import type { FastifyInstance } from 'fastify'

// ─── Route registration ───────────────────────────────────────────────────────

export function eea2Routes(app: FastifyInstance): void {
  /**
   * GET /eea2
   *
   * List all EEA2 annual report drafts for the authenticated tenant.
   * EEA2 is the annual submission to the DEL portal, due 1–15 January each year
   * under rule_eea_016 of the Employment Equity Act.
   * Not yet implemented.
   */
  app.get('/eea2', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * GET /eea2/:id
   *
   * Retrieve a single EEA2 draft by ID.
   * Not yet implemented.
   */
  app.get<{ Params: { id: string } }>('/eea2/:id', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * POST /eea2
   *
   * Create a new EEA2 draft for the authenticated tenant.
   * Not yet implemented.
   */
  app.post<{ Body: unknown }>('/eea2', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })

  /**
   * PUT /eea2/:id
   *
   * Update an existing EEA2 draft by ID.
   * Not yet implemented.
   */
  app.put<{ Params: { id: string }; Body: unknown }>('/eea2/:id', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })
}
