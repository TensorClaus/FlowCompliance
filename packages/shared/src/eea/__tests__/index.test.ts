import { describe, expect, it } from 'vitest'
import { EEA2_DECLARATION_TEXT } from '../declarations.js'
import { FIELD_LABELS } from '../field-labels.js'
import * as eeaBarrel from '../index.js'
import { PII_FIELD_PATHS } from '../pii-fields.js'

/**
 * eea/index.ts re-exports the UI reference data (PII paths, field labels,
 * declaration text) for consumers that want the whole eea/* surface from one
 * import. Assert live-binding identity against the source modules so a
 * dropped or renamed re-export fails loudly here rather than as a runtime
 * undefined in a consuming app.
 */
describe('eea/index.ts barrel', () => {
  it('re-exports PII_FIELD_PATHS as the same binding as pii-fields.js', () => {
    expect(eeaBarrel.PII_FIELD_PATHS).toBe(PII_FIELD_PATHS)
  })

  it('re-exports FIELD_LABELS as the same binding as field-labels.js', () => {
    expect(eeaBarrel.FIELD_LABELS).toBe(FIELD_LABELS)
  })

  it('re-exports EEA2_DECLARATION_TEXT as the same binding as declarations.js', () => {
    expect(eeaBarrel.EEA2_DECLARATION_TEXT).toBe(EEA2_DECLARATION_TEXT)
  })
})
