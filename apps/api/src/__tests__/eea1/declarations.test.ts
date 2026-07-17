import { randomUUID } from 'node:crypto'
import { PII_FIELD_PATHS } from '@simplifi/shared/eea/pii-fields'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { config } from '../../config.js'
import { Prisma } from '../../generated/prisma/client.js'
import { decrypt } from '../../lib/crypto.js'
import { prisma } from '../../lib/prisma.js'
import { eea1DeclarationsRoutes } from '../../routes/eea1/declarations.js'
import { createTestTenant, type TestRole } from '../helpers/tenant.js'

interface EEA1PostResponse {
  id: string
}

interface RawEea1Row {
  id: string
  race: string | null
  declarationDate: Date | string
}

interface RawCountRow {
  count: number
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.addHook('onRequest', async (request, reply) => {
    const auth = request.headers.authorization
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing Authorization header' })
    }

    const payload = jwt.verify(auth.slice(7), config.SESSION_SECRET) as { tenantId?: unknown }
    if (typeof payload.tenantId !== 'string') {
      return reply.status(401).send({ error: 'Token missing valid tenantId claim' })
    }

    await prisma.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${payload.tenantId}'`)
  })
  eea1DeclarationsRoutes(app)
  await app.ready()
}, 30_000)

afterEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE eea_events, eea1_declarations, tenants CASCADE')
})

afterAll(async () => {
  await app.close()
})

function issueJwt(tenantId: string, sub: string, role: TestRole = 'EE_MANAGER'): string {
  return jwt.sign(
    {
      sub,
      tenantId,
      email: `${sub}@simplifi.test`,
      role,
      totpVerified: true,
      tokenType: 'access',
      jti: randomUUID(),
    },
    config.SESSION_SECRET,
    { expiresIn: 900 },
  )
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

function dateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0] ?? ''
  }
  return value.slice(0, 10)
}

function buildDeclarationBody(employeeId: string): Record<string, unknown> {
  return {
    employeeId,
    name: 'Test Employee',
    workplaceNumber: 'WP-001',
    race: 'African',
    gender: 'Female',
    disability: 'No',
    foreignNational: false,
    signatureDataUrl: 'data:image/png;base64,SIGNATURE',
    declarationDate: '2020-01-01',
  }
}

async function seedDeclaration(tenantId: string, employeeId: string): Promise<string> {
  const id = randomUUID()

  await prisma.eea1Declaration.create({
    data: {
      id,
      tenantId,
      employeeId,
      name: 'Seed Employee',
      workplaceNumber: 'WP-SEED',
      race: 'White',
      gender: 'Male',
      disability: 'No',
      foreignNational: false,
      signatureDataUrl: 'data:image/png;base64,SEEDED',
      declarationDate: new Date(`${todayIso()}T00:00:00.000Z`),
    },
  })

  return id
}

async function postDeclaration(
  tenantId: string,
  employeeId: string,
  body: Record<string, unknown>,
) {
  return app.inject({
    method: 'POST',
    url: '/eea1',
    headers: {
      authorization: `Bearer ${issueJwt(tenantId, employeeId)}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('EEA1 declaration routes', () => {
  it('encrypts race when POST /eea1 receives a demographic value', async () => {
    const tenantId = await createTestTenant('EEA1 POST encryption')
    const employeeId = randomUUID()

    const response = await postDeclaration(tenantId, employeeId, buildDeclarationBody(employeeId))

    expect(response.statusCode).toBe(201)
    const created = response.json<EEA1PostResponse>()

    const rows = await prisma.$queryRaw<RawEea1Row[]>`
      SELECT id, race, "declarationDate"
      FROM eea1_declarations
      WHERE id = CAST(${created.id} AS uuid)
    `

    expect(rows).toHaveLength(1)
    const row = rows[0]
    if (row === undefined) throw new Error('Expected created EEA1 row')

    expect(row.race).not.toBe('African')
    if (row.race === null) throw new Error('Expected encrypted race ciphertext')
    expect(decrypt(row.race)).toBe('African')
  })

  it('returns 403 for cross-employee GET in the same tenant', async () => {
    const tenantId = await createTestTenant('EEA1 cross-employee')
    const ownerId = randomUUID()
    const otherUserId = randomUUID()
    const declarationId = await seedDeclaration(tenantId, ownerId)

    const response = await app.inject({
      method: 'GET',
      url: `/eea1/${declarationId}`,
      headers: { authorization: `Bearer ${issueJwt(tenantId, otherUserId)}` },
    })

    expect(response.statusCode).toBe(403)
  })

  it('returns 404 for cross-tenant GET because RLS hides the row', async () => {
    const tenantAId = await createTestTenant('EEA1 tenant A')
    const tenantBId = await createTestTenant('EEA1 tenant B')
    const employeeId = randomUUID()
    const declarationId = await seedDeclaration(tenantAId, employeeId)

    const response = await app.inject({
      method: 'GET',
      url: `/eea1/${declarationId}`,
      headers: { authorization: `Bearer ${issueJwt(tenantBId, employeeId)}` },
    })

    expect(response.statusCode).toBe(404)
  })

  it('rejects PATCH bodies that contain race', async () => {
    const tenantId = await createTestTenant('EEA1 PATCH PII reject')
    const employeeId = randomUUID()
    const declarationId = await seedDeclaration(tenantId, employeeId)

    const response = await app.inject({
      method: 'PATCH',
      url: `/eea1/${declarationId}`,
      headers: {
        authorization: `Bearer ${issueJwt(tenantId, employeeId)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ race: 'African' }),
    })

    expect(response.statusCode).toBe(400)
  })

  it("overwrites client-supplied declarationDate with today's date on POST", async () => {
    const tenantId = await createTestTenant('EEA1 declaration date')
    const employeeId = randomUUID()

    const response = await postDeclaration(tenantId, employeeId, {
      ...buildDeclarationBody(employeeId),
      declarationDate: '2020-01-01',
    })

    expect(response.statusCode).toBe(201)
    const created = response.json<EEA1PostResponse>()

    const rows = await prisma.$queryRaw<RawEea1Row[]>`
      SELECT id, race, "declarationDate"
      FROM eea1_declarations
      WHERE id = CAST(${created.id} AS uuid)
    `

    const row = rows[0]
    if (row === undefined) throw new Error('Expected created EEA1 row')

    expect(dateOnly(row.declarationDate)).toBe(todayIso())
    expect(dateOnly(row.declarationDate)).not.toBe('2020-01-01')
  })

  it('records non-PII autosave events but no PII field paths', async () => {
    const tenantId = await createTestTenant('EEA1 events PII check')
    const employeeId = randomUUID()
    const declarationId = await seedDeclaration(tenantId, employeeId)

    const response = await app.inject({
      method: 'PATCH',
      url: `/eea1/${declarationId}`,
      headers: {
        authorization: `Bearer ${issueJwt(tenantId, employeeId)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Updated Employee' }),
    })

    expect(response.statusCode).toBe(200)

    const nameRows = await prisma.$queryRaw<RawCountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM eea_events
      WHERE "formId" = CAST(${declarationId} AS uuid)
        AND "fieldPath" = 'name'
    `

    const piiRows = await prisma.$queryRaw<RawCountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM eea_events
      WHERE "formId" = CAST(${declarationId} AS uuid)
        AND "fieldPath" IN (${Prisma.join(PII_FIELD_PATHS)})
    `

    expect(nameRows[0]?.count).toBe(1)
    expect(piiRows[0]?.count).toBe(0)
  })
})
