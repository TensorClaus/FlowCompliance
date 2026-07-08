import { describe, it, expect } from 'vitest'
import { EmployeeDeclarationSchema, EEA1FormSchema } from '../eea1.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const validDeclaration = {
  employeeId: 'emp-001',
  tenantId: 'tenant-001',
  name: 'Thandi Mokoena',
  workplaceNumber: 'WP-042',
  gender: 'F' as const,
  race: 'A' as const,
  foreignNational: false,
  disability: false,
  declarationDate: '2026-01-10',
  signatureDataUrl: 'data:image/png;base64,sig123',
}

describe('EmployeeDeclarationSchema', () => {
  it('accepts a complete valid declaration and coerces date strings to Date', () => {
    const result = EmployeeDeclarationSchema.safeParse(validDeclaration)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.declarationDate).toBeInstanceOf(Date)
    }
  })

  it.each(['gender', 'race', 'disability'] as const)(
    'preserves null as an explicit non-disclosure choice for %s (POPIA s.26)',
    (field) => {
      const result = EmployeeDeclarationSchema.safeParse({ ...validDeclaration, [field]: null })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data[field]).toBeNull()
      }
    },
  )

  it.each(['gender', 'race', 'disability'] as const)(
    'rejects a missing %s — non-disclosure must be explicit null, not absence',
    (field) => {
      const { [field]: _omitted, ...withoutField } = validDeclaration
      expect(EmployeeDeclarationSchema.safeParse(withoutField).success).toBe(false)
    },
  )

  it('rejects an invalid race code', () => {
    expect(EmployeeDeclarationSchema.safeParse({ ...validDeclaration, race: 'X' }).success).toBe(
      false,
    )
  })

  it('accepts the conditional disability fields when disability is true', () => {
    const result = EmployeeDeclarationSchema.safeParse({
      ...validDeclaration,
      disability: true,
      disabilityNature: 'Visual impairment',
      reasonableAccommodation: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty disabilityNature when present', () => {
    expect(
      EmployeeDeclarationSchema.safeParse({ ...validDeclaration, disabilityNature: '' }).success,
    ).toBe(false)
  })

  it('coerces an ISO citizenshipDate string to a Date', () => {
    const result = EmployeeDeclarationSchema.safeParse({
      ...validDeclaration,
      foreignNational: true,
      citizenshipDate: '2019-06-30',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.citizenshipDate).toBeInstanceOf(Date)
    }
  })

  it('rejects an empty signatureDataUrl', () => {
    expect(
      EmployeeDeclarationSchema.safeParse({ ...validDeclaration, signatureDataUrl: '' }).success,
    ).toBe(false)
  })
})

describe('EEA1FormSchema', () => {
  const validForm = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    declaration: validDeclaration,
    status: 'draft' as const,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:05:00Z',
  }

  it('accepts a valid persisted form record', () => {
    const result = EEA1FormSchema.safeParse(validForm)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date)
      expect(result.data.updatedAt).toBeInstanceOf(Date)
    }
  })

  it('rejects a non-UUID id', () => {
    expect(EEA1FormSchema.safeParse({ ...validForm, id: 'form-1' }).success).toBe(false)
  })

  it.each(['draft', 'pending_ceo', 'signed', 'submitted'] as const)(
    'accepts lifecycle status "%s"',
    (status) => {
      expect(EEA1FormSchema.safeParse({ ...validForm, status }).success).toBe(true)
    },
  )

  it('rejects a status outside the EEAFormStatus state machine', () => {
    expect(EEA1FormSchema.safeParse({ ...validForm, status: 'archived' }).success).toBe(false)
  })
})
