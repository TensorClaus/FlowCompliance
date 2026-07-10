import type { FastifyInstance } from 'fastify'

// ─── Route registration ───────────────────────────────────────────────────────

// GET /eea1/:id, POST /eea1, and PATCH /eea1/:id are implemented in
// ./eea1/declarations.ts and registered in app.ts via eea1DeclarationsRoutes.
// Only the list endpoint remains here as a stub.

export function eea1Routes(app: FastifyInstance): void {
  /**
   * GET /eea1
   *
   * List all EEA1 workforce profile declarations for the authenticated tenant.
   * EEA1 captures race, gender, and disability across the 7 occupational levels
   * required under rule_eea_005 of the Employment Equity Act.
   * Not yet implemented.
   */
  app.get('/eea1', async (_request, reply) => {
    return reply.status(501).send({ error: 'Not Implemented' })
  })
}
