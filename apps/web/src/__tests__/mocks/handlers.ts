/**
 * Default MSW request handlers for AuditHistoryPanel tests.
 *
 * Import `handlers` and pass it to `server.use(...handlers)` in beforeEach,
 * or override individual handlers per-test with `server.use(http.get(...))`.
 *
 * The global server in apps/web/src/test/server.ts is set up with
 * `onUnhandledRequest: 'error'`, so every fetch the component fires must be
 * covered by a handler registered for that test.
 */

import { http, HttpResponse } from 'msw'
import type { AuditEvent } from '@/components/eea/AuditHistoryPanel'

/** Minimal factory so tests can build events without repeating boilerplate. */
export function buildAuditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    eventId: crypto.randomUUID(),
    eventType: 'FIELD_UPDATED',
    fieldPath: 'sectionA.field',
    timestamp: new Date().toISOString(),
    triggeredBy: 'test-user@simplifi.co.za',
    ...overrides,
  }
}

/**
 * Default GET /eea2/:formId/events handler — returns an empty list.
 *
 * Override per-test using server.use(http.get('/eea2/:formId/events', ...)).
 */
export const handlers = [
  http.get('/eea2/:formId/events', () => {
    return HttpResponse.json({ events: [], nextCursor: null })
  }),

  http.post('/eea2/:formId/replay', () => {
    return HttpResponse.json({ sectionA: { field: 'snapshot-value' } })
  }),
]
