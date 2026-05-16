import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'

const JWT_ALGORITHM = 'HS256' as const

// ─── Signing roles requiring TOTP ─────────────────────────────────────────────

const SIGNING_ROLES = new Set(['CEO', 'CFO', 'SENIOR_MANAGER'])

// ─── Routes that bypass this auth guard ──────────────────────────────────────

const PUBLIC_PREFIXES = [
  '/auth/register',
  '/auth/login',
  '/auth/refresh',
  '/auth/totp/verify',
  '/test/seed', // test-only seed endpoint; never registered outside NODE_ENV=test
]
const PUBLIC_EXACT = new Set(['/health'])

function isPublicRoute(url: string): boolean {
  if (PUBLIC_EXACT.has(url)) return true
  // Strip query string before prefix matching
  const pathname = url.split('?')[0] ?? url
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

// ─── JWT payload ──────────────────────────────────────────────────────────────

export interface AuthTokenPayload {
  sub: string
  tenantId: string
  email: string
  role: string
  totpVerified: boolean
  tokenType: 'access'
  jti: string
  iat?: number
  exp?: number
}

// ─── Fastify type augmentation ────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthTokenPayload
  }
}

// ─── Helper: extract Bearer token ────────────────────────────────────────────

function extractBearerToken(request: FastifyRequest): string | null {
  const auth = request.headers.authorization
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7)
  }
  return null
}

// ─── preHandler factory (exported for route-level use) ───────────────────────

/**
 * Standalone preHandler that can be attached to individual routes when the
 * global plugin is not suitable (e.g., in test fixtures).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(request)

  if (token === null) {
    return reply.status(401).send({ error: 'Missing Authorization header' })
  }

  let payload: AuthTokenPayload
  try {
    payload = jwt.verify(token, config.SESSION_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as AuthTokenPayload
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' })
  }

  // Structural validation: sub and tenantId must be non-empty strings.
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return reply.status(401).send({ error: 'Token missing subject claim' })
  }

  if (typeof payload.tenantId !== 'string' || payload.tenantId.length === 0) {
    return reply.status(401).send({ error: 'Token missing tenantId claim' })
  }

  if ((payload as { tokenType: string }).tokenType !== 'access') {
    return reply.status(401).send({ error: 'Invalid or expired token' })
  }

  // Role must be present for TOTP enforcement.
  if (typeof payload.role !== 'string' || payload.role.length === 0) {
    return reply.status(401).send({ error: 'Token missing role claim' })
  }

  // TOTP gate: signing-role users must have completed TOTP before accessing
  // protected routes.
  if (SIGNING_ROLES.has(payload.role) && !payload.totpVerified) {
    return reply.status(403).send({
      error: 'TOTP verification required for this role',
      code: 'TOTP_REQUIRED',
    })
  }

  // Attach the decoded user to the request for downstream route handlers.
  request.user = payload
}

export const requireJwt = requireAuth

export async function requireTenant(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (typeof request.user.tenantId !== 'string' || request.user.tenantId.length === 0) {
    return reply.status(401).send({ error: 'Token missing tenantId claim' })
  }
}

export function requireRole(
  roles: string[],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const allowed = new Set(roles)
  return async (request, reply) => {
    if (!allowed.has(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient role for this resource' })
    }
  }
}

// ─── Plugin ──────────────────────────────────────────────────────────────────

const authPlugin: FastifyPluginCallback = (app, _options, done) => {
  /**
   * Global preHandler that runs after tenant-context's onRequest hook.
   * Public routes (/health, /auth/*) are skipped so that the login and
   * TOTP-enrolment flows remain reachable without a pre-existing token.
   */
  app.addHook('preHandler', async (request, reply) => {
    if (isPublicRoute(request.url)) {
      return
    }

    return requireAuth(request, reply)
  })
  done()
}

export default fp(authPlugin, {
  name: 'auth',
  // Must run after tenant-context so RLS is already set when handlers execute.
  dependencies: ['tenant-context'],
  fastify: '4.x',
})
