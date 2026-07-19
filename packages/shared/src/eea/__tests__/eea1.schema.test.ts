import { describe, expect, it } from 'vitest'
import { EEA1DeclarationBaseSchema, EEA1DeclarationSchema } from '../eea1.schema.js'

function declaration(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    employeeId: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Jane Doe',
    workplaceNumber: 'WP-001',
    foreignNational: false,
    ...overrides,
  }
}

describe('EEA1DeclarationBaseSchema', () => {
  it('accepts a well-formed South African employee declaration with no citizenshipDate', () => {
    const result = EEA1DeclarationBaseSchema.safeParse(declaration())
    expect(result.success).toBe(true)
  })

  it('rejects an employeeId that is not a UUID', () => {
    const result = EEA1DeclarationBaseSchema.safeParse(declaration({ employeeId: 'not-a-uuid' }))
    expect(result.success).toBe(false)
  })

  it('rejects a name shorter than 2 characters', () => {
    const result = EEA1DeclarationBaseSchema.safeParse(declaration({ name: 'A' }))
    expect(result.success).toBe(false)
  })

  it('does NOT enforce the foreign-national citizenshipDate rule on its own (that is superRefine-only)', () => {
    // EEA1DeclarationBaseSchema is exported specifically so per-field blur
    // validation via .shape does not trigger the cross-field ZodEffects
    // error. A foreign national with no citizenshipDate must still pass the
    // base schema in isolation.
    const result = EEA1DeclarationBaseSchema.safeParse(declaration({ foreignNational: true }))
    expect(result.success).toBe(true)
  })
})

describe('EEA1DeclarationSchema', () => {
  it('accepts a South African (non-foreign-national) declaration with no citizenshipDate', () => {
    const result = EEA1DeclarationSchema.safeParse(declaration())
    expect(result.success).toBe(true)
  })

  it('rejects a foreign national who omits citizenshipDate, per EEA s.1', () => {
    const result = EEA1DeclarationSchema.safeParse(declaration({ foreignNational: true }))

    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue?.path).toEqual(['citizenshipDate'])
      expect(issue?.message).toBe(
        'Citizenship/permanent residence date is required for foreign nationals',
      )
    }
  })

  it('accepts a foreign national who supplies citizenshipDate', () => {
    const result = EEA1DeclarationSchema.safeParse(
      declaration({ foreignNational: true, citizenshipDate: '2020-01-15' }),
    )
    expect(result.success).toBe(true)
  })

  it('does not require citizenshipDate for a non-foreign-national even if supplied as empty', () => {
    const result = EEA1DeclarationSchema.safeParse(
      declaration({ foreignNational: false, citizenshipDate: undefined }),
    )
    expect(result.success).toBe(true)
  })
})
