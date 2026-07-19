import type { FastifyInstance } from 'fastify'

// ─── Route registration ───────────────────────────────────────────────────────
//
// DECISION (2026-07-19, founder sign-off): these employer-profile CRUD routes
// are INTENTIONALLY left as 501 stubs. Nothing consumes them — Section A reads
// employer_profiles through the EEA2 pre-fill path (GET /eea2/prefill), not this
// API. Implement only when a caller actually needs employer-profile CRUD (YAGNI).
// Do not "fix" these to real handlers without a consuming feature.

export function employerRoutes(app: FastifyInstance): void {
  /**
   * GET /employers
   *
   * List all employer profiles visible to the authenticated tenant.
   * Not yet implemented.
   */
  app.get('/employers', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * GET /employers/:id
   *
   * Retrieve a single employer profile by ID.
   * Not yet implemented.
   */
  app.get<{ Params: { id: string } }>('/employers/:id', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * POST /employers
   *
   * Create a new employer profile for the authenticated tenant.
   * Not yet implemented.
   */
  app.post<{ Body: unknown }>('/employers', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * PUT /employers/:id
   *
   * Update an existing employer profile by ID.
   * Not yet implemented.
   */
  app.put<{ Params: { id: string }; Body: unknown }>('/employers/:id', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })
}
