import { describe, expect, it } from 'vitest'
import {
  EEAEventSchema,
  EEAEventTypeSchema,
  EventMetadataSchema,
  EventReasonSchema,
  EventSourceSchema,
} from '../events.js'

function metadata(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    triggeredBy: 'user-123',
    ip: '196.25.1.1',
    userAgent: 'Mozilla/5.0',
    sessionId: 'session-abc',
    ...overrides,
  }
}

function event(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    tenantId: 'tenant-001',
    formType: 'EEA2',
    formId: 'form-001',
    eventType: 'FIELD_UPDATED',
    fieldPath: 'sectionA.tradingName',
    previousValue: 'Old Name',
    newValue: 'New Name',
    metadata: metadata(),
    timestamp: '2025-06-01T10:00:00Z',
    ...overrides,
  }
}

describe('EEAEventTypeSchema', () => {
  it('accepts every documented event type', () => {
    const eventTypes = [
      'FORM_CREATED',
      'FIELD_UPDATED',
      'SECTION_COMPLETED',
      'SECTION_UNLOCKED',
      'CROSS_FORM_SYNC',
      'VALIDATION_FAILED',
      'VALIDATION_RESOLVED',
      'PREFILL_APPLIED',
      'PREFILL_OVERRIDDEN',
      'HITL_GATE_OPENED',
      'HITL_GATE_SIGNED',
      'HITL_GATE_REJECTED',
      'SUBMISSION_BUNDLED',
      'SUBMITTED',
      'EEA1_POPIA_CONSENT',
    ]
    for (const eventType of eventTypes) {
      expect(EEAEventTypeSchema.safeParse(eventType).success).toBe(true)
    }
  })

  it('rejects an unrecognised event type', () => {
    expect(EEAEventTypeSchema.safeParse('FORM_DELETED').success).toBe(false)
  })
})

describe('EventReasonSchema', () => {
  it('accepts every documented reason', () => {
    for (const reason of [
      'manual_edit',
      'payroll_reconciliation',
      'prefill_carryforward',
      'cross_form_sync',
    ]) {
      expect(EventReasonSchema.safeParse(reason).success).toBe(true)
    }
  })

  it('rejects an unrecognised reason', () => {
    expect(EventReasonSchema.safeParse('bulk_import').success).toBe(false)
  })
})

describe('EventSourceSchema', () => {
  it('accepts every documented source', () => {
    for (const source of ['eea12_prefill', 'prior_year_prefill', 'csv_import', 'api_sync']) {
      expect(EventSourceSchema.safeParse(source).success).toBe(true)
    }
  })

  it('rejects an unrecognised source', () => {
    expect(EventSourceSchema.safeParse('unknown_source').success).toBe(false)
  })
})

describe('EventMetadataSchema', () => {
  it('accepts metadata with reason and source both omitted', () => {
    expect(EventMetadataSchema.safeParse(metadata()).success).toBe(true)
  })

  it('accepts metadata with reason and source both supplied', () => {
    const result = EventMetadataSchema.safeParse(
      metadata({ reason: 'manual_edit', source: 'csv_import' }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects metadata missing triggeredBy (server must always attribute the actor)', () => {
    const withoutTriggeredBy = metadata()
    delete (withoutTriggeredBy as Record<string, unknown>).triggeredBy

    expect(EventMetadataSchema.safeParse(withoutTriggeredBy).success).toBe(false)
  })
})

describe('EEAEventSchema', () => {
  it('accepts a well-formed FIELD_UPDATED event', () => {
    expect(EEAEventSchema.safeParse(event()).success).toBe(true)
  })

  it('accepts null fieldPath, previousValue and newValue for a form-level event', () => {
    const result = EEAEventSchema.safeParse(
      event({
        eventType: 'FORM_CREATED',
        fieldPath: null,
        previousValue: null,
        newValue: null,
      }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects an eventType outside EEAEventTypeSchema', () => {
    expect(EEAEventSchema.safeParse(event({ eventType: 'FORM_DELETED' })).success).toBe(false)
  })

  it('rejects a non-UUID eventId', () => {
    expect(EEAEventSchema.safeParse(event({ eventId: 'not-a-uuid' })).success).toBe(false)
  })

  it('rejects an empty formId', () => {
    expect(EEAEventSchema.safeParse(event({ formId: '' })).success).toBe(false)
  })
})
