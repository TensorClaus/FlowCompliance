import { describe, expect, it } from 'vitest'
import { PII_FIELD_PATHS } from '../pii-fields.js'

describe('PII_FIELD_PATHS', () => {
  it('is non-empty and has no duplicate entries', () => {
    expect(PII_FIELD_PATHS.length).toBeGreaterThan(0)
    expect(new Set(PII_FIELD_PATHS).size).toBe(PII_FIELD_PATHS.length)
  })

  it('flags the EEA1 demographic declaration fields protected under POPIA s.1', () => {
    for (const field of ['race', 'gender', 'disability', 'disabilityCategory', 'citizenship']) {
      expect(PII_FIELD_PATHS).toContain(field)
    }
  })

  it('flags direct-identifier fields (national ID, passport, contact details)', () => {
    for (const field of ['nationalId', 'passportNumber', 'email', 'phone', 'fullName']) {
      expect(PII_FIELD_PATHS).toContain(field)
    }
  })

  it('flags per-employee remuneration fields used in the EEA4 income differential report', () => {
    for (const field of ['salary', 'ctc', 'annualCTC', 'totalRemuneration']) {
      expect(PII_FIELD_PATHS).toContain(field)
    }
  })

  it('mirrors demographic fields under the personalDetails.* namespace used by the EEA1 declaration form', () => {
    const mirroredFields = [
      'race',
      'gender',
      'disability',
      'disabilityCategory',
      'citizenship',
      'nationalId',
      'passportNumber',
      'dateOfBirth',
      'firstName',
      'lastName',
      'fullName',
      'email',
      'phone',
    ]
    for (const field of mirroredFields) {
      expect(PII_FIELD_PATHS).toContain(`personalDetails.${field}`)
    }
  })

  it('does not mirror record-identity fields under personalDetails.* (they identify the record, not a person attribute)', () => {
    for (const field of ['employeeId', 'employeeName', 'address']) {
      expect(PII_FIELD_PATHS).toContain(field)
      expect(PII_FIELD_PATHS).not.toContain(`personalDetails.${field}`)
    }
  })

  it('flags the EEA4 D1/D2 wildcard paths that identify highest/lowest-paid individuals', () => {
    expect(PII_FIELD_PATHS).toContain('report.sectionD1.*')
    expect(PII_FIELD_PATHS).toContain('report.sectionD2.*')
  })
})
