import { z } from 'zod'
import { FormTypeSchema } from '../enums.js'

// ---------------------------------------------------------------------------
// ValidationSeverity
// ---------------------------------------------------------------------------

/**
 * Severity level for a validation rule outcome.
 *
 * - error   : The submission MUST NOT proceed. Blocks signing and DoL submission.
 * - warning : Anomaly detected but submission is not hard-blocked; reviewer must acknowledge.
 * - info    : Informational note surfaced to the preparer; no action required.
 */
export const ValidationSeveritySchema = z.enum(['error', 'warning', 'info'])
export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>

// ---------------------------------------------------------------------------
// ValidationRule — rule type enum
// ---------------------------------------------------------------------------

/**
 * Logical operator that governs how sourceValue and targetValue are compared.
 *
 * - equality : sourceValue === targetValue  (e.g. EEA2 ↔ EEA4 headcount cells)
 * - lte      : sourceValue <= targetValue   (e.g. disability profile <= workforce profile)
 * - gte      : sourceValue >= targetValue   (e.g. highest-paid total >= lowest-paid total)
 * - requires : targetForm/targetPath must exist and be in a valid state before sourceForm
 *              can advance (e.g. EEA4 requires a linked EEA2 in the same period)
 * - bundle   : all listed forms must satisfy a shared status condition before any action
 *              can proceed (e.g. both EEA2 and EEA4 must be 'signed' before DoL submission)
 */
export const RuleTypeSchema = z.enum(['equality', 'lte', 'gte', 'requires', 'bundle'])
export type RuleType = z.infer<typeof RuleTypeSchema>

// ---------------------------------------------------------------------------
// ValidationRule
// ---------------------------------------------------------------------------

/**
 * A single, stateless cross-form (or intra-form) validation rule definition.
 *
 * Cross-form rules compare data between a sourceForm and a targetForm.
 * Intra-form rules set targetForm and targetPath to null and compare
 * two paths within the same form document.
 *
 * sourcePath and targetPath use dot-notation relative to the form root, e.g.:
 *   'sectionB.workforceProfile.topManagement.africanMale.value'
 *   'sectionC.topManagement.africanMale.headcount'
 *
 * CROSS-FORM RULES defined for the EEA compliance module:
 *
 *  xform:eea2-eea4-headcount
 *    EEA2 Table 1.1 headcount per cell MUST EQUAL EEA4 Section C headcount per cell.
 *    Per-level, per-demographic cell (race × gender). Severity: error.
 *
 *  xform:eea4-requires-eea2
 *    An EEA4 submission can only exist if a same-period EEA2 has been linked
 *    via linkedEEA2Id. Severity: error.
 *
 *  xform:eea2-disability-lte-workforce
 *    EEA2 Section B disability profile totals (Table 1.2) must be <= the
 *    workforce profile totals (Table 1.1) at every demographic cell.
 *    Severity: error.
 *
 *  xform:eea2-targets-match-levels
 *    EEA2 Section B annual numeric targets must reference the same
 *    occupational levels present in the workforce profile. Severity: warning.
 *
 *  xform:eea4-highpaid-gte-lowpaid
 *    EEA4 Section D1 (highest-paid employees) total at each level must be
 *    >= Section D2 (lowest-paid employees) total at that level. Severity: error.
 *
 *  xform:eea2-ceo-section-completeness
 *    EEA2 Section H (CEO declaration) cannot be signed until all preceding
 *    sections (A through G) are fully completed. Severity: error.
 *
 *  xform:eea4-ceo-headcount-validated
 *    EEA4 CEO declaration cannot be signed until the EEA4 ↔ EEA2 headcount
 *    validation (xform:eea2-eea4-headcount) has passed. Severity: error.
 *
 *  xform:bundle-signed-before-dol
 *    EEA2 and EEA4 must both carry status 'signed' before the DoL submission
 *    bundle can be dispatched. Severity: error.
 */
export const ValidationRuleSchema = z.object({
  /** Unique, stable identifier for this rule. Convention: 'xform:<slug>'. */
  ruleId: z.string().min(1),

  /** Short human-readable label shown in validation summary panels. */
  name: z.string().min(1),

  /** Detailed explanation of what is being validated and why it matters. */
  description: z.string().min(1),

  /** Severity of a failure: blocks submission (error), advisory (warning), or informational (info). */
  severity: ValidationSeveritySchema,

  /** The form that owns the source data and triggers this rule during its validation lifecycle. */
  sourceForm: FormTypeSchema,

  /**
   * The form whose data is read as the comparison target.
   * null for intra-form rules where both paths live inside sourceForm.
   */
  targetForm: FormTypeSchema.nullable(),

  /**
   * Dot-notation path into the source form document for the value being validated.
   * Example: 'sectionB.workforceProfile.topManagement.africanMale.value'
   */
  sourcePath: z.string().min(1),

  /**
   * Dot-notation path into the target form document for the comparison value.
   * null when the rule does not perform a value-level comparison (e.g. 'requires', 'bundle').
   */
  targetPath: z.string().nullable(),

  /**
   * Comparison operator applied between sourceValue and targetValue.
   * See RuleTypeSchema JSDoc for full semantics.
   */
  ruleType: RuleTypeSchema,
})
export type ValidationRule = z.infer<typeof ValidationRuleSchema>

// ---------------------------------------------------------------------------
// ValidationResult
// ---------------------------------------------------------------------------

/**
 * The outcome of evaluating a single ValidationRule against live form data.
 *
 * sourceValue and targetValue capture the actual values at evaluation time so
 * that the UI can render a meaningful diff without re-fetching form data.
 * They are typed as unknown because the value at any given path may be a
 * number, string, boolean, or nested object depending on the rule.
 */
export const ValidationResultSchema = z.object({
  /** ruleId of the ValidationRule that produced this result. */
  ruleId: z.string().min(1),

  /** true when the rule's assertion holds; false when the assertion is violated. */
  passed: z.boolean(),

  /** Severity copied from the originating rule at evaluation time. */
  severity: ValidationSeveritySchema,

  /** Human-readable message describing what passed or failed and what action to take. */
  message: z.string().min(1),

  /** Actual value read from sourcePath at evaluation time. */
  sourceValue: z.unknown().optional(),

  /** Actual value read from targetPath at evaluation time. */
  targetValue: z.unknown().optional(),

  /** sourcePath copied from the originating rule. */
  sourcePath: z.string().min(1),

  /** targetPath copied from the originating rule. null for intra-form or non-value rules. */
  targetPath: z.string().nullable(),

  /** UTC timestamp of when this result was computed. */
  timestamp: z.coerce.date(),
})
export type ValidationResult = z.infer<typeof ValidationResultSchema>

// ---------------------------------------------------------------------------
// ValidationReport
// ---------------------------------------------------------------------------

/**
 * Aggregated validation report for one form or a cross-form pair.
 *
 * A report is generated each time the validation engine runs against a
 * (sourceFormId, targetFormId) pair. Multiple reports may exist for the same
 * pair across different points in time — the latest report is authoritative.
 *
 * allPassed is a derived convenience field: true only when errorCount === 0
 * (warnings and info items do not affect allPassed).
 */
export const ValidationReportSchema = z.object({
  /** UUID for this specific report instance. */
  reportId: z.string().min(1),

  /** Document ID of the source EEA form. */
  sourceFormId: z.string().min(1),

  /**
   * Document ID of the target EEA form.
   * null when the report covers only intra-form rules.
   */
  targetFormId: z.string().nullable(),

  /** Ordered list of individual rule outcomes included in this report. */
  rules: z.array(ValidationResultSchema),

  /**
   * Convenience flag: true only when no rule with severity 'error' has passed === false.
   * Warnings and info items do not affect this flag.
   */
  allPassed: z.boolean(),

  /** Total count of rules with severity 'error' and passed === false. */
  errorCount: z.number().int().nonnegative(),

  /** Total count of rules with severity 'warning' and passed === false. */
  warningCount: z.number().int().nonnegative(),

  /** UTC timestamp when this report was generated. */
  generatedAt: z.coerce.date(),
})
export type ValidationReport = z.infer<typeof ValidationReportSchema>

// ---------------------------------------------------------------------------
// CROSS_FORM_RULES — canonical rule registry for the EEA compliance module
// ---------------------------------------------------------------------------

/**
 * Pre-defined, immutable registry of all cross-form validation rules enforced
 * by the Simplifi EEA compliance module.
 *
 * Rules are evaluated by the ValidationEngine at the following lifecycle points:
 *   1. On any section save (rules touching that section's paths).
 *   2. On CEO/signing action (all rules for the form being signed).
 *   3. On DoL bundle submission (bundle rule + all rules for both forms).
 *
 * sourcePath / targetPath values in this registry are canonical path templates.
 * The engine resolves per-cell variants at runtime (e.g. iterating occupational
 * levels and demographic cells) using these paths as base patterns.
 */
export const CROSS_FORM_RULES: ValidationRule[] = [
  // Rule 1 — EEA2 ↔ EEA4 headcount equality (the primary cross-form invariant)
  {
    ruleId: 'xform:eea2-eea4-headcount',
    name: 'EEA2/EEA4 Headcount Consistency',
    description:
      'EEA2 Table 1.1 workforce headcount must equal EEA4 Section C headcount for every ' +
      'occupational level and demographic cell (race × gender). A mismatch indicates ' +
      'that the two forms were prepared from different source data and the bundle cannot ' +
      'be submitted to the DoL.',
    severity: 'error',
    sourceForm: 'EEA2',
    targetForm: 'EEA4',
    sourcePath: 'sectionB.workforceProfile.*.*.value',
    targetPath: 'sectionC.*.*.headcount',
    ruleType: 'equality',
  },

  // Rule 2 — EEA4 requires a linked same-period EEA2
  {
    ruleId: 'xform:eea4-requires-eea2',
    name: 'EEA4 Requires Linked EEA2',
    description:
      'An EEA4 (Income Differential Statement) may only exist when a same-reporting-period ' +
      'EEA2 has been linked via the linkedEEA2Id field. The EEA4 cannot be created, saved, ' +
      'or signed without this linkage.',
    severity: 'error',
    sourceForm: 'EEA4',
    targetForm: 'EEA2',
    sourcePath: 'linkedEEA2Id',
    targetPath: 'formId',
    ruleType: 'requires',
  },

  // Rule 3 — Disability profile totals must not exceed workforce profile totals
  {
    ruleId: 'xform:eea2-disability-lte-workforce',
    name: 'Disability Profile Within Workforce Profile Bounds',
    description:
      'EEA2 Section B Table 1.2 (disability profile) totals must be less than or equal to ' +
      'the corresponding Table 1.1 (workforce profile) totals at every occupational level ' +
      'and demographic cell. Employees with disabilities are a subset of the total ' +
      'workforce; a value exceeding the workforce cell total indicates a data error.',
    severity: 'error',
    sourceForm: 'EEA2',
    targetForm: null,
    sourcePath: 'sectionB.disabilityProfile.*.*.value',
    targetPath: 'sectionB.workforceProfile.*.*.value',
    ruleType: 'lte',
  },

  // Rule 4 — Annual targets must reference levels present in the workforce profile
  {
    ruleId: 'xform:eea2-targets-match-levels',
    name: 'Annual Targets Reference Valid Occupational Levels',
    description:
      'EEA2 Section B annual numerical targets must reference occupational levels that are ' +
      'present in the workforce profile (Table 1.1). Targets set for levels with zero ' +
      'workforce entries are likely data-entry errors and should be reviewed before signing.',
    severity: 'warning',
    sourceForm: 'EEA2',
    targetForm: null,
    sourcePath: 'sectionB.annualTargets.*.occupationalLevel',
    targetPath: 'sectionB.workforceProfile.*.occupationalLevel',
    ruleType: 'requires',
  },

  // Rule 5 — EEA4 Section D1 highest-paid total >= Section D2 lowest-paid total per level
  {
    ruleId: 'xform:eea4-highpaid-gte-lowpaid',
    name: 'Highest-Paid Total >= Lowest-Paid Total per Level',
    description:
      'EEA4 Section D1 (ten highest-paid employees) total remuneration at each occupational ' +
      'level must be greater than or equal to the Section D2 (ten lowest-paid employees) ' +
      'total at that same level. A D1 total below a D2 total implies transposed data and ' +
      'will cause the DoL validation to fail.',
    severity: 'error',
    sourceForm: 'EEA4',
    targetForm: null,
    sourcePath: 'sectionD1.*.totalRemuneration',
    targetPath: 'sectionD2.*.totalRemuneration',
    ruleType: 'gte',
  },

  // Rule 6 — EEA2 Section H (CEO declaration) requires prior sections to be complete
  {
    ruleId: 'xform:eea2-ceo-section-completeness',
    name: 'EEA2 CEO Declaration Requires Complete Prior Sections',
    description:
      'EEA2 Section H (CEO / Designated Senior Manager declaration) cannot be signed until ' +
      'all preceding sections — A (employer info), B (workforce profile), C (analysis), ' +
      'D (recruitment), E (promotion), F (skills development), and G (reasonable ' +
      'accommodation) — have been fully completed and saved without validation errors.',
    severity: 'error',
    sourceForm: 'EEA2',
    targetForm: null,
    sourcePath: 'sectionH.ceoSignature',
    targetPath: 'meta.priorSectionsComplete',
    ruleType: 'requires',
  },

  // Rule 7 — EEA4 CEO declaration requires headcount validation to have passed
  {
    ruleId: 'xform:eea4-ceo-headcount-validated',
    name: 'EEA4 CEO Declaration Requires Headcount Validation Pass',
    description:
      'EEA4 CEO / Designated Senior Manager declaration cannot be signed until the ' +
      'xform:eea2-eea4-headcount cross-form validation has produced a passing result. ' +
      'This ensures that the signatory certifies figures that are provably consistent ' +
      'with the linked EEA2 workforce profile.',
    severity: 'error',
    sourceForm: 'EEA4',
    targetForm: 'EEA2',
    sourcePath: 'sectionE.ceoSignature',
    targetPath: 'meta.headcountValidationPassed',
    ruleType: 'requires',
  },

  // Rule 8 — DoL submission bundle: both EEA2 and EEA4 must be 'signed'
  {
    ruleId: 'xform:bundle-signed-before-dol',
    name: 'Submission Bundle Requires Both Forms Signed',
    description:
      'The DoL submission bundle cannot be dispatched until both the EEA2 and the linked ' +
      "EEA4 carry status 'signed'. A bundle with one or both forms in 'draft' or " +
      "'pending_ceo' status will be rejected by the DoL electronic filing system.",
    severity: 'error',
    sourceForm: 'EEA2',
    targetForm: 'EEA4',
    sourcePath: 'meta.status',
    targetPath: 'meta.status',
    ruleType: 'bundle',
  },
] as const satisfies ValidationRule[]
