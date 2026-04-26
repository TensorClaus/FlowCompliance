import type { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from './app.js'

const TEST_JWT_SECRET = process.env['SESSION_SECRET'] ?? ''
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001'

const { mockBetterAuthApi } = vi.hoisted(() => {
  const mockBetterAuthApi = {
    signUpEmail: vi.fn(),
    signInEmail: vi.fn(),
    signOut: vi.fn(),
  }
  return { mockBetterAuthApi }
})

vi.mock('./lib/prisma.js', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $disconnect: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('./lib/auth.js', () => ({
  auth: { api: mockBetterAuthApi },
  ACCESS_TOKEN_EXPIRY_SECONDS: 900,
  REFRESH_TOKEN_EXPIRY_SECONDS: 604_800,
}))

const validToken = jwt.sign(
  {
    sub: 'test-user-id',
    tenantId: TEST_TENANT_ID,
    email: 'test@simplifi.co.za',
    role: 'EE_MANAGER',
    totpVerified: false,
    tokenType: 'access',
  },
  TEST_JWT_SECRET,
  { expiresIn: 900 },
)

describe('api startup smoke test', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  }, 30_000)

  afterAll(async () => {
    await app.close()
  })

  it('GET /health returns 200 with status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })

  it('registers sensible — unknown authenticated route returns 404 not 500', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/does-not-exist',
      headers: { Authorization: `Bearer ${validToken}` },
    })

    expect(response.statusCode).toBe(404)
  })

  it('registers helmet — security headers present', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBeDefined()
  })

  it('returns 401 when Authorization header is missing on authenticated scope', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/employers',
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toHaveProperty('error')
  })
})
