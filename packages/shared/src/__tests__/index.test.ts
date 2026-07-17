import { describe, expect, it } from 'vitest'
import { EEA2_DECLARATION_TEXT } from '../eea/declarations.js'
import { FIELD_LABELS } from '../eea/field-labels.js'
import { PII_FIELD_PATHS } from '../eea/pii-fields.js'
import { OccupationalLevelSchema } from '../enums.js'
import { AppError } from '../errors.js'
import * as barrel from '../index.js'
import { err, ok } from '../result.js'
import { CROSS_FORM_RULES } from '../schemas/validation-rules.js'
import { validateGoalAgainstMinimums } from '../validation/eea13-goals.js'
import { EngineError, evaluateRules } from '../validation/engine.js'

/**
 * The barrel (index.ts) re-exports every public symbol from its owning
 * module. A missing or misspelled re-export is a silent breaking change for
 * every consumer that imports from '@simplifi/shared' rather than a deep
 * path, so these tests assert live-binding identity against the source
 * module rather than merely checking `typeof x !== 'undefined'`.
 */
describe('index.ts barrel', () => {
  it('re-exports the Result helpers as the same bindings as result.js', () => {
    expect(barrel.ok).toBe(ok)
    expect(barrel.err).toBe(err)
  })

  it('re-exports the error hierarchy as the same bindings as errors.js', () => {
    expect(barrel.AppError).toBe(AppError)
  })

  it('re-exports core enums as the same bindings as enums.js', () => {
    expect(barrel.OccupationalLevelSchema).toBe(OccupationalLevelSchema)
  })

  it('re-exports EEA UI reference data as the same bindings as the eea/* modules', () => {
    expect(barrel.EEA2_DECLARATION_TEXT).toBe(EEA2_DECLARATION_TEXT)
    expect(barrel.FIELD_LABELS).toBe(FIELD_LABELS)
    expect(barrel.PII_FIELD_PATHS).toBe(PII_FIELD_PATHS)
  })

  it('re-exports cross-form validation rules and the engine as the same bindings', () => {
    expect(barrel.CROSS_FORM_RULES).toBe(CROSS_FORM_RULES)
    expect(barrel.evaluateRules).toBe(evaluateRules)
    expect(barrel.EngineError).toBe(EngineError)
  })

  it('re-exports the EEA13 goal-minimum validator as the same binding', () => {
    expect(barrel.validateGoalAgainstMinimums).toBe(validateGoalAgainstMinimums)
  })
})
