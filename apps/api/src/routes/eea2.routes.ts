import type { FastifyInstance } from 'fastify'
import * as OTPAuth from 'otpauth'
import { z } from 'zod'
import type { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { requireJwt, requireRole, requireTenant } from '../plugins/auth.js'

const SIGNING_ROLES = ['CEO', 'SENIOR_MANAGER']

const signBodySchema = z
  .object({
    totpCode: z.string().length(6),
    typedName: z.string().min(1),
    confirmationChecked: z.boolean(),
  })
  .strict()

const rejectBodySchema = z
  .object({
    reason: z.string().min(20),
  })
  .strict()

const statusBodySchema = z
  .object({
    status: z.enum(['draft', 'pending_ceo', 'submitted']),
  })
  .strict()

const draftStateBodySchema = z
  .object({
    stepId: z.string().min(1),
    sectionKey: z.string().min(1),
    state: z.record(z.string(), z.unknown()),
    completedSteps: z.array(z.string()).optional(),
  })
  .strict()

const patchDraftBodySchema = z
  .object({
    state: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(['draft', 'pending_ceo', 'submitted']).optional(),
  })
  .strict()

// tenantId is accepted for the frontend's convenience but is NEVER used to scope
// data — the authoritative tenant comes from the verified JWT (request.user).
const prefillQuerySchema = z.object({
  tenantId: z.uuid().optional(),
  reportingYear: z.coerce.number().int().min(2000).max(2100),
})

type JsonObject = Record<string, unknown>

function asJsonObject(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

type TenantTransaction = Prisma.TransactionClient

async function setTenantContext(tx: TenantTransaction, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
}

async function findDraftForMutation(tx: TenantTransaction, formId: string, tenantId: string) {
  return tx.eea2Draft.findFirst({
    where: { id: formId, tenantId },
    select: { id: true, status: true, state: true },
  })
}

function getUserId(requestUser: { sub: string; userId?: unknown }): string {
  return typeof requestUser.userId === 'string' && requestUser.userId.length > 0
    ? requestUser.userId
    : requestUser.sub
}

export function eea2Routes(app: FastifyInstance): void {
  app.get('/eea2', async (request, reply) => {
    const drafts = await prisma.$transaction(async (tx) => {
      await setTenantContext(tx, request.user.tenantId)
      return tx.eea2Draft.findMany({
        where: { tenantId: request.user.tenantId },
        orderBy: { updatedAt: 'desc' },
      })
    })

    return reply.status(200).send({ drafts })
  })

  // GET /eea2/prefill — Section A pre-fill from the prior year's employer profile.
  // Static route resolves ahead of /eea2/:id in the radix router. Returns only
  // employer details (never workforce or remuneration data — Decisions Log
  // 2026-03-23). barrierCategories is empty until a server-side barrier store
  // exists (barriers currently live in EEA12/EEA2 draft state).
  app.get<{ Querystring: Record<string, unknown> }>('/eea2/prefill', async (request, reply) => {
    const parsed = prefillQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query parameters' })
    }

    const { reportingYear } = parsed.data
    const tenantId = request.user.tenantId

    const employerProfile = await prisma.$transaction(async (tx) => {
      await setTenantContext(tx, tenantId)
      const priorYear = await tx.employerProfile.findFirst({
        where: { tenantId, reportingYear: reportingYear - 1 },
      })
      if (priorYear !== null) {
        return priorYear
      }
      // Fall back to the most recent profile before the requested year (e.g. a
      // gap year), so a returning employer still pre-fills Section A.
      return tx.employerProfile.findFirst({
        where: { tenantId, reportingYear: { lt: reportingYear } },
        orderBy: { reportingYear: 'desc' },
      })
    })

    return reply.status(200).send({ employerProfile, barrierCategories: [] })
  })

  app.get<{ Params: { id: string } }>('/eea2/:id', async (request, reply) => {
    const draft = await prisma.$transaction(async (tx) => {
      await setTenantContext(tx, request.user.tenantId)
      return tx.eea2Draft.findFirst({
        where: { id: request.params.id, tenantId: request.user.tenantId },
      })
    })

    if (draft === null) {
      return reply.status(404).send({ error: 'Draft not found' })
    }

    return reply.status(200).send(draft)
  })

  app.post<{ Body: unknown }>('/eea2', async (request, reply) => {
    const body = z
      .object({
        reportingYear: z.number().int().min(2000).max(2100),
        state: z.record(z.string(), z.unknown()).default({}),
      })
      .strict()
      .safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid request body' })
    }

    const draft = await prisma.$transaction(async (tx) => {
      await setTenantContext(tx, request.user.tenantId)
      return tx.eea2Draft.create({
        data: {
          tenantId: request.user.tenantId,
          reportingYear: body.data.reportingYear,
          state: body.data.state as Prisma.InputJsonValue,
        },
      })
    })

    return reply.status(201).send(draft)
  })

  app.patch<{ Params: { formId: string }; Body: unknown }>(
    '/eea2/:formId/draft/state',
    async (request, reply) => {
      const { formId } = request.params
      const tenantId = request.user.tenantId
      return prisma.$transaction(async (tx) => {
        await setTenantContext(tx, tenantId)
        const draft = await findDraftForMutation(tx, formId, tenantId)

        if (draft === null) {
          return reply.status(404).send({ error: 'Draft not found' })
        }

        if (draft.status === 'signed') {
          return reply.status(409).send({ error: 'Form is immutable' })
        }

        const parsed = draftStateBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send({ error: 'Invalid request body' })
        }

        const nextState = {
          ...asJsonObject(draft.state),
          ...parsed.data.state,
          ...(parsed.data.completedSteps === undefined
            ? {}
            : { completedSteps: parsed.data.completedSteps }),
        }

        await tx.eea2Draft.update({
          where: { id: formId },
          data: { state: nextState as Prisma.InputJsonValue },
        })

        return reply.status(200).send({ status: draft.status })
      })
    },
  )

  app.patch<{ Params: { formId: string }; Body: unknown }>(
    '/eea2/:formId/status',
    async (request, reply) => {
      const { formId } = request.params
      const tenantId = request.user.tenantId
      return prisma.$transaction(async (tx) => {
        await setTenantContext(tx, tenantId)
        const draft = await findDraftForMutation(tx, formId, tenantId)

        if (draft === null) {
          return reply.status(404).send({ error: 'Draft not found' })
        }

        if (draft.status === 'signed') {
          return reply.status(409).send({ error: 'Form is immutable' })
        }

        const parsed = statusBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send({ error: 'Invalid request body' })
        }

        await tx.eea2Draft.update({
          where: { id: formId },
          data: { status: parsed.data.status },
        })

        return reply.status(200).send({ status: parsed.data.status })
      })
    },
  )

  app.patch<{ Params: { formId: string }; Body: unknown }>(
    '/eea2/:formId',
    async (request, reply) => {
      const { formId } = request.params
      const tenantId = request.user.tenantId
      return prisma.$transaction(async (tx) => {
        await setTenantContext(tx, tenantId)
        const draft = await findDraftForMutation(tx, formId, tenantId)

        if (draft === null) {
          return reply.status(404).send({ error: 'Draft not found' })
        }

        if (draft.status === 'signed') {
          return reply.status(409).send({ error: 'Form is immutable' })
        }

        const parsed = patchDraftBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send({ error: 'Invalid request body' })
        }

        const data: Prisma.Eea2DraftUpdateInput = {}
        if (parsed.data.status !== undefined) {
          data.status = parsed.data.status
        }
        if (parsed.data.state !== undefined) {
          data.state = {
            ...asJsonObject(draft.state),
            ...parsed.data.state,
          } as Prisma.InputJsonValue
        }

        await tx.eea2Draft.update({ where: { id: formId }, data })

        return reply.status(200).send({ status: parsed.data.status ?? draft.status })
      })
    },
  )

  app.put<{ Params: { id: string }; Body: unknown }>('/eea2/:id', async (request, reply) => {
    return prisma.$transaction(async (tx) => {
      await setTenantContext(tx, request.user.tenantId)
      const draft = await findDraftForMutation(tx, request.params.id, request.user.tenantId)

      if (draft === null) {
        return reply.status(404).send({ error: 'Draft not found' })
      }

      if (draft.status === 'signed') {
        return reply.status(409).send({ error: 'Form is immutable' })
      }

      const parsed = patchDraftBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }

      await tx.eea2Draft.update({
        where: { id: request.params.id },
        data: {
          ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
          ...(parsed.data.state === undefined
            ? {}
            : {
                state: {
                  ...asJsonObject(draft.state),
                  ...parsed.data.state,
                } as Prisma.InputJsonValue,
              }),
        },
      })

      return reply.status(200).send({ status: parsed.data.status ?? draft.status })
    })
  })

  app.post<{ Params: { formId: string }; Body: unknown }>(
    '/eea2/:formId/sign',
    {
      preHandler: [requireJwt, requireTenant, requireRole(SIGNING_ROLES)],
    },
    async (request, reply) => {
      const parsed = signBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }

      const body = parsed.data
      if (!body.confirmationChecked) {
        return reply.status(400).send({ error: 'Confirmation is required' })
      }

      return prisma.$transaction(async (tx) => {
        await setTenantContext(tx, request.user.tenantId)
        const userId = getUserId(request.user)
        const user = await tx.user.findFirst({
          where: { id: userId, tenantId: request.user.tenantId },
          select: { id: true, name: true, totpSecret: true },
        })

        if (user === null) {
          return reply.status(403).send({ error: 'User not found' })
        }

        if (user.totpSecret === null) {
          return reply.status(403).send({ error: 'TOTP not configured' })
        }

        const totp = new OTPAuth.TOTP({ secret: user.totpSecret })
        const valid = totp.validate({ token: body.totpCode, window: 1 }) !== null
        if (!valid) {
          return reply.status(403).send({ error: 'Invalid TOTP code' })
        }

        const draft = await tx.eea2Draft.findFirst({
          where: { id: request.params.formId, tenantId: request.user.tenantId },
          select: { id: true, status: true },
        })

        if (draft === null) {
          return reply.status(404).send({ error: 'Draft not found' })
        }

        if (draft.status === 'signed') {
          return reply.status(409).send({ error: 'Form is immutable' })
        }

        if (body.typedName.toLowerCase() !== (user.name ?? '').toLowerCase()) {
          return reply.status(403).send({ error: 'Name does not match' })
        }

        await tx.eeaEvent.create({
          data: {
            tenantId: request.user.tenantId,
            formType: 'EEA2',
            formId: request.params.formId,
            eventType: 'EEA2_SIGNED',
            metadata: {
              userId: user.id,
              totpVerified: true,
              typedName: body.typedName,
            },
          },
        })
        await tx.eea2Draft.update({
          where: { id: request.params.formId },
          data: { status: 'signed' },
        })

        return reply.status(200).send({ status: 'signed' })
      })
    },
  )

  app.post<{ Params: { formId: string }; Body: unknown }>(
    '/eea2/:formId/reject',
    {
      preHandler: [requireJwt, requireTenant, requireRole(SIGNING_ROLES)],
    },
    async (request, reply) => {
      const parsed = rejectBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }

      const { formId } = request.params
      const tenantId = request.user.tenantId
      const userId = getUserId(request.user)
      return prisma.$transaction(async (tx) => {
        await setTenantContext(tx, tenantId)
        const draft = await tx.eea2Draft.findFirst({
          where: { id: formId, tenantId },
          select: { id: true, status: true },
        })

        if (draft === null) {
          return reply.status(404).send({ error: 'Draft not found' })
        }

        if (draft.status !== 'pending_ceo') {
          return reply.status(409).send({ error: 'Form is not pending CEO signing' })
        }

        const eeManagers = await tx.user.findMany({
          where: { tenantId, role: 'EE_MANAGER' },
          select: { id: true },
        })

        await tx.eeaEvent.create({
          data: {
            tenantId,
            formType: 'EEA2',
            formId,
            eventType: 'EEA2_REJECTED',
            metadata: {
              userId,
              reason: parsed.data.reason,
            },
          },
        })
        await tx.eea2Draft.update({
          where: { id: formId },
          data: { status: 'draft' },
        })
        if (eeManagers.length > 0) {
          await tx.notification.createMany({
            data: eeManagers.map((user) => ({
              tenantId,
              userId: user.id,
              role: 'EE_MANAGER',
              message: `EEA2 rejected: ${parsed.data.reason}`,
              read: false,
            })),
          })
        }

        return reply.status(200).send({ status: 'draft' })
      })
    },
  )
}
