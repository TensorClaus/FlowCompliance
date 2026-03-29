import type { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { prisma } from '../lib/prisma.js'

interface JwtPayload {
  tenantId: string
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

function tenantContextPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    const token = extractBearerToken(request)

    if (token === null) {
      return reply.status(401).send({ error: 'Missing Authorization header' })
    }

    let payload: JwtPayload
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }

    const { tenantId } = payload

    if (typeof tenantId !== 'string' || !UUID_RE.test(tenantId)) {
      return reply.status(401).send({ error: 'Token missing valid tenantId claim' })
    }

    // Set the tenant context for RLS on this connection.
    // SET LOCAL scopes the value to the current transaction; outside a transaction
    // it behaves like SET (session-level) and is cleared when the connection
    // returns to the pool via prisma.$disconnect or a transaction commit.
    // Production queries that span multiple Prisma calls MUST wrap in $transaction
    // to guarantee SET LOCAL is in scope for every statement.
    await prisma.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`)
  })
}

export default fp(tenantContextPlugin, {
  name: 'tenant-context',
  fastify: '4.x',
})
