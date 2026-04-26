/**
 * Fastify type augmentation for Better Auth integration.
 *
 * request.user (AuthTokenPayload) is declared in plugins/auth.ts — that
 * declaration is frozen (Phase 2 output) and must not be duplicated here.
 * TypeScript merges all `declare module 'fastify'` blocks; re-declaring
 * request.user with a different type would cause a TS2300 duplicate error.
 *
 * request.session is declared here because no Phase 2 file claims it.
 * It holds the raw Better Auth session record when one is resolved
 * (populated in B3 — the preHandler task). Routes that run before B3's
 * preHandler will observe null.
 *
 * BetterAuthUser / BetterAuthSession are re-exported for use by route
 * handlers and tests that need the canonical BA model types.
 */
import type { Session, User } from 'better-auth'

export type BetterAuthSession = Session
export type BetterAuthUser = User

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * The Better Auth session record resolved from the Bearer token.
     * Null on public routes and before the B3 preHandler runs.
     * Populated by the session-resolution preHandler (Task B3).
     */
    session: Session | null
  }
}
