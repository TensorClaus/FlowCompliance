import { z } from 'zod'
import { EEAFormStatusSchema, MonitoringFrequencySchema } from '../enums.js'
import { CEODeclarationSchema } from './common.js'
import { EmployerProfileSchema } from './employer.js'
import { OccupationalMatrixSchema } from './matrix.js'

// ---------------------------------------------------------------------------
// Helper: DateRange
// ---------------------------------------------------------------------------

/**
 * A closed date range with a start and end date.
 * Used for reporting periods and EE plan durations throughout EEA2.
 */
export const DateRangeSchema = z.object({
  /** Start date of the range (inclusive) */
  from: z.coerce.date(),
  /** End date of the range (inclusive) */
  to: z.coerce.date(),
})

export type DateRange = z.infer<typeof DateRangeSchema>

// ---------------------------------------------------------------------------
// Helper: JustifiableReasons — DC-003 Section B
// ---------------------------------------------------------------------------

/**
 * A single occupational-level row in the justifiable reasons table.
 * Each boolean column represents one of the seven permissible reasons
 * for not meeting annual equity targets (DC-003 Section B).
 */
export const JustifiableReasonsRowSchema = z.object({
  /** Occupational level label (e.g. "Top Management", "Senior Management", "Disability") */
  occupationalLevel: z.string(),
  /** Insufficient recruitment pool at that level */
  insufficientRecruitment: z.boolean(),
  /** Insufficient internal promotion candidates */
  insufficientPromotion: z.boolean(),
  /** Insufficient suitably qualified designated applicants */
  insufficientQualified: z.boolean(),
  /** CCMA award or court order restricted deviation */
  ccmaAward: z.boolean(),
  /** Transfer of business (s197 / s197A) */
  transferOfBusiness: z.boolean(),
  /** Merger or acquisition impacted workforce composition */
  mergerAcquisition: z.boolean(),
  /** Adverse economic conditions prevented achievement */
  economicConditions: z.boolean(),
})

export type JustifiableReasonsRow = z.infer<typeof JustifiableReasonsRowSchema>

/**
 * Complete justifiable reasons table.
 * Contains 8 rows: 7 occupational levels plus a disability row (DC-003 Section B).
 * Only required when sectionB.targetsAchieved is false.
 */
export const JustifiableReasonsTableSchema = z.object({
  topManagement: JustifiableReasonsRowSchema,
  seniorManagement: JustifiableReasonsRowSchema,
  professionallyQualified: JustifiableReasonsRowSchema,
  skilledTechnical: JustifiableReasonsRowSchema,
  semiSkilled: JustifiableReasonsRowSchema,
  unskilled: JustifiableReasonsRowSchema,
  totalPermanent: JustifiableReasonsRowSchema,
  disability: JustifiableReasonsRowSchema,
})

export type JustifiableReasonsTable = z.infer<typeof JustifiableReasonsTableSchema>

// ---------------------------------------------------------------------------
// Helper: ConsultationRecord — DC-003 Section F
// ---------------------------------------------------------------------------

/**
 * Records which consultation bodies were engaged during the EE planning process.
 * At least one must be true for a valid consultation record (DC-003 Section F).
 */
export const ConsultationRecordSchema = z.object({
  /** Consultation conducted via a formal consultative body/forum */
  consultativeBody: z.boolean(),
  /** Consultation conducted with a registered trade union */
  tradeUnion: z.boolean(),
  /** Consultation conducted directly with employees */
  employees: z.boolean(),
})

export type ConsultationRecord = z.infer<typeof ConsultationRecordSchema>

// ---------------------------------------------------------------------------
// Helper: BarrierRecord — DC-003 Section F (23 categories)
// ---------------------------------------------------------------------------

/**
 * A single barrier category from the 23 barrier categories defined in DC-003 Section F.
 * Captures whether the barrier exists and whether an affirmative action measure has been developed.
 */
export const BarrierRecordSchema = z.object({
  /** Barrier category identifier (1–23) as defined in DC-003 Section F */
  categoryId: z.number().int().min(1).max(23),
  /** Human-readable label for the barrier category */
  label: z.string(),
  /** Whether this barrier exists in the organisation */
  barrierExists: z.boolean(),
  /** Whether an affirmative action measure has been developed to address this barrier */
  aaMeasuresDeveloped: z.boolean(),
  /** Planned or actual implementation start date (optional) */
  implementationStart: z.coerce.date().optional(),
  /** Planned or actual implementation end date (optional) */
  implementationEnd: z.coerce.date().optional(),
})

export type BarrierRecord = z.infer<typeof BarrierRecordSchema>

// ---------------------------------------------------------------------------
// Helper: CEODeclaration — DC-003 Section H (HITL gate)
// ---------------------------------------------------------------------------

// Re-exported from common.ts to ensure consistency across EEA2 and EEA4
export { CEODeclarationSchema, type CEODeclaration } from './common.js'

// ---------------------------------------------------------------------------
// Helper: SectorTargets — DC-003 Section E, Table 6.1
// ---------------------------------------------------------------------------

/**
 * A single row in the five-year sector targets table (DC-003 Section E, Table 6.1).
 * Each row represents a combination of occupational level, designated group, and gender
 * with associated annual and five-year targets.
 */
export const SectorTargetRowSchema = z.object({
  /** Occupational level label (e.g. "Top Management") */
  occupationalLevel: z.string(),
  /** Designated group label (e.g. "African Male", "Coloured Female") */
  designatedGroup: z.string(),
  /** Gender target as a percentage */
  genderTarget: z.number().nonnegative().max(100),
  /** Five-year numerical target (headcount or percentage, context-dependent) */
  fiveYearTarget: z.number().nonnegative(),
})

export type SectorTargetRow = z.infer<typeof SectorTargetRowSchema>

/**
 * Complete sector targets table for Table 6.1 (DC-003 Section E).
 * Uses an array to accommodate variable numbers of sector target rows.
 */
export const SectorTargetsTableSchema = z.array(SectorTargetRowSchema)

export type SectorTargetsTable = z.infer<typeof SectorTargetsTableSchema>

// ---------------------------------------------------------------------------
// Section B — Workforce Profile & Annual Targets (DC-003 Tables 1.1, 1.2)
// ---------------------------------------------------------------------------

/**
 * EEA2 Section B: Workforce Profile, Disability Profile, Annual Targets, and Targets Assessment.
 *
 * - Table 1.1: workforceProfile — total headcount breakdown by designated group
 * - Table 1.2: disabilityProfile — employees with disabilities breakdown
 * - annualTargets: numeric targets set for the current reporting year
 * - disabilityTarget: specific disability representation target percentages
 * - targetsAchieved: whether all annual targets were met
 * - justifiableReasons: required only when targetsAchieved is false (DC-003 Section B)
 */
export const SectionBSchema = z.object({
  /**
   * Table 1.1 — Total workforce profile by occupational level and designated group.
   * Reflects the actual headcount at the end of the reporting period.
   */
  workforceProfile: OccupationalMatrixSchema,
  /**
   * Table 1.2 — Employees with disabilities by occupational level and designated group.
   * Subset of the workforce profile showing employees who declared a disability.
   */
  disabilityProfile: OccupationalMatrixSchema,
  /**
   * Annual numeric targets for the current reporting year by occupational level
   * and designated group. Used to assess target achievement in this section.
   */
  annualTargets: OccupationalMatrixSchema,
  /** Disability representation targets: prior year profile % and current year target % */
  disabilityTarget: z.object({
    /** Disability representation percentage from the current workforce profile */
    profilePct: z.number().nonnegative().max(100),
    /** Disability representation target percentage for the current year */
    targetPct: z.number().nonnegative().max(100),
  }),
  /** Whether all annual equity targets were achieved in this reporting period */
  targetsAchieved: z.boolean(),
  /**
   * Justifiable reasons for not meeting targets — only required when targetsAchieved is false.
   * Covers 7 occupational levels + disability row with 7 reason checkboxes each (DC-003 Section B).
   */
  justifiableReasons: JustifiableReasonsTableSchema.optional(),
})

export type SectionB = z.infer<typeof SectionBSchema>

// ---------------------------------------------------------------------------
// Section C — Employment Changes (DC-003 Tables 2.1, 3.1, 4.1)
// ---------------------------------------------------------------------------

/**
 * EEA2 Section C: Recruitment, Promotions, and Terminations during the reporting period.
 *
 * - Table 2.1: recruitment — new appointments by occupational level and designated group
 * - Table 3.1: promotions — upward movements by occupational level and designated group
 * - Table 4.1: terminations — exits by occupational level, designated group, and reason
 */
export const SectionCSchema = z.object({
  /**
   * Table 2.1 — New appointments (recruitment) during the reporting period
   * by occupational level and designated group.
   */
  recruitment: OccupationalMatrixSchema,
  /**
   * Table 3.1 — Internal promotions during the reporting period
   * by occupational level and designated group.
   */
  promotions: OccupationalMatrixSchema,
  /**
   * Table 4.1 — Terminations of employment during the reporting period
   * by occupational level and designated group.
   */
  terminations: OccupationalMatrixSchema,
})

export type SectionC = z.infer<typeof SectionCSchema>

// ---------------------------------------------------------------------------
// Section D — Skills Development (DC-003 Table 5.1)
// ---------------------------------------------------------------------------

/**
 * EEA2 Section D: Skills Development activities during the reporting period.
 *
 * - Table 5.1: skillsDevelopment — employees who received training or development
 *   by occupational level and designated group.
 */
export const SectionDSchema = z.object({
  /**
   * Table 5.1 — Employees who received skills development interventions
   * during the reporting period by occupational level and designated group.
   */
  skillsDevelopment: OccupationalMatrixSchema,
})

export type SectionD = z.infer<typeof SectionDSchema>

// ---------------------------------------------------------------------------
// Section E — Equity Targets for Next Year (DC-003 Tables 6.1, 7.1)
// ---------------------------------------------------------------------------

/**
 * EEA2 Section E: Five-year sector targets and next-year annual targets.
 *
 * - Table 6.1: sectorTargets5Year — sector-specific five-year numerical targets
 * - Table 7.1: annualTargetsNextYear — targets for the next 12-month reporting period
 * - disabilityTargetNextYear: numerical and percentage disability representation target
 */
export const SectionESchema = z.object({
  /**
   * Table 6.1 — Sector-specific five-year equity targets by occupational level,
   * designated group, and gender (DC-003 Section E).
   */
  sectorTargets5Year: SectorTargetsTableSchema,
  /**
   * Table 7.1 — Annual equity targets for the next reporting year
   * by occupational level and designated group.
   */
  annualTargetsNextYear: OccupationalMatrixSchema,
  /** Disability representation target for the next reporting year */
  disabilityTargetNextYear: z.object({
    /** Absolute headcount target for employees with disabilities */
    value: z.number().int().nonnegative(),
    /** Disability representation target as a percentage of total workforce */
    pct: z.number().nonnegative().max(100),
  }),
})

export type SectionE = z.infer<typeof SectionESchema>

// ---------------------------------------------------------------------------
// Section F — Consultation & Barriers (DC-003 Section F)
// ---------------------------------------------------------------------------

/**
 * EEA2 Section F: Consultation process and barriers to employment equity.
 *
 * - consultation: which bodies were consulted during EE plan development
 * - barriers: assessment of all 23 DC-003 barrier categories and AA measures developed
 */
export const SectionFSchema = z.object({
  /**
   * Record of consultative bodies engaged during the EE planning process.
   * At least one of consultativeBody, tradeUnion, or employees must have been consulted.
   */
  consultation: ConsultationRecordSchema,
  /**
   * Assessment of all 23 barrier categories defined in DC-003 Section F.
   * Each barrier records whether it exists and whether an AA measure has been developed.
   * Array must contain exactly one entry per category (categoryId 1–23).
   */
  barriers: z.array(BarrierRecordSchema).length(23),
})

export type SectionF = z.infer<typeof SectionFSchema>

// ---------------------------------------------------------------------------
// Section G — Monitoring (DC-003 Section G)
// ---------------------------------------------------------------------------

/**
 * EEA2 Section G: EE Plan monitoring frequency and objectives assessment.
 * Records how frequently the employer monitors implementation of the EE plan
 * and whether the plan's objectives were achieved during the reporting period.
 */
export const SectionGSchema = z.object({
  /** How frequently the EE plan implementation is monitored */
  monitoringFrequency: MonitoringFrequencySchema,
  /** Whether the EE plan objectives were achieved during the reporting period */
  objectivesAchieved: z.boolean(),
  /**
   * Explanation for objectives not being achieved or context for their achievement.
   * Optional — encouraged when objectivesAchieved is false.
   */
  objectivesExplanation: z.string().optional(),
})

export type SectionG = z.infer<typeof SectionGSchema>

// ---------------------------------------------------------------------------
// Section H — CEO Declaration (DC-003 Section H) — HITL gate
// ---------------------------------------------------------------------------

/**
 * EEA2 Section H: CEO / authorised signatory declaration.
 * This section is absent (undefined) until the HITL signing gate is passed.
 * When the CEO signs, this section is populated and the form status advances to 'signed'.
 * DC-003 Section H.
 */
export const SectionHSchema = CEODeclarationSchema

export type SectionH = z.infer<typeof SectionHSchema>

// ---------------------------------------------------------------------------
// EEA2Report — Full annual report (DC-011)
// ---------------------------------------------------------------------------

/**
 * Complete EEA2 Annual Employment Equity Report.
 * Composes all sections (A–H) as defined in DC-011 and DC-003.
 * Section H is optional — it remains undefined until the CEO signs (HITL gate).
 */
export const EEA2ReportSchema = z.object({
  /** Tenant identifier linking the report to the registered employer */
  tenantId: z.string().uuid(),
  /** Calendar year for which this report is submitted (e.g. 2025) */
  reportingYear: z.number().int().min(2000).max(2100),
  /**
   * Section A (implicit) — Reporting period covered by this submission.
   * Typically 1 October to 30 September for the preceding 12 months.
   */
  reportingPeriod: DateRangeSchema,
  /**
   * Duration of the current Employment Equity Plan (up to 5 years).
   * Must align with the plan submitted to the Department of Employment and Labour.
   */
  eePlanDuration: DateRangeSchema,
  /**
   * Section A — Employer profile and registration details.
   * Based on EmployerProfile from DC-011 employer registration specification.
   */
  employerProfile: EmployerProfileSchema,
  /**
   * Section B — Workforce profile, disability profile, annual targets, and targets assessment.
   * Covers DC-003 Tables 1.1 and 1.2.
   */
  sectionB: SectionBSchema,
  /**
   * Section C — Employment movement: recruitment, promotions, and terminations.
   * Covers DC-003 Tables 2.1, 3.1, and 4.1.
   */
  sectionC: SectionCSchema,
  /**
   * Section D — Skills development interventions during the reporting period.
   * Covers DC-003 Table 5.1.
   */
  sectionD: SectionDSchema,
  /**
   * Section E — Five-year sector targets and next-year annual targets.
   * Covers DC-003 Tables 6.1 and 7.1.
   */
  sectionE: SectionESchema,
  /**
   * Section F — Consultation process and assessment of employment equity barriers.
   * Covers DC-003 Section F (23 barrier categories).
   */
  sectionF: SectionFSchema,
  /**
   * Section G — EE plan monitoring frequency and objectives achievement.
   * DC-003 Section G.
   */
  sectionG: SectionGSchema,
  /**
   * Section H — CEO / authorised signatory declaration.
   * Optional: absent until the HITL signing gate is completed.
   * Populated by the signing workflow; absence indicates status is 'pending_ceo' or earlier.
   * DC-003 Section H.
   */
  sectionH: SectionHSchema.optional(),
  /**
   * Current submission status of the EEA2 form.
   * Progresses: draft → pending_ceo → signed → submitted.
   */
  status: EEAFormStatusSchema,
})

export type EEA2Report = z.infer<typeof EEA2ReportSchema>

// ---------------------------------------------------------------------------
// EEA2Form — Persistence wrapper with audit fields
// ---------------------------------------------------------------------------

/**
 * EEA2 form persistence wrapper.
 * Wraps the EEA2Report with a system-generated UUID, audit timestamps,
 * and a top-level status field for workflow orchestration.
 * This is the document stored in the database; EEA2Report is the domain payload.
 */
export const EEA2FormSchema = z.object({
  /** System-generated unique identifier for the persisted form document */
  id: z.string().uuid(),
  /** The complete EEA2 annual report payload */
  report: EEA2ReportSchema,
  /**
   * Top-level form status for workflow orchestration.
   * Mirrors report.status; kept at wrapper level for indexed queries.
   */
  status: EEAFormStatusSchema,
  /** Timestamp when the form document was first created */
  createdAt: z.coerce.date(),
  /** Timestamp of the most recent update to the form document */
  updatedAt: z.coerce.date(),
})

export type EEA2Form = z.infer<typeof EEA2FormSchema>
