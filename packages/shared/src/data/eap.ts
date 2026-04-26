/**
 * Economically Active Population (EAP) data from StatsSA Quarterly Labour
 * Force Survey (QLFS).
 *
 * EAP data is used by designated employers to set numerical goals under EEA
 * s.20, comparing their workforce profile against the economically active
 * population by province, race, gender and occupational level.
 *
 * Reference rules: rule_eea_005, rule_eea_008, rule_eea_009
 * (see eea-patterns.md)
 *
 * TODO: Replace all placeholder values with actual StatsSA QLFS Q4 2024
 *       figures once the official dataset is licensed and ingested.
 *       Stub provinces (non-National/Gauteng/Western Cape) use national
 *       averages until real provincial breakdowns are loaded.
 *
 * No runtime dependencies — pure static data and derived types only.
 */

// ---------------------------------------------------------------------------
// Provinces
// ---------------------------------------------------------------------------

/**
 * All nine South African provinces plus the "National" aggregate.
 * Display-name strings used in EAP reporting (distinct from the Zod
 * ProvinceSchema enum in enums.ts which uses underscore keys).
 */
export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
  'National',
] as const

/**
 * Display-name province type derived from PROVINCES.
 * Named EapProvince to avoid collision with the Zod-based Province enum
 * (underscore keys) exported from enums.ts.
 */
export type EapProvince = (typeof PROVINCES)[number]

// ---------------------------------------------------------------------------
// EapDataPoint interface
// ---------------------------------------------------------------------------

/**
 * A single EAP data point representing the population share for a specific
 * combination of province, race, gender and occupational level.
 *
 * `percentage` is on a 0–100 scale relative to all economically active
 * persons in that province × occupational-level slice.
 * `population` is the estimated headcount (thousands) from the QLFS dataset.
 */
export interface EapDataPoint {
  /** Province (or "National" for the aggregate). */
  readonly province: EapProvince
  /** Race label: 'African', 'Coloured', 'Indian/Asian', or 'White'. */
  readonly race: string
  /** Gender label: 'Male' or 'Female'. */
  readonly gender: string
  /** Occupational level (1–7, aligned with OccupationalLevel in enums.ts). */
  readonly occupationalLevel: number
  /** Percentage share of economically active population (0–100 scale). */
  readonly percentage: number
  /** Estimated population headcount (in thousands). */
  readonly population: number
  /** Source dataset identifier. */
  readonly source: string
  /** Survey year. */
  readonly year: number
}

// ---------------------------------------------------------------------------
// Data builder helpers (internal, not exported)
// ---------------------------------------------------------------------------

const SOURCE = 'StatsSA QLFS Q4 2024'
const YEAR = 2024

/**
 * Builds a data point with shared source/year defaults applied.
 */
function dp(
  province: EapProvince,
  race: string,
  gender: string,
  occupationalLevel: number,
  percentage: number,
  population: number,
): EapDataPoint {
  return {
    province,
    race,
    gender,
    occupationalLevel,
    percentage,
    population,
    source: SOURCE,
    year: YEAR,
  }
}

// ---------------------------------------------------------------------------
// Demographic building blocks
// ---------------------------------------------------------------------------
//
// TODO: Replace with actual QLFS Q4 2024 figures.
//
// The placeholder values below are constructed from StatsSA QLFS EAP
// aggregate proportions (African ~79.5%, Coloured ~9%, Indian ~2.5%,
// White ~9%) with level-appropriate skewing:
//   - Senior levels skew toward White/male (historical under-transformation)
//   - Lower levels reflect closer-to-national demographic composition
//
// Provincial figures for non-detailed provinces use national averages
// scaled by estimated provincial labour-force participation weights:
//   Gauteng     ~25% of national EAP
//   Western Cape ~11% of national EAP
//   Remaining provinces each carry 5–9% of national EAP

const races = ['African', 'Coloured', 'Indian/Asian', 'White'] as const
const genders = ['Male', 'Female'] as const

// National EAP share by race (%), split evenly by gender as baseline
// Level-specific multipliers approximate transformation gap reality.
// [level][race][gender] = { pct, pop (thousands) }

type LevelProfile = Readonly<Record<string, Readonly<Record<string, readonly [number, number]>>>>

/**
 * National EAP percentage and population (thousands) by occupational level,
 * race and gender.
 *
 * TODO: Replace with actual QLFS Q4 2024 tabulated figures.
 */
const NATIONAL_PROFILE: Readonly<Record<number, LevelProfile>> = {
  1: {
    African: { Male: [33, 28.1], Female: [22, 18.7] },
    Coloured: { Male: [5, 4.3], Female: [3.5, 3] },
    'Indian/Asian': { Male: [4, 3.4], Female: [2, 1.7] },
    White: { Male: [18, 15.3], Female: [12.5, 10.6] },
  },
  2: {
    African: { Male: [37, 141.3], Female: [25, 95.5] },
    Coloured: { Male: [5.5, 21], Female: [3.8, 14.5] },
    'Indian/Asian': { Male: [3.5, 13.4], Female: [2, 7.6] },
    White: { Male: [14.5, 55.4], Female: [9.7, 37.1] },
  },
  3: {
    African: { Male: [40, 420.1], Female: [28, 294.1] },
    Coloured: { Male: [5.5, 57.8], Female: [4, 42] },
    'Indian/Asian': { Male: [3, 31.5], Female: [1.8, 18.9] },
    White: { Male: [11, 115.5], Female: [7.7, 80.8] },
  },
  4: {
    African: { Male: [43, 952.7], Female: [28, 620] },
    Coloured: { Male: [5.5, 121.8], Female: [4, 88.6] },
    'Indian/Asian': { Male: [2.5, 55.4], Female: [1.5, 33.2] },
    White: { Male: [9, 199.4], Female: [7.5, 166.1] },
  },
  5: {
    African: { Male: [46, 1843], Female: [29.5, 1181.7] },
    Coloured: { Male: [5.5, 220.4], Female: [4, 160.3] },
    'Indian/Asian': { Male: [1.8, 72.1], Female: [1, 40.1] },
    White: { Male: [7, 280.5], Female: [5.7, 228.4] },
  },
  6: {
    African: { Male: [44, 852.3], Female: [35, 678] },
    Coloured: { Male: [4.8, 93], Female: [3.8, 73.6] },
    'Indian/Asian': { Male: [1.2, 23.2], Female: [0.7, 13.5] },
    White: { Male: [5.5, 106.5], Female: [5, 96.8] },
  },
  7: {
    African: { Male: [44.5, 620.1], Female: [30, 418.2] },
    Coloured: { Male: [5, 69.7], Female: [4, 55.7] },
    'Indian/Asian': { Male: [1.5, 20.9], Female: [0.8, 11.1] },
    White: { Male: [8.5, 118.5], Female: [5.5, 76.6] },
  },
}

/** Provincial EAP weighting factors relative to national totals. */
const PROVINCIAL_WEIGHT: Readonly<Record<EapProvince, number>> = {
  National: 1,
  Gauteng: 0.25,
  'Western Cape': 0.11,
  'KwaZulu-Natal': 0.18,
  'Eastern Cape': 0.12,
  Limpopo: 0.09,
  Mpumalanga: 0.07,
  'North West': 0.06,
  'Free State': 0.06,
  'Northern Cape': 0.03,
}

// ---------------------------------------------------------------------------
// Gauteng-specific profile overrides
// ---------------------------------------------------------------------------
//
// TODO: Replace with actual QLFS Q4 2024 provincial tabulations.
//
// Gauteng has higher White and Indian representation at senior levels and
// a larger absolute labour force. Adjustments below reflect known structural
// patterns from published QLFS summaries.

const GAUTENG_PROFILE: Readonly<Record<number, LevelProfile>> = {
  1: {
    African: { Male: [28, 6], Female: [18, 3.9] },
    Coloured: { Male: [3.5, 0.8], Female: [2.5, 0.5] },
    'Indian/Asian': { Male: [6.5, 1.4], Female: [3.5, 0.8] },
    White: { Male: [24, 5.2], Female: [16, 3.4] },
  },
  2: {
    African: { Male: [32, 30.7], Female: [22, 21.1] },
    Coloured: { Male: [4, 3.8], Female: [2.8, 2.7] },
    'Indian/Asian': { Male: [5.5, 5.3], Female: [3, 2.9] },
    White: { Male: [20, 19.2], Female: [11.7, 11.2] },
  },
  3: {
    African: { Male: [35, 93.1], Female: [24, 63.8] },
    Coloured: { Male: [4, 10.6], Female: [3, 8] },
    'Indian/Asian': { Male: [5, 13.3], Female: [2.8, 7.4] },
    White: { Male: [16, 42.6], Female: [11.2, 29.8] },
  },
  4: {
    African: { Male: [40, 215.8], Female: [26, 140.3] },
    Coloured: { Male: [4.2, 22.7], Female: [3, 16.2] },
    'Indian/Asian': { Male: [4, 21.6], Female: [2.5, 13.5] },
    White: { Male: [13, 70.1], Female: [9.3, 50.2] },
  },
  5: {
    African: { Male: [43, 199.1], Female: [28, 129.6] },
    Coloured: { Male: [4.5, 20.8], Female: [3.2, 14.8] },
    'Indian/Asian': { Male: [3, 13.9], Female: [1.8, 8.3] },
    White: { Male: [10, 46.3], Female: [7.5, 34.7] },
  },
  6: {
    African: { Male: [42, 95.5], Female: [33, 75] },
    Coloured: { Male: [4, 9.1], Female: [3.2, 7.3] },
    'Indian/Asian': { Male: [2, 4.5], Female: [1.2, 2.7] },
    White: { Male: [8, 18.2], Female: [7.6, 17.3] },
  },
  7: {
    African: { Male: [42, 65.7], Female: [28.5, 44.6] },
    Coloured: { Male: [4, 6.3], Female: [3.2, 5] },
    'Indian/Asian': { Male: [2.5, 3.9], Female: [1.5, 2.3] },
    White: { Male: [11, 17.2], Female: [7.3, 11.4] },
  },
}

// ---------------------------------------------------------------------------
// Western Cape-specific profile overrides
// ---------------------------------------------------------------------------
//
// TODO: Replace with actual QLFS Q4 2024 provincial tabulations.
//
// Western Cape has materially higher Coloured representation at all levels
// and lower African representation than the national average, reflecting
// provincial demographic composition.

const WESTERN_CAPE_PROFILE: Readonly<Record<number, LevelProfile>> = {
  1: {
    African: { Male: [16, 1.7], Female: [10.5, 1.1] },
    Coloured: { Male: [18, 1.9], Female: [14, 1.5] },
    'Indian/Asian': { Male: [3.5, 0.4], Female: [2, 0.2] },
    White: { Male: [24, 2.6], Female: [16, 1.7] },
  },
  2: {
    African: { Male: [18, 5.6], Female: [12, 3.7] },
    Coloured: { Male: [20, 6.2], Female: [15, 4.6] },
    'Indian/Asian': { Male: [4, 1.2], Female: [2.5, 0.8] },
    White: { Male: [18, 5.6], Female: [11.5, 3.6] },
  },
  3: {
    African: { Male: [22, 15.3], Female: [15, 10.4] },
    Coloured: { Male: [22, 15.3], Female: [16.5, 11.5] },
    'Indian/Asian': { Male: [4, 2.8], Female: [2.5, 1.7] },
    White: { Male: [13, 9], Female: [9, 6.3] },
  },
  4: {
    African: { Male: [24, 55.9], Female: [16.5, 38.4] },
    Coloured: { Male: [24, 55.9], Female: [18, 41.9] },
    'Indian/Asian': { Male: [3, 7], Female: [2, 4.7] },
    White: { Male: [8.5, 19.8], Female: [6, 14] },
  },
  5: {
    African: { Male: [27, 130.6], Female: [18, 87.1] },
    Coloured: { Male: [25, 120.9], Female: [19, 91.9] },
    'Indian/Asian': { Male: [2, 9.7], Female: [1.2, 5.8] },
    White: { Male: [5.5, 26.6], Female: [4.3, 20.8] },
  },
  6: {
    African: { Male: [28, 61.7], Female: [22, 48.5] },
    Coloured: { Male: [26, 57.3], Female: [20, 44.1] },
    'Indian/Asian': { Male: [1.2, 2.6], Female: [0.8, 1.8] },
    White: { Male: [4.5, 9.9], Female: [3.5, 7.7] },
  },
  7: {
    African: { Male: [28, 18.5], Female: [19, 12.5] },
    Coloured: { Male: [27, 17.8], Female: [20.5, 13.5] },
    'Indian/Asian': { Male: [1.5, 1], Female: [0.8, 0.5] },
    White: { Male: [7, 4.6], Female: [5.2, 3.4] },
  },
}

// ---------------------------------------------------------------------------
// EAP_DATA — primary data constant
// ---------------------------------------------------------------------------

/**
 * Builds all EapDataPoint entries for a given province using the supplied
 * level profile. Iterates all 7 levels × 4 races × 2 genders = 56 points.
 */
function buildProvincePoints(
  province: EapProvince,
  profile: Readonly<Record<number, LevelProfile>>,
): EapDataPoint[] {
  const points: EapDataPoint[] = []
  for (let level = 1; level <= 7; level++) {
    const levelProfile = profile[level]
    if (!levelProfile) continue
    for (const race of races) {
      const raceProfile = levelProfile[race]
      if (!raceProfile) continue
      for (const gender of genders) {
        const cell = raceProfile[gender]
        if (!cell) continue
        points.push(dp(province, race, gender, level, cell[0], cell[1]))
      }
    }
  }
  return points
}

/**
 * Builds stub EapDataPoint entries for provinces without detailed profiles.
 * Uses national-average percentages scaled by the province's EAP weight
 * for approximate population estimates.
 *
 * TODO: Replace with actual QLFS Q4 2024 provincial tabulations.
 */
function buildStubProvincePoints(province: EapProvince): EapDataPoint[] {
  const weight = PROVINCIAL_WEIGHT[province]
  const points: EapDataPoint[] = []
  for (let level = 1; level <= 7; level++) {
    const levelProfile = NATIONAL_PROFILE[level]
    if (!levelProfile) continue
    for (const race of races) {
      const raceProfile = levelProfile[race]
      if (!raceProfile) continue
      for (const gender of genders) {
        const cell = raceProfile[gender]
        if (!cell) continue
        points.push(
          dp(province, race, gender, level, cell[0], Math.round(cell[1] * weight * 10) / 10),
        )
      }
    }
  }
  return points
}

/**
 * Complete EAP dataset.
 *
 * Detailed profiles: National, Gauteng, Western Cape (56 points each = 168).
 * Stub profiles for remaining 7 provinces (56 points each = 392).
 * Total: 560 data points.
 *
 * TODO: Replace placeholder values with actual StatsSA QLFS Q4 2024 data.
 */
export const EAP_DATA: readonly EapDataPoint[] = [
  // Detailed provinces
  ...buildProvincePoints('National', NATIONAL_PROFILE),
  ...buildProvincePoints('Gauteng', GAUTENG_PROFILE),
  ...buildProvincePoints('Western Cape', WESTERN_CAPE_PROFILE),
  // Stub provinces — national averages scaled by provincial EAP weight
  ...buildStubProvincePoints('Eastern Cape'),
  ...buildStubProvincePoints('Free State'),
  ...buildStubProvincePoints('KwaZulu-Natal'),
  ...buildStubProvincePoints('Limpopo'),
  ...buildStubProvincePoints('Mpumalanga'),
  ...buildStubProvincePoints('North West'),
  ...buildStubProvincePoints('Northern Cape'),
] as const

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Returns all EAP data points for a given province.
 *
 * @param province - One of the 10 province display names (including "National").
 */
export function getEapByProvince(province: EapProvince): EapDataPoint[] {
  return EAP_DATA.filter((d) => d.province === province)
}

/**
 * Returns all EAP data points for a given province and occupational level.
 *
 * @param province - One of the 10 province display names (including "National").
 * @param level    - Occupational level (1–7).
 */
export function getEapByProvinceAndLevel(province: EapProvince, level: number): EapDataPoint[] {
  return EAP_DATA.filter((d) => d.province === province && d.occupationalLevel === level)
}
