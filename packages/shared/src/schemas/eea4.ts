import { z } from 'zod'
import { EEAFormStatusSchema } from '../enums.js'
import { CEODeclarationSchema } from './common.js'
import { EmployerProfileSchema } from './employer.js'
import { RemunerationMatrixSchema, RemBreakdownMatrixSchema } from './matrix.js'

// ---------------------------------------------------------------------------
// CEO Declaration
// ---------------------------------------------------------------------------

// Re-exported from common.ts to ensure consistency across EEA2 and EEA4
export { CEODeclarationSchema, type CEODeclaration } from './common.js'

// ---------------------------------------------------------------------------
// Section E — Median and Remuneration Gap
// ---------------------------------------------------------------------------

/**
 * Boundary range used to express the top-5% and bottom-5% remuneration
 * bands in Section E of the EEA4.
 * All monetary values are in ZAR with no decimal places (DC-004).
 */
export const RemunerationGapRangeSchema = z.object({
  /** Lower boundary of the range (ZAR, non-negative integer) */
  lowest: z.number().nonnegative(),
  /** Upper boundary of the range (ZAR, non-negative integer) */
  highest: z.number().nonnegative(),
})

export type RemunerationGapRange = z.infer<typeof RemunerationGapRangeSchema>

/**
 * EEA4 Section E — Median Remuneration and Income Differential (Gap) data.
 * All monetary values are total annual remuneration in ZAR (DC-004, no decimals).
 */
export const SectionESchema = z.object({
  /** Total annual remuneration median across all employees (ZAR) */
  median: z.number().nonnegative(),
  /**
   * Remuneration range for employees in the top 5 percentile.
   * `lowest` is the floor of the top-5% cohort;
   * `highest` is the ceiling / maximum earner.
   */
  top5pctRange: RemunerationGapRangeSchema,
  /**
   * Remuneration range for employees in the bottom 5 percentile.
   * `lowest` is the minimum earner; `highest` is the ceiling of the bottom-5% cohort.
   */
  bottom5pctRange: RemunerationGapRangeSchema,
})

export type SectionE = z.infer<typeof SectionESchema>

// ---------------------------------------------------------------------------
// EEA4 Report
// ---------------------------------------------------------------------------

/**
 * EEA4 Income Differential Statement — core report data.
 *
 * CRITICAL CROSS-FORM CONSTRAINT (DC-004 / DC-011):
 * The headcount figures in `sectionC` (RemunerationMatrix) MUST match the
 * employee counts recorded in EEA2 Table 1.1 for the same reporting period.
 * This constraint is intentionally NOT enforced at the schema layer because
 * the EEA2 document is a separate aggregate; enforcement lives in the
 * application validation layer and the HITL gate that locks `declaration`
 * until the cross-form check passes.
 *
 * Section A (employer details) is derived at render time from the linked
 * EEA2's `employerProfile` field — it is not duplicated on the EEA4 report
 * itself to avoid data inconsistency between the two forms.
 */
export const EEA4ReportSchema = z.object({
  /** Tenant (employer) identifier — scopes the report to a single organisation */
  tenantId: z.uuid(),

  /**
   * UUID of the EEA2 report this EEA4 is linked to.
   * Both documents MUST share the same reporting period; the headcount in
   * sectionC is pre-filled (read-only) from EEA2 Table 1.1.
   */
  linkedEEA2Id: z.uuid(),

  /**
   * Section A — Employer profile.
   * Captured here for form self-containment at submission time.
   * Source of truth remains the linked EEA2; treat this as a snapshot.
   */
  sectionA: EmployerProfileSchema,

  /**
   * Section C — Remuneration by occupational level and demographic category.
   * Each cell holds headcount + totalRemuneration (ZAR).
   * Headcount is pre-filled from EEA2 Table 1.1 and must be treated as
   * read-only in the UI; mismatch triggers a validation error at the
   * application layer before the CEO Declaration gate opens.
   */
  sectionC: RemunerationMatrixSchema,

  /**
   * Section D1 — Highest-paid employee per occupational level.
   * Fixed + variable + auto-calculated total per demographic cell.
   * If only one employee exists at a level, capture that employee here (D1)
   * only — do not duplicate in D2.
   */
  sectionD1: RemBreakdownMatrixSchema,

  /**
   * Section D2 — Lowest-paid employee per occupational level.
   * Same structure as D1. Leave cells zeroed for any level where only
   * one employee exists (that employee is captured in D1 only).
   */
  sectionD2: RemBreakdownMatrixSchema,

  /** Section E — Median remuneration and income gap ranges */
  sectionE: SectionESchema,

  /**
   * CEO / authorised representative declaration (Section F on the form).
   * Optional — populated only after:
   *   1. sectionC headcount is validated against EEA2 Table 1.1, AND
   *   2. The CEO completes the HITL sign-off flow.
   * The status field transitions from `pending_ceo` → `signed` at that point.
   */
  declaration: CEODeclarationSchema.optional(),

  /** Lifecycle status of this EEA4 document */
  status: EEAFormStatusSchema,
})

export type EEA4Report = z.infer<typeof EEA4ReportSchema>

// ---------------------------------------------------------------------------
// EEA4 Form (persistence wrapper)
// ---------------------------------------------------------------------------

/**
 * EEA4 Form — persistence-layer wrapper around EEA4Report.
 * Adds system-managed identity and audit timestamps.
 */
export const EEA4FormSchema = z.object({
  /** Unique identifier for this EEA4 form record */
  id: z.uuid(),

  /** The EEA4 report payload */
  report: EEA4ReportSchema,

  /**
   * Top-level status mirror — kept in sync with `report.status`.
   * Stored at the form level to support indexed queries without
   * deserialising the full report payload.
   */
  status: EEAFormStatusSchema,

  /** Timestamp of initial record creation */
  createdAt: z.coerce.date(),

  /** Timestamp of the most recent update */
  updatedAt: z.coerce.date(),
})

export type EEA4Form = z.infer<typeof EEA4FormSchema>
