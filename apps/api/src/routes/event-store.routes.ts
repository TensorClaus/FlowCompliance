import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { Prisma } from '../generated/prisma/client.js'
import { prisma } from '../lib/prisma.js'
import { requireAuth } from '../plugins/auth.js'

const AppendBodySchema = z.object({
  eventType: z.string().min(1),
  formId: z.string().min(1),
  newValue: z.string(),
})

export function eventStoreRoutes(app: FastifyInstance): void {
  app.post<{ Body: unknown }>(
    '/api/event-store/append',
    { preHandler: [requireAuth] },
    async (request, reply): Promise<FastifyReply> => {
      const parsed = AppendBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }

      const { eventType, formId, newValue } = parsed.data
      const { tenantId, sub: userId, email: userName } = request.user

      const event = await prisma.eeaEvent.create({
        data: {
          id: randomUUID(),
          tenantId,
          formType: 'EEA1',
          formId,
          eventType,
          fieldPath: null,
          prevValue: Prisma.DbNull,
          newValue,
          metadata: { userId, userName },
        },
      })

      return reply.status(201).send({ success: true, eventId: event.id })
    },
  )
}
