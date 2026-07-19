import { describe, expect, it } from 'vitest'
import { EEA2_DECLARATION_TEXT } from '../declarations.js'

describe('EEA2_DECLARATION_TEXT', () => {
  it('carries the mandatory attestation clauses required by DC-003 Section H', () => {
    expect(EEA2_DECLARATION_TEXT).toContain('duly authorised to sign this Employment Equity Report')
    expect(EEA2_DECLARATION_TEXT).toContain('accurate and true to the best of my knowledge')
    expect(EEA2_DECLARATION_TEXT).toContain('no designated group member has been victimised')
  })

  it('is a single trimmed sentence with no leading/trailing whitespace', () => {
    expect(EEA2_DECLARATION_TEXT).toBe(EEA2_DECLARATION_TEXT.trim())
    expect(EEA2_DECLARATION_TEXT.endsWith('.')).toBe(true)
  })
})
