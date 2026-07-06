import { describe, it, expect } from 'vitest'
import {
  SectorCodeSchema,
  DesignatedGroupCodeSchema,
  NumericalGoalSchema,
  PlanYearSchema,
  BarriersRemovalPlanSchema,
  DisputeResolutionSchema,
  EEA13Schema,
} from '../eea13.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const validCeoDeclaration = {
  fullName: 'Thabo Mbeki',
  organisationName: 'Compliance Corp (Pty) Ltd',
  signatureDataUrl: 'data:image/png;base64,abc123',
  date: '2025-06-01',
  place: 'Pretoria',
}

const validGoal = {
  occupationalLevel: 3 as const,
  designatedGroup: 'A' as const,
  currentRepresentation: 35,
  target: 45,
  eapBenchmark: 40,
  timeframe: 'By 31 December 2026',
  targetDate: '2026-12-31',
  measures: ['Targeted recruitment from designated institutions'],
}

const validPlanYear = {
  year: 2025,
  goals: [validGoal],
  reviewDate: '2025-10-01',
}

const validBarriersRemoval = {
  barrierCategory: 'recruitment_procedures' as const,
  action: 'Review selection criteria to remove indirect barriers',
  responsible: 'HR Director',
  timeline: 'Complete by 30 June 2026',
  measurableOutcome: 'Selection criteria reviewed and approved by EECF',
}

const validDisputeResolution = {
  internalProcedure: 'Employees may lodge a written grievance with HR',
  ccmaReferralProcess: 'Chapter II disputes referred to CCMA within 6 months',
  labourCourtEscalation: 'Chapter III disputes escalated to Labour Court',
}

function buildValidEEA13() {
  return {
    employerId: '550e8400-e29b-41d4-a716-446655440000',
    sectorCode: 'finance_insurance' as const,
    planPeriod: {
      startDate: '2025-01-01',
      endDate: '2029-12-31',
    },
    consultation: {
      consultedWithEmployees: true,
      eecfEstablished: true,
      consultationDate: '2024-11-15',
    },
    workforceAnalysis: {
      totalEmployees: 200,
      designatedEmployees: 150,
      foreignNationals: 10,
    },
    yearlyPlans: [
      { ...validPlanYear, year: 2025 },
      { ...validPlanYear, year: 2026 },
      { ...validPlanYear, year: 2027 },
    ],
    barriersRemovalPlan: [validBarriersRemoval],
    disputeResolution: validDisputeResolution,
    monitoringMechanism: 'Quarterly review by EECF with dashboard reporting',
    ceoDeclaration: validCeoDeclaration,
    submittedAt: '2025-01-15T08:00:00Z',
  }
}

// ---------------------------------------------------------------------------
// SectorCodeSchema
// ---------------------------------------------------------------------------

describe('SectorCodeSchema', () => {
  it('accepts all 18 sector codes', () => {
    const codes = [
      'accommodation_food_service',
      'administrative_support',
      'agriculture_forestry_fishing',
      'arts_entertainment_recreation',
      'construction',
      'education',
      'electricity_gas',
      'finance_insurance',
      'health_social_work',
      'information_communication',
      'manufacturing',
      'mining_quarrying',
      'professional_scientific_technical',
      'public_administration_defence',
      'real_estate',
      'transport_storage',
      'water_supply',
      'wholesale_retail_trade',
    ]
    for (const code of codes) {
      expect(SectorCodeSchema.safeParse(code).success).toBe(true)
    }
    expect(codes).toHaveLength(18)
  })

  it('rejects unknown sector code', () => {
    expect(SectorCodeSchema.safeParse('unknown_sector').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DesignatedGroupCodeSchema
// ---------------------------------------------------------------------------

describe('DesignatedGroupCodeSchema', () => {
  it.each(['A', 'C', 'I', 'W', 'M', 'F'])('accepts code "%s"', (code) => {
    expect(DesignatedGroupCodeSchema.safeParse(code).success).toBe(true)
  })

  it('rejects invalid code', () => {
    expect(DesignatedGroupCodeSchema.safeParse('X').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// NumericalGoalSchema — CRITICAL compliance refines
// ---------------------------------------------------------------------------

describe('NumericalGoalSchema', () => {
  it('accepts a valid goal where target >= eapBenchmark', () => {
    expect(NumericalGoalSchema.safeParse(validGoal).success).toBe(true)
  })

  it('accepts goal where target equals eapBenchmark exactly', () => {
    const goal = { ...validGoal, target: 40, eapBenchmark: 40 }
    expect(NumericalGoalSchema.safeParse(goal).success).toBe(true)
  })

  it('rejects target below eapBenchmark with error path containing "target"', () => {
    const goal = { ...validGoal, target: 30, eapBenchmark: 40 }
    const result = NumericalGoalSchema.safeParse(goal)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('target'))).toBe(true)
      expect(result.error.issues.some((i) => i.message.includes('EAP benchmark'))).toBe(true)
    }
  })

  it('rejects timeframe "ongoing" (lowercase)', () => {
    const goal = { ...validGoal, timeframe: 'ongoing' }
    const result = NumericalGoalSchema.safeParse(goal)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('timeframe'))).toBe(true)
    }
  })

  it('rejects timeframe "Ongoing" (capitalised)', () => {
    const goal = { ...validGoal, timeframe: 'Ongoing' }
    const result = NumericalGoalSchema.safeParse(goal)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('timeframe'))).toBe(true)
    }
  })

  it('rejects timeframe "ONGOING" (uppercase)', () => {
    const goal = { ...validGoal, timeframe: 'ONGOING' }
    const result = NumericalGoalSchema.safeParse(goal)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('timeframe'))).toBe(true)
    }
  })

  it('rejects timeframe containing "ongoing" in a phrase', () => {
    const goal = { ...validGoal, timeframe: 'This is an ongoing commitment' }
    const result = NumericalGoalSchema.safeParse(goal)
    expect(result.success).toBe(false)
  })

  it('rejects error message references EEA Regulation 4', () => {
    const goal = { ...validGoal, timeframe: 'ongoing' }
    const result = NumericalGoalSchema.safeParse(goal)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('EEA Regulation 4'))).toBe(true)
    }
  })

  it('rejects target > 100', () => {
    const goal = { ...validGoal, target: 101, eapBenchmark: 5 }
    const result = NumericalGoalSchema.safeParse(goal)
    expect(result.success).toBe(false)
  })

  it('rejects empty measures array', () => {
    const goal = { ...validGoal, measures: [] }
    const result = NumericalGoalSchema.safeParse(goal)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PlanYearSchema
// ---------------------------------------------------------------------------

describe('PlanYearSchema', () => {
  it('accepts a valid plan year', () => {
    expect(PlanYearSchema.safeParse(validPlanYear).success).toBe(true)
  })

  it('accepts plan year with optional annualBudget', () => {
    const py = { ...validPlanYear, annualBudget: 500_000 }
    expect(PlanYearSchema.safeParse(py).success).toBe(true)
  })

  it('rejects year below 2025', () => {
    expect(PlanYearSchema.safeParse({ ...validPlanYear, year: 2024 }).success).toBe(false)
  })

  it('rejects year above 2030', () => {
    expect(PlanYearSchema.safeParse({ ...validPlanYear, year: 2031 }).success).toBe(false)
  })

  it('rejects empty goals array', () => {
    expect(PlanYearSchema.safeParse({ ...validPlanYear, goals: [] }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BarriersRemovalPlanSchema
// ---------------------------------------------------------------------------

describe('BarriersRemovalPlanSchema', () => {
  it('accepts a valid removal plan entry', () => {
    expect(BarriersRemovalPlanSchema.safeParse(validBarriersRemoval).success).toBe(true)
  })

  it('rejects timeline "ongoing" (lowercase)', () => {
    const entry = { ...validBarriersRemoval, timeline: 'ongoing' }
    const result = BarriersRemovalPlanSchema.safeParse(entry)
    expect(result.success).toBe(false)
  })

  it('rejects timeline "Ongoing" (mixed case)', () => {
    const entry = { ...validBarriersRemoval, timeline: 'Ongoing basis' }
    const result = BarriersRemovalPlanSchema.safeParse(entry)
    expect(result.success).toBe(false)
  })

  it('rejects empty action string', () => {
    const entry = { ...validBarriersRemoval, action: '' }
    expect(BarriersRemovalPlanSchema.safeParse(entry).success).toBe(false)
  })

  it('rejects invalid barrier category', () => {
    const entry = { ...validBarriersRemoval, barrierCategory: 'fake_category' }
    expect(BarriersRemovalPlanSchema.safeParse(entry).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DisputeResolutionSchema
// ---------------------------------------------------------------------------

describe('DisputeResolutionSchema', () => {
  it('accepts a valid dispute resolution object', () => {
    expect(DisputeResolutionSchema.safeParse(validDisputeResolution).success).toBe(true)
  })

  it('rejects empty internalProcedure', () => {
    const dr = { ...validDisputeResolution, internalProcedure: '' }
    expect(DisputeResolutionSchema.safeParse(dr).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// EEA13Schema — full 5-year plan (CRITICAL)
// ---------------------------------------------------------------------------

describe('EEA13Schema', () => {
  it('accepts a complete valid 5-year plan with 3 yearly plans (minimum)', () => {
    const result = EEA13Schema.safeParse(buildValidEEA13())
    expect(result.success).toBe(true)
  })

  it('accepts a complete plan with 5 yearly plans', () => {
    const data = buildValidEEA13()
    data.yearlyPlans = [
      { ...validPlanYear, year: 2025 },
      { ...validPlanYear, year: 2026 },
      { ...validPlanYear, year: 2027 },
      { ...validPlanYear, year: 2028 },
      { ...validPlanYear, year: 2029 },
    ]
    expect(EEA13Schema.safeParse(data).success).toBe(true)
  })

  it('accepts plan with goals above EAP benchmark', () => {
    const data = buildValidEEA13()
    const highGoal = { ...validGoal, target: 80, eapBenchmark: 40 }
    data.yearlyPlans = [
      { ...validPlanYear, year: 2025, goals: [highGoal] },
      { ...validPlanYear, year: 2026, goals: [highGoal] },
      { ...validPlanYear, year: 2027, goals: [highGoal] },
    ]
    expect(EEA13Schema.safeParse(data).success).toBe(true)
  })

  // --- Invalid cases ---

  it('rejects consultedWithEmployees === false', () => {
    const data = buildValidEEA13()
    data.consultation.consultedWithEmployees = false
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('consultedWithEmployees'))).toBe(true)
      expect(result.error.issues.some((i) => i.message.includes('EEA s.16'))).toBe(true)
    }
  })

  it('rejects yearlyPlans with fewer than 3 entries', () => {
    const data = buildValidEEA13()
    data.yearlyPlans = [
      { ...validPlanYear, year: 2025 },
      { ...validPlanYear, year: 2026 },
    ]
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects yearlyPlans with more than 5 entries', () => {
    const data = buildValidEEA13()
    data.yearlyPlans = [
      { ...validPlanYear, year: 2025 },
      { ...validPlanYear, year: 2026 },
      { ...validPlanYear, year: 2027 },
      { ...validPlanYear, year: 2028 },
      { ...validPlanYear, year: 2029 },
      { ...validPlanYear, year: 2030 },
    ]
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects planPeriod that is not approximately 5 years', () => {
    const data = buildValidEEA13()
    // Only 1 year
    data.planPeriod = { startDate: '2025-01-01', endDate: '2026-01-01' }
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages.some((m) => m.includes('5 years'))).toBe(true)
    }
  })

  it('rejects planPeriod that is too long (7 years)', () => {
    const data = buildValidEEA13()
    data.planPeriod = { startDate: '2025-01-01', endDate: '2032-01-01' }
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects invalid sectorCode', () => {
    const data = { ...buildValidEEA13(), sectorCode: 'invalid_sector' }
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects missing barriersRemovalPlan', () => {
    const data = buildValidEEA13()
    data.barriersRemovalPlan = []
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects non-positive totalEmployees', () => {
    const data = buildValidEEA13()
    data.workforceAnalysis.totalEmployees = 0
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects negative foreignNationals', () => {
    const data = buildValidEEA13()
    data.workforceAnalysis.foreignNationals = -1
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects missing ceoDeclaration', () => {
    const { ceoDeclaration: _, ...rest } = buildValidEEA13()
    const result = EEA13Schema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid submittedAt', () => {
    const data = { ...buildValidEEA13(), submittedAt: 'not-a-datetime' }
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects empty monitoringMechanism', () => {
    const data = { ...buildValidEEA13(), monitoringMechanism: '' }
    const result = EEA13Schema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
