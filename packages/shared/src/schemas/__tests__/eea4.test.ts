import { describe, expect, it } from 'vitest'
import { CEODeclarationSchema as CEODeclarationSchemaFromCommon } from '../common.js'
import { CEODeclarationSchema, RemunerationGapRangeSchema, SectionESchema } from '../eea4.js'

function ceoDeclaration(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    fullName: 'Jane Doe',
    organisationName: 'Acme Holdings (Pty) Ltd',
    signatureDataUrl: 'data:image/png;base64,iVBOR',
    date: '2025-06-01',
    place: 'Johannesburg',
    ...overrides,
  }
}

describe('CEODeclarationSchema (re-exported from common.js for EEA4 consumers)', () => {
  it('is the exact same schema instance as common.js — not a divergent copy', () => {
    // eea4.ts re-exports CEODeclarationSchema so both EEA2 and EEA4 enforce
    // identical CEO sign-off constraints. Asserting reference identity
    // catches accidental drift (e.g. someone redefining a looser schema
    // locally in eea4.ts instead of re-exporting the canonical one).
    expect(CEODeclarationSchema).toBe(CEODeclarationSchemaFromCommon)
  })

  it('accepts a fully populated declaration', () => {
    expect(CEODeclarationSchema.safeParse(ceoDeclaration()).success).toBe(true)
  })

  it('rejects an empty signatureDataUrl (EEA4 canonical .min(1) constraint)', () => {
    const result = CEODeclarationSchema.safeParse(ceoDeclaration({ signatureDataUrl: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects an empty fullName', () => {
    expect(CEODeclarationSchema.safeParse(ceoDeclaration({ fullName: '' })).success).toBe(false)
  })
})

describe('RemunerationGapRangeSchema', () => {
  it('accepts a non-negative lowest/highest boundary pair', () => {
    expect(RemunerationGapRangeSchema.safeParse({ lowest: 50_000, highest: 90_000 }).success).toBe(
      true,
    )
  })

  it('rejects a negative lowest bound', () => {
    expect(RemunerationGapRangeSchema.safeParse({ lowest: -1, highest: 90_000 }).success).toBe(
      false,
    )
  })

  it('parses even when lowest > highest (schema-level; ordering is an application-layer invariant)', () => {
    const result = RemunerationGapRangeSchema.safeParse({ lowest: 100_000, highest: 50_000 })
    expect(result.success).toBe(true)
  })
})

function sectionE(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    median: 100_000,
    top5pctRange: { lowest: 500_000, highest: 900_000 },
    bottom5pctRange: { lowest: 50_000, highest: 80_000 },
    ...overrides,
  }
}

describe('SectionESchema', () => {
  it('accepts a well-formed Section E median/gap payload', () => {
    expect(SectionESchema.safeParse(sectionE()).success).toBe(true)
  })

  it('rejects a negative median', () => {
    expect(SectionESchema.safeParse(sectionE({ median: -1 })).success).toBe(false)
  })

  it('rejects a malformed top5pctRange', () => {
    const result = SectionESchema.safeParse(sectionE({ top5pctRange: { lowest: -1, highest: 1 } }))
    expect(result.success).toBe(false)
  })
})
