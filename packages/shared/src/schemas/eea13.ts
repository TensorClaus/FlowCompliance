import { z } from 'zod'
import { SECTOR_CODES } from '../data/sector-targets.js'
import { OccupationalLevelSchema } from '../enums.js'
import { CEODeclarationSchema } from './common.js'
import { BarrierCategoryEnum } from './eea12.js'

/**
 * EEA13 — 5-Year Employment Equity Plan (EEP) with Numerical Goals.
 *
 * Legal basis:
 *   - EEA s.20: Employer must set numerical goals referencing EAP data
 *   - GN 6124 (2024): Mandatory sector-specific targets, 5-year window
 *     2025-01-01 to 2029-12-31
 *   - EEA s.16: Genuine employee consultation required before adoption
 *   - EEA s.65: Penalty regime for non-compliance (R1.5m–R2.7m or up
 *     to 10% of annual turnover)
 *
 * CRITICAL COMPLIANCE GUARDS:
 *   1. Numerical goal targets MUST meet or exceed EAP benchmarks.
 *      Goals below sector EAP targets are non-compliant (s.20 + GN 6124).
 *   2. Timeframes MUST be concrete dates — "ongoing" is explicitly
 *      rejected as it fails the specificity requirement in EEA Regulation 4.
 *   3. Plan period MUST span exactly 5 years (EEA s.20(2)(b)).
 *   4. Employee consultation MUST have occurred (EEA s.16).
 *
 * Reference rules: rule_eea_003, rule_eea_004, rule_eea_008, rule_eea_009,
 * rule_eea_014, rule_eea_024 (see eea-patterns.md)
 */

// ---------------------------------------------------------------------------
// SectorCodeSchema — Zod enum derived from SECTOR_CODES constant
// ---------------------------------------------------------------------------

export const SectorCodeSchema = z.enum(SECTOR_CODES)

// ---------------------------------------------------------------------------
// DesignatedGroupCodeSchema — combined race + gender codes for goal targeting
// ---------------------------------------------------------------------------

/**
 * Designated group code for numerical goals. Includes race codes (A, C, I, W)
 * and gender codes (M, F) since goals may target either dimension.
 */
export const DesignatedGroupCodeSchema = z.enum(['A', 'C', 'I', 'W', 'M', 'F'])

// ---------------------------------------------------------------------------
// NumericalGoalSchema — individual goal entry (EEA s.20)
// ---------------------------------------------------------------------------

/**
 * A single numerical goal within a yearly plan. Each goal targets a specific
 * designated group at a given occupational level with a concrete percentage
 * target that must meet or exceed the EAP benchmark.
 *
 * Compliance refines:
 *   - target < eapBenchmark → REJECTED (GN 6124 non-compliance)
 *   - timeframe contains "ongoing" → REJECTED (specificity requirement)
 */
export const NumericalGoalSchema = z
  .object({
    /** Occupational level (1–7) this goal applies to. */
    occupationalLevel: OccupationalLevelSchema,
    /** Designated group code (race or gender) targeted by this goal. */
    designatedGroup: DesignatedGroupCodeSchema,
    /** Current workforce representation percentage for this group at this level (0–100). */
    currentRepresentation: z.number().min(0).max(100),
    /** Target representation percentage to achieve (0–100). */
    target: z.number().min(0).max(100),
    /** EAP benchmark percentage for this group at this level (0–100). */
    eapBenchmark: z.number().min(0).max(100),
    /**
     * Concrete timeframe description for achieving this goal.
     * MUST NOT be "ongoing" — every goal requires a specific time-bound commitment.
     */
    timeframe: z.string().min(1),
    /** ISO 8601 date string by which the target must be achieved. */
    targetDate: z.string().min(1),
    /** Concrete affirmative action measures to achieve this goal. At least one required. */
    measures: z.array(z.string().min(1)).min(1),
  })
  .refine((goal) => !goal.timeframe.toLowerCase().includes('ongoing'), {
    message:
      'Timeframe must be a concrete date or period — "ongoing" is not accepted (EEA Regulation 4)',
    path: ['timeframe'],
  })
  .refine((goal) => goal.target >= goal.eapBenchmark, {
    message: 'Target must meet or exceed EAP benchmark',
    path: ['target'],
  })

/** Inferred TypeScript type for a single numerical goal. */
export type NumericalGoal = z.infer<typeof NumericalGoalSchema>

// ---------------------------------------------------------------------------
// PlanYearSchema — annual breakdown within the 5-year plan
// ---------------------------------------------------------------------------

/**
 * Annual plan for a single year within the 5-year EEP. Contains all numerical
 * goals for that year, an optional budget allocation, and a review date.
 */
export const PlanYearSchema = z.object({
  /** Calendar year (2025–2030, covering the GN 6124 mandatory window). */
  year: z.number().int().min(2025).max(2030),
  /** Numerical goals for this year. At least one goal required per year. */
  goals: z.array(NumericalGoalSchema).min(1),
  /** Annual budget allocated to affirmative action measures (optional). */
  annualBudget: z.number().nonnegative().optional(),
  /** ISO 8601 date string for the annual review of this year's progress. */
  reviewDate: z.string().min(1),
})

/** Inferred TypeScript type for a single plan year. */
export type PlanYear = z.infer<typeof PlanYearSchema>

// ---------------------------------------------------------------------------
// BarriersRemovalPlanSchema — linked to barriers analysis (EEA s.19/s.20)
// ---------------------------------------------------------------------------

/**
 * A single action item in the barriers removal plan, linked to a barrier
 * category identified in the EEA12 barriers analysis.
 */
export const BarriersRemovalPlanSchema = z.object({
  /** Barrier category from the canonical EEA Regulation 4 taxonomy. */
  barrierCategory: BarrierCategoryEnum,
  /** Description of the action to remove or mitigate the barrier. */
  action: z.string().min(1),
  /** Person or role responsible for executing this action. */
  responsible: z.string().min(1),
  /**
   * Timeline for completing this action.
   * MUST NOT be "ongoing" — specificity required (EEA Regulation 4).
   */
  timeline: z
    .string()
    .min(1)
    .refine((val) => !val.toLowerCase().includes('ongoing'), {
      message: 'Timeline must be a concrete date or period — "ongoing" is not accepted',
    }),
  /** Measurable outcome that will indicate the barrier has been addressed. */
  measurableOutcome: z.string().min(1),
})

/** Inferred TypeScript type for a single barriers removal plan entry. */
export type BarriersRemovalPlan = z.infer<typeof BarriersRemovalPlanSchema>

// ---------------------------------------------------------------------------
// DisputeResolutionSchema — EEA s.25 / CCMA / Labour Court
// ---------------------------------------------------------------------------

/**
 * Dispute resolution procedures as required by EEA s.25.
 * Chapter II disputes (unfair discrimination) → CCMA within 6 months.
 * Chapter III disputes (affirmative action) → Labour Court within 6 months.
 */
export const DisputeResolutionSchema = z.object({
  /** Description of the internal dispute resolution procedure. */
  internalProcedure: z.string().min(1),
  /** Process for referring disputes to the CCMA (Chapter II — unfair discrimination). */
  ccmaReferralProcess: z.string().min(1),
  /** Process for escalating to the Labour Court (Chapter III — affirmative action). */
  labourCourtEscalation: z.string().min(1),
})

/** Inferred TypeScript type for dispute resolution procedures. */
export type DisputeResolution = z.infer<typeof DisputeResolutionSchema>

// ---------------------------------------------------------------------------
// PlanPeriodSchema — 5-year plan window
// ---------------------------------------------------------------------------

/**
 * Plan period for the EEP. The end date must be approximately 5 years from
 * the start date (EEA s.20(2)(b)). Tolerance of +/- 31 days accounts for
 * month-end alignment variations.
 */
const PlanPeriodSchema = z
  .object({
    /** ISO 8601 date string for the start of the plan period. */
    startDate: z.string().min(1),
    /** ISO 8601 date string for the end of the plan period. */
    endDate: z.string().min(1),
  })
  .refine(
    (period) => {
      const start = Date.parse(period.startDate)
      const end = Date.parse(period.endDate)
      if (Number.isNaN(start) || Number.isNaN(end)) return false
      const diffMs = end - start
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      // 5 years = ~1826 days (including one leap year). Allow +/- 31 days tolerance.
      return diffDays >= 1795 && diffDays <= 1857
    },
    {
      message: 'Plan period must span 5 years (EEA s.20(2)(b))',
      path: ['endDate'],
    },
  )

// ---------------------------------------------------------------------------
// ConsultationSchema — EEA s.16 consultation record
// ---------------------------------------------------------------------------

const ConsultationSchema = z.object({
  /** Whether genuine employee consultation occurred (EEA s.16 — mandatory). */
  consultedWithEmployees: z.boolean(),
  /** Whether an Employment Equity Consultative Forum has been established. */
  eecfEstablished: z.boolean(),
  /** ISO 8601 date string when consultation took place. */
  consultationDate: z.string().min(1),
})

// ---------------------------------------------------------------------------
// WorkforceAnalysisSchema — workforce composition summary
// ---------------------------------------------------------------------------

const WorkforceAnalysisSchema = z.object({
  /** Total number of employees in the organisation. */
  totalEmployees: z.number().int().positive(),
  /** Number of employees classified as designated group members. */
  designatedEmployees: z.number().int().nonnegative(),
  /** Number of foreign national employees (excluded from designated counts per EEA s.1). */
  foreignNationals: z.number().int().nonnegative(),
})

// ---------------------------------------------------------------------------
// EEA13Schema — top-level 5-year Employment Equity Plan
// ---------------------------------------------------------------------------

/**
 * Full EEA13 return — the 5-year Employment Equity Plan with numerical goals,
 * barriers removal plan, dispute resolution, and CEO declaration.
 *
 * Top-level refine: consultation.consultedWithEmployees must be true.
 * EEA s.16 makes genuine employee consultation a prerequisite for adopting
 * or amending an EEP. Submitting without consultation is non-compliant.
 */
export const EEA13Schema = z
  .object({
    /** UUID of the designated employer. */
    employerId: z.string().uuid(),
    /** GN 6124 sector code for sector-specific target lookup. */
    sectorCode: SectorCodeSchema,
    /** 5-year plan period (start and end dates). */
    planPeriod: PlanPeriodSchema,
    /** Employee consultation record (EEA s.16). */
    consultation: ConsultationSchema,
    /** Summary workforce composition at time of plan preparation. */
    workforceAnalysis: WorkforceAnalysisSchema,
    /** Yearly plans covering at least 3 of the 5 years. */
    yearlyPlans: z.array(PlanYearSchema).min(3).max(5),
    /** Barriers removal actions linked to the EEA12 barriers analysis. */
    barriersRemovalPlan: z.array(BarriersRemovalPlanSchema).min(1),
    /** Dispute resolution procedures (EEA s.25). */
    disputeResolution: DisputeResolutionSchema,
    /** Description of the monitoring mechanism for tracking plan progress. */
    monitoringMechanism: z.string().min(1),
    /** CEO or authorised signatory declaration. */
    ceoDeclaration: CEODeclarationSchema,
    /** ISO 8601 datetime string when the plan was submitted. */
    submittedAt: z.string().datetime(),
  })
  .refine((plan) => plan.consultation.consultedWithEmployees, {
    message: 'Employee consultation is mandatory before adopting an EEP (EEA s.16)',
    path: ['consultation', 'consultedWithEmployees'],
  })

/** Inferred TypeScript type for a complete EEA13 submission. */
export type EEA13 = z.infer<typeof EEA13Schema>
