import { describe, expect, it } from 'vitest'
import {
  BarrierRecordSchema,
  ConsultationRecordSchema,
  DateRangeSchema,
  JustifiableReasonsRowSchema,
  JustifiableReasonsTableSchema,
  SectorTargetRowSchema,
} from '../eea2.js'

function justifiableReasonsRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    occupationalLevel: 'Top Management',
    insufficientRecruitment: false,
    insufficientPromotion: false,
    insufficientQualified: true,
    ccmaAward: false,
    transferOfBusiness: false,
    mergerAcquisition: false,
    economicConditions: false,
    ...overrides,
  }
}

describe('DateRangeSchema', () => {
  it('accepts a valid ISO from/to range and coerces to Date instances', () => {
    const result = DateRangeSchema.safeParse({ from: '2024-10-01', to: '2025-09-30' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.from).toBeInstanceOf(Date)
      expect(result.data.to).toBeInstanceOf(Date)
    }
  })

  it('rejects an unparseable date string', () => {
    expect(DateRangeSchema.safeParse({ from: 'not-a-date', to: '2025-09-30' }).success).toBe(false)
  })

  it('rejects a range missing the `to` boundary', () => {
    expect(DateRangeSchema.safeParse({ from: '2024-10-01' }).success).toBe(false)
  })
})

describe('JustifiableReasonsRowSchema', () => {
  it('accepts a row with all seven DC-003 Section B reason flags', () => {
    expect(JustifiableReasonsRowSchema.safeParse(justifiableReasonsRow()).success).toBe(true)
  })

  it('rejects a row missing one of the seven reason flags', () => {
    const incomplete = justifiableReasonsRow()
    delete (incomplete as Record<string, unknown>).ccmaAward

    expect(JustifiableReasonsRowSchema.safeParse(incomplete).success).toBe(false)
  })
})

describe('JustifiableReasonsTableSchema', () => {
  it('accepts a table with all 8 rows (7 occupational levels + disability)', () => {
    const table = {
      topManagement: justifiableReasonsRow(),
      seniorManagement: justifiableReasonsRow(),
      professionallyQualified: justifiableReasonsRow(),
      skilledTechnical: justifiableReasonsRow(),
      semiSkilled: justifiableReasonsRow(),
      unskilled: justifiableReasonsRow(),
      totalPermanent: justifiableReasonsRow(),
      disability: justifiableReasonsRow(),
    }
    expect(JustifiableReasonsTableSchema.safeParse(table).success).toBe(true)
  })

  it('rejects a table missing the disability row', () => {
    const table: Record<string, unknown> = {
      topManagement: justifiableReasonsRow(),
      seniorManagement: justifiableReasonsRow(),
      professionallyQualified: justifiableReasonsRow(),
      skilledTechnical: justifiableReasonsRow(),
      semiSkilled: justifiableReasonsRow(),
      unskilled: justifiableReasonsRow(),
      totalPermanent: justifiableReasonsRow(),
    }
    expect(JustifiableReasonsTableSchema.safeParse(table).success).toBe(false)
  })
})

describe('ConsultationRecordSchema', () => {
  it('accepts a record where at least one consultation channel is true', () => {
    const result = ConsultationRecordSchema.safeParse({
      consultativeBody: true,
      tradeUnion: false,
      employees: false,
    })
    expect(result.success).toBe(true)
  })

  it('parses even when all three channels are false (schema-level; app layer enforces the "at least one" rule)', () => {
    const result = ConsultationRecordSchema.safeParse({
      consultativeBody: false,
      tradeUnion: false,
      employees: false,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a record missing the tradeUnion field', () => {
    const result = ConsultationRecordSchema.safeParse({ consultativeBody: true, employees: false })
    expect(result.success).toBe(false)
  })
})

function barrier(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    categoryId: 1,
    label: 'Recruitment procedures',
    barrierExists: true,
    aaMeasuresDeveloped: false,
    ...overrides,
  }
}

describe('BarrierRecordSchema', () => {
  it('accepts a barrier record with implementation dates omitted', () => {
    expect(BarrierRecordSchema.safeParse(barrier()).success).toBe(true)
  })

  it('accepts a barrier record with implementation start/end supplied', () => {
    const result = BarrierRecordSchema.safeParse(
      barrier({ implementationStart: '2025-01-01', implementationEnd: '2025-12-31' }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a categoryId outside the 1-23 DC-003 range', () => {
    expect(BarrierRecordSchema.safeParse(barrier({ categoryId: 24 })).success).toBe(false)
    expect(BarrierRecordSchema.safeParse(barrier({ categoryId: 0 })).success).toBe(false)
  })
})

describe('SectorTargetRowSchema', () => {
  it('accepts a valid Table 6.1 sector target row', () => {
    const result = SectorTargetRowSchema.safeParse({
      occupationalLevel: 'Top Management',
      designatedGroup: 'African Female',
      genderTarget: 45.5,
      fiveYearTarget: 12,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a genderTarget above 100 percent', () => {
    const result = SectorTargetRowSchema.safeParse({
      occupationalLevel: 'Top Management',
      designatedGroup: 'African Female',
      genderTarget: 150,
      fiveYearTarget: 12,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a negative fiveYearTarget', () => {
    const result = SectorTargetRowSchema.safeParse({
      occupationalLevel: 'Top Management',
      designatedGroup: 'African Female',
      genderTarget: 45.5,
      fiveYearTarget: -1,
    })
    expect(result.success).toBe(false)
  })
})
