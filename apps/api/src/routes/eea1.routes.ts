import type { FastifyInstance } from 'fastify'

// ─── Route registration ───────────────────────────────────────────────────────

export function eea1Routes(app: FastifyInstance): void {
  /**
   * GET /eea1
   *
   * List all EEA1 workforce profile declarations for the authenticated tenant.
   * EEA1 captures race, gender, and disability across the 8 occupational levels
   * required under rule_eea_005 of the Employment Equity Act.
   * Not yet implemented.
   */
  app.get('/eea1', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * GET /eea1/:id
   *
   * Retrieve a single EEA1 declaration by ID.
   * Not yet implemented.
   */
  app.get<{ Params: { id: string } }>('/eea1/:id', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * POST /eea1
   *
   * Create a new EEA1 declaration for the authenticated tenant.
   * Not yet implemented.
   */
  app.post<{ Body: unknown }>('/eea1', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * PUT /eea1/:id
   *
   * Update an existing EEA1 declaration by ID.
   * Not yet implemented.
   */
  app.put<{ Params: { id: string }; Body: unknown }>('/eea1/:id', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })
}
