import { describe, it, expect } from 'vitest'
import {
  EEAEventTypeSchema,
  EventReasonSchema,
  EventSourceSchema,
  EventMetadataSchema,
  EEAEventSchema,
} from '../events.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const validMetadata = {
  triggeredBy: 'user-001',
  ip: '196.25.1.10',
  userAgent: 'Mozilla/5.0',
  sessionId: 'sess-abc123',
}

function buildValidEvent() {
  return {
    eventId: '01890a5d-ac96-774b-bcce-b302099a8057',
    tenantId: 'tenant-001',
    formType: 'EEA2' as const,
    formId: 'form-eea2-001',
    eventType: 'FIELD_UPDATED' as const,
    fieldPath: 'sectionB.table1_1.topManagement.africanMale',
    previousValue: 3,
    newValue: 4,
    metadata: validMetadata,
    timestamp: '2026-01-10T09:00:00Z',
  }
}

// ---------------------------------------------------------------------------
// Event type / reason / source vocabularies
// ---------------------------------------------------------------------------

describe('EEAEventTypeSchema', () => {
  it.each([
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
  ])('accepts event type %s', (eventType) => {
    expect(EEAEventTypeSchema.safeParse(eventType).success).toBe(true)
  })

  it('rejects an unknown event type — the union is exhaustive by design', () => {
    expect(EEAEventTypeSchema.safeParse('FORM_DELETED').success).toBe(false)
  })
})

describe('EventReasonSchema', () => {
  it.each(['manual_edit', 'payroll_reconciliation', 'prefill_carryforward', 'cross_form_sync'])(
    'accepts reason "%s"',
    (reason) => {
      expect(EventReasonSchema.safeParse(reason).success).toBe(true)
    },
  )

  it('rejects a free-text reason', () => {
    expect(EventReasonSchema.safeParse('because').success).toBe(false)
  })
})

describe('EventSourceSchema', () => {
  it.each(['eea12_prefill', 'prior_year_prefill', 'csv_import', 'api_sync'])(
    'accepts source "%s"',
    (source) => {
      expect(EventSourceSchema.safeParse(source).success).toBe(true)
    },
  )

  it('rejects an unknown source', () => {
    expect(EventSourceSchema.safeParse('manual').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// EventMetadataSchema
// ---------------------------------------------------------------------------

describe('EventMetadataSchema', () => {
  it('accepts server-captured metadata without optional reason/source', () => {
    expect(EventMetadataSchema.safeParse(validMetadata).success).toBe(true)
  })

  it('accepts metadata with reason and source from the controlled vocabularies', () => {
    expect(
      EventMetadataSchema.safeParse({
        ...validMetadata,
        reason: 'cross_form_sync',
        source: 'api_sync',
      }).success,
    ).toBe(true)
  })

  it.each(['triggeredBy', 'ip', 'userAgent', 'sessionId'] as const)(
    'requires audit field %s to be non-empty',
    (field) => {
      expect(EventMetadataSchema.safeParse({ ...validMetadata, [field]: '' }).success).toBe(false)
    },
  )
})

// ---------------------------------------------------------------------------
// EEAEventSchema
// ---------------------------------------------------------------------------

describe('EEAEventSchema', () => {
  it('accepts a FIELD_UPDATED event with both previous and new values', () => {
    const result = EEAEventSchema.safeParse(buildValidEvent())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timestamp).toBeInstanceOf(Date)
    }
  })

  it('accepts a form-level FORM_CREATED event with null fieldPath and previousValue', () => {
    const result = EEAEventSchema.safeParse({
      ...buildValidEvent(),
      eventType: 'FORM_CREATED',
      fieldPath: null,
      previousValue: null,
      newValue: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts an EEA1_POPIA_CONSENT event carrying the acknowledgement timestamp', () => {
    const result = EEAEventSchema.safeParse({
      ...buildValidEvent(),
      formType: 'EEA1',
      eventType: 'EEA1_POPIA_CONSENT',
      fieldPath: null,
      previousValue: null,
      newValue: '2026-01-10T09:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('preserves arbitrary JSON shapes in previousValue/newValue', () => {
    const result = EEAEventSchema.safeParse({
      ...buildValidEvent(),
      previousValue: { value: 3, percent: 25 },
      newValue: { value: 4, percent: 30 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-UUID eventId', () => {
    expect(EEAEventSchema.safeParse({ ...buildValidEvent(), eventId: 'evt-1' }).success).toBe(false)
  })

  it('rejects an unknown formType', () => {
    expect(EEAEventSchema.safeParse({ ...buildValidEvent(), formType: 'EEA3' }).success).toBe(false)
  })

  it('rejects an event without metadata — the audit context is mandatory', () => {
    const { metadata: _m, ...withoutMetadata } = buildValidEvent()
    expect(EEAEventSchema.safeParse(withoutMetadata).success).toBe(false)
  })
})
