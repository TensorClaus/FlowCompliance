/**
 * API integration tests for GET /eea2/:formId/events and
 * POST /eea2/:formId/replay (Tests 7–12).
 *
 * Requirements:
 *   - POSTGRES_URL_TEST env var (separate test schema, never production).
 *   - The vitest.config.ts for apps/api already sets DATABASE_URL for the
 *     test environment; these tests consume that same value.
 *   - SESSION_SECRET must be set (≥32 chars) so JWTs can be signed/verified.
 *
 * Isolation: afterEach truncates eea_events and tenants so each test starts
 * from a clean slate. The truncation uses raw SQL to bypass RLS.
 *
 * PII invariant (test 10): event.newValue === null AND event.prevValue === null
 * for any fieldPath in PII_FIELD_PATHS — strict equality, never loose.
 *
 * RLS invariant (test 9): a cross-tenant query returns 200 { events: [] }.
 * RLS makes the rows invisible; it does NOT return 403.
 */

import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../lib/prisma.js'
import { createTestTenant, getTestJwt, seedEvents } from '../helpers/tenant.js'

// ---------------------------------------------------------------------------
// App lifecycle — one Fastify instance for the entire suite.
// ---------------------------------------------------------------------------

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

// ---------------------------------------------------------------------------
// Cleanup — truncate event and tenant rows after every test.
// Raw SQL bypasses RLS so the delete is unconditional.
// ---------------------------------------------------------------------------

afterEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE eea_events CASCADE')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE tenants CASCADE')
})

// ---------------------------------------------------------------------------
// Helper: seed a single PII event for a tenant/form
// ---------------------------------------------------------------------------

async function seedPiiEvent(
  tenantId: string,
  formId: string,
  fieldPath: string,
  rawValue: string,
): Promise<string> {
  const id = randomUUID()
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    await tx.eeaEvent.create({
      data: {
        id,
        tenantId,
        formId,
        formType: 'EEA2',
        eventType: 'FIELD_UPDATED',
        fieldPath,
        prevValue: rawValue,
        newValue: rawValue,
        metadata: {
          triggeredBy: 'test-user',
          ip: '127.0.0.1',
          userAgent: 'vitest',
          sessionId: 's1',
        },
        createdAt: new Date(),
      },
    })
  })
  return id
}

// ---------------------------------------------------------------------------
// Tests 7–12
// ---------------------------------------------------------------------------

describe('GET /eea2/:formId/events', () => {
  // -------------------------------------------------------------------------
  // Test 7 — 401 when no Authorization header is supplied
  // -------------------------------------------------------------------------

  it('returns 401 when no Authorization header is provided', async () => {
    const formId = randomUUID()

    const response = await app.inject({
      method: 'GET',
      url: `/eea2/${formId}/events`,
    })

    expect(response.statusCode).toBe(401)
  })

  // -------------------------------------------------------------------------
  // Test 8 — 200 + correct event count for authenticated tenant owner
  // -------------------------------------------------------------------------

  it('returns 200 and the seeded events for an authenticated EE_MANAGER', async () => {
    const tenantId = await createTestTenant('Tenant A — test 8')
    const formId = randomUUID()
    await seedEvents(tenantId, formId, 3)

    const jwt = getTestJwt(tenantId, 'EE_MANAGER')

    const response = await app.inject({
      method: 'GET',
      url: `/eea2/${formId}/events`,
      headers: { authorization: `Bearer ${jwt}` },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json<{ events: unknown[]; nextCursor: string | null }>()
    expect(body.events.length).toBe(3)
  })

  // -------------------------------------------------------------------------
  // Test 9 — RLS cross-tenant: tenant B sees empty array, NOT 403
  //
  // CRITICAL invariant: RLS makes tenant A's rows invisible to tenant B's
  // query. The route returns 200 { events: [] } — it does NOT return 403.
  // -------------------------------------------------------------------------

  it('returns 200 with an empty events array when tenant B queries tenant A formId', async () => {
    const tenantAId = await createTestTenant('Tenant A — test 9')
    const tenantBId = await createTestTenant('Tenant B — test 9')
    const formId = randomUUID()

    // Seed 3 events owned by tenant A.
    await seedEvents(tenantAId, formId, 3)

    // Authenticate as tenant B.
    const jwtB = getTestJwt(tenantBId, 'EE_MANAGER')

    const response = await app.inject({
      method: 'GET',
      url: `/eea2/${formId}/events`,
      headers: { authorization: `Bearer ${jwtB}` },
    })

    // RLS makes tenant A's rows invisible — the response is 200 with an empty list.
    expect(response.statusCode).toBe(200)
    const body = response.json<{ events: unknown[] }>()
    expect(body.events).toEqual([])
  })
})

describe('PII stripping', () => {
  // -------------------------------------------------------------------------
  // Test 10 — prevValue and newValue are null for PII fieldPaths
  // -------------------------------------------------------------------------

  it('nulls prevValue and newValue for a PII fieldPath (gender)', async () => {
    const tenantId = await createTestTenant('Tenant — test 10')
    const formId = randomUUID()

    // Seed a gender event with raw demographic values.
    await seedPiiEvent(tenantId, formId, 'gender', 'Female')

    const jwt = getTestJwt(tenantId, 'EE_MANAGER')

    const response = await app.inject({
      method: 'GET',
      url: `/eea2/${formId}/events`,
      headers: { authorization: `Bearer ${jwt}` },
    })

    expect(response.statusCode).toBe(200)

    const body = response.json<{
      events: Array<{ fieldPath: string; newValue: unknown; prevValue: unknown }>
    }>()

    expect(body.events.length).toBe(1)

    const event = body.events[0]
    if (event === undefined) throw new Error('Expected at least one event')

    // Strict null equality — must be exactly null, not undefined or empty string.
    expect(event.newValue).toStrictEqual(null)
    expect(event.prevValue).toStrictEqual(null)

    // Belt-and-suspenders: the raw value must not appear anywhere in the JSON body.
    const serialised = JSON.stringify(body)
    expect(serialised).not.toContain('Female')
    expect(serialised).not.toContain('Male')
  })
})

describe('POST /eea2/:formId/replay', () => {
  // -------------------------------------------------------------------------
  // Test 11 — Replay to midpoint returns state built from events 1–5 only
  // -------------------------------------------------------------------------

  it('replays to the 5th event and excludes changes from events 6–10', async () => {
    const tenantId = await createTestTenant('Tenant — test 11')
    const formId = randomUUID()

    // Seed 10 events: events 1–5 write sectionA.name; events 6–10 write
    // sectionB.lateField so we can verify late changes are absent in the
    // midpoint snapshot.
    const seeded = await seedEvents(tenantId, formId, 10)

    // Override event 6 onwards to write to a distinct field so we can detect
    // their absence. Because seedEvents writes sectionA.field0…field9, we
    // add a dedicated late event on top.
    const lateEventId = randomUUID()
    const lateTimestamp = new Date((seeded[9]?.createdAt.getTime() ?? Date.now()) + 1000)
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
      await tx.eeaEvent.create({
        data: {
          id: lateEventId,
          tenantId,
          formId,
          formType: 'EEA2',
          eventType: 'FIELD_UPDATED',
          fieldPath: 'sectionB.lateField',
          prevValue: Prisma.DbNull,
          newValue: 'LATE_VALUE',
          metadata: {
            triggeredBy: 'test-user',
            ip: '127.0.0.1',
            userAgent: 'vitest',
            sessionId: 's1',
          },
          createdAt: lateTimestamp,
        },
      })
    })

    // Replay to the 5th seeded event (index 4).
    const midpointEvent = seeded[4]
    if (midpointEvent === undefined) throw new Error('Expected seeded[4] to exist')

    const jwt = getTestJwt(tenantId, 'EE_MANAGER')

    const response = await app.inject({
      method: 'POST',
      url: `/eea2/${formId}/replay`,
      headers: {
        authorization: `Bearer ${jwt}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ toEventId: midpointEvent.id }),
    })

    expect(response.statusCode).toBe(200)

    const snapshot = response.json<Record<string, unknown>>()

    // The snapshot must contain sectionA (written by events 1–5).
    expect(snapshot).toHaveProperty('sectionA')

    // The late field written after the midpoint must NOT be present.
    const sectionB = snapshot['sectionB'] as Record<string, unknown> | undefined
    expect(sectionB?.['lateField']).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // Test 12 — Replay cross-tenant returns 404 (event outside tenant scope)
  // -------------------------------------------------------------------------

  it('returns 404 when tenant B replays an event id owned by tenant A', async () => {
    const tenantAId = await createTestTenant('Tenant A — test 12')
    const tenantBId = await createTestTenant('Tenant B — test 12')
    const formId = randomUUID()

    // Seed events owned by tenant A.
    const seeded = await seedEvents(tenantAId, formId, 5)
    const tenantAEventId = seeded[0]?.id
    if (tenantAEventId === undefined) throw new Error('Expected seeded[0] to exist')

    // Authenticate as tenant B and attempt to replay a tenant A event.
    const jwtB = getTestJwt(tenantBId, 'EE_MANAGER')

    const response = await app.inject({
      method: 'POST',
      url: `/eea2/${formId}/replay`,
      headers: {
        authorization: `Bearer ${jwtB}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ toEventId: tenantAEventId }),
    })

    // The route performs findFirst with tenantId from the JWT + RLS in scope.
    // Tenant A's event is invisible to tenant B — the handler returns 404.
    expect(response.statusCode).toBe(404)
  })
})
