import { describe, it, expect } from 'vitest'
import {
  ValidationSeveritySchema,
  RuleTypeSchema,
  ValidationRuleSchema,
  ValidationResultSchema,
  ValidationReportSchema,
  CROSS_FORM_RULES,
} from '../validation-rules.js'

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

describe('ValidationSeveritySchema', () => {
  it.each(['error', 'warning', 'info'])('accepts severity "%s"', (severity) => {
    expect(ValidationSeveritySchema.safeParse(severity).success).toBe(true)
  })

  it('rejects an unknown severity', () => {
    expect(ValidationSeveritySchema.safeParse('critical').success).toBe(false)
  })
})

describe('RuleTypeSchema', () => {
  it.each(['equality', 'lte', 'gte', 'requires', 'bundle'])('accepts ruleType "%s"', (type) => {
    expect(RuleTypeSchema.safeParse(type).success).toBe(true)
  })

  it('rejects an unknown ruleType', () => {
    expect(RuleTypeSchema.safeParse('regex').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ValidationRuleSchema
// ---------------------------------------------------------------------------

describe('ValidationRuleSchema', () => {
  const validRule = {
    ruleId: 'xform:test-rule',
    name: 'Test Rule',
    description: 'A rule used in tests',
    severity: 'error' as const,
    sourceForm: 'EEA2' as const,
    targetForm: 'EEA4' as const,
    sourcePath: 'sectionB.total',
    targetPath: 'sectionC.total',
    ruleType: 'equality' as const,
  }

  it('accepts a valid cross-form rule', () => {
    expect(ValidationRuleSchema.safeParse(validRule).success).toBe(true)
  })

  it('accepts an intra-form rule with null targetForm and targetPath', () => {
    expect(
      ValidationRuleSchema.safeParse({ ...validRule, targetForm: null, targetPath: null }).success,
    ).toBe(true)
  })

  it('rejects an unknown sourceForm', () => {
    expect(ValidationRuleSchema.safeParse({ ...validRule, sourceForm: 'EEA99' }).success).toBe(
      false,
    )
  })

  it('rejects an empty ruleId', () => {
    expect(ValidationRuleSchema.safeParse({ ...validRule, ruleId: '' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ValidationResultSchema / ValidationReportSchema
// ---------------------------------------------------------------------------

describe('ValidationResultSchema', () => {
  const validResult = {
    ruleId: 'xform:eea2-eea4-headcount',
    passed: false,
    severity: 'error' as const,
    message: 'Headcount mismatch at topManagement.africanMale',
    sourceValue: 12,
    targetValue: 11,
    sourcePath: 'sectionB.workforceProfile.topManagement.africanMale.value',
    targetPath: 'sectionC.topManagement.africanMale.headcount',
    timestamp: '2026-01-10T09:00:00Z',
  }

  it('accepts a failing result carrying both values for diff rendering', () => {
    const result = ValidationResultSchema.safeParse(validResult)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timestamp).toBeInstanceOf(Date)
    }
  })

  it('accepts a result without source/target values (non-comparison rules)', () => {
    const { sourceValue: _s, targetValue: _t, ...withoutValues } = validResult
    expect(ValidationResultSchema.safeParse(withoutValues).success).toBe(true)
  })

  it('rejects an empty message', () => {
    expect(ValidationResultSchema.safeParse({ ...validResult, message: '' }).success).toBe(false)
  })
})

describe('ValidationReportSchema', () => {
  const validReport = {
    reportId: 'report-001',
    sourceFormId: 'form-eea2-001',
    targetFormId: 'form-eea4-001',
    rules: [],
    allPassed: true,
    errorCount: 0,
    warningCount: 0,
    generatedAt: '2026-01-10T09:00:00Z',
  }

  it('accepts a valid cross-form report', () => {
    expect(ValidationReportSchema.safeParse(validReport).success).toBe(true)
  })

  it('accepts an intra-form report with null targetFormId', () => {
    expect(ValidationReportSchema.safeParse({ ...validReport, targetFormId: null }).success).toBe(
      true,
    )
  })

  it('rejects negative error counts', () => {
    expect(ValidationReportSchema.safeParse({ ...validReport, errorCount: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CROSS_FORM_RULES — canonical registry integrity
// ---------------------------------------------------------------------------

describe('CROSS_FORM_RULES registry', () => {
  it('contains exactly the 8 documented rules', () => {
    expect(CROSS_FORM_RULES).toHaveLength(8)
  })

  it('every entry parses against ValidationRuleSchema', () => {
    for (const rule of CROSS_FORM_RULES) {
      const result = ValidationRuleSchema.safeParse(rule)
      expect(result.success, `rule ${rule.ruleId} failed schema validation`).toBe(true)
    }
  })

  it('ruleIds are unique and follow the xform: convention', () => {
    const ids = CROSS_FORM_RULES.map((rule) => rule.ruleId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id.startsWith('xform:'), `${id} does not start with xform:`).toBe(true)
    }
  })

  it.each([
    'xform:eea2-eea4-headcount',
    'xform:eea4-requires-eea2',
    'xform:eea2-disability-lte-workforce',
    'xform:eea2-targets-match-levels',
    'xform:eea4-highpaid-gte-lowpaid',
    'xform:eea2-ceo-section-completeness',
    'xform:eea4-ceo-headcount-validated',
    'xform:bundle-signed-before-dol',
  ])('registers rule %s', (ruleId) => {
    expect(CROSS_FORM_RULES.some((rule) => rule.ruleId === ruleId)).toBe(true)
  })

  it('the headcount consistency rule is a blocking equality check between EEA2 and EEA4', () => {
    const rule = CROSS_FORM_RULES.find((r) => r.ruleId === 'xform:eea2-eea4-headcount')
    expect(rule).toMatchObject({
      severity: 'error',
      ruleType: 'equality',
      sourceForm: 'EEA2',
      targetForm: 'EEA4',
    })
  })

  it('the disability subset rule is intra-form lte (Table 1.2 <= Table 1.1)', () => {
    const rule = CROSS_FORM_RULES.find((r) => r.ruleId === 'xform:eea2-disability-lte-workforce')
    expect(rule).toMatchObject({ severity: 'error', ruleType: 'lte', targetForm: null })
    expect(rule?.sourcePath).toContain('disabilityProfile')
    expect(rule?.targetPath).toContain('workforceProfile')
  })

  it('only the targets-match-levels rule is advisory; all others block submission', () => {
    for (const rule of CROSS_FORM_RULES) {
      const expected = rule.ruleId === 'xform:eea2-targets-match-levels' ? 'warning' : 'error'
      expect(rule.severity, `unexpected severity on ${rule.ruleId}`).toBe(expected)
    }
  })

  it('the DoL bundle rule spans both forms with ruleType bundle', () => {
    const rule = CROSS_FORM_RULES.find((r) => r.ruleId === 'xform:bundle-signed-before-dol')
    expect(rule).toMatchObject({
      ruleType: 'bundle',
      sourceForm: 'EEA2',
      targetForm: 'EEA4',
      severity: 'error',
    })
  })

  it('wildcard path templates appear only on per-cell rules', () => {
    for (const rule of CROSS_FORM_RULES) {
      const usesWildcard =
        rule.sourcePath.includes('*') || (rule.targetPath?.includes('*') ?? false)
      const perCellRules = [
        'xform:eea2-eea4-headcount',
        'xform:eea2-disability-lte-workforce',
        'xform:eea2-targets-match-levels',
        'xform:eea4-highpaid-gte-lowpaid',
      ]
      expect(usesWildcard, `wildcard usage mismatch on ${rule.ruleId}`).toBe(
        perCellRules.includes(rule.ruleId),
      )
    }
  })
})
