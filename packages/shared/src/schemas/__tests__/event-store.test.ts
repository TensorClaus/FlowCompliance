import { describe, it, expect } from 'vitest'
import {
  EventStreamSchema,
  ProjectionSchema,
  SnapshotSchema,
  AppendResultSchema,
  ReplayRequestSchema,
} from '../event-store.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const validEvent = {
  eventId: '01890a5d-ac96-774b-bcce-b302099a8057',
  tenantId: 'tenant-001',
  formType: 'EEA2' as const,
  formId: 'form-eea2-001',
  eventType: 'FORM_CREATED' as const,
  fieldPath: null,
  previousValue: null,
  newValue: null,
  metadata: {
    triggeredBy: 'user-001',
    ip: '196.25.1.10',
    userAgent: 'Mozilla/5.0',
    sessionId: 'sess-abc123',
  },
  timestamp: '2026-01-10T09:00:00Z',
}

const STREAM_ID = '550e8400-e29b-41d4-a716-446655440000'
const FORM_ID = '660e8400-e29b-41d4-a716-446655440001'
const EVENT_ID = '01890a5d-ac96-774b-bcce-b302099a8057'

// ---------------------------------------------------------------------------
// EventStreamSchema
// ---------------------------------------------------------------------------

describe('EventStreamSchema', () => {
  const validStream = {
    streamId: STREAM_ID,
    tenantId: 'tenant-001',
    formType: 'EEA2' as const,
    formId: FORM_ID,
    events: [validEvent],
    version: 1,
    createdAt: '2026-01-10T08:00:00Z',
    lastEventAt: '2026-01-10T09:00:00Z',
  }

  it('accepts a stream with one event', () => {
    expect(EventStreamSchema.safeParse(validStream).success).toBe(true)
  })

  it('accepts an empty stream at version 0 with null lastEventAt', () => {
    expect(
      EventStreamSchema.safeParse({ ...validStream, events: [], version: 0, lastEventAt: null })
        .success,
    ).toBe(true)
  })

  it('rejects a negative version — the counter is monotonic from 0', () => {
    expect(EventStreamSchema.safeParse({ ...validStream, version: -1 }).success).toBe(false)
  })

  it('rejects a fractional version', () => {
    expect(EventStreamSchema.safeParse({ ...validStream, version: 1.5 }).success).toBe(false)
  })

  it('rejects a stream whose events contain an invalid EEAEvent', () => {
    expect(
      EventStreamSchema.safeParse({
        ...validStream,
        events: [{ ...validEvent, eventId: 'bad' }],
      }).success,
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ProjectionSchema
// ---------------------------------------------------------------------------

describe('ProjectionSchema', () => {
  const validProjection = {
    projectionId: STREAM_ID,
    tenantId: 'tenant-001',
    formType: 'EEA2' as const,
    formId: FORM_ID,
    state: { sectionA: { tradeName: 'Ubuntu Traders' } },
    version: 3,
    builtFromEventId: EVENT_ID,
    builtAt: '2026-01-10T09:00:01Z',
    stale: false,
  }

  it('accepts a fresh projection with polymorphic state', () => {
    expect(ProjectionSchema.safeParse(validProjection).success).toBe(true)
  })

  it('accepts a stale projection awaiting rebuild', () => {
    expect(ProjectionSchema.safeParse({ ...validProjection, stale: true }).success).toBe(true)
  })

  it('rejects a projection without the builtFromEventId replay anchor', () => {
    const { builtFromEventId: _b, ...withoutAnchor } = validProjection
    expect(ProjectionSchema.safeParse(withoutAnchor).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SnapshotSchema
// ---------------------------------------------------------------------------

describe('SnapshotSchema', () => {
  const validSnapshot = {
    snapshotId: STREAM_ID,
    tenantId: 'tenant-001',
    formType: 'EEA4' as const,
    formId: FORM_ID,
    state: { status: 'signed' },
    snapshotAt: '2026-01-12T10:00:00Z',
    eventVersion: 42,
    lastEventId: EVENT_ID,
    reason: 'ceo_sign_off' as const,
    createdBy: 'system',
    createdAt: '2026-01-12T10:00:00Z',
  }

  it('accepts a CEO sign-off snapshot created by the system', () => {
    expect(SnapshotSchema.safeParse(validSnapshot).success).toBe(true)
  })

  it.each(['ceo_sign_off', 'dol_submission', 'manual_request', 'pre_edit_backup'] as const)(
    'accepts controlled-vocabulary reason "%s"',
    (reason) => {
      expect(SnapshotSchema.safeParse({ ...validSnapshot, reason }).success).toBe(true)
    },
  )

  it('rejects a free-text reason — programmatic audit queries depend on the vocabulary', () => {
    expect(SnapshotSchema.safeParse({ ...validSnapshot, reason: 'backup' }).success).toBe(false)
  })

  it('rejects an empty createdBy — every snapshot must be attributable', () => {
    expect(SnapshotSchema.safeParse({ ...validSnapshot, createdBy: '' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// AppendResultSchema / ReplayRequestSchema
// ---------------------------------------------------------------------------

describe('AppendResultSchema', () => {
  const validResult = {
    success: true,
    eventId: EVENT_ID,
    newVersion: 7,
    projectionSyncTriggered: true,
  }

  it('accepts a successful append acknowledgement', () => {
    expect(AppendResultSchema.safeParse(validResult).success).toBe(true)
  })

  it('accepts a degraded append where the sync job could not be enqueued', () => {
    expect(
      AppendResultSchema.safeParse({ ...validResult, projectionSyncTriggered: false }).success,
    ).toBe(true)
  })

  it('rejects a negative newVersion', () => {
    expect(AppendResultSchema.safeParse({ ...validResult, newVersion: -1 }).success).toBe(false)
  })
})

describe('ReplayRequestSchema', () => {
  const validRequest = {
    formId: FORM_ID,
    replayTo: '2026-01-12T10:00:00Z',
  }

  it('accepts a replay request and coerces replayTo to a Date', () => {
    const result = ReplayRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.replayTo).toBeInstanceOf(Date)
      expect(result.data.includeEvent).toBeUndefined()
    }
  })

  it('accepts an explicit exclusive boundary', () => {
    expect(ReplayRequestSchema.safeParse({ ...validRequest, includeEvent: false }).success).toBe(
      true,
    )
  })

  it('rejects an unparseable replayTo timestamp', () => {
    expect(ReplayRequestSchema.safeParse({ ...validRequest, replayTo: 'yesterday' }).success).toBe(
      false,
    )
  })
})
