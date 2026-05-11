import { PII_FIELD_PATHS } from '@simplifi/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { requireAuth } from '../../plugins/auth.js'

// ─── Role enforcement ─────────────────────────────────────────────────────────

const ALLOWED_ROLES = new Set([
  'EE_MANAGER',
  'HR_DIRECTOR',
  'ADMIN',
  'CEO',
  'SENIOR_MANAGER',
  'CFO',
])

async function requireAllowedRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!ALLOWED_ROLES.has(request.user.role)) {
    return reply.status(403).send({ error: 'Insufficient role' })
  }
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const EventsQuerySchema = z.object({
  section: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) =>
      v === undefined ? 50 : Math.min(Number.parseInt(v, 10), 100),
    )
    .pipe(z.number().int().min(1).max(100)),
})

const ReplayBodySchema = z.object({
  toEventId: z.string().uuid(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventsParams {
  formId: string
}

// ─── PII strip ───────────────────────────────────────────────────────────────

const PII_SET = new Set<string>(PII_FIELD_PATHS)

interface RawEeaEvent {
  id: string
  tenantId: string
  formType: string | null
  formId: string | null
  eventType: string | null
  fieldPath: string | null
  prevValue: unknown
  newValue: unknown
  metadata: unknown
  createdAt: Date
}

function stripPii(event: RawEeaEvent) {
  const hasPii = event.fieldPath !== null && PII_SET.has(event.fieldPath)
  return {
    eventId: event.id,
    tenantId: event.tenantId,
    formType: event.formType ?? 'EEA2',
    formId: event.formId ?? '',
    eventType: event.eventType ?? 'FIELD_UPDATED',
    fieldPath: event.fieldPath,
    previousValue: hasPii ? null : (event.prevValue ?? null),
    newValue: hasPii ? null : (event.newValue ?? null),
    metadata: event.metadata,
    timestamp: event.createdAt,
  }
}

// ─── Route registration ───────────────────────────────────────────────────────

export function eea2EventRoutes(app: FastifyInstance): void {
  /**
   * GET /eea2/:formId/events
   *
   * Returns a paginated, PII-stripped audit log for a single EEA2 form.
   * Cursor pagination via eventId (DESC by createdAt).
   * PII fields (race, gender, disability, etc.) have prevValue/newValue nulled
   * server-side before the response is sent — the client never receives them.
   *
   * RLS: requireAuth attaches request.user including tenantId; the Prisma query
   * filters by tenantId so cross-tenant reads are impossible at the query level
   * in addition to the Postgres RLS guard set by tenant-context.
   *
   * tenantId is never accepted from the request body or query params.
   */
  app.get<{ Params: EventsParams }>(
    '/eea2/:formId/events',
    { preHandler: [requireAuth, requireAllowedRole] },
    async (request, reply) => {
      const { formId } = request.params

      const queryResult = EventsQuerySchema.safeParse(request.query)
      if (!queryResult.success) {
        return reply.status(400).send({
          error: 'Invalid query parameters',
          details: queryResult.error.flatten(),
        })
      }

      const { section, from, to, cursor, limit } = queryResult.data
      const tenantId = request.user.tenantId

      // Build Prisma where clause — tenantId always comes from the verified JWT
      const where: Record<string, unknown> = {
        tenantId,
        formId,
        ...(section !== undefined && { fieldPath: { startsWith: section } }),
        ...(from !== undefined || to !== undefined
          ? {
              createdAt: {
                ...(from !== undefined && { gte: new Date(from) }),
                ...(to !== undefined && { lte: new Date(to) }),
              },
            }
          : {}),
        // Cursor: return events older than the cursor event
        ...(cursor !== undefined && { id: { lt: cursor } }),
      }

      const rows = await prisma.eeaEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      })

      let nextCursor: string | null = null
      if (rows.length > limit) {
        rows.pop()
        const last = rows.at(-1)
        nextCursor = last?.id ?? null
      }

      const events = rows.map((r) => stripPii(r))

      return reply.send({ events, nextCursor })
    },
  )

  /**
   * POST /eea2/:formId/replay
   *
   * Replays the EEA2 event stream up to and including toEventId to produce a
   * materialised snapshot of the form state at that point in history.
   *
   * If toEventId does not exist within the tenant's scope for this formId, 404
   * is returned. tenantId is never accepted from the request body.
   */
  app.post<{ Params: EventsParams }>(
    '/eea2/:formId/replay',
    { preHandler: [requireAuth, requireAllowedRole] },
    async (request, reply) => {
      const { formId } = request.params
      const tenantId = request.user.tenantId

      const bodyResult = ReplayBodySchema.safeParse(request.body)
      if (!bodyResult.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: bodyResult.error.flatten(),
        })
      }

      const { toEventId } = bodyResult.data

      // Verify the target event exists in this tenant's scope for this form
      const targetEvent = await prisma.eeaEvent.findFirst({
        where: { id: toEventId, tenantId, formId },
        select: { createdAt: true },
      })

      if (targetEvent === null) {
        return reply.status(404).send({ error: 'Event not found' })
      }

      // Replay: fetch all events up to and including the target event's timestamp
      const streamEvents = await prisma.eeaEvent.findMany({
        where: {
          tenantId,
          formId,
          createdAt: { lte: targetEvent.createdAt },
        },
        orderBy: { createdAt: 'asc' },
      })

      // Materialise the snapshot by folding field-level events into a state object
      const state: Record<string, unknown> = {}

      for (const event of streamEvents) {
        if (
          (event.eventType === 'FIELD_UPDATED' ||
            event.eventType === 'PREFILL_APPLIED' ||
            event.eventType === 'PREFILL_OVERRIDDEN' ||
            event.eventType === 'CROSS_FORM_SYNC') &&
          event.fieldPath !== null
        ) {
          // Walk/create nested path
          const parts = event.fieldPath.split('.')
          let cursor: Record<string, unknown> = state
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]
            if (part === undefined) continue
            if (typeof cursor[part] !== 'object' || cursor[part] === null) {
              cursor[part] = {}
            }
            cursor = cursor[part] as Record<string, unknown>
          }
          const lastPart = parts.at(-1)
          if (lastPart === undefined) continue
          cursor[lastPart] = event.newValue
        }
      }

      const snapshot = {
        formId,
        tenantId,
        snapshotAt: targetEvent.createdAt,
        replayedToEventId: toEventId,
        state,
      }

      return reply.send(snapshot)
    },
  )
}
