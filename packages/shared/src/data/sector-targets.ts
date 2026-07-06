/**
 * GN 6124 — Employment Equity Act, 1998: Determination of Sectoral
 * Numerical Targets. Government Gazette No. 52514, Regulation Gazette
 * No. 10177, published 15 April 2025 by the Minister of Employment and
 * Labour (Ms N. Meth, MP), under EEA s.15A(1)-(2).
 *
 * These are MANDATORY targets that designated employers must achieve by
 * 2029-12-31 (5-year window; targets are operative from the gazette's
 * publication date, 15 April 2025). Non-compliance attracts penalties
 * under EEA s.65 ranging from R1.5m to R2.7m or 10% of annual turnover.
 *
 * Source (primary): https://www.gov.za/sites/default/files/gcis_document/202504/52514gon6124.pdf
 * Source (cross-verified mirror): https://ee.labour.gov.za/DMISO/SECTOR%20TARGETS%20REGULATION.pdf
 *
 * The gazette's own heading for this data is "1. 5-Year Sectoral Numerical
 * Targets for All Sectors" (under gazette section "2. Sectoral numerical
 * targets") — informally referred to as "Schedule 1" in project docs, which
 * is not the gazette's own term.
 *
 * Reference rules: rule_eea_008, rule_eea_009, rule_eea_024
 * (see eea-patterns.md)
 *
 * This file is pure static data and types — no Zod, no runtime
 * dependencies beyond the OccupationalLevel type from enums.ts.
 */

import type { OccupationalLevel } from '../enums.js'

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

/** Gazette notice identifier and publication date for this target dataset. */
export const GN6124_VERSION = 'GN6124-2025-04-15' as const

// ---------------------------------------------------------------------------
// Sector codes
// ---------------------------------------------------------------------------

/**
 * The 18 sector codes defined in GN 6124 Section 1, "Identification of
 * Economic Sectors" (SIC-aligned). Used to classify designated employers
 * for sector-specific target lookup.
 *
 * Internal kebab/snake-case slugs — not Standard Industrial Classification
 * (SIC) numeric codes. The gazette references SIC codes but does not print
 * them alongside the sector names in the extracted table text.
 */
export const SECTOR_CODES = [
  'accommodation_food_service',
  'administrative_support',
  'agriculture_forestry_fishing',
  'arts_entertainment_recreation',
  'construction',
  'education',
  'electricity_gas',
  'finance_insurance',
  'health_social_work',
  'information_communication',
  'manufacturing',
  'mining_quarrying',
  'professional_scientific_technical',
  'public_administration_defence',
  'real_estate',
  'transport_storage',
  'water_supply',
  'wholesale_retail_trade',
] as const

/** Union type of all valid sector code strings. */
export type SectorCode = (typeof SECTOR_CODES)[number]

// ---------------------------------------------------------------------------
// Target occupational levels (GN 6124 target-setting scope)
// ---------------------------------------------------------------------------

/**
 * The 4 occupational levels for which GN 6124 sets numerical targets —
 * verbatim from the gazette's table preamble: "Top Management, Senior
 * Management, Professionally Qualified and Middle Management, and Skilled
 * Technical levels."
 *
 * IMPORTANT — this is a DIFFERENT scope from the 7-level workforce
 * classification scheme used by EEA1/EEA2 profile capture (see
 * OccupationalLevel in enums.ts and OCCUPATIONAL_LEVEL_LABELS below).
 * GN 6124 sets targets for only the top 4 of those 7 levels; Semi-Skilled,
 * Unskilled, and Non-Permanent (levels 5-7) are outside its target-setting
 * scope and have no gazetted target. Do NOT conflate the two schemes —
 * see 01-RESEARCH.md "Common Pitfall #1".
 */
export const TARGET_OCCUPATIONAL_LEVELS = [
  'top_management',
  'senior_management',
  'professionally_qualified_middle_management',
  'skilled_technical',
] as const

/** Union type of the 4 gazetted target-setting occupational levels. */
export type TargetOccupationalLevel = (typeof TARGET_OCCUPATIONAL_LEVELS)[number]

// ---------------------------------------------------------------------------
// Target interfaces
// ---------------------------------------------------------------------------

/**
 * Percentage targets for designated groups at a single gazetted
 * occupational level, split by gender only. All values are on a 0-100
 * scale.
 *
 * The gazette's "DESIGNATED GROUPS" column targets the aggregate legal
 * category (black people + women + persons with disabilities) split by
 * gender — it does NOT break targets down further by race (African,
 * Coloured, Indian, White). Per gazette clause 3.1, these gender targets
 * are NOT required to sum to 100%, because white non-disabled males and
 * foreign nationals are excluded from both the numerator and the frame
 * of reference.
 */
export interface SectorTargetLevel {
  /** Target percentage for designated-group male employees at this level. */
  readonly designatedGroupMale: number
  /** Target percentage for designated-group female employees at this level. */
  readonly designatedGroupFemale: number
}

/**
 * Full target profile for a single sector: sector metadata, a designated-
 * group gender target for each of the 4 gazetted occupational levels, and
 * one flat sector-wide disability target.
 *
 * The gazette gives ONE disability target per sector (verbatim: "Disability
 * only | All | 3%"), applied across the whole sector — NOT per occupational
 * level — so disabilityTarget lives here as a sibling field, not inside
 * SectorTargetLevel.
 */
export interface SectorTarget {
  readonly sectorCode: SectorCode
  readonly sectorName: string
  readonly targets: Readonly<Record<TargetOccupationalLevel, SectorTargetLevel>>
  /** Flat sector-wide disability target percentage (gazetted at 3% for all sectors). */
  readonly disabilityTarget: number
}

// ---------------------------------------------------------------------------
// Occupational level display names (workforce-classification scheme)
// ---------------------------------------------------------------------------

/**
 * Human-readable labels for occupational levels 1-7 — the workforce-
 * classification scheme used by EEA1/EEA2 profile capture. This is a
 * SEPARATE concern from GN 6124's 4-level target-setting scope above
 * (TargetOccupationalLevel): every employee is classified into one of
 * these 7 levels regardless of whether GN 6124 sets a numerical target
 * for that level. See 01-RESEARCH.md "Common Pitfall #1" — do not shrink
 * this map to 4 keys.
 */
export const OCCUPATIONAL_LEVEL_LABELS: Readonly<Record<OccupationalLevel, string>> = {
  1: 'Top Management',
  2: 'Senior Management',
  3: 'Professionally Qualified',
  4: 'Skilled Technical',
  5: 'Semi-Skilled',
  6: 'Unskilled',
  7: 'Non-Permanent',
} as const

// ---------------------------------------------------------------------------
// SECTOR_TARGETS — the primary data constant
// ---------------------------------------------------------------------------

/**
 * Complete sector target dataset for GN 6124. Each entry is transcribed
 * verbatim from the gazette's "1. 5-Year Sectoral Numerical Targets for All
 * Sectors" table (Gazette No. 52514, 15 April 2025), with a per-cell source
 * citation, following visual verification against the rendered PDF (not
 * `pdftotext` linear output, which interleaves the Male/Female/Total
 * sub-rows unreliably across columns).
 *
 * TODO(Wave 2): populate all 18 sector entries with gazetted values. Left
 * empty here — no statutory values are transcribed in the shape-redesign
 * commit; this array holds the shape only until transcription lands.
 */
export const SECTOR_TARGETS: readonly SectorTarget[] = []

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the full target profile for a given sector.
 *
 * @param sectorCode - One of the 18 GN 6124 sector codes.
 * @returns The matching SectorTarget, or undefined if not found.
 */
export function getSectorTarget(sectorCode: SectorCode): SectorTarget | undefined {
  return SECTOR_TARGETS.find((t) => t.sectorCode === sectorCode)
}

/**
 * Retrieve the designated-group gender target for a specific sector and
 * gazetted target occupational level.
 *
 * @param sectorCode - One of the 18 GN 6124 sector codes.
 * @param level - One of the 4 gazetted target occupational levels.
 * @returns The matching SectorTargetLevel, or undefined if sector not found.
 */
export function getSectorTargetByLevel(
  sectorCode: SectorCode,
  level: TargetOccupationalLevel,
): SectorTargetLevel | undefined {
  const sector = getSectorTarget(sectorCode)
  if (!sector) return undefined
  return sector.targets[level]
}
