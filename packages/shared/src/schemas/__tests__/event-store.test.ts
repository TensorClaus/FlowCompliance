import { describe, expect, it } from 'vitest'
import {
  AppendResultSchema,
  EventStreamSchema,
  ProjectionSchema,
  ReplayRequestSchema,
  SnapshotSchema,
} from '../event-store.js'

function eventStream(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    streamId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: 'tenant-001',
    formType: 'EEA2',
    formId: '550e8400-e29b-41d4-a716-446655440001',
    events: [],
    version: 0,
    createdAt: '2025-01-01T00:00:00Z',
    lastEventAt: null,
    ...overrides,
  }
}

function projection(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    projectionId: '550e8400-e29b-41d4-a716-446655440002',
    tenantId: 'tenant-001',
    formType: 'EEA2',
    formId: '550e8400-e29b-41d4-a716-446655440001',
    state: { status: 'draft' },
    version: 3,
    builtFromEventId: '550e8400-e29b-41d4-a716-446655440003',
    builtAt: '2025-01-02T00:00:00Z',
    stale: false,
    ...overrides,
  }
}

function snapshot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    snapshotId: '550e8400-e29b-41d4-a716-446655440004',
    tenantId: 'tenant-001',
    formType: 'EEA2',
    formId: '550e8400-e29b-41d4-a716-446655440001',
    state: { status: 'signed' },
    snapshotAt: '2025-01-05T00:00:00Z',
    eventVersion: 5,
    lastEventId: '550e8400-e29b-41d4-a716-446655440005',
    reason: 'ceo_sign_off',
    createdBy: 'user-001',
    createdAt: '2025-01-05T00:00:01Z',
    ...overrides,
  }
}

function appendResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    success: true,
    eventId: '550e8400-e29b-41d4-a716-446655440006',
    newVersion: 1,
    projectionSyncTriggered: true,
    ...overrides,
  }
}

function replayRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    formId: '550e8400-e29b-41d4-a716-446655440001',
    replayTo: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

describe('EventStreamSchema', () => {
  it('accepts a freshly created stream with no events (version 0, lastEventAt null)', () => {
    expect(EventStreamSchema.safeParse(eventStream()).success).toBe(true)
  })

  it('rejects a negative version (optimistic concurrency counter cannot go backwards)', () => {
    expect(EventStreamSchema.safeParse(eventStream({ version: -1 })).success).toBe(false)
  })

  it('rejects a non-integer version', () => {
    expect(EventStreamSchema.safeParse(eventStream({ version: 1.5 })).success).toBe(false)
  })

  it('accepts a non-null lastEventAt once events have been appended', () => {
    const result = EventStreamSchema.safeParse(
      eventStream({ version: 1, lastEventAt: '2025-01-02T00:00:00Z' }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a formType outside FormTypeSchema', () => {
    expect(EventStreamSchema.safeParse(eventStream({ formType: 'EEA99' })).success).toBe(false)
  })
})

describe('ProjectionSchema', () => {
  it('accepts a fresh (non-stale) projection', () => {
    expect(ProjectionSchema.safeParse(projection()).success).toBe(true)
  })

  it('accepts state as arbitrary unknown JSON (polymorphic across form types)', () => {
    const result = ProjectionSchema.safeParse(
      projection({ state: { any: 'shape', is: 'accepted', nested: { works: true } } }),
    )
    expect(result.success).toBe(true)
  })

  it('flags stale: true when a rebuild is pending', () => {
    expect(ProjectionSchema.safeParse(projection({ stale: true })).success).toBe(true)
  })

  it('rejects a non-UUID builtFromEventId', () => {
    expect(ProjectionSchema.safeParse(projection({ builtFromEventId: 'not-a-uuid' })).success).toBe(
      false,
    )
  })
})

describe('SnapshotSchema', () => {
  it('accepts every documented snapshot reason', () => {
    for (const reason of ['ceo_sign_off', 'dol_submission', 'manual_request', 'pre_edit_backup']) {
      expect(SnapshotSchema.safeParse(snapshot({ reason })).success).toBe(true)
    }
  })

  it('rejects an undocumented reason (controlled vocabulary is exhaustive)', () => {
    expect(SnapshotSchema.safeParse(snapshot({ reason: 'ad_hoc' })).success).toBe(false)
  })

  it("accepts createdBy: 'system' for automated snapshots", () => {
    expect(SnapshotSchema.safeParse(snapshot({ createdBy: 'system' })).success).toBe(true)
  })

  it('rejects an empty createdBy', () => {
    expect(SnapshotSchema.safeParse(snapshot({ createdBy: '' })).success).toBe(false)
  })
})

describe('AppendResultSchema', () => {
  it('accepts a successful append with the sync job enqueued', () => {
    expect(AppendResultSchema.safeParse(appendResult()).success).toBe(true)
  })

  it('accepts projectionSyncTriggered: false (degraded queue, event still persisted)', () => {
    const result = AppendResultSchema.safeParse(appendResult({ projectionSyncTriggered: false }))
    expect(result.success).toBe(true)
  })

  it('rejects a negative newVersion', () => {
    expect(AppendResultSchema.safeParse(appendResult({ newVersion: -1 })).success).toBe(false)
  })
})

describe('ReplayRequestSchema', () => {
  it('accepts a replay request with includeEvent omitted (inclusive default)', () => {
    expect(ReplayRequestSchema.safeParse(replayRequest()).success).toBe(true)
  })

  it('accepts includeEvent explicitly set to false for an exclusive boundary', () => {
    const result = ReplayRequestSchema.safeParse(replayRequest({ includeEvent: false }))
    expect(result.success).toBe(true)
  })

  it('rejects a non-UUID formId', () => {
    expect(ReplayRequestSchema.safeParse(replayRequest({ formId: 'not-a-uuid' })).success).toBe(
      false,
    )
  })
})
