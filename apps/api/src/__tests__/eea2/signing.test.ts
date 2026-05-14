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
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
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
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
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

function jsonHeaders(tenantId: string, userId: string, role: TestRole = 'EE_MANAGER') {
  return {
    authorization: `Bearer ${issueJwt(tenantId, userId, role)}`,
    'content-type': 'application/json',
  }
}

interface DraftResponse {
  id: string
  status: string
}

interface DraftListResponse {
  drafts: DraftResponse[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertDraftResponse(value: unknown): asserts value is DraftResponse {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.status !== 'string') {
    throw new Error('Expected draft response body')
  }
}

function assertDraftListResponse(value: unknown): asserts value is DraftListResponse {
  if (!isRecord(value) || !Array.isArray(value.drafts)) {
    throw new Error('Expected draft list response body')
  }
  for (const draft of value.drafts) {
    assertDraftResponse(draft)
  }
}

describe('EEA2 draft routes', () => {
  it('supports draft create, read, status, state patch, and PUT lifecycle mutations', async () => {
    const tenantId = await createTestTenant('EEA2 draft lifecycle')
    const userId = await seedUser(tenantId, { role: 'EE_MANAGER' })
    const headers = jsonHeaders(tenantId, userId)

    const invalidCreate = await app.inject({
      method: 'POST',
      url: '/eea2',
      headers,
      body: JSON.stringify({ reportingYear: 1999 }),
    })
    expect(invalidCreate.statusCode).toBe(400)

    const createResponse = await app.inject({
      method: 'POST',
      url: '/eea2',
      headers,
      body: JSON.stringify({ reportingYear: 2027, state: { sectionA: { complete: true } } }),
    })
    expect(createResponse.statusCode).toBe(201)
    const created: unknown = createResponse.json()
    assertDraftResponse(created)
    expect(created.status).toBe('draft')

    const listResponse = await app.inject({ method: 'GET', url: '/eea2', headers })
    expect(listResponse.statusCode).toBe(200)
    const listBody: unknown = listResponse.json()
    assertDraftListResponse(listBody)
    expect(listBody.drafts).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: created.id })]),
    )

    const readResponse = await app.inject({ method: 'GET', url: `/eea2/${created.id}`, headers })
    expect(readResponse.statusCode).toBe(200)
    expect(readResponse.json()).toMatchObject({ id: created.id, status: 'draft' })

    const missingRead = await app.inject({
      method: 'GET',
      url: `/eea2/${randomUUID()}`,
      headers,
    })
    expect(missingRead.statusCode).toBe(404)

    const statePatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${created.id}/draft/state`,
      headers,
      body: JSON.stringify({
        stepId: 'section-b',
        sectionKey: 'sectionB',
        state: { sectionB: { total: 12 } },
        completedSteps: ['section-a', 'section-b'],
      }),
    })
    expect(statePatch.statusCode).toBe(200)
    expect(statePatch.json()).toEqual({ status: 'draft' })

    const statusPatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${created.id}/status`,
      headers,
      body: JSON.stringify({ status: 'pending_ceo' }),
    })
    expect(statusPatch.statusCode).toBe(200)
    expect(statusPatch.json()).toEqual({ status: 'pending_ceo' })

    const genericPatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${created.id}`,
      headers,
      body: JSON.stringify({ status: 'draft', state: { sectionC: { complete: true } } }),
    })
    expect(genericPatch.statusCode).toBe(200)
    expect(genericPatch.json()).toEqual({ status: 'draft' })

    const putResponse = await app.inject({
      method: 'PUT',
      url: `/eea2/${created.id}`,
      headers,
      body: JSON.stringify({ state: { sectionD: { complete: true } } }),
    })
    expect(putResponse.statusCode).toBe(200)
    expect(putResponse.json()).toEqual({ status: 'draft' })

    const draft = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
      return tx.eea2Draft.findUnique({ where: { id: created.id } })
    })
    expect(draft?.state).toMatchObject({
      sectionA: { complete: true },
      sectionB: { total: 12 },
      sectionC: { complete: true },
      sectionD: { complete: true },
      completedSteps: ['section-a', 'section-b'],
    })
  })

  it('returns route-specific errors for missing, invalid, and immutable draft mutations', async () => {
    const tenantId = await createTestTenant('EEA2 draft route errors')
    const userId = await seedUser(tenantId, { role: 'EE_MANAGER' })
    const headers = jsonHeaders(tenantId, userId)
    const draftId = await seedDraft(tenantId, 'draft')
    const signedTenantId = await createTestTenant('EEA2 signed route errors')
    const signedDraftId = await seedDraft(signedTenantId, 'signed')
    const signedUserId = await seedUser(signedTenantId, { role: 'EE_MANAGER' })
    const signedHeaders = jsonHeaders(signedTenantId, signedUserId)

    const invalidStatePatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${draftId}/draft/state`,
      headers,
      body: JSON.stringify({ stepId: '', sectionKey: 'sectionA', state: {} }),
    })
    expect(invalidStatePatch.statusCode).toBe(400)

    const missingStatePatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${randomUUID()}/draft/state`,
      headers,
      body: JSON.stringify({ stepId: 'section-a', sectionKey: 'sectionA', state: {} }),
    })
    expect(missingStatePatch.statusCode).toBe(404)

    const immutableStatePatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${signedDraftId}/draft/state`,
      headers: signedHeaders,
      body: JSON.stringify({ stepId: 'section-a', sectionKey: 'sectionA', state: {} }),
    })
    expect(immutableStatePatch.statusCode).toBe(409)

    const invalidStatusPatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${draftId}/status`,
      headers,
      body: JSON.stringify({ status: 'signed' }),
    })
    expect(invalidStatusPatch.statusCode).toBe(400)

    const missingStatusPatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${randomUUID()}/status`,
      headers,
      body: JSON.stringify({ status: 'draft' }),
    })
    expect(missingStatusPatch.statusCode).toBe(404)

    const invalidPatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${draftId}`,
      headers,
      body: JSON.stringify({ status: 'signed' }),
    })
    expect(invalidPatch.statusCode).toBe(400)

    const missingPatch = await app.inject({
      method: 'PATCH',
      url: `/eea2/${randomUUID()}`,
      headers,
      body: JSON.stringify({ state: {} }),
    })
    expect(missingPatch.statusCode).toBe(404)

    const invalidPut = await app.inject({
      method: 'PUT',
      url: `/eea2/${draftId}`,
      headers,
      body: JSON.stringify({ status: 'signed' }),
    })
    expect(invalidPut.statusCode).toBe(400)

    const missingPut = await app.inject({
      method: 'PUT',
      url: `/eea2/${randomUUID()}`,
      headers,
      body: JSON.stringify({ state: {} }),
    })
    expect(missingPut.statusCode).toBe(404)

    const immutablePut = await app.inject({
      method: 'PUT',
      url: `/eea2/${signedDraftId}`,
      headers: signedHeaders,
      body: JSON.stringify({ state: {} }),
    })
    expect(immutablePut.statusCode).toBe(409)
  })
})

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
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
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

  it('does not allow generic draft mutation routes to sign the form', async () => {
    const tenantId = await createTestTenant('EEA2 sign bypass')
    const userId = await seedUser(tenantId, { role: 'EE_MANAGER' })
    const formId = await seedDraft(tenantId, 'pending_ceo')

    const responses = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/eea2/${formId}/status`,
        headers: {
          authorization: `Bearer ${issueJwt(tenantId, userId, 'EE_MANAGER')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'signed' }),
      }),
      app.inject({
        method: 'PATCH',
        url: `/eea2/${formId}`,
        headers: {
          authorization: `Bearer ${issueJwt(tenantId, userId, 'EE_MANAGER')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'signed' }),
      }),
      app.inject({
        method: 'PUT',
        url: `/eea2/${formId}`,
        headers: {
          authorization: `Bearer ${issueJwt(tenantId, userId, 'EE_MANAGER')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ status: 'signed' }),
      }),
    ])

    expect(responses.map((response) => response.statusCode)).toEqual([400, 400, 400])
    const draft = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
      return tx.eea2Draft.findUnique({ where: { id: formId } })
    })
    expect(draft?.status).toBe('pending_ceo')
  })
})

describe('POST /eea2/:formId/reject', () => {
  it('returns validation, missing-draft, and wrong-status errors', async () => {
    const tenantId = await createTestTenant('EEA2 reject errors')
    const signerId = await seedUser(tenantId, { role: 'CEO' })
    const draftId = await seedDraft(tenantId, 'draft')
    const headers = jsonHeaders(tenantId, signerId, 'CEO')

    const invalidBody = await app.inject({
      method: 'POST',
      url: `/eea2/${draftId}/reject`,
      headers,
      body: JSON.stringify({ reason: 'too short' }),
    })
    expect(invalidBody.statusCode).toBe(400)

    const missingDraft = await app.inject({
      method: 'POST',
      url: `/eea2/${randomUUID()}/reject`,
      headers,
      body: JSON.stringify({ reason: 'This rejection reason is long enough.' }),
    })
    expect(missingDraft.statusCode).toBe(404)

    const wrongStatus = await app.inject({
      method: 'POST',
      url: `/eea2/${draftId}/reject`,
      headers,
      body: JSON.stringify({ reason: 'This rejection reason is long enough.' }),
    })
    expect(wrongStatus.statusCode).toBe(409)
  })

  it('returns a pending form to draft even when no EE managers exist', async () => {
    const tenantId = await createTestTenant('EEA2 reject without manager')
    const signerId = await seedUser(tenantId, { role: 'CEO' })
    const formId = await seedDraft(tenantId, 'pending_ceo')

    const response = await app.inject({
      method: 'POST',
      url: `/eea2/${formId}/reject`,
      headers: jsonHeaders(tenantId, signerId, 'CEO'),
      body: JSON.stringify({ reason: 'The CEO requires a corrected Section H narrative.' }),
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'draft' })
    const notifications = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
      return tx.notification.findMany({ where: { tenantId } })
    })
    expect(notifications).toHaveLength(0)
  })

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
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
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

    const patchAfterRejection = await app.inject({
      method: 'PATCH',
      url: `/eea2/${formId}`,
      headers: {
        authorization: `Bearer ${issueJwt(tenantId, eeManagerId, 'EE_MANAGER')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ state: { sectionH: { rejectionAddressed: true } } }),
    })

    expect(patchAfterRejection.statusCode).toBe(200)
    expect(patchAfterRejection.json()).toEqual({ status: 'draft' })
  })
})
