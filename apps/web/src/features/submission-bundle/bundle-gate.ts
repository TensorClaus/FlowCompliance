import {
  CROSS_FORM_RULES,
  evaluateRules,
  type EEAFormStatus,
  type ValidationReport,
  type ValidationSeverity,
} from '@simplifi/shared'

// ---------------------------------------------------------------------------
// Submission-bundle gate — the last check before an EEA2+EEA4 bundle could
// leave the building. This module is PURE: it takes two form wrappers and a
// clock, runs the canonical cross-form rule registry through the engine (the
// sole validation authority), and reports whether the bundle is ready.
//
// M3 scope ends at an audit-logged "bundle validated" state. Nothing here
// dispatches to any external system.
// ---------------------------------------------------------------------------

/**
 * The bundle status rule reads meta.status of BOTH form wrappers. It is the
 * engine's own expression of the "both signed" invariant. The gate ALSO checks
 * wrapper status directly (bothSigned) because signing gates the surface before
 * any rule is inspected — but the rule still runs so the report is complete.
 */
const BUNDLE_STATUS_RULE_ID = 'xform:bundle-signed-before-dol'

/** Human-readable rule names keyed by ruleId, sourced from the registry. */
export const BUNDLE_RULE_NAMES: Record<string, string> = Object.fromEntries(
  CROSS_FORM_RULES.map((rule) => [rule.ruleId, rule.name]),
)

/**
 * Typed, exhaustive explanation of why a bundle is (not) ready. A missing form
 * yields a typed reason rather than a throw.
 */
export type BundleGateReason =
  | 'ready'
  | 'both-missing'
  | 'eea2-missing'
  | 'eea4-missing'
  | 'not-signed'
  | 'rules-failed'

export const BUNDLE_REASON_LABELS: Record<BundleGateReason, string> = {
  ready: 'Both forms are signed and every cross-form check has passed.',
  'both-missing': 'Neither the EEA2 nor the EEA4 form exists for this reporting period.',
  'eea2-missing': 'The EEA2 form is missing for this reporting period.',
  'eea4-missing': 'The EEA4 form is missing for this reporting period.',
  'not-signed': 'One or both forms are not yet signed.',
  'rules-failed': 'One or more cross-form validation rules are failing.',
}

export interface BundleGateResult {
  /** Live cross-form validation report over the full CROSS_FORM_RULES registry. */
  report: ValidationReport
  /** True only when BOTH wrapper statuses are exactly 'signed'. */
  bothSigned: boolean
  /** True only when bothSigned AND report.allPassed. The single readiness gate. */
  ready: boolean
  /** Typed explanation of the current gate state. */
  reason: BundleGateReason
  eea2Present: boolean
  eea4Present: boolean
  eea2Status: EEAFormStatus | undefined
  eea4Status: EEAFormStatus | undefined
}

export interface EvaluateBundleGateInput {
  /** EEA2 FORM WRAPPER ({ id, status, report }); undefined/null when absent. */
  eea2Form: unknown
  /** EEA4 FORM WRAPPER ({ id, status, report }); undefined/null when absent. */
  eea4Form: unknown
  /** Injected clock — keeps the gate pure; the caller owns wall-clock time. */
  clock: () => Date
  /** Report instance id for this evaluation. */
  reportId: string
}

/**
 * Runs every cross-form rule through the engine and derives the readiness gate.
 *
 * The engine tolerates missing forms (an absent wrapper resolves to undefined
 * values, which fail comparisons cleanly) so this function never throws for a
 * missing form — it returns ready === false with a typed reason instead.
 */
export function evaluateBundleGate({
  eea2Form,
  eea4Form,
  clock,
  reportId,
}: EvaluateBundleGateInput): BundleGateResult {
  const report = evaluateRules(
    CROSS_FORM_RULES,
    { EEA2: eea2Form, EEA4: eea4Form },
    { clock, reportId },
  )

  const eea2Present = isRecord(eea2Form)
  const eea4Present = isRecord(eea4Form)
  const eea2Status = readStatus(eea2Form)
  const eea4Status = readStatus(eea4Form)
  const bothSigned = eea2Status === 'signed' && eea4Status === 'signed'
  const ready = bothSigned && report.allPassed
  const reason = deriveReason(eea2Present, eea4Present, bothSigned, report.allPassed)

  return { report, bothSigned, ready, reason, eea2Present, eea4Present, eea2Status, eea4Status }
}

function deriveReason(
  eea2Present: boolean,
  eea4Present: boolean,
  bothSigned: boolean,
  allPassed: boolean,
): BundleGateReason {
  if (!eea2Present && !eea4Present) return 'both-missing'
  if (!eea2Present) return 'eea2-missing'
  if (!eea4Present) return 'eea4-missing'
  if (!bothSigned) return 'not-signed'
  if (!allPassed) return 'rules-failed'
  return 'ready'
}

// ---------------------------------------------------------------------------
// Blocker derivation — one item per failing ERROR rule.
//
// HARD RULE: blockers carry rule name, severity and affected cellPaths ONLY.
// They NEVER carry sourceValue / targetValue (remuneration or headcount
// figures). Those figures stay confined to the ValidationReportPanel diff
// cells. When a form is unsigned, a status-only blocker names the form.
// ---------------------------------------------------------------------------

export interface BundleBlocker {
  key: string
  kind: 'unsigned' | 'rule'
  /** Rule name, or "EEA2 is not signed" — never a data value. */
  label: string
  severity: ValidationSeverity | 'unsigned'
  /** Affected source cell paths (path templates resolved per cell). No values. */
  cellPaths: string[]
  /** For unsigned blockers: the offending lifecycle status (status only). */
  status?: string
}

export function deriveBundleBlockers(result: BundleGateResult): BundleBlocker[] {
  const blockers: BundleBlocker[] = []

  if (!result.bothSigned) {
    if (result.eea2Status !== 'signed') {
      blockers.push(unsignedBlocker('EEA2', result.eea2Present, result.eea2Status))
    }
    if (result.eea4Status !== 'signed') {
      blockers.push(unsignedBlocker('EEA4', result.eea4Present, result.eea4Status))
    }
  }

  const order: string[] = []
  const pathsByRule = new Map<string, string[]>()
  for (const outcome of result.report.rules) {
    if (outcome.passed || outcome.severity !== 'error') continue
    // The bundle status rule is represented by the unsigned blockers above; do
    // not duplicate it here (and never surface its meta.status diff as a rule).
    if (outcome.ruleId === BUNDLE_STATUS_RULE_ID) continue

    const existing = pathsByRule.get(outcome.ruleId)
    if (existing === undefined) {
      order.push(outcome.ruleId)
      pathsByRule.set(outcome.ruleId, [outcome.sourcePath])
    } else if (!existing.includes(outcome.sourcePath)) {
      existing.push(outcome.sourcePath)
    }
  }

  for (const ruleId of order) {
    blockers.push({
      key: ruleId,
      kind: 'rule',
      label: BUNDLE_RULE_NAMES[ruleId] ?? ruleId,
      severity: 'error',
      cellPaths: pathsByRule.get(ruleId) ?? [],
    })
  }

  return blockers
}

function unsignedBlocker(
  form: 'EEA2' | 'EEA4',
  present: boolean,
  status: EEAFormStatus | undefined,
): BundleBlocker {
  const statusLabel = present ? (status ?? 'unknown') : 'missing'
  return {
    key: `unsigned:${form}`,
    kind: 'unsigned',
    label: `${form} is not signed`,
    severity: 'unsigned',
    cellPaths: [],
    status: statusLabel,
  }
}

// ---------------------------------------------------------------------------
// Wrapper readers
// ---------------------------------------------------------------------------

function readStatus(form: unknown): EEAFormStatus | undefined {
  if (!isRecord(form)) return undefined
  const direct = form['status']
  if (typeof direct === 'string') return direct as EEAFormStatus
  const report = form['report']
  if (isRecord(report) && typeof report['status'] === 'string') {
    return report['status'] as EEAFormStatus
  }
  return undefined
}

/** Reads the EEA4's linkedEEA2Id from the wrapper report, if present. */
export function readLinkedEEA2Id(form: unknown): string | null {
  if (!isRecord(form)) return null
  const report = form['report']
  if (isRecord(report) && typeof report['linkedEEA2Id'] === 'string') {
    return report['linkedEEA2Id']
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
