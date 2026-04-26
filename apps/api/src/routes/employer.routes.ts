import type { FastifyInstance } from 'fastify'

// ─── Route registration ───────────────────────────────────────────────────────

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
