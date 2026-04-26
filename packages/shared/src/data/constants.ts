/**
 * Canonical shared constants for Simplifi EEA compliance domain.
 *
 * This file is the single source of truth for display labels, code arrays,
 * and category tuples that are referenced across multiple schemas and
 * reporting layers.
 *
 * NOTE: BARRIER_CATEGORIES here is the canonical value. The BARRIER_CATEGORIES
 * constant in schemas/eea12.ts is kept as-is (frozen) but may be updated in a
 * future refactor to re-export from here.
 *
 * No runtime dependencies — pure static data and derived types only.
 */

// ---------------------------------------------------------------------------
// Barrier categories — EEA Regulation 4 taxonomy (23 items)
// ---------------------------------------------------------------------------

/**
 * Canonical barrier category taxonomy aligned with EEA Regulation 4 and the
 * Code of Good Practice on the Preparation, Implementation and Monitoring of
 * Employment Equity Plans.
 *
 * These 23 categories match the BARRIER_CATEGORIES tuple defined in
 * schemas/eea12.ts. When eea12.ts is unfrozen, it should import from here.
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

/** Union type of all valid barrier category strings. */
export type BarrierCategory = (typeof BARRIER_CATEGORIES)[number]

// ---------------------------------------------------------------------------
// Occupational levels — display names (EEA s.1, OFO-aligned)
// ---------------------------------------------------------------------------

/**
 * Human-readable display names for occupational levels 1–7 in array order
 * (index 0 = level 1 "Top Management", index 6 = level 7 "Non-Permanent").
 *
 * For a keyed lookup by numeric level, use OCCUPATIONAL_LEVEL_LABELS in
 * data/sector-targets.ts.
 */
export const OCCUPATIONAL_LEVELS = [
  'Top Management',
  'Senior Management',
  'Professionally Qualified',
  'Skilled Technical',
  'Semi-Skilled',
  'Unskilled',
  'Non-Permanent',
] as const

/** Union type of all occupational level display-name strings. */
export type OccupationalLevelLabel = (typeof OCCUPATIONAL_LEVELS)[number]

// ---------------------------------------------------------------------------
// Race codes and labels
// ---------------------------------------------------------------------------

/**
 * Race classification codes used across EEA forms.
 * A = African/Black, C = Coloured, I = Indian/Asian, W = White.
 */
export const RACE_CODES = ['A', 'C', 'I', 'W'] as const

/** Union type of valid race code strings. */
export type RaceCode = (typeof RACE_CODES)[number]

/** Display labels keyed by race code. */
export const RACE_LABELS: Readonly<Record<RaceCode, string>> = {
  A: 'African',
  C: 'Coloured',
  I: 'Indian/Asian',
  W: 'White',
} as const

// ---------------------------------------------------------------------------
// Gender codes and labels
// ---------------------------------------------------------------------------

/**
 * Gender classification codes used across EEA forms.
 * M = Male, F = Female.
 */
export const GENDER_CODES = ['M', 'F'] as const

/** Union type of valid gender code strings. */
export type GenderCode = (typeof GENDER_CODES)[number]

/** Display labels keyed by gender code. */
export const GENDER_LABELS: Readonly<Record<GenderCode, string>> = {
  M: 'Male',
  F: 'Female',
} as const

// ---------------------------------------------------------------------------
// Designation statuses
// ---------------------------------------------------------------------------

/**
 * Designation status codes aligned with DesignationStatusSchema in enums.ts.
 * Includes non_disclosure to account for employees who chose not to disclose.
 */
export const DESIGNATION_STATUSES = [
  'designated',
  'non_designated',
  'foreign_national',
  'non_disclosure',
] as const

/** Union type of valid designation status strings. */
export type DesignationStatus = (typeof DESIGNATION_STATUSES)[number]

// ---------------------------------------------------------------------------
// Disability categories
// ---------------------------------------------------------------------------

/**
 * Disability category classification for reasonable accommodation and
 * EEA1 disability register purposes (EEA rule_eea_013).
 * 'none' indicates the employee has no recorded disability.
 */
export const DISABILITY_CATEGORIES = [
  'physical',
  'sensory',
  'intellectual',
  'psychosocial',
  'neurological',
  'multiple',
  'none',
] as const

/** Union type of valid disability category strings. */
export type DisabilityCategory = (typeof DISABILITY_CATEGORIES)[number]
