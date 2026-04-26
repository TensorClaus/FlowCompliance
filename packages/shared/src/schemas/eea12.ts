import { z } from 'zod'
import {
  OccupationalLevelSchema,
  RaceCodeSchema,
  GenderCodeSchema,
  DesignationStatusSchema,
} from '../enums.js'
import { CEODeclarationSchema } from './common.js'

/**
 * EEA12 — Barriers Analysis, Workforce Profile and Economically Active
 * Population (EAP) comparison return.
 *
 * Scope:
 *   - Section A: Barriers analysis (EEA s.19(1), Regulation 4)
 *   - Section B: Workforce profile snapshot by occupational level × race ×
 *     gender × disability
 *   - Section C: EAP comparison per occupational level (StatsSA QLFS-referenced)
 *
 * Cross-row and cross-section consistency checks (e.g. totals reconciliation,
 * non-negative gap bounds, EAP dataset freshness) are intentionally NOT
 * encoded here — they live in the dedicated cross-form validation layer
 * (`schemas/validation-rules.ts`) so that this schema remains declarative
 * and reusable for partial drafts.
 */

// ---------------------------------------------------------------------------
// BarrierCategoryEnum — canonical barrier taxonomy (EEA Regulation 4)
// ---------------------------------------------------------------------------

/**
 * Canonical barrier category taxonomy for EEA12 barriers analysis.
 *
 * These categories group the 23 barrier items enumerated in DC-003 Section F
 * into the high-level dimensions prescribed by EEA Regulation 4 and the
 * Code of Good Practice on the Preparation, Implementation and Monitoring
 * of Employment Equity Plans.
 */
export const BARRIER_CATEGORIES = [
  'recruitment_procedures',
  'advertising_positions',
  'selection_criteria',
  'appointments',
  'job_classification_and_grading',
  'remuneration_and_benefits',
  'terms_and_conditions_of_employment',
  'job_assignments',
  'work_environment_and_facilities',
  'training_and_development',
  'performance_and_evaluation_systems',
  'promotion',
  'transfer',
  'demotion',
  'disciplinary_measures',
  'dismissals',
  'retention_of_designated_groups',
  'reasonable_accommodation',
  'succession_and_experience_planning',
  'workplace_culture',
  'hiv_aids_prevention_and_wellness',
  'corporate_restructuring',
  'other',
] as const

export const BarrierCategoryEnum = z.enum(BARRIER_CATEGORIES)
export type BarrierCategory = z.infer<typeof BarrierCategoryEnum>

// ---------------------------------------------------------------------------
// BarriersAnalysisSchema — Section A
// ---------------------------------------------------------------------------

/** Severity rating applied to a single identified barrier. */
export const BarrierSeveritySchema = z.enum(['low', 'medium', 'high'])
export type BarrierSeverity = z.infer<typeof BarrierSeveritySchema>

/**
 * A single barrier entry identified through the analysis performed under
 * EEA s.19(1). Each entry captures the category, a plain-language
 * description, severity, the designated groups it affects, proposed
 * mitigation actions and a target completion date.
 */
export const BarrierEntrySchema = z.object({
  /** Canonical barrier category (see BarrierCategoryEnum). */
  category: BarrierCategoryEnum,
  /** Plain-language description of the identified barrier. */
  description: z.string().min(1),
  /** Assessed severity of the barrier. */
  severity: BarrierSeveritySchema,
  /**
   * Designated groups affected by this barrier.
   * Uses the canonical DesignationStatus codes from enums.ts.
   */
  affectedDesignatedGroups: z.array(DesignationStatusSchema),
  /** One or more mitigation actions; each must be a non-empty string. */
  mitigationActions: z.array(z.string().min(1)).min(1),
  /** Target date for completion of mitigation actions (ISO 8601 date). */
  targetCompletionDate: z.string().min(1),
})
export type BarrierEntry = z.infer<typeof BarrierEntrySchema>

/**
 * Barriers analysis section. At least one barrier must be recorded per
 * submission — a nil return still requires an explicit "other" entry
 * documenting that no barriers were identified.
 */
export const BarriersAnalysisSchema = z.object({
  entries: z.array(BarrierEntrySchema).min(1),
})
export type BarriersAnalysis = z.infer<typeof BarriersAnalysisSchema>

// ---------------------------------------------------------------------------
// WorkforceProfileSchema — Section B
// ---------------------------------------------------------------------------

/**
 * A single cell of the workforce profile matrix: the number of employees at
 * a given occupational level with the given race, gender and disability
 * status. Counts are non-negative integers.
 *
 * Totals consistency between rows and section grand-totals is enforced by
 * the cross-form validation layer, not here.
 */
export const WorkforceProfileRowSchema = z.object({
  occupationalLevel: OccupationalLevelSchema,
  race: RaceCodeSchema,
  gender: GenderCodeSchema,
  disability: z.boolean(),
  count: z.number().int().nonnegative(),
})
export type WorkforceProfileRow = z.infer<typeof WorkforceProfileRowSchema>

/** Workforce profile snapshot — a flat, declarative array of profile rows. */
export const WorkforceProfileSchema = z.object({
  rows: z.array(WorkforceProfileRowSchema),
})
export type WorkforceProfile = z.infer<typeof WorkforceProfileSchema>

// ---------------------------------------------------------------------------
// EapComparisonSchema — Section C
// ---------------------------------------------------------------------------

/**
 * EAP comparison row — actual workforce composition vs the Economically
 * Active Population (EAP) reference for a given occupational level.
 *
 * Percentages are expressed on a 0–100 scale. `gapPct` is computed upstream
 * (typically `actualPct - eapPct`) and carried here purely as a typed value;
 * sign and bounds are validated by the cross-form validation layer.
 */
export const EapComparisonRowSchema = z.object({
  occupationalLevel: OccupationalLevelSchema,
  actualPct: z.number(),
  eapPct: z.number(),
  gapPct: z.number(),
})
export type EapComparisonRow = z.infer<typeof EapComparisonRowSchema>

export const EapComparisonSchema = z.object({
  rows: z.array(EapComparisonRowSchema),
})
export type EapComparison = z.infer<typeof EapComparisonSchema>

// ---------------------------------------------------------------------------
// EEA12Schema — top-level return
// ---------------------------------------------------------------------------

/**
 * Reporting period for the EEA12 return. The end date must be strictly
 * greater than the start date.
 */
export const EEA12ReportingPeriodSchema = z
  .object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
  })
  .refine((p) => Date.parse(p.endDate) > Date.parse(p.startDate), {
    message: 'reportingPeriod.endDate must be after reportingPeriod.startDate',
    path: ['endDate'],
  })
export type EEA12ReportingPeriod = z.infer<typeof EEA12ReportingPeriodSchema>

/**
 * Full EEA12 return envelope. Combines the barriers analysis, workforce
 * profile and EAP comparison with the employer identifier, reporting period,
 * CEO declaration (re-used from common.ts) and submission timestamp.
 */
export const EEA12Schema = z.object({
  employerId: z.string().uuid(),
  reportingPeriod: EEA12ReportingPeriodSchema,
  barriers: BarriersAnalysisSchema,
  workforceProfile: WorkforceProfileSchema,
  eapComparison: EapComparisonSchema,
  ceoDeclaration: CEODeclarationSchema,
  submittedAt: z.string().datetime(),
})
export type EEA12 = z.infer<typeof EEA12Schema>
