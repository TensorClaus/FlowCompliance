import { PII_FIELD_PATHS } from '@simplifi/shared/eea/pii-fields'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { replayTo } from '../../event-store/replay.js'
import { prisma } from '../../lib/prisma.js'
import { requireAuth } from '../../plugins/auth.js'

// Module-level Set for O(1) PII lookups — never use Array.includes() per-event.
const PII_SET = new Set<string>(PII_FIELD_PATHS)

// ---------------------------------------------------------------------------
// POPIA gate — server-side PII stripping
//
// prevValue and newValue are nulled for any event whose fieldPath appears in
// PII_FIELD_PATHS. Raw values must never leave the API server. This is the
// sole enforcement point; the client must not be trusted to hide PII.
// ---------------------------------------------------------------------------

interface RawEvent {
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

interface StrippedEvent {
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

function stripPii(events: RawEvent[]): StrippedEvent[] {
  return events.map((event) => {
    const isPii = event.fieldPath !== null && PII_SET.has(event.fieldPath)
    return {
      ...event,
      prevValue: isPii ? null : event.prevValue,
      newValue: isPii ? null : event.newValue,
    }
  })
}

// ---------------------------------------------------------------------------
// Role guard — factory that produces a preHandler enforcing allowed roles.
// The global authPlugin has already verified the JWT and attached request.user
// by the time this runs; this guard only checks the role claim.
// ---------------------------------------------------------------------------

type AllowedRole = 'EE_MANAGER' | 'HR_DIRECTOR' | 'ADMIN' | 'CEO' | 'SENIOR_MANAGER' | 'CFO'

function requireRole(
  roles: AllowedRole[],
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const allowed = new Set<string>(roles)
  return async (request, reply) => {
    if (!allowed.has(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient role for this resource' })
    }
  }
}

// ---------------------------------------------------------------------------
// Zod schemas for query / body validation
// ---------------------------------------------------------------------------

const eventsQuerySchema = z.object({
  section: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const replayBodySchema = z.object({
  toEventId: z.string().min(1),
})

const ALLOWED_ROLES: AllowedRole[] = [
  'EE_MANAGER',
  'HR_DIRECTOR',
  'ADMIN',
  'CEO',
  'SENIOR_MANAGER',
  'CFO',
]

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function eea2EventsRoutes(app: FastifyInstance): void {
  /**
   * GET /eea2/:formId/events
   *
   * Returns a paginated, PII-stripped audit event log for a specific EEA2
   * form instance. All filter state is driven by query params; no post-filter
   * is applied in JavaScript — every filter change fires a new Prisma query.
   *
   * Security:
   *  - requireAuth (via global plugin) → 401 if no/invalid Bearer token
   *  - requireRole → 403 if caller's role is not in the allowed set
   *  - tenantId is NEVER accepted from the client body; RLS enforces tenant
   *    isolation at the database layer via SET LOCAL app.tenant_id
   *  - PII fields (race, gender, disability, salary, etc.) are nulled before
   *    the response is serialised — raw values never leave the server
   */
  app.get<{ Params: { formId: string }; Querystring: unknown }>(
    '/eea2/:formId/events',
    {
      preHandler: [requireAuth, requireRole(ALLOWED_ROLES)],
    },
    async (request, reply) => {
      const parsed = eventsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query parameters' })
      }

      const { section, from, to, cursor, limit } = parsed.data
      const { formId } = request.params
      const tenantId = request.user.tenantId

      // Build WHERE clause — both tenantId and formId scope every query.
      // tenantId comes from the verified JWT claim and is never client-supplied.
      // This is defence-in-depth alongside the Postgres RLS guard.
      const where: Record<string, unknown> = { tenantId, formId }

      if (section !== undefined && section.length > 0) {
        // section maps to a prefix on fieldPath (e.g. 'Section A' → 'sectionA.')
        // The exact mapping is a product decision; for now we pass it through
        // as a metadata or fieldPath prefix filter if the caller supplies it.
        // This is stored as-is; the consumer controls the vocabulary.
        where['fieldPath'] = { startsWith: section }
      }

      if (from !== undefined || to !== undefined) {
        const dateFilter: Record<string, Date> = {}
        if (from !== undefined) dateFilter['gte'] = new Date(from)
        if (to !== undefined) dateFilter['lte'] = new Date(to)
        where['createdAt'] = dateFilter
      }

      // Cursor pagination: if a cursor (event id) is supplied, skip events
      // up to and including that id by using Prisma's cursor + skip: 1.
      const cursorArg = cursor !== undefined && cursor.length > 0 ? { id: cursor } : undefined

      // Fetch limit+1 to detect whether a next page exists.
      const fetchLimit = limit + 1

      const rawEvents = await prisma.eeaEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: fetchLimit,
        ...(cursorArg === undefined ? {} : { cursor: cursorArg, skip: 1 }),
      })

      let nextCursor: string | null = null
      if (rawEvents.length > limit) {
        // Pop the sentinel item — it exists only to signal another page.
        const last = rawEvents.pop()
        if (last !== undefined) {
          nextCursor = last.id
        }
      }

      const events = stripPii(rawEvents as RawEvent[])

      return reply.status(200).send({ events, nextCursor })
    },
  )

  /**
   * POST /eea2/:formId/replay
   *
   * Replays the EEA2 event stream up to (and including) the specified event,
   * returning the materialised form state at that point in time.
   *
   * Used by the SnapshotDrawer UI to reconstruct a historical snapshot without
   * reading a pre-built Snapshot record. This is the forensic replay path
   * required by POPIA s.22 and EEA s.21(4).
   *
   * Security: same role guard as GET /events. tenantId is derived from the
   * verified JWT claim; the client must not supply it.
   */
  app.post<{ Params: { formId: string }; Body: unknown }>(
    '/eea2/:formId/replay',
    {
      preHandler: [requireAuth, requireRole(ALLOWED_ROLES)],
    },
    async (request, reply) => {
      const parsed = replayBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }

      const { toEventId } = parsed.data
      const { formId } = request.params
      const tenantId = request.user.tenantId

      // Resolve the target event to get its timestamp.
      // The replayTo helper replays all events up to a given timestamp.
      const targetEvent = await prisma.eeaEvent.findFirst({
        where: {
          id: toEventId,
          formId,
          // tenantId filter here is defence-in-depth on top of RLS.
          tenantId,
        },
      })

      if (targetEvent === null) {
        return reply.status(404).send({ error: 'Event not found or outside tenant scope' })
      }

      // Replay the stream within a transaction so the RLS GUC set by
      // tenant-context's onRequest hook is in scope for every statement.
      const snapshot = await prisma.$transaction(async (tx) => {
        return replayTo(tenantId, formId, targetEvent.createdAt, tx)
      })

      return reply.status(200).send(snapshot)
    },
  )
}
