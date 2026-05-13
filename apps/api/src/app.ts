import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import sensible from '@fastify/sensible'
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import { config } from './config.js'
import authPlugin from './plugins/auth.js'
import logScrubberPlugin, { REDACT_CONFIG } from './plugins/log-scrubber.js'
import tenantContextPlugin from './plugins/tenant-context.js'
import { authRoutes } from './routes/auth.routes.js'
import { eea1DeclarationsRoutes } from './routes/eea1/declarations.js'
import { eea1Routes } from './routes/eea1.routes.js'
import { eea2EventsRoutes } from './routes/eea2/events.js'
import { eea2Routes } from './routes/eea2.routes.js'
import { employerRoutes } from './routes/employer.routes.js'
import { totpRoutes } from './routes/totp.routes.js'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: REDACT_CONFIG,
    },
  })

  // POPIA s.19 — PII encryption is applied at the Prisma client level via the
  // KMS encryption extension wired in apps/api/src/lib/prisma.ts. Every import
  // of `prisma` in this process receives the encrypting client, so no
  // create/update/upsert on Eea1Declaration can bypass field encryption.

  // Log scrubber MUST be registered before any route handlers (POPIA s.19).
  await app.register(logScrubberPlugin)

  void app.register(sensible)
  void app.register(helmet)
  void app.register(cors)
  void app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  // Public routes (no auth)
  app.get('/health', () => ({ status: 'ok' }))

  // Auth routes are registered before tenant-context so that /auth/* endpoints
  // are reachable without a pre-existing Bearer token. The tenant-context plugin
  // only skips /health explicitly; auth routes issue the token that all other
  // routes then require.
  await app.register(authRoutes)
  await app.register(totpRoutes)
  await app.register(employerRoutes)
  await app.register(eea1Routes)
  await app.register(eea1DeclarationsRoutes)
  await app.register(eea2Routes)
  await app.register(eea2EventsRoutes)

  // Tenant context — enforces JWT auth + sets RLS GUC for all non-public routes.
  // The plugin's onRequest hook skips /health; add further public paths there as needed.
  await app.register(tenantContextPlugin)

  // Auth plugin — runs as a preHandler (after onRequest) to attach request.user
  // and enforce TOTP for signing-role users. Depends on tenant-context being
  // registered first so the fastify-plugin dependency declaration is satisfied.
  await app.register(authPlugin)

  return app
}
