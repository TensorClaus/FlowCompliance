/**
 * GN 6124 (Government Notice 6124, 2024) — Schedule 1 Sector-Specific
 * Numerical Targets for Employment Equity.
 *
 * These are MANDATORY targets that designated employers must achieve by
 * 2029-12-31 (5-year window from 2025-01-01). Non-compliance attracts
 * penalties under EEA s.65 ranging from R1.5m to R2.7m or 10% of
 * annual turnover.
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

/** Gazette notice identifier and year for this target dataset. */
export const GN6124_VERSION = 'GN6124-2024' as const

// ---------------------------------------------------------------------------
// Sector codes
// ---------------------------------------------------------------------------

/**
 * The 19 sector codes defined in GN 6124 Schedule 1.
 * Used to classify designated employers for sector-specific target lookup.
 */
export const SECTOR_CODES = [
  'agriculture',
  'mining',
  'manufacturing',
  'electricity_gas_water',
  'construction',
  'retail_wholesale',
  'transport_storage',
  'finance_insurance',
  'real_estate',
  'community_services',
  'education',
  'health',
  'hospitality',
  'information_technology',
  'professional_services',
  'administrative_services',
  'public_administration',
  'other_services',
  'domestic_services',
] as const

/** Union type of all valid sector code strings. */
export type SectorCode = (typeof SECTOR_CODES)[number]

// ---------------------------------------------------------------------------
// Target interfaces
// ---------------------------------------------------------------------------

/**
 * Percentage targets for each designated group at a given occupational level.
 * All values are on a 0–100 scale.
 */
export interface DesignatedGroupTarget {
  /** Target percentage for African/Black employees. */
  readonly african: number
  /** Target percentage for Coloured employees. */
  readonly coloured: number
  /** Target percentage for Indian/Asian employees. */
  readonly indian: number
  /** Target percentage for White employees. */
  readonly white: number
  /** Target percentage for male employees. */
  readonly male: number
  /** Target percentage for female employees. */
  readonly female: number
  /** Target percentage for persons with disabilities. */
  readonly disabledTarget: number
}

/**
 * Full target profile for a single sector, containing the sector metadata
 * and a target breakdown for each of the 7 occupational levels.
 */
export interface SectorTarget {
  readonly sectorCode: SectorCode
  readonly sectorName: string
  readonly targets: Readonly<Record<OccupationalLevel, DesignatedGroupTarget>>
}

// ---------------------------------------------------------------------------
// Occupational level display names (utility mapping)
// ---------------------------------------------------------------------------

/**
 * Human-readable labels for occupational levels 1–7. Useful for rendering
 * dashboard tables and reports.
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
// Default target builder (placeholder demographics)
// ---------------------------------------------------------------------------

// TODO: Replace with actual GN 6124 gazette values
// These placeholder percentages approximate SA national demographics from
// StatsSA QLFS EAP data (African ~80%, Coloured ~9%, Indian ~2.5%,
// White ~8.5%) with level-appropriate variation.

function buildTarget(overrides?: Partial<DesignatedGroupTarget>): DesignatedGroupTarget {
  return {
    african: 79.5,
    coloured: 9,
    indian: 2.5,
    white: 9,
    male: 55,
    female: 45,
    disabledTarget: 2,
    ...overrides,
  }
}

/**
 * Builds a complete set of occupational-level targets for a sector.
 * Applies top-heavy White/male skew at senior levels and corrects at
 * lower levels, reflecting realistic transformation goals.
 */
function buildLevelTargets(
  sectorOverrides?: Partial<Record<OccupationalLevel, Partial<DesignatedGroupTarget>>>,
): Readonly<Record<OccupationalLevel, DesignatedGroupTarget>> {
  const defaults: Record<OccupationalLevel, Partial<DesignatedGroupTarget>> = {
    1: { african: 60, coloured: 8, indian: 5, white: 27, male: 60, female: 40, disabledTarget: 2 },
    2: {
      african: 65,
      coloured: 8.5,
      indian: 4.5,
      white: 22,
      male: 58,
      female: 42,
      disabledTarget: 2,
    },
    3: {
      african: 70,
      coloured: 9,
      indian: 3.5,
      white: 17.5,
      male: 55,
      female: 45,
      disabledTarget: 2,
    },
    4: { african: 75, coloured: 9, indian: 3, white: 13, male: 52, female: 48, disabledTarget: 2 },
    5: {
      african: 80,
      coloured: 9.5,
      indian: 2.5,
      white: 8,
      male: 50,
      female: 50,
      disabledTarget: 2,
    },
    6: {
      african: 83,
      coloured: 9.5,
      indian: 2,
      white: 5.5,
      male: 48,
      female: 52,
      disabledTarget: 2,
    },
    7: {
      african: 80,
      coloured: 9,
      indian: 2.5,
      white: 8.5,
      male: 52,
      female: 48,
      disabledTarget: 2,
    },
  }

  const merged = { ...defaults }
  if (sectorOverrides) {
    for (const key of Object.keys(sectorOverrides) as unknown as OccupationalLevel[]) {
      const override = sectorOverrides[key]
      if (override) {
        merged[key] = { ...merged[key], ...override }
      }
    }
  }

  return {
    1: buildTarget(merged[1]),
    2: buildTarget(merged[2]),
    3: buildTarget(merged[3]),
    4: buildTarget(merged[4]),
    5: buildTarget(merged[5]),
    6: buildTarget(merged[6]),
    7: buildTarget(merged[7]),
  }
}

// ---------------------------------------------------------------------------
// SECTOR_TARGETS — the primary data constant
// ---------------------------------------------------------------------------

// TODO: Replace with actual GN 6124 gazette values
// Current values are demographically informed placeholders with
// sector-appropriate adjustments (e.g. mining skews male, education
// skews female, IT has higher White representation at senior levels).

/**
 * Complete sector target dataset for GN 6124 Schedule 1.
 * One entry per sector code, each containing targets across all 7
 * occupational levels.
 */
export const SECTOR_TARGETS: readonly SectorTarget[] = [
  {
    sectorCode: 'agriculture',
    sectorName: 'Agriculture, Forestry and Fishing',
    targets: buildLevelTargets({
      1: { african: 58, male: 65, female: 35 },
      2: { african: 62, male: 63, female: 37 },
    }),
  },
  {
    sectorCode: 'mining',
    sectorName: 'Mining and Quarrying',
    targets: buildLevelTargets({
      1: { african: 55, male: 70, female: 30 },
      2: { african: 60, male: 68, female: 32 },
      5: { african: 85, male: 72, female: 28 },
      6: { african: 88, male: 75, female: 25 },
    }),
  },
  {
    sectorCode: 'manufacturing',
    sectorName: 'Manufacturing',
    targets: buildLevelTargets({
      1: { african: 58, male: 62, female: 38 },
      4: { african: 73, male: 58, female: 42 },
    }),
  },
  {
    sectorCode: 'electricity_gas_water',
    sectorName: 'Electricity, Gas and Water Supply',
    targets: buildLevelTargets({
      1: { african: 62, male: 60, female: 40 },
      3: { african: 72, male: 55, female: 45 },
    }),
  },
  {
    sectorCode: 'construction',
    sectorName: 'Construction',
    targets: buildLevelTargets({
      1: { african: 55, male: 68, female: 32 },
      5: { african: 82, male: 70, female: 30 },
      6: { african: 85, male: 72, female: 28 },
    }),
  },
  {
    sectorCode: 'retail_wholesale',
    sectorName: 'Wholesale and Retail Trade',
    targets: buildLevelTargets({
      1: { african: 58, coloured: 10, indian: 5, white: 27 },
      4: { african: 74, female: 50, male: 50 },
    }),
  },
  {
    sectorCode: 'transport_storage',
    sectorName: 'Transport, Storage and Communication',
    targets: buildLevelTargets({
      1: { african: 60, male: 62, female: 38 },
      5: { african: 82, male: 55, female: 45 },
    }),
  },
  {
    sectorCode: 'finance_insurance',
    sectorName: 'Financial Intermediation and Insurance',
    targets: buildLevelTargets({
      1: { african: 55, coloured: 8, indian: 6, white: 31 },
      2: { african: 60, indian: 5.5, white: 26 },
      3: { african: 65, indian: 4.5, white: 21.5 },
    }),
  },
  {
    sectorCode: 'real_estate',
    sectorName: 'Real Estate and Business Services',
    targets: buildLevelTargets({
      1: { african: 57, white: 29 },
      3: { african: 68, white: 19 },
    }),
  },
  {
    sectorCode: 'community_services',
    sectorName: 'Community, Social and Personal Services',
    targets: buildLevelTargets({
      1: { african: 62, female: 45, male: 55 },
      3: { african: 72, female: 48, male: 52 },
    }),
  },
  {
    sectorCode: 'education',
    sectorName: 'Education',
    targets: buildLevelTargets({
      1: { african: 65, female: 48, male: 52 },
      2: { african: 68, female: 50, male: 50 },
      3: { african: 72, female: 55, male: 45 },
      4: { african: 76, female: 58, male: 42 },
    }),
  },
  {
    sectorCode: 'health',
    sectorName: 'Health and Social Work',
    targets: buildLevelTargets({
      1: { african: 63, female: 50, male: 50 },
      3: { african: 70, female: 55, male: 45 },
      5: { african: 82, female: 60, male: 40 },
    }),
  },
  {
    sectorCode: 'hospitality',
    sectorName: 'Accommodation and Food Services',
    targets: buildLevelTargets({
      1: { african: 55, coloured: 10, indian: 5, white: 30 },
      5: { african: 82, female: 55, male: 45 },
      6: { african: 85, female: 55, male: 45 },
    }),
  },
  {
    sectorCode: 'information_technology',
    sectorName: 'Information and Communication Technology',
    targets: buildLevelTargets({
      1: { african: 52, indian: 7, white: 33, male: 62, female: 38 },
      2: { african: 58, indian: 6, white: 28, male: 60, female: 40 },
      3: { african: 63, indian: 5, white: 23, male: 58, female: 42 },
    }),
  },
  {
    sectorCode: 'professional_services',
    sectorName: 'Professional, Scientific and Technical Services',
    targets: buildLevelTargets({
      1: { african: 54, indian: 6, white: 32 },
      2: { african: 60, indian: 5, white: 27 },
      3: { african: 66, indian: 4, white: 22 },
    }),
  },
  {
    sectorCode: 'administrative_services',
    sectorName: 'Administrative and Support Services',
    targets: buildLevelTargets({
      1: { african: 60, white: 26 },
      5: { african: 82 },
      6: { african: 85 },
    }),
  },
  {
    sectorCode: 'public_administration',
    sectorName: 'Public Administration and Defence',
    targets: buildLevelTargets({
      1: { african: 72, coloured: 9, indian: 3, white: 16 },
      2: { african: 75, white: 13 },
      3: { african: 78, white: 10 },
    }),
  },
  {
    sectorCode: 'other_services',
    sectorName: 'Other Services',
    targets: buildLevelTargets(),
  },
  {
    sectorCode: 'domestic_services',
    sectorName: 'Domestic Services',
    targets: buildLevelTargets({
      5: { african: 88, female: 65, male: 35 },
      6: { african: 90, female: 70, male: 30 },
    }),
  },
] as const

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the full target profile for a given sector.
 *
 * @param sectorCode - One of the 19 GN 6124 sector codes.
 * @returns The matching SectorTarget, or undefined if not found.
 */
export function getSectorTarget(sectorCode: SectorCode): SectorTarget | undefined {
  return SECTOR_TARGETS.find((t) => t.sectorCode === sectorCode)
}

/**
 * Retrieve the designated-group target percentages for a specific sector
 * and occupational level.
 *
 * @param sectorCode - One of the 19 GN 6124 sector codes.
 * @param level - Occupational level (1–7).
 * @returns The matching DesignatedGroupTarget, or undefined if sector not found.
 */
export function getSectorTargetByLevel(
  sectorCode: SectorCode,
  level: OccupationalLevel,
): DesignatedGroupTarget | undefined {
  const sector = getSectorTarget(sectorCode)
  if (!sector) return undefined
  return sector.targets[level]
}
