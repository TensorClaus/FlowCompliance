import { describe, expect, it } from 'vitest'
import { EEA1FormSchema, EmployeeDeclarationSchema } from '../eea1.js'

function declaration(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    employeeId: 'emp-001',
    tenantId: 'tenant-001',
    name: 'Jane Doe',
    workplaceNumber: 'WP-001',
    gender: 'F',
    race: 'A',
    foreignNational: false,
    disability: false,
    declarationDate: '2025-06-01',
    signatureDataUrl: 'data:image/png;base64,iVBOR',
    ...overrides,
  }
}

describe('EmployeeDeclarationSchema', () => {
  it('accepts a fully declared employee record', () => {
    expect(EmployeeDeclarationSchema.safeParse(declaration()).success).toBe(true)
  })

  it('accepts null for gender, race and disability (POPIA right of non-disclosure)', () => {
    const result = EmployeeDeclarationSchema.safeParse(
      declaration({ gender: null, race: null, disability: null }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects an undefined gender (undefined is not the same as an explicit non-disclosure null)', () => {
    const withoutGender = declaration()
    delete (withoutGender as Record<string, unknown>).gender

    expect(EmployeeDeclarationSchema.safeParse(withoutGender).success).toBe(false)
  })

  it('rejects a gender code outside the M/F enum', () => {
    const result = EmployeeDeclarationSchema.safeParse(declaration({ gender: 'X' }))
    expect(result.success).toBe(false)
  })

  it('rejects a race code outside the A/C/I/W enum', () => {
    const result = EmployeeDeclarationSchema.safeParse(declaration({ race: 'Z' }))
    expect(result.success).toBe(false)
  })

  it('rejects an empty employeeId', () => {
    expect(EmployeeDeclarationSchema.safeParse(declaration({ employeeId: '' })).success).toBe(false)
  })

  it('rejects an empty signatureDataUrl (a declaration is not valid without a signature)', () => {
    const result = EmployeeDeclarationSchema.safeParse(declaration({ signatureDataUrl: '' }))
    expect(result.success).toBe(false)
  })

  it('accepts optional fields (citizenshipDate, disabilityNature, reasonableAccommodation) when omitted', () => {
    const minimal = declaration()
    expect(EmployeeDeclarationSchema.safeParse(minimal).success).toBe(true)
  })

  it('accepts a disabled employee with disabilityNature and reasonableAccommodation set', () => {
    const result = EmployeeDeclarationSchema.safeParse(
      declaration({
        disability: true,
        disabilityNature: 'Hearing impairment',
        reasonableAccommodation: true,
      }),
    )
    expect(result.success).toBe(true)
  })
})

describe('EEA1FormSchema', () => {
  it('wraps a valid declaration with lifecycle metadata', () => {
    const result = EEA1FormSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      declaration: declaration(),
      status: 'draft',
      createdAt: '2025-06-01T00:00:00Z',
      updatedAt: '2025-06-01T00:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a status outside the EEAFormStatus enum', () => {
    const result = EEA1FormSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      declaration: declaration(),
      status: 'archived',
      createdAt: '2025-06-01T00:00:00Z',
      updatedAt: '2025-06-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-UUID id', () => {
    const result = EEA1FormSchema.safeParse({
      id: 'not-a-uuid',
      declaration: declaration(),
      status: 'draft',
      createdAt: '2025-06-01T00:00:00Z',
      updatedAt: '2025-06-01T00:00:00Z',
    })
    expect(result.success).toBe(false)
  })
})
