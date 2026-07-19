import type {
  OccupationalMatrix,
  OccupationalLevel,
  RaceCode,
  GenderCode,
  WorkforceProfileRow,
} from '@simplifi/shared'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecomposeResult {
  rows: WorkforceProfileRow[]
  /**
   * Cell paths where disability count exceeds workforce count.
   * Format: "<levelKey>.<raceCode><genderCode>" e.g. "topManagement.AM"
   * No counts are embedded — the validation layer interprets these paths.
   */
  anomalies: string[]
  /**
   * Per-level totals for foreign national employees (male + female).
   * Foreign nationals have no race code in the flat EEA12 shape, so they
   * cannot be emitted as WorkforceProfileRow entries. Per rule_eea_006,
   * foreign nationals are excluded from designated group counts and must
   * be reported separately. This summary enables the UI to render an info
   * note and pass the totals to the EEA13 pre-fill layer.
   */
  foreignNationals: Array<{ level: string; count: number }>
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/**
 * The six "real" occupational levels in the OccupationalMatrix.
 * totalPermanent and grandTotal are computed/derived rows — they are the sum
 * of the real levels and temporaryEmployees. Iterating them would double-count
 * every employee, producing inflated flat rows that diverge from the EEA2
 * source. temporaryEmployees IS a real row (OFO level 7) and must be included.
 */
const REAL_LEVEL_KEYS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'temporaryEmployees',
] as const

type RealLevelKey = (typeof REAL_LEVEL_KEYS)[number]

/**
 * Maps OccupationalMatrix level key to the OccupationalLevel numeric code
 * used in WorkforceProfileRow. The mapping follows OFO level numbering:
 *   1 = Top Management, 2 = Senior Management, 3 = Professionally Qualified,
 *   4 = Skilled Technical, 5 = Semi-Skilled, 6 = Unskilled, 7 = Temporary.
 */
const LEVEL_KEY_TO_CODE: Record<RealLevelKey, OccupationalLevel> = {
  topManagement: 1,
  seniorManagement: 2,
  professionallyQualified: 3,
  skilledTechnical: 4,
  semiSkilled: 5,
  unskilled: 6,
  temporaryEmployees: 7,
}

/**
 * Race × gender column pairs from the OccupationalMatrix MatrixRow.
 * Foreign national columns are intentionally absent — they are handled
 * separately in the foreignNationals summary.
 */
const RACE_GENDER_COLUMNS: Array<{
  key: string
  race: RaceCode
  gender: GenderCode
}> = [
  { key: 'africanMale', race: 'A', gender: 'M' },
  { key: 'africanFemale', race: 'A', gender: 'F' },
  { key: 'colouredMale', race: 'C', gender: 'M' },
  { key: 'colouredFemale', race: 'C', gender: 'F' },
  { key: 'indianMale', race: 'I', gender: 'M' },
  { key: 'indianFemale', race: 'I', gender: 'F' },
  { key: 'whiteMale', race: 'W', gender: 'M' },
  { key: 'whiteFemale', race: 'W', gender: 'F' },
]

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Decomposes the EEA2 Section B matrix tables into a flat array of
 * WorkforceProfileRow records suitable for the EEA12 Section B.
 *
 * Design decisions:
 *
 * 1. Skips totalPermanent and grandTotal.
 *    These are computed aggregates of the real rows. Including them would
 *    inflate the flat representation and break EEA13 pre-fill reconciliation.
 *
 * 2. Foreign national columns are excluded from rows.
 *    Per rule_eea_006 foreign nationals have no race code in the EEA12 flat
 *    shape. Their per-level totals (male + female) are returned in the
 *    foreignNationals array so the UI can surface an info note and EEA13 can
 *    consume the totals without receiving invalid race-coded rows.
 *
 * 3. Anomalies carry cell paths only — no counts.
 *    When disabilityCount > workforceCount for a cell, the cell path string is
 *    appended to anomalies[]. The validation layer owns count-level comparison
 *    and error messaging; this function does not log, clamp, or reformat counts.
 *
 * 4. Zero-count rows are suppressed.
 *    A disability:true row is only emitted when disabilityCount > 0.
 *    A disability:false row is only emitted when nonDisabledCount > 0.
 *    Empty rows add noise to EEA13 pre-fill without carrying information.
 *
 * 5. nonDisabledCount is floored at 0.
 *    When disabilityCount > workforceCount the cell path enters anomalies[]
 *    and nonDisabledCount is treated as 0 (no negative rows emitted). The
 *    disability row is still emitted at its raw disabilityCount value so the
 *    validation layer can observe the overflow condition.
 *
 * @param workforce  EEA2 Table 1.1 — total headcount matrix.
 * @param disability EEA2 Table 1.2 — employees with disabilities matrix.
 * @returns          Flat rows, anomaly paths, and foreign national summary.
 */
export function decomposeEEA2Workforce(
  workforce: OccupationalMatrix,
  disability: OccupationalMatrix,
): DecomposeResult {
  const rows: WorkforceProfileRow[] = []
  const anomalies: string[] = []
  const foreignNationals: Array<{ level: string; count: number }> = []

  for (const levelKey of REAL_LEVEL_KEYS) {
    const workforceRow = workforce[levelKey]
    const disabilityRow = disability[levelKey]

    // Foreign national summary (male + female combined, no race code available).
    const fnCount =
      workforceRow.foreignNationalMale.value + workforceRow.foreignNationalFemale.value
    if (fnCount > 0) {
      foreignNationals.push({ level: levelKey, count: fnCount })
    }

    const occupationalLevel = LEVEL_KEY_TO_CODE[levelKey]

    for (const col of RACE_GENDER_COLUMNS) {
      const workforceCount: number =
        (workforceRow as unknown as Record<string, { value: number }>)[col.key]?.value ?? 0
      const disabilityCount: number =
        (disabilityRow as unknown as Record<string, { value: number }>)[col.key]?.value ?? 0

      const cellPath = `${levelKey}.${col.race}${col.gender}`

      if (disabilityCount > workforceCount) {
        anomalies.push(cellPath)
      }

      const nonDisabledCount = Math.max(0, workforceCount - disabilityCount)

      // Emit disability row only when > 0.
      if (disabilityCount > 0) {
        rows.push({
          occupationalLevel,
          race: col.race,
          gender: col.gender,
          disability: true,
          count: disabilityCount,
        })
      }

      // Emit non-disabled row only when > 0.
      if (nonDisabledCount > 0) {
        rows.push({
          occupationalLevel,
          race: col.race,
          gender: col.gender,
          disability: false,
          count: nonDisabledCount,
        })
      }
    }
  }

  return { rows, anomalies, foreignNationals }
}
