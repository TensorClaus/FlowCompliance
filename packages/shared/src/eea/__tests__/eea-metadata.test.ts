import { describe, it, expect } from 'vitest'
import { EEA2_DECLARATION_TEXT } from '../declarations.js'
import { EEA1DeclarationBaseSchema, EEA1DeclarationSchema } from '../eea1.schema.js'
import { FIELD_LABELS } from '../field-labels.js'
import { PII_FIELD_PATHS } from '../pii-fields.js'

// ---------------------------------------------------------------------------
// PII_FIELD_PATHS — POPIA s.26 special-personal-information guard list
// ---------------------------------------------------------------------------

describe('PII_FIELD_PATHS', () => {
  it('contains no duplicate paths', () => {
    expect(new Set(PII_FIELD_PATHS).size).toBe(PII_FIELD_PATHS.length)
  })

  it.each(['race', 'gender', 'disability', 'citizenship', 'nationalId', 'dateOfBirth'])(
    'guards the bare demographic path "%s" (POPIA s.26)',
    (path) => {
      expect(PII_FIELD_PATHS).toContain(path)
    },
  )

  it.each(['salary', 'ctc', 'annualCTC', 'totalRemuneration'])(
    'guards the EEA4 remuneration path "%s" (rule_eea_018/019)',
    (path) => {
      expect(PII_FIELD_PATHS).toContain(path)
    },
  )

  it('guards every personalDetails.* variant of the bare demographic paths', () => {
    for (const bare of ['race', 'gender', 'disability', 'nationalId', 'dateOfBirth']) {
      expect(PII_FIELD_PATHS).toContain(`personalDetails.${bare}`)
    }
  })

  it('guards every sectionD.* variant of the remuneration paths', () => {
    for (const bare of ['salary', 'ctc', 'annualCTC', 'totalRemuneration']) {
      expect(PII_FIELD_PATHS).toContain(`sectionD.${bare}`)
    }
  })
})

// ---------------------------------------------------------------------------
// FIELD_LABELS — audit-history display labels
// ---------------------------------------------------------------------------

describe('FIELD_LABELS', () => {
  it('labels every EEA2 section A–H with at least one field', () => {
    for (const section of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      const prefix = `section${section}.`
      expect(
        Object.keys(FIELD_LABELS).some((key) => key.startsWith(prefix)),
        `no label for any section${section}.* field`,
      ).toBe(true)
    }
  })

  it('labels the sensitive PII fields whose values the timeline guards', () => {
    expect(FIELD_LABELS['gender']).toBe('Gender')
    expect(FIELD_LABELS['race']).toBe('Race')
    expect(FIELD_LABELS['disability']).toBe('Disability status')
  })

  it('has non-empty labels for every fieldPath', () => {
    for (const [path, label] of Object.entries(FIELD_LABELS)) {
      expect(label.length, `empty label for ${path}`).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// EEA2_DECLARATION_TEXT — DC-003 Section H statutory wording
// ---------------------------------------------------------------------------

describe('EEA2_DECLARATION_TEXT', () => {
  it('contains the statutory authorisation, accuracy, and non-victimisation clauses', () => {
    expect(EEA2_DECLARATION_TEXT).toContain('duly authorised')
    expect(EEA2_DECLARATION_TEXT).toContain('accurate and true')
    expect(EEA2_DECLARATION_TEXT).toContain('victimised')
  })
})

// ---------------------------------------------------------------------------
// EEA1DeclarationSchema — form-layer declaration with citizenship rule
// ---------------------------------------------------------------------------

const validDeclaration = {
  employeeId: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Thandi Mokoena',
  workplaceNumber: 'WP-042',
  foreignNational: false,
}

describe('EEA1DeclarationBaseSchema', () => {
  it('accepts a valid SA-citizen declaration without citizenshipDate', () => {
    expect(EEA1DeclarationBaseSchema.safeParse(validDeclaration).success).toBe(true)
  })

  it('exposes .shape for per-field blur validation', () => {
    expect(EEA1DeclarationBaseSchema.shape.employeeId.safeParse('not-a-uuid').success).toBe(false)
    expect(EEA1DeclarationBaseSchema.shape.name.safeParse('T').success).toBe(false)
    expect(EEA1DeclarationBaseSchema.shape.citizenshipDate.safeParse('2020-03-15').success).toBe(
      true,
    )
    expect(EEA1DeclarationBaseSchema.shape.citizenshipDate.safeParse('15/03/2020').success).toBe(
      false,
    )
  })

  it('rejects a workplace number longer than 20 characters', () => {
    const result = EEA1DeclarationBaseSchema.safeParse({
      ...validDeclaration,
      workplaceNumber: 'X'.repeat(21),
    })
    expect(result.success).toBe(false)
  })
})

describe('EEA1DeclarationSchema (superRefine)', () => {
  it('requires citizenshipDate when foreignNational is true', () => {
    const result = EEA1DeclarationSchema.safeParse({
      ...validDeclaration,
      foreignNational: true,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue?.path).toEqual(['citizenshipDate'])
      expect(issue?.message).toContain('foreign nationals')
    }
  })

  it('accepts a foreign national with a citizenshipDate', () => {
    const result = EEA1DeclarationSchema.safeParse({
      ...validDeclaration,
      foreignNational: true,
      citizenshipDate: '2018-11-02',
    })
    expect(result.success).toBe(true)
  })

  it('does not require citizenshipDate for SA citizens', () => {
    expect(EEA1DeclarationSchema.safeParse(validDeclaration).success).toBe(true)
  })
})
