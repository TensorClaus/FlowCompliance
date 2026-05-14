import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { prisma } from '../lib/prisma.js'

function issueTestJwt(sub: string, tenantId: string, role: string): string {
  return jwt.sign(
    {
      sub,
      tenantId,
      email: `${sub.slice(0, 8)}@test.local`,
      role,
      totpVerified: true,
      tokenType: 'access',
      jti: randomUUID(),
    },
    config.SESSION_SECRET,
    { algorithm: 'HS256', expiresIn: 3600 },
  )
}

export function testSeedRoutes(app: FastifyInstance): void {
  app.post('/test/seed', async (_request, reply): Promise<FastifyReply> => {
    const tenantId = randomUUID()
    const eeaManagerId = randomUUID()
    const employeeBId = randomUUID()
    const ceoId = randomUUID()

    await prisma.$transaction(async (tx) => {
      // Set RLS GUC for the new tenant before any DML inside this transaction.
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`

      await tx.tenant.create({
        data: {
          id: tenantId,
          name: `test-${tenantId.slice(0, 8)}`,
          kmsKeyId: 'local-dev-placeholder',
        },
      })

      await tx.user.createMany({
        data: [
          {
            id: eeaManagerId,
            email: `mgr-${eeaManagerId.slice(0, 6)}@test.local`,
            tenantId,
            passwordHash: '',
            role: 'EE_MANAGER',
          },
          {
            id: employeeBId,
            email: `emp-${employeeBId.slice(0, 6)}@test.local`,
            tenantId,
            passwordHash: '',
            role: 'EE_MANAGER',
          },
          {
            id: ceoId,
            email: `ceo-${ceoId.slice(0, 6)}@test.local`,
            tenantId,
            passwordHash: '',
            role: 'CEO',
          },
        ],
      })
    })

    return reply.status(201).send({
      tenantId,
      eeaManagerToken: issueTestJwt(eeaManagerId, tenantId, 'EE_MANAGER'),
      eeaManagerSub: eeaManagerId,
      employeeBToken: issueTestJwt(employeeBId, tenantId, 'EE_MANAGER'),
      employeeBSub: employeeBId,
      ceoToken: issueTestJwt(ceoId, tenantId, 'CEO'),
    })
  })

  app.delete<{ Params: { tenantId: string } }>(
    '/test/seed/:tenantId',
    async (request, reply): Promise<FastifyReply> => {
      const { tenantId } = request.params
      // Cascade deletes users, eea1_declarations, eea_events via FK constraints.
      await prisma.tenant.deleteMany({ where: { id: tenantId } })
      return reply.status(204).send()
    },
  )
}
