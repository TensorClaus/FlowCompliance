import { describe, expect, it } from 'vitest'
import { CROSS_FORM_RULES, type ValidationRule } from '../../schemas/validation-rules.js'
import { EngineError, evaluateRules } from '../engine.js'

const CLOCK_DATE = new Date('2026-07-15T10:00:00.000Z')
const clock = () => CLOCK_DATE

const OCCUPATIONAL_LEVELS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'totalPermanent',
  'temporaryEmployees',
  'grandTotal',
] as const

const MATRIX_ROW_KEYS = [
  'africanMale',
  'africanFemale',
  'colouredMale',
  'colouredFemale',
  'indianMale',
  'indianFemale',
  'whiteMale',
  'whiteFemale',
  'foreignNationalMale',
  'foreignNationalFemale',
  'total',
] as const

function matrixCell(value = 1) {
  return { value, percent: 10 }
}

function matrixRow(value = 1) {
  return Object.fromEntries(MATRIX_ROW_KEYS.map((key) => [key, matrixCell(value)]))
}

function occupationalMatrix(value = 1) {
  return Object.fromEntries(OCCUPATIONAL_LEVELS.map((level) => [level, matrixRow(value)]))
}

function remunerationCell(headcount = 1, totalRemuneration = 1000) {
  return { headcount, totalRemuneration }
}

function remunerationRow(headcount = 1) {
  return Object.fromEntries(MATRIX_ROW_KEYS.map((key) => [key, remunerationCell(headcount)]))
}

function remunerationMatrix(headcount = 1) {
  return Object.fromEntries(OCCUPATIONAL_LEVELS.map((level) => [level, remunerationRow(headcount)]))
}

function remBreakdownCell(fixed = 500, variable = 500, total?: number) {
  return total === undefined ? { fixed, variable } : { fixed, variable, total }
}

function remBreakdownRow(fixed = 500, variable = 500, total?: number) {
  return Object.fromEntries(
    MATRIX_ROW_KEYS.map((key) => [key, remBreakdownCell(fixed, variable, total)]),
  )
}

function remBreakdownMatrix(fixed = 500, variable = 500, total?: number) {
  return Object.fromEntries(
    OCCUPATIONAL_LEVELS.map((level) => [level, remBreakdownRow(fixed, variable, total)]),
  )
}

const address = {
  line1: '1 Main Rd',
  city: 'Cape Town',
  province: 'western_cape',
  postalCode: '8001',
}

const employerProfile = {
  tradeName: 'Acme',
  dtiRegistrationName: 'Acme Holdings',
  dtiRegistrationNumber: '2020/123456/07',
  payeSarsNumber: '7123456789',
  uifReferenceNumber: 'U123456789',
  eapType: 'national',
  industrySector: 'finance',
  setaClassification: 'FASSET',
  telephone: '0210000000',
  postalAddress: address,
  physicalAddress: address,
  ceoName: 'Jane Doe',
  ceoTelephone: '0210000001',
  ceoEmail: 'ceo@acme.co.za',
  seniorManagerName: 'John Smith',
  seniorManagerTelephone: '0210000002',
  seniorManagerEmail: 'hr@acme.co.za',
  businessType: 'private_company',
  organOfState: false,
  employeeCountBand: '150+',
}

const signedDeclaration = {
  fullName: 'Jane Doe',
  organisationName: 'Acme Holdings (Pty) Ltd',
  signatureDataUrl: 'data:image/png;base64,iVBOR',
  date: '2025-06-01',
  place: 'Johannesburg',
}

function buildEEA2Form(overrides: Record<string, unknown> = {}) {
  const report = {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    reportingYear: 2025,
    reportingPeriod: { from: '2024-10-01', to: '2025-09-30' },
    eePlanDuration: { from: '2025-01-01', to: '2029-12-31' },
    employerProfile,
    sectionB: {
      workforceProfile: occupationalMatrix(),
      disabilityProfile: occupationalMatrix(),
      annualTargets: occupationalMatrix(),
      disabilityTarget: { profilePct: 2, targetPct: 3 },
      targetsAchieved: true,
    },
    sectionC: {
      recruitment: occupationalMatrix(),
      promotions: occupationalMatrix(),
      terminations: occupationalMatrix(),
    },
    sectionD: { skillsDevelopment: occupationalMatrix() },
    sectionE: {
      sectorTargets5Year: [],
      annualTargetsNextYear: occupationalMatrix(),
      disabilityTargetNextYear: { value: 5, pct: 3 },
    },
    sectionF: {
      consultation: { consultativeBody: true, tradeUnion: false, employees: true },
      barriers: Array.from({ length: 23 }, (_, index) => ({
        categoryId: index + 1,
        label: `Barrier ${String(index + 1)}`,
        barrierExists: false,
        aaMeasuresDeveloped: false,
      })),
    },
    sectionG: { monitoringFrequency: 'quarterly', objectivesAchieved: true },
    sectionH: signedDeclaration,
    status: 'signed',
    ...overrides,
  }

  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    report,
    status: report.status,
    createdAt: '2025-10-01T00:00:00Z',
    updatedAt: '2025-10-02T00:00:00Z',
  }
}

function buildEEA4Form(overrides: Record<string, unknown> = {}) {
  const report = {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    linkedEEA2Id: '550e8400-e29b-41d4-a716-446655440001',
    sectionA: employerProfile,
    sectionC: remunerationMatrix(),
    sectionD1: remBreakdownMatrix(),
    sectionD2: remBreakdownMatrix(),
    sectionE: {
      median: 100_000,
      top5pctRange: { lowest: 500_000, highest: 900_000 },
      bottom5pctRange: { lowest: 50_000, highest: 80_000 },
    },
    declaration: signedDeclaration,
    status: 'signed',
    ...overrides,
  }

  return {
    id: '550e8400-e29b-41d4-a716-446655440002',
    report,
    status: report.status,
    createdAt: '2025-10-01T00:00:00Z',
    updatedAt: '2025-10-02T00:00:00Z',
  }
}

function run(rules: ValidationRule[], docs?: { EEA2?: unknown; EEA4?: unknown }) {
  const resolvedDocs = docs ?? { EEA2: buildEEA2Form(), EEA4: buildEEA4Form() }
  return evaluateRules(rules, resolvedDocs, { clock, reportId: 'validation-report-1' })
}

function rule(ruleId: string) {
  const found = CROSS_FORM_RULES.find((candidate) => candidate.ruleId === ruleId)
  if (!found) throw new Error(`Missing test rule ${ruleId}`)
  return found
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function setPath(root: unknown, path: string, value: unknown) {
  const keys = path.split('.')
  let current = root as Record<string, unknown>
  for (const key of keys.slice(0, -1)) {
    current = current[key] as Record<string, unknown>
  }
  current[keys.at(-1) as string] = value
}

describe('evaluateRules', () => {
  it('returns a report using supplied IDs and clock', () => {
    const report = run([rule('xform:eea4-requires-eea2')])

    expect(report.reportId).toBe('validation-report-1')
    expect(report.sourceFormId).toBe('550e8400-e29b-41d4-a716-446655440002')
    expect(report.targetFormId).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(report.generatedAt).toEqual(CLOCK_DATE)
    expect(report.rules[0]?.timestamp).toEqual(CLOCK_DATE)
    expect(report.allPassed).toBe(true)
    expect(report.errorCount).toBe(0)
    expect(report.warningCount).toBe(0)
  })

  it('fans out equality over 9 levels and 11 MatrixRow keys in schema order', () => {
    const report = run([rule('xform:eea2-eea4-headcount')])

    // Levels: topManagement, seniorManagement, professionallyQualified,
    // skilledTechnical, semiSkilled, unskilled, totalPermanent,
    // temporaryEmployees, grandTotal. MatrixRow keys: 10 demographic cells + total.
    expect(report.rules).toHaveLength(OCCUPATIONAL_LEVELS.length * MATRIX_ROW_KEYS.length)
    expect(report.rules[0]).toMatchObject({
      passed: true,
      sourcePath: 'sectionB.workforceProfile.topManagement.africanMale.value',
      targetPath: 'sectionC.topManagement.africanMale.headcount',
      sourceValue: 1,
      targetValue: 1,
    })
    expect(report.rules.at(-1)).toMatchObject({
      passed: true,
      sourcePath: 'sectionB.workforceProfile.grandTotal.total.value',
      targetPath: 'sectionC.grandTotal.total.headcount',
      sourceValue: 1,
      targetValue: 1,
    })
  })

  it('fails equality for the concrete mismatched cell only', () => {
    const eea4 = clone(buildEEA4Form())
    setPath(eea4, 'report.sectionC.topManagement.africanMale.headcount', 2)

    const report = run([rule('xform:eea2-eea4-headcount')], { EEA2: buildEEA2Form(), EEA4: eea4 })

    const failures = report.rules.filter((result) => !result.passed)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatchObject({
      sourcePath: 'sectionB.workforceProfile.topManagement.africanMale.value',
      targetPath: 'sectionC.topManagement.africanMale.headcount',
      sourceValue: 1,
      targetValue: 2,
    })
    expect(report.allPassed).toBe(false)
    expect(report.errorCount).toBe(1)
  })

  it('passes and fails lte comparisons per expanded cell', () => {
    const pass = run([rule('xform:eea2-disability-lte-workforce')])
    expect(pass.errorCount).toBe(0)

    const eea2 = clone(buildEEA2Form())
    setPath(eea2, 'report.sectionB.disabilityProfile.unskilled.whiteFemale.value', 3)
    const fail = run([rule('xform:eea2-disability-lte-workforce')], {
      EEA2: eea2,
      EEA4: buildEEA4Form(),
    })

    expect(fail.errorCount).toBe(1)
    expect(fail.rules.find((result) => !result.passed)).toMatchObject({
      sourcePath: 'sectionB.disabilityProfile.unskilled.whiteFemale.value',
      targetPath: 'sectionB.workforceProfile.unskilled.whiteFemale.value',
      sourceValue: 3,
      targetValue: 1,
    })
  })

  it('computes optional remuneration totals for gte paths before comparison', () => {
    const eea4 = buildEEA4Form({
      sectionD1: remBreakdownMatrix(700, 300),
      sectionD2: remBreakdownMatrix(400, 500),
    })
    const report = run([rule('xform:eea4-highpaid-gte-lowpaid')], {
      EEA2: buildEEA2Form(),
      EEA4: eea4,
    })

    expect(report.errorCount).toBe(0)
    expect(report.rules[0]).toMatchObject({
      sourceValue: 1000,
      targetValue: 900,
    })
  })

  it('fails gte comparisons without leaking remuneration values into messages', () => {
    const eea4 = buildEEA4Form({
      sectionD1: remBreakdownMatrix(111_111, 222_222),
      sectionD2: remBreakdownMatrix(444_444, 555_555),
    })
    const report = run([rule('xform:eea4-highpaid-gte-lowpaid')], {
      EEA2: buildEEA2Form(),
      EEA4: eea4,
    })

    expect(report.errorCount).toBe(OCCUPATIONAL_LEVELS.length * MATRIX_ROW_KEYS.length)
    expect(report.rules[0]).toMatchObject({ sourceValue: 333_333, targetValue: 999_999 })
    for (const result of report.rules) {
      expect(result.message).not.toMatch(/\b(?:111111|222222|333333|444444|555555|999999)\b/)
    }
  })

  it('passes and fails requires rules based on signature trigger and target presence', () => {
    const pass = run([rule('xform:eea2-ceo-section-completeness')])
    expect(pass.errorCount).toBe(0)

    const eea2 = clone(buildEEA2Form())
    setPath(eea2, 'report.sectionC', undefined)
    const fail = run([rule('xform:eea2-ceo-section-completeness')], {
      EEA2: eea2,
      EEA4: buildEEA4Form(),
    })

    expect(fail.errorCount).toBe(1)
    expect(fail.rules[0]).toMatchObject({
      passed: false,
      sourceValue: 'data:image/png;base64,iVBOR',
      targetValue: false,
      targetPath: 'meta.priorSectionsComplete',
    })
  })

  it('does not enforce requires when signatureDataUrl is empty or absent', () => {
    const eea2 = clone(buildEEA2Form())
    setPath(eea2, 'report.sectionC', undefined)
    setPath(eea2, 'report.sectionH.signatureDataUrl', '')

    const report = run([rule('xform:eea2-ceo-section-completeness')], {
      EEA2: eea2,
      EEA4: buildEEA4Form(),
    })

    expect(report.errorCount).toBe(0)
    expect(report.rules[0]).toMatchObject({ passed: true, sourceValue: '' })
  })

  it('fails requires without throwing when EEA4 target document is missing', () => {
    const customRequires: ValidationRule = {
      ruleId: 'xform:test-eea2-requires-eea4',
      name: 'Test requires target document',
      description: 'Test target document handling',
      severity: 'error',
      sourceForm: 'EEA2',
      targetForm: 'EEA4',
      sourcePath: 'meta.status',
      targetPath: 'linkedEEA2Id',
      ruleType: 'requires',
    }

    const report = run([customRequires], { EEA2: buildEEA2Form(), EEA4: undefined })

    expect(report.errorCount).toBe(1)
    expect(report.rules[0]).toMatchObject({
      passed: false,
      sourceValue: 'signed',
      targetValue: undefined,
      sourcePath: 'meta.status',
      targetPath: 'linkedEEA2Id',
    })
  })

  it('aggregates one-wildcard requires paths into one warning result', () => {
    const pass = run([rule('xform:eea2-targets-match-levels')])
    expect(pass.rules).toHaveLength(1)
    expect(pass.warningCount).toBe(0)
    expect(pass.rules[0]?.sourceValue).toHaveLength(OCCUPATIONAL_LEVELS.length)
    expect(pass.rules[0]?.targetValue).toHaveLength(OCCUPATIONAL_LEVELS.length)

    const eea2 = clone(buildEEA2Form())
    setPath(eea2, 'report.sectionB.workforceProfile.topManagement.total.value', undefined)
    const fail = run([rule('xform:eea2-targets-match-levels')], {
      EEA2: eea2,
      EEA4: buildEEA4Form(),
    })

    expect(fail.warningCount).toBe(1)
    expect(fail.allPassed).toBe(true)
    expect(fail.rules[0]).toMatchObject({
      passed: false,
      severity: 'warning',
      sourcePath: 'sectionB.annualTargets.*.total.value',
      targetPath: 'sectionB.workforceProfile.*.total.value',
    })
  })

  it('passes and fails bundle status checks', () => {
    const pass = run([rule('xform:bundle-signed-before-dol')])
    expect(pass.allPassed).toBe(true)

    const eea4 = buildEEA4Form({ status: 'pending_ceo' })
    const fail = run([rule('xform:bundle-signed-before-dol')], {
      EEA2: buildEEA2Form(),
      EEA4: eea4,
    })

    expect(fail.allPassed).toBe(false)
    expect(fail.errorCount).toBe(1)
    expect(fail.rules[0]).toMatchObject({
      sourceValue: 'signed',
      targetValue: 'pending_ceo',
    })
  })

  it('reads explicit D1/D2 totals without recomputing them', () => {
    const eea4 = buildEEA4Form({
      sectionD1: remBreakdownMatrix(1, 1, 10),
      sectionD2: remBreakdownMatrix(1, 1, 9),
    })
    const report = run([rule('xform:eea4-highpaid-gte-lowpaid')], {
      EEA2: buildEEA2Form(),
      EEA4: eea4,
    })

    expect(report.rules[0]).toMatchObject({
      passed: true,
      sourceValue: 10,
      targetValue: 9,
    })
  })

  it('fails bundle without throwing when EEA4 is missing', () => {
    const report = run([rule('xform:bundle-signed-before-dol')], {
      EEA2: buildEEA2Form(),
      EEA4: undefined,
    })

    expect(report.errorCount).toBe(1)
    expect(report.rules[0]).toMatchObject({ passed: false, targetValue: undefined })
  })

  it('feeds in-run headcount result into EEA4 signature requires rule', () => {
    const rules = [rule('xform:eea2-eea4-headcount'), rule('xform:eea4-ceo-headcount-validated')]
    const pass = run(rules)
    expect(pass.rules.at(-1)).toMatchObject({
      ruleId: 'xform:eea4-ceo-headcount-validated',
      passed: true,
      targetValue: true,
    })

    const eea4 = clone(buildEEA4Form())
    setPath(eea4, 'report.sectionC.grandTotal.total.headcount', 9)
    const fail = run(rules, { EEA2: buildEEA2Form(), EEA4: eea4 })

    expect(fail.rules.at(-1)).toMatchObject({
      ruleId: 'xform:eea4-ceo-headcount-validated',
      passed: false,
      targetValue: false,
    })
  })

  it('throws EngineError for malformed paths', () => {
    const malformed: ValidationRule = {
      ...rule('xform:eea2-eea4-headcount'),
      sourcePath: 'sectionB..workforceProfile',
    }

    expect(() => run([malformed])).toThrow(EngineError)
  })

  it('throws EngineError for unsupported path and rule shapes', () => {
    const tooManyWildcards: ValidationRule = {
      ...rule('xform:eea2-eea4-headcount'),
      sourcePath: 'sectionB.*.*.*.value',
      targetPath: 'sectionC.*.*.*.headcount',
    }
    const wildcardMismatch: ValidationRule = {
      ...rule('xform:eea2-eea4-headcount'),
      sourcePath: 'sectionB.workforceProfile.*.*.value',
      targetPath: 'sectionC.*.headcount',
    }
    const nullTargetComparable: ValidationRule = {
      ...rule('xform:eea2-eea4-headcount'),
      targetPath: null,
    }
    const unsupportedForm: ValidationRule = {
      ...rule('xform:eea2-eea4-headcount'),
      sourceForm: 'EEA1',
    }
    const requiresWithoutTarget: ValidationRule = {
      ...rule('xform:eea2-ceo-section-completeness'),
      targetPath: null,
    }
    const requiresWildcardMismatch: ValidationRule = {
      ...rule('xform:eea2-targets-match-levels'),
      targetPath: 'sectionB.workforceProfile.topManagement.total.value',
    }
    const unsupportedRuleType = {
      ...rule('xform:eea2-eea4-headcount'),
      ruleType: 'unsupported',
    } as unknown as ValidationRule

    expect(() => run([tooManyWildcards])).toThrow(EngineError)
    expect(() => run([wildcardMismatch])).toThrow(EngineError)
    expect(() => run([nullTargetComparable])).toThrow(EngineError)
    expect(() => run([unsupportedForm])).toThrow(EngineError)
    expect(() => run([requiresWithoutTarget])).toThrow(EngineError)
    expect(() => run([requiresWildcardMismatch])).toThrow(EngineError)
    expect(() => run([unsupportedRuleType])).toThrow(EngineError)
  })

  it('fails numeric comparisons when either resolved value is nonnumeric', () => {
    const nonnumericLte: ValidationRule = {
      ruleId: 'xform:test-nonnumeric-lte',
      name: 'Test nonnumeric lte',
      description: 'Test nonnumeric lte',
      severity: 'error',
      sourceForm: 'EEA2',
      targetForm: null,
      sourcePath: 'meta.status',
      targetPath: 'meta.status',
      ruleType: 'lte',
    }

    const report = run([nonnumericLte])

    expect(report.errorCount).toBe(1)
    expect(report.rules[0]).toMatchObject({
      passed: false,
      sourceValue: 'signed',
      targetValue: 'signed',
    })
  })
})
