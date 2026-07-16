import { z } from 'zod'

/**
 * Basic matrix cell containing a numeric value with optional percentage
 * Used for employment counts in occupational matrices
 * Percentage is auto-calculated based on the total column value
 * From DC-011 compliance specification
 */
export const MatrixCellSchema = z.object({
  /** Numeric value (headcount or count) */
  value: z.number().int().nonnegative(),
  /** Optional percentage of total (auto-calculated from total column) */
  percent: z.number().nonnegative().max(100).optional(),
})

export type MatrixCell = z.infer<typeof MatrixCellSchema>

/**
 * Matrix cell for remuneration data containing headcount and total remuneration
 * Used in EEA4 Section C for salary and remuneration reporting
 */
export const RemunerationCellSchema = z.object({
  /** Number of employees in this category */
  headcount: z.number().int().nonnegative(),
  /** Total remuneration paid to employees in this category (in ZAR) */
  totalRemuneration: z.number().nonnegative(),
})

export type RemunerationCell = z.infer<typeof RemunerationCellSchema>

/**
 * Matrix cell for remuneration breakdown containing fixed and variable components
 * Used in EEA4 Sections D1 and D2 for remuneration composition analysis
 * Total is auto-calculated as fixed + variable
 */
export const RemBreakdownCellSchema = z.object({
  /** Fixed remuneration component (in ZAR) */
  fixed: z.number().nonnegative(),
  /** Variable remuneration component (in ZAR) */
  variable: z.number().nonnegative(),
  /** Total remuneration (auto-calculated as fixed + variable) */
  total: z.number().nonnegative().optional(),
})

export type RemBreakdownCell = z.infer<typeof RemBreakdownCellSchema>

/**
 * Single row of a matrix containing cells for all gender/race combinations
 * Includes 10 demographic categories plus a total column
 * Used as a building block for occupational, remuneration, and breakdown matrices
 */
export const MatrixRowSchema = z.object({
  /** African male employees */
  africanMale: MatrixCellSchema,
  /** African female employees */
  africanFemale: MatrixCellSchema,
  /** Coloured male employees */
  colouredMale: MatrixCellSchema,
  /** Coloured female employees */
  colouredFemale: MatrixCellSchema,
  /** Indian/Asian male employees */
  indianMale: MatrixCellSchema,
  /** Indian/Asian female employees */
  indianFemale: MatrixCellSchema,
  /** White male employees */
  whiteMale: MatrixCellSchema,
  /** White female employees */
  whiteFemale: MatrixCellSchema,
  /** Foreign national male employees */
  foreignNationalMale: MatrixCellSchema,
  /** Foreign national female employees */
  foreignNationalFemale: MatrixCellSchema,
  /** Total across all categories */
  total: MatrixCellSchema,
})

export type MatrixRow = z.infer<typeof MatrixRowSchema>

/**
 * Single row of a remuneration matrix containing remuneration cells
 * Same structure as MatrixRow but with RemunerationCell elements
 * Used for EEA4 Section C remuneration data
 */
export const RemunerationRowSchema = z.object({
  /** African male employees remuneration data */
  africanMale: RemunerationCellSchema,
  /** African female employees remuneration data */
  africanFemale: RemunerationCellSchema,
  /** Coloured male employees remuneration data */
  colouredMale: RemunerationCellSchema,
  /** Coloured female employees remuneration data */
  colouredFemale: RemunerationCellSchema,
  /** Indian/Asian male employees remuneration data */
  indianMale: RemunerationCellSchema,
  /** Indian/Asian female employees remuneration data */
  indianFemale: RemunerationCellSchema,
  /** White male employees remuneration data */
  whiteMale: RemunerationCellSchema,
  /** White female employees remuneration data */
  whiteFemale: RemunerationCellSchema,
  /** Foreign national male employees remuneration data */
  foreignNationalMale: RemunerationCellSchema,
  /** Foreign national female employees remuneration data */
  foreignNationalFemale: RemunerationCellSchema,
  /** Total remuneration data across all categories */
  total: RemunerationCellSchema,
})

export type RemunerationRow = z.infer<typeof RemunerationRowSchema>

/**
 * Single row of a remuneration breakdown matrix containing breakdown cells
 * Same structure as MatrixRow but with RemBreakdownCell elements
 * Used for EEA4 Sections D1 and D2 remuneration composition analysis
 */
export const RemBreakdownRowSchema = z.object({
  /** African male employees remuneration breakdown */
  africanMale: RemBreakdownCellSchema,
  /** African female employees remuneration breakdown */
  africanFemale: RemBreakdownCellSchema,
  /** Coloured male employees remuneration breakdown */
  colouredMale: RemBreakdownCellSchema,
  /** Coloured female employees remuneration breakdown */
  colouredFemale: RemBreakdownCellSchema,
  /** Indian/Asian male employees remuneration breakdown */
  indianMale: RemBreakdownCellSchema,
  /** Indian/Asian female employees remuneration breakdown */
  indianFemale: RemBreakdownCellSchema,
  /** White male employees remuneration breakdown */
  whiteMale: RemBreakdownCellSchema,
  /** White female employees remuneration breakdown */
  whiteFemale: RemBreakdownCellSchema,
  /** Foreign national male employees remuneration breakdown */
  foreignNationalMale: RemBreakdownCellSchema,
  /** Foreign national female employees remuneration breakdown */
  foreignNationalFemale: RemBreakdownCellSchema,
  /** Total remuneration breakdown across all categories */
  total: RemBreakdownCellSchema,
})

export type RemBreakdownRow = z.infer<typeof RemBreakdownRowSchema>

/**
 * Occupational matrix for employment equity reporting
 * Contains employee counts by occupational level and demographic categories
 * Used in EEA2 Section B and EEA4 tables for employee distribution analysis
 * Rows represent 9 occupational categories as per DC-003 and DC-004 specifications
 */
export const OccupationalMatrixSchema = z.object({
  /** Top Management occupational level */
  topManagement: MatrixRowSchema,
  /** Senior Management occupational level */
  seniorManagement: MatrixRowSchema,
  /** Professionally Qualified occupational level */
  professionallyQualified: MatrixRowSchema,
  /** Skilled Technical occupational level */
  skilledTechnical: MatrixRowSchema,
  /** Semi-Skilled occupational level */
  semiSkilled: MatrixRowSchema,
  /** Unskilled occupational level */
  unskilled: MatrixRowSchema,
  /** Total Permanent employees */
  totalPermanent: MatrixRowSchema,
  /** Temporary employees */
  temporaryEmployees: MatrixRowSchema,
  /** Grand total across all categories */
  grandTotal: MatrixRowSchema,
})

export type OccupationalMatrix = z.infer<typeof OccupationalMatrixSchema>

/**
 * Remuneration matrix for salary and compensation reporting
 * Contains headcount and total remuneration by occupational level and demographic categories
 * Used in EEA4 Section C for detailed remuneration analysis
 * Same row structure as OccupationalMatrix but with remuneration data
 */
export const RemunerationMatrixSchema = z.object({
  /** Top Management remuneration data */
  topManagement: RemunerationRowSchema,
  /** Senior Management remuneration data */
  seniorManagement: RemunerationRowSchema,
  /** Professionally Qualified remuneration data */
  professionallyQualified: RemunerationRowSchema,
  /** Skilled Technical remuneration data */
  skilledTechnical: RemunerationRowSchema,
  /** Semi-Skilled remuneration data */
  semiSkilled: RemunerationRowSchema,
  /** Unskilled remuneration data */
  unskilled: RemunerationRowSchema,
  /** Total Permanent employees remuneration data */
  totalPermanent: RemunerationRowSchema,
  /** Temporary employees remuneration data */
  temporaryEmployees: RemunerationRowSchema,
  /** Grand total remuneration data across all categories */
  grandTotal: RemunerationRowSchema,
})

export type RemunerationMatrix = z.infer<typeof RemunerationMatrixSchema>

/**
 * Remuneration breakdown matrix for fixed/variable compensation analysis
 * Contains remuneration composition (fixed and variable components) by occupational level and demographic categories
 * Used in EEA4 Sections D1 and D2 for remuneration structure analysis
 * Same row structure as OccupationalMatrix but with remuneration breakdown data
 *
 * Single-employee rule: if the linked EEA2 headcount total for an occupational
 * level is exactly 1, the identifiable employee is captured in Section D1 only;
 * the corresponding Section D2 row must remain zeroed and read-only.
 */
export const RemBreakdownMatrixSchema = z.object({
  /** Top Management remuneration breakdown */
  topManagement: RemBreakdownRowSchema,
  /** Senior Management remuneration breakdown */
  seniorManagement: RemBreakdownRowSchema,
  /** Professionally Qualified remuneration breakdown */
  professionallyQualified: RemBreakdownRowSchema,
  /** Skilled Technical remuneration breakdown */
  skilledTechnical: RemBreakdownRowSchema,
  /** Semi-Skilled remuneration breakdown */
  semiSkilled: RemBreakdownRowSchema,
  /** Unskilled remuneration breakdown */
  unskilled: RemBreakdownRowSchema,
  /** Total Permanent employees remuneration breakdown */
  totalPermanent: RemBreakdownRowSchema,
  /** Temporary employees remuneration breakdown */
  temporaryEmployees: RemBreakdownRowSchema,
  /** Grand total remuneration breakdown across all categories */
  grandTotal: RemBreakdownRowSchema,
})

export type RemBreakdownMatrix = z.infer<typeof RemBreakdownMatrixSchema>
