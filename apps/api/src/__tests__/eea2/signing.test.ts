import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import * as OTPAuth from 'otpauth'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { config } from '../../config.js'
import { prisma } from '../../lib/prisma.js'
import { eea2Routes } from '../../routes/eea2.routes.js'
import { createTestTenant, type TestRole } from '../helpers/tenant.js'

const TOTP_SECRET = 'US3WHSG7X5KAPV27VANWKQHF3SH3HULL'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.addHook('onRequest', async (request, reply) => {
    const auth = request.headers.authorization
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing Authorization header' })
    }

    const payload = jwt.verify(auth.slice(7), config.SESSION_SECRET) as {
      sub: string
      tenantId: string
      email: string
      role: string
      totpVerified: boolean
      tokenType: 'access'
      jti: string
    }
    request.user = payload
    await prisma.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${payload.tenantId}'`)
  })
  eea2Routes(app)
  await app.ready()
}, 30_000)

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE notifications, eea_events, eea2_drafts, users, tenants CASCADE',
  )
})

afterAll(async () => {
  await app.close()
})

function issueJwt(tenantId: string, userId: string, role: TestRole = 'CEO'): string {
  return jwt.sign(
    {
      sub: userId,
      tenantId,
      email: `${userId}@simplifi.test`,
      role,
      totpVerified: true,
      tokenType: 'access',
      jti: randomUUID(),
    },
    config.SESSION_SECRET,
    { expiresIn: 900 },
  )
}

function currentTotp(): string {
  return new OTPAuth.TOTP({ secret: TOTP_SECRET }).generate()
}

async function seedUser(
  tenantId: string,
  input: { role?: TestRole; name?: string | null; totpSecret?: string | null } = {},
): Promise<string> {
  const id = randomUUID()
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`
    await tx.user.create({
      data: {
        id,
        tenantId,
        email: `${id}@simplifi.test`,
        name: input.name ?? 'Rivaan Pillay',
        passwordHash: 'test-hash',
        role: input.role ?? 'CEO',
        totpSecret: input.totpSecret ?? TOTP_SECRET,
      },
    })
  })
  return id
}

async function seedDraft(tenantId: string, status: string): Promise<string> {
  const id = randomUUID()
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`
    await tx.eea2Draft.create({
      data: {
        id,
        tenantId,
        reportingYear: 2026,
        status,
        state: { completedSteps: ['section-a'] },
      },
    })
  })
  return id
}

async function postSign(
  tenantId: string,
  userId: string,
  formId: string,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: `/eea2/${formId}/sign`,
    headers: {
      authorization: `Bearer ${issueJwt(tenantId, userId)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /eea2/:formId/sign', () => {
  it('returns 403 for a wrong TOTP code without leaking totpSecret', async () => {
    const tenantId = await createTestTenant('EEA2 sign wrong TOTP')
    const userId = await seedUser(tenantId)
    const formId = await seedDraft(tenantId, 'pending_ceo')

    const response = await postSign(tenantId, userId, formId, {
      totpCode: '000000',
      typedName: 'Rivaan Pillay',
      confirmationChecked: true,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Invalid TOTP code' })
    expect(response.body).not.toContain(TOTP_SECRET)
  })

  it('returns 403 when the typed name does not match the registered user name', async () => {
    const tenantId = await createTestTenant('EEA2 sign name mismatch')
    const userId = await seedUser(tenantId, { name: 'Rivaan Pillay' })
    const formId = await seedDraft(tenantId, 'pending_ceo')

    const response = await postSign(tenantId, userId, formId, {
      totpCode: currentTotp(),
      typedName: 'Different Person',
      confirmationChecked: true,
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({ error: 'Name does not match' })
  })

  it('writes EEA2_SIGNED before setting the draft status to signed', async () => {
    const tenantId = await createTestTenant('EEA2 sign success')
    const userId = await seedUser(tenantId)
    const formId = await seedDraft(tenantId, 'pending_ceo')

    const response = await postSign(tenantId, userId, formId, {
      totpCode: currentTotp(),
      typedName: 'rivaan pillay',
      confirmationChecked: true,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'signed' })

    const [event, draft] = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`
      return Promise.all([
        tx.eeaEvent.findFirst({ where: { tenantId, formId, eventType: 'EEA2_SIGNED' } }),
        tx.eea2Draft.findUnique({ where: { id: formId } }),
      ])
    })

    expect(event?.metadata).toMatchObject({
      userId,
      totpVerified: true,
      typedName: 'rivaan pillay',
    })
    expect(JSON.stringify(event)).not.toContain(TOTP_SECRET)
    expect(draft?.status).toBe('signed')
  })

  it('returns 409 before mutating a signed draft', async () => {
    const tenantId = await createTestTenant('EEA2 immutable draft')
    const userId = await seedUser(tenantId, { role: 'EE_MANAGER' })
    const formId = await seedDraft(tenantId, 'signed')

    const response = await app.inject({
      method: 'PATCH',
      url: `/eea2/${formId}`,
      headers: {
        authorization: `Bearer ${issueJwt(tenantId, userId, 'EE_MANAGER')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ state: { sectionA: { primaryContactName: 'Changed' } } }),
    })

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({ error: 'Form is immutable' })
  })
})

describe('POST /eea2/:formId/reject', () => {
  it('returns the form to draft and notifies all EE managers in the tenant', async () => {
    const tenantId = await createTestTenant('EEA2 reject')
    const signerId = await seedUser(tenantId, { role: 'SENIOR_MANAGER' })
    const eeManagerId = await seedUser(tenantId, { role: 'EE_MANAGER' })
    const formId = await seedDraft(tenantId, 'pending_ceo')
    const reason = 'The CEO found material inconsistencies in Section H.'

    const response = await app.inject({
      method: 'POST',
      url: `/eea2/${formId}/reject`,
      headers: {
        authorization: `Bearer ${issueJwt(tenantId, signerId, 'SENIOR_MANAGER')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'draft' })

    const [draft, notification, event] = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`
      return Promise.all([
        tx.eea2Draft.findUnique({ where: { id: formId } }),
        tx.notification.findFirst({ where: { tenantId, userId: eeManagerId } }),
        tx.eeaEvent.findFirst({ where: { tenantId, formId, eventType: 'EEA2_REJECTED' } }),
      ])
    })

    expect(draft?.status).toBe('draft')
    expect(event?.metadata).toMatchObject({ userId: signerId, reason })
    expect(notification).toMatchObject({
      role: 'EE_MANAGER',
      message: `EEA2 rejected: ${reason}`,
      read: false,
    })
  })
})
