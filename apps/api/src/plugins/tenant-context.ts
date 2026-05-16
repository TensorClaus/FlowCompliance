import type { FastifyPluginCallback, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { prisma } from '../lib/prisma.js'

const JWT_ALGORITHM = 'HS256' as const
const PUBLIC_PREFIXES = [
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/totp/verify',
  '/test/seed', // test-only seed endpoint; never registered outside NODE_ENV=test
]
const PUBLIC_EXACT = new Set(['/health'])

interface JwtPayload {
  tenantId: string
  tokenType: 'access'
  sub?: string
  iat?: number
  exp?: number
}

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  return null
}

function isPublicRoute(url: string): boolean {
  if (PUBLIC_EXACT.has(url)) return true
  const pathname = url.split('?')[0] ?? url
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

const tenantContextPlugin: FastifyPluginCallback = (app, _options, done) => {
  app.addHook('onRequest', async (request, reply) => {
    if (isPublicRoute(request.url)) {
      return
    }

    const token = extractBearerToken(request)

    if (token === null) {
      return reply.status(401).send({ error: 'Missing Authorization header' })
    }

    let payload: JwtPayload
    try {
      payload = jwt.verify(token, config.SESSION_SECRET, {
        algorithms: [JWT_ALGORITHM],
      }) as JwtPayload
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }

    const { tenantId } = payload

    if (typeof tenantId !== 'string' || !UUID_RE.test(tenantId)) {
      return reply.status(401).send({ error: 'Token missing valid tenantId claim' })
    }

    if ((payload as { tokenType: string }).tokenType !== 'access') {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }

    // Set the tenant context for RLS on this connection.
    // SET LOCAL scopes the value to the current transaction; outside a transaction
    // it behaves like SET (session-level) and is cleared when the connection
    // returns to the pool via prisma.$disconnect or a transaction commit.
    // Production queries that span multiple Prisma calls MUST wrap in $transaction
    // to guarantee SET LOCAL is in scope for every statement.
    await prisma.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`)
  })
  done()
}

export default fp(tenantContextPlugin, {
  name: 'tenant-context',
  fastify: '4.x',
})
