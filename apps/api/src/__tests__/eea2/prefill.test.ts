import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { config } from '../../config.js'
import { prisma } from '../../lib/prisma.js'
import { eea2Routes } from '../../routes/eea2.routes.js'
import { createTestTenant, getTestJwt } from '../helpers/tenant.js'

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
    'TRUNCATE TABLE employer_profiles, notifications, eea_events, eea2_drafts, users, tenants CASCADE',
  )
})

afterAll(async () => {
  await app.close()
})

async function seedEmployerProfile(
  tenantId: string,
  reportingYear: number,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    await tx.employerProfile.create({
      data: {
        tenantId,
        reportingYear,
        registeredName: 'Acme (Pty) Ltd',
        companyRegNumber: '2018/123456/07',
        province: 'Western Cape',
        physicalAddress: '1 Long Street',
        city: 'Cape Town',
        postalCode: '8001',
        sectorCode: 'AGRI',
        totalEmployees: 120,
        contactPersonName: 'Thandi Nkosi',
        contactDesignation: 'HR Director',
        ...overrides,
      },
    })
  })
}

interface PrefillResponse {
  employerProfile: {
    reportingYear: number
    companyRegNumber: string | null
    sectorCode: string
    province: string
    totalEmployees: number
  } | null
  barrierCategories: unknown[]
}

function asPrefill(value: unknown): PrefillResponse {
  if (typeof value !== 'object' || value === null || !('employerProfile' in value)) {
    throw new Error('Expected prefill response body')
  }
  return value as PrefillResponse
}

function getPrefill(tenantId: string, reportingYear: number) {
  return app.inject({
    method: 'GET',
    url: `/eea2/prefill?tenantId=${tenantId}&reportingYear=${String(reportingYear)}`,
    headers: { authorization: `Bearer ${getTestJwt(tenantId)}` },
  })
}

describe('GET /eea2/prefill', () => {
  it("returns the prior year's employer profile for Section A pre-fill", async () => {
    const tenantId = await createTestTenant('prefill prior year')
    await seedEmployerProfile(tenantId, 2025, { totalEmployees: 137 })

    const response = await getPrefill(tenantId, 2026)

    expect(response.statusCode).toBe(200)
    const body = asPrefill(response.json())
    expect(body.employerProfile).toMatchObject({
      reportingYear: 2025,
      companyRegNumber: '2018/123456/07',
      sectorCode: 'AGRI',
      province: 'Western Cape',
      totalEmployees: 137,
    })
    expect(body.barrierCategories).toEqual([])
  })

  it('falls back to the most recent earlier profile when the prior year is missing', async () => {
    const tenantId = await createTestTenant('prefill gap year')
    await seedEmployerProfile(tenantId, 2022)
    await seedEmployerProfile(tenantId, 2023, { totalEmployees: 90 })

    const response = await getPrefill(tenantId, 2026)

    expect(response.statusCode).toBe(200)
    expect(asPrefill(response.json()).employerProfile).toMatchObject({
      reportingYear: 2023,
      totalEmployees: 90,
    })
  })

  it('returns a null profile when the tenant has never filed', async () => {
    const tenantId = await createTestTenant('prefill first year')

    const response = await getPrefill(tenantId, 2026)

    expect(response.statusCode).toBe(200)
    expect(asPrefill(response.json()).employerProfile).toBeNull()
  })

  it('rejects a request without a valid reporting year', async () => {
    const tenantId = await createTestTenant('prefill bad query')

    const response = await app.inject({
      method: 'GET',
      url: '/eea2/prefill',
      headers: { authorization: `Bearer ${getTestJwt(tenantId)}` },
    })

    expect(response.statusCode).toBe(400)
  })

  it('never leaks another tenant profile — scoping ignores the query tenantId', async () => {
    const tenantA = await createTestTenant('prefill tenant A')
    const tenantB = await createTestTenant('prefill tenant B')
    await seedEmployerProfile(tenantA, 2025)

    // Authenticate as tenant B but pass tenant A's id in the query string.
    const response = await app.inject({
      method: 'GET',
      url: `/eea2/prefill?tenantId=${tenantA}&reportingYear=2026`,
      headers: { authorization: `Bearer ${getTestJwt(tenantB)}` },
    })

    expect(response.statusCode).toBe(200)
    expect(asPrefill(response.json()).employerProfile).toBeNull()
  })
})
