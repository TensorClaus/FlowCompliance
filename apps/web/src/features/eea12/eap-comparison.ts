import {
  EAP_VERSION,
  GN6124_VERSION,
  getEapByProvince,
  getSectorTargetByLevel,
  targetLevelForOccupationalLevel,
  type EapProvince,
  type EapComparisonRow,
  type SectorTargetLevel,
  type OccupationalLevel,
  type SectorCode,
  type WorkforceProfileRow,
} from '@simplifi/shared'
import { classify, type GapStatus } from '../compliance/lib/gap-status'

/**
 * EEA12 Section C — EAP comparison computation.
 *
 * Compares an employer's actual workforce composition against two reference
 * baselines per occupational level:
 *
 *   1. The StatsSA QLFS Economically Active Population (EAP) share of
 *      designated groups — the figure that drives the gap and status.
 *   2. The GN 6124 sector-specific numerical target — carried alongside as a
 *      display-only baseline; it is NOT part of the gap calculation.
 *
 * PROVISIONAL DATA: every EAP-derived field (eapPct, gapPct, status) is
 * produced from cited StatsSA QLFS Q1 2026 figures (see EAP_VERSION) that remain
 * provisional pending reference-quarter confirmation — the EE Regulations
 * reference the Q3-of-reporting-year EAP, so the final marker wording is tracked
 * in the reference-quarter ruling. Callers MUST surface a provisional marker on
 * every EAP-derived cell and persist the dataset versions so saved forms are
 * auditable. This module never blocks on EAP-derived values — the blocking
 * constraint lives in EEA13.
 *
 * Reference rules: rule_eea_005, rule_eea_008, rule_eea_009
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The seven occupational levels reported in EEA12 Section C, in display order.
 * Level 7 is the non-permanent / temporary level. Every level is rendered,
 * including zero-headcount levels (actual 0.0%), so the comparison is complete
 * and no rows are silently hidden.
 */
const OCCUPATIONAL_LEVELS: readonly OccupationalLevel[] = [1, 2, 3, 4, 5, 6, 7]

/**
 * EAP race labels that count toward the designated-group share. Designated
 * groups under the EEA are South African citizens who are African, Coloured
 * or Indian/Asian. White citizens and foreign nationals are excluded. The
 * label strings match the `race` field in the EAP dataset.
 */
const DESIGNATED_EAP_RACES = new Set(['African', 'Coloured', 'Indian/Asian'])

/**
 * Race codes (from WorkforceProfileRow) that count toward the designated
 * group: A = African, C = Coloured, I = Indian/Asian. W = White is excluded.
 */
const DESIGNATED_RACE_CODES = new Set(['A', 'C', 'I'])

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BuildEapComparisonOptions {
  /**
   * GN 6124 sector code used to look up the display-only sector target per
   * level. When omitted, the sector target column shows no value.
   */
  readonly sectorCode?: SectorCode
}

/**
 * Per-level context returned alongside each EapComparisonRow. Carries the
 * gap status and the display-only GN 6124 sector target so the UI can render
 * the status chip and sector-target badge without recomputing.
 */
export interface EapComparisonRowContext {
  readonly occupationalLevel: OccupationalLevel
  /** Gap status derived from gapPct via the shared classify(). */
  readonly status: GapStatus
  /**
   * Total citizen headcount at this level (designated + non-designated
   * citizens). Zero when the level is empty. Used to distinguish a genuine
   * 0.0% actual (no designated citizens) from an empty level; both render.
   */
  readonly citizenHeadcount: number
  /**
   * GN 6124 designated-group gender targets for this level (display baseline
   * only, NOT part of gapPct). Undefined when no sectorCode was supplied, or
   * when the level falls outside GN 6124's gazetted top-four target scope
   * (levels 5-7 have no gazetted target).
   */
  readonly sectorTarget?: SectorTargetLevel
}

export interface EapComparisonResult {
  readonly rows: EapComparisonRow[]
  readonly context: EapComparisonRowContext[]
  /** Dataset version for the EAP figures — persist for auditability. */
  readonly eapDatasetVersion: typeof EAP_VERSION
  /** Dataset version for the GN 6124 sector targets — persist for auditability. */
  readonly sectorTargetVersion: typeof GN6124_VERSION
  /** Province actually used for the EAP lookup (after National fallback). */
  readonly province: EapProvince
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * One-decimal rounding — matches the compliance representation convention
 * (Math.round(x * 10) / 10 on an already-scaled percentage).
 */
function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Percentage of a part within a whole on a 0–100 scale, one decimal.
 * Returns 0 for an empty whole (zero-headcount levels render 0.0%).
 */
function sharePct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10
}

/**
 * Designated-group share of the EAP for a province, on a 0–100 scale. Sums the
 * EAP percentages of African, Coloured and Indian/Asian across both genders.
 * The StatsSA QLFS EAP is not broken down by occupational level, so this
 * province-wide share is the benchmark applied uniformly to every level.
 * Returns 0 when the province slice is absent.
 */
function eapDesignatedPct(province: EapProvince): number {
  const points = getEapByProvince(province)
  let total = 0
  for (const point of points) {
    if (DESIGNATED_EAP_RACES.has(point.race)) total += point.economicallyActivePct
  }
  return roundOneDecimal(total)
}

/**
 * Designated-citizen actual share for a level from citizen-only workforce rows.
 *
 * PRECONDITION: `rows` contain SA-citizen employees only. Foreign nationals
 * are excluded upstream by decomposeEEA2Workforce (rule_eea_006) and never
 * appear as WorkforceProfileRow entries, so every row here is a citizen and
 * the denominator is the full citizen headcount at the level.
 */
function actualDesignatedPct(
  rows: WorkforceProfileRow[],
  level: OccupationalLevel,
): { pct: number; citizenHeadcount: number } {
  let citizenHeadcount = 0
  let designated = 0
  for (const row of rows) {
    if (row.occupationalLevel !== level) continue
    citizenHeadcount += row.count
    if (DESIGNATED_RACE_CODES.has(row.race)) designated += row.count
  }
  return { pct: sharePct(designated, citizenHeadcount), citizenHeadcount }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the EEA12 Section C EAP comparison from citizen-only workforce rows.
 *
 * @param rows     Citizen-only WorkforceProfileRow[] (foreign nationals already
 *                 excluded by decomposeEEA2Workforce per rule_eea_006).
 * @param province Employer province as an EAP display name, or undefined.
 *                 When undefined, the EAP lookup falls back to 'National'.
 * @param opts     Optional GN 6124 sectorCode for the display-only target.
 * @returns        Per-level comparison rows, per-level context (status +
 *                 sector target), and the dataset versions to persist.
 *
 * actualPct  = designated-citizen headcount / total citizen headcount × 100.
 * eapPct     = designated-group EAP share for the province (uniform across
 *              levels; the EAP has no occupational-level dimension).
 * gapPct     = actualPct − eapPct (one decimal).
 * status     = classify(gapPct) — advisory only; never blocks here.
 */
export function buildEapComparison(
  rows: WorkforceProfileRow[],
  province?: EapProvince,
  opts: BuildEapComparisonOptions = {},
): EapComparisonResult {
  const resolvedProvince: EapProvince = province ?? 'National'

  const comparisonRows: EapComparisonRow[] = []
  const context: EapComparisonRowContext[] = []

  // The EAP has no occupational-level dimension; the province-wide designated
  // share is the benchmark for every level (uniform-province-benchmark model).
  const eapPct = eapDesignatedPct(resolvedProvince)

  for (const level of OCCUPATIONAL_LEVELS) {
    const actual = actualDesignatedPct(rows, level)
    const gapPct = roundOneDecimal(actual.pct - eapPct)
    const status = classify(gapPct)

    comparisonRows.push({
      occupationalLevel: level,
      actualPct: actual.pct,
      eapPct,
      gapPct,
    })

    const targetLevel = targetLevelForOccupationalLevel(level)
    const sectorTarget =
      opts.sectorCode === undefined || targetLevel === undefined
        ? undefined
        : getSectorTargetByLevel(opts.sectorCode, targetLevel)

    context.push({
      occupationalLevel: level,
      status,
      citizenHeadcount: actual.citizenHeadcount,
      ...(sectorTarget === undefined ? {} : { sectorTarget }),
    })
  }

  return {
    rows: comparisonRows,
    context,
    eapDatasetVersion: EAP_VERSION,
    sectorTargetVersion: GN6124_VERSION,
    province: resolvedProvince,
  }
}
