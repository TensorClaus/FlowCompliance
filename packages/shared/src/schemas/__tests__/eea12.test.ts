import { describe, it, expect } from 'vitest'
import {
  BARRIER_CATEGORIES,
  BarrierCategoryEnum,
  BarrierSeveritySchema,
  BarrierEntrySchema,
  BarriersAnalysisSchema,
  WorkforceProfileRowSchema,
  WorkforceProfileSchema,
  EapComparisonRowSchema,
  EapComparisonSchema,
  EEA12ReportingPeriodSchema,
  EEA12Schema,
} from '../eea12.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const validCeoDeclaration = {
  fullName: 'Jane Doe',
  organisationName: 'Acme Holdings (Pty) Ltd',
  signatureDataUrl: 'data:image/png;base64,iVBOR',
  date: '2025-06-01',
  place: 'Johannesburg',
}

const validBarrierEntry = {
  category: 'recruitment_procedures' as const,
  description: 'Selection criteria favour candidates from historically advantaged institutions',
  severity: 'high' as const,
  affectedDesignatedGroups: ['designated' as const],
  mitigationActions: ['Broaden recruitment channels to include TVET colleges'],
  targetCompletionDate: '2026-03-31',
}

const validWorkforceRow = {
  occupationalLevel: 3 as const,
  race: 'A' as const,
  gender: 'F' as const,
  disability: false,
  count: 42,
}

const validEapComparisonRow = {
  occupationalLevel: 3 as const,
  actualPct: 35,
  eapPct: 40,
  gapPct: -5,
}

function buildValidEEA12() {
  return {
    employerId: '550e8400-e29b-41d4-a716-446655440000',
    reportingPeriod: {
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    },
    barriers: { entries: [validBarrierEntry] },
    workforceProfile: { rows: [validWorkforceRow] },
    eapComparison: { rows: [validEapComparisonRow] },
    ceoDeclaration: validCeoDeclaration,
    submittedAt: '2025-10-15T09:30:00Z',
  }
}

// ---------------------------------------------------------------------------
// BarrierCategoryEnum
// ---------------------------------------------------------------------------

describe('BarrierCategoryEnum', () => {
  it('contains 23 categories matching BARRIER_CATEGORIES', () => {
    expect(BARRIER_CATEGORIES).toHaveLength(23)
    for (const cat of BARRIER_CATEGORIES) {
      expect(BarrierCategoryEnum.safeParse(cat).success).toBe(true)
    }
  })

  it('rejects unknown category strings', () => {
    const result = BarrierCategoryEnum.safeParse('nonexistent_category')
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BarrierSeveritySchema
// ---------------------------------------------------------------------------

describe('BarrierSeveritySchema', () => {
  it.each(['low', 'medium', 'high'] as const)('accepts severity "%s"', (sev) => {
    expect(BarrierSeveritySchema.safeParse(sev).success).toBe(true)
  })

  it('rejects unknown severity', () => {
    expect(BarrierSeveritySchema.safeParse('critical').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BarrierEntrySchema
// ---------------------------------------------------------------------------

describe('BarrierEntrySchema', () => {
  it('accepts a valid barrier entry', () => {
    expect(BarrierEntrySchema.safeParse(validBarrierEntry).success).toBe(true)
  })

  it('rejects empty description', () => {
    const result = BarrierEntrySchema.safeParse({ ...validBarrierEntry, description: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty mitigationActions array', () => {
    const result = BarrierEntrySchema.safeParse({ ...validBarrierEntry, mitigationActions: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    const result = BarrierEntrySchema.safeParse({ category: 'other' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BarriersAnalysisSchema
// ---------------------------------------------------------------------------

describe('BarriersAnalysisSchema', () => {
  it('accepts analysis with one or more entries', () => {
    expect(BarriersAnalysisSchema.safeParse({ entries: [validBarrierEntry] }).success).toBe(true)
  })

  it('rejects empty entries array', () => {
    const result = BarriersAnalysisSchema.safeParse({ entries: [] })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// WorkforceProfileRowSchema
// ---------------------------------------------------------------------------

describe('WorkforceProfileRowSchema', () => {
  it('accepts a valid row', () => {
    expect(WorkforceProfileRowSchema.safeParse(validWorkforceRow).success).toBe(true)
  })

  it('accepts zero count', () => {
    expect(WorkforceProfileRowSchema.safeParse({ ...validWorkforceRow, count: 0 }).success).toBe(
      true,
    )
  })

  it('rejects negative count', () => {
    const result = WorkforceProfileRowSchema.safeParse({ ...validWorkforceRow, count: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer count', () => {
    const result = WorkforceProfileRowSchema.safeParse({ ...validWorkforceRow, count: 3.5 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid occupational level', () => {
    const result = WorkforceProfileRowSchema.safeParse({
      ...validWorkforceRow,
      occupationalLevel: 8,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid race code', () => {
    const result = WorkforceProfileRowSchema.safeParse({ ...validWorkforceRow, race: 'X' })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// WorkforceProfileSchema
// ---------------------------------------------------------------------------

describe('WorkforceProfileSchema', () => {
  it('accepts profile with rows', () => {
    expect(WorkforceProfileSchema.safeParse({ rows: [validWorkforceRow] }).success).toBe(true)
  })

  it('accepts profile with empty rows', () => {
    expect(WorkforceProfileSchema.safeParse({ rows: [] }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// EapComparisonRowSchema / EapComparisonSchema
// ---------------------------------------------------------------------------

describe('EapComparisonRowSchema', () => {
  it('accepts a valid comparison row', () => {
    expect(EapComparisonRowSchema.safeParse(validEapComparisonRow).success).toBe(true)
  })

  it('accepts negative gapPct', () => {
    expect(
      EapComparisonRowSchema.safeParse({ ...validEapComparisonRow, gapPct: -12.5 }).success,
    ).toBe(true)
  })
})

describe('EapComparisonSchema', () => {
  it('accepts comparison with rows', () => {
    expect(EapComparisonSchema.safeParse({ rows: [validEapComparisonRow] }).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// EEA12ReportingPeriodSchema
// ---------------------------------------------------------------------------

describe('EEA12ReportingPeriodSchema', () => {
  it('accepts valid period where endDate > startDate', () => {
    const result = EEA12ReportingPeriodSchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    })
    expect(result.success).toBe(true)
  })

  it('rejects endDate before startDate', () => {
    const result = EEA12ReportingPeriodSchema.safeParse({
      startDate: '2025-12-31',
      endDate: '2025-01-01',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('endDate')
    }
  })

  it('rejects equal startDate and endDate', () => {
    const result = EEA12ReportingPeriodSchema.safeParse({
      startDate: '2025-06-15',
      endDate: '2025-06-15',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty startDate', () => {
    const result = EEA12ReportingPeriodSchema.safeParse({
      startDate: '',
      endDate: '2025-12-31',
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// EEA12Schema — full return
// ---------------------------------------------------------------------------

describe('EEA12Schema', () => {
  it('accepts a complete valid EEA12 return', () => {
    const result = EEA12Schema.safeParse(buildValidEEA12())
    expect(result.success).toBe(true)
  })

  it('accepts minimal valid EEA12 with empty workforce and comparison rows', () => {
    const minimal = {
      ...buildValidEEA12(),
      workforceProfile: { rows: [] },
      eapComparison: { rows: [] },
    }
    expect(EEA12Schema.safeParse(minimal).success).toBe(true)
  })

  it('accepts EEA12 with all severity levels represented', () => {
    const entries = (['low', 'medium', 'high'] as const).map((severity) => ({
      ...validBarrierEntry,
      severity,
    }))
    const data = { ...buildValidEEA12(), barriers: { entries } }
    expect(EEA12Schema.safeParse(data).success).toBe(true)
  })

  it('rejects invalid employerId (not UUID)', () => {
    const result = EEA12Schema.safeParse({ ...buildValidEEA12(), employerId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects missing barriers', () => {
    const { barriers: _, ...rest } = buildValidEEA12()
    const result = EEA12Schema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid submittedAt (not ISO datetime)', () => {
    const result = EEA12Schema.safeParse({ ...buildValidEEA12(), submittedAt: '2025-10-15' })
    expect(result.success).toBe(false)
  })

  it('rejects missing ceoDeclaration', () => {
    const { ceoDeclaration: _, ...rest } = buildValidEEA12()
    const result = EEA12Schema.safeParse(rest)
    expect(result.success).toBe(false)
  })
})
