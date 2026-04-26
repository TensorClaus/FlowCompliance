import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { config } from '../config.js'
import { buildTokenPair, auth } from '../lib/auth.js'
import { prisma } from '../lib/prisma.js'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
})

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RefreshTokenClaims {
  sub: string
  tenantId: string
  tokenType: 'refresh'
  jti?: string
}

interface BaApiResponse {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baApi = auth.api as any as {
  signUpEmail(args: unknown): Promise<BaApiResponse>
  signInEmail(args: unknown): Promise<BaApiResponse>
  signOut(args: unknown): Promise<unknown>
}

function verifyRefreshToken(token: string): RefreshTokenClaims {
  const payload = jwt.verify(token, config.SESSION_SECRET, {
    algorithms: ['HS256'],
  }) as RefreshTokenClaims
  if ((payload as { tokenType: string }).tokenType !== 'refresh') {
    throw new Error('Not a refresh token')
  }
  return payload
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function authRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown }>('/auth/register', async (request, reply): Promise<FastifyReply> => {
    const parsed = registerBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' })
    }

    const { email, password, tenantId, name } = parsed.data

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (tenant === null) {
      return reply.status(422).send({ error: 'Tenant not found' })
    }

    const baResponse = await baApi.signUpEmail({ body: { email, password, name } })
    if (!baResponse.ok) {
      const body = await baResponse.json()
      const message = (body as { message?: string }).message ?? 'Registration failed'
      return reply.status(baResponse.status).send({ error: message })
    }

    const baBody = await baResponse.json()
    const baUser = (baBody as { user: { id: string; email: string } }).user

    const sessionId = randomUUID()
    const user = await prisma.user.upsert({
      where: { email },
      update: { tenantId },
      create: {
        id: baUser.id,
        email: baUser.email,
        tenantId,
        passwordHash: '',
        role: 'EE_MANAGER',
      },
    })

    return reply.status(201).send({
      ...buildTokenPair(
        {
          sub: user.id,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role as string,
          totpVerified: false,
        },
        sessionId,
      ),
      tokenType: 'Bearer',
    })
  })

  app.post<{ Body: unknown }>('/auth/login', async (request, reply): Promise<FastifyReply> => {
    const parsed = loginBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' })
    }

    const { email, password } = parsed.data

    const baResponse = await baApi.signInEmail({ body: { email, password } })
    if (!baResponse.ok) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const baBody = await baResponse.json()
    const baUser = (baBody as { user: { id: string; email: string } }).user

    const user = await prisma.user.findUnique({ where: { id: baUser.id } })
    if (user === null) {
      return reply.status(401).send({ error: 'User not found' })
    }

    const sessionId = randomUUID()
    return reply.status(200).send({
      ...buildTokenPair(
        {
          sub: user.id,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role as string,
          totpVerified: false,
        },
        sessionId,
      ),
      tokenType: 'Bearer',
    })
  })

  app.post<{ Body: unknown }>('/auth/refresh', async (request, reply): Promise<FastifyReply> => {
    const parsed = refreshBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed' })
    }

    let payload: RefreshTokenClaims
    try {
      payload = verifyRefreshToken(parsed.data.refreshToken)
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' })
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (user === null) {
      return reply.status(401).send({ error: 'User not found' })
    }

    const sessionId = payload.jti ?? randomUUID()
    return reply.status(200).send({
      ...buildTokenPair(
        {
          sub: user.id,
          tenantId: user.tenantId,
          email: user.email,
          role: user.role as string,
          totpVerified: false,
        },
        sessionId,
      ),
      tokenType: 'Bearer',
    })
  })

  app.post('/auth/logout', async (_request, reply): Promise<FastifyReply> => {
    try {
      await baApi.signOut({})
    } catch {
      // Non-fatal: session cleanup failure should not block client logout
    }
    return reply.status(204).send()
  })
}

// Re-export for any consumers that relied on the old named export

export { ACCESS_TOKEN_EXPIRY_SECONDS } from '../lib/auth.js'
