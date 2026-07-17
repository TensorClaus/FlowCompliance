import {
  CROSS_FORM_RULES,
  evaluateRules,
  type ValidationReport,
  type ValidationRule,
} from '@simplifi/shared'

// ---------------------------------------------------------------------------
// EEA4 declaration gate — rule selection + engine invocation
// ---------------------------------------------------------------------------

/**
 * The four cross-form rules that gate the EEA4 CEO declaration.
 *
 * Order is taken directly from CROSS_FORM_RULES (registry order) and MUST be
 * preserved: xform:eea2-eea4-headcount is evaluated first so the engine can
 * project meta.headcountValidationPassed BEFORE xform:eea4-ceo-headcount-validated
 * reads it. The engine mutates that meta flag during the headcount rule pass.
 *
 * These are references into the immutable registry — no rule literals are
 * re-declared here. The engine remains the sole validation authority.
 */
const EEA4_DECLARATION_RULE_IDS = [
  'xform:eea2-eea4-headcount',
  'xform:eea4-requires-eea2',
  'xform:eea4-highpaid-gte-lowpaid',
  'xform:eea4-ceo-headcount-validated',
] as const

export const EEA4_DECLARATION_RULES: ValidationRule[] = EEA4_DECLARATION_RULE_IDS.map((ruleId) => {
  const rule = CROSS_FORM_RULES.find((candidate) => candidate.ruleId === ruleId)
  if (rule === undefined) {
    throw new Error(`Missing EEA4 declaration rule ${ruleId}`)
  }
  return rule
})

/** Human-readable rule names keyed by ruleId, sourced from the registry. */
export const EEA4_DECLARATION_RULE_NAMES: Record<string, string> = Object.fromEntries(
  EEA4_DECLARATION_RULES.map((rule) => [rule.ruleId, rule.name]),
)

export interface EvaluateDeclarationGateInput {
  /** Full linked EEA2 FORM WRAPPER ({ id, report, status }). */
  linkedEEA2Form: unknown
  /** Current EEA4 FORM WRAPPER ({ id, report, status }). */
  eea4Form: unknown
  /** Injected clock — keeps the engine pure; the component owns wall-clock time. */
  clock: () => Date
}

/**
 * Runs the four EEA4 declaration-gate rules through the engine.
 *
 * reportId is a fresh crypto.randomUUID() per invocation (each run is a distinct
 * report instance). The engine is passed FORM WRAPPERS: Rule 2 reads the EEA2
 * wrapper id, and the meta projection reads wrapper status.
 */
export function evaluateDeclarationGate({
  linkedEEA2Form,
  eea4Form,
  clock,
}: EvaluateDeclarationGateInput): ValidationReport {
  return evaluateRules(
    EEA4_DECLARATION_RULES,
    { EEA2: linkedEEA2Form, EEA4: eea4Form },
    { clock, reportId: crypto.randomUUID() },
  )
}
