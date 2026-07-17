/**
 * Gap-status classification — the single source of truth for turning a
 * signed percentage delta (actual − target) into a three-state compliance
 * status used across representation dashboards and EEA12 EAP comparison.
 *
 * A positive or zero delta means the actual share meets or exceeds the
 * reference; a small shortfall is "close"; a larger shortfall is a "gap".
 *
 * This module is pure and has no dependencies so it can be imported by both
 * the compliance representation layer and the EEA12 feature without creating
 * a cycle. The blocking treatment of a "gap" (if any) lives downstream in
 * EEA13; here the classification is advisory only.
 */

export type GapStatus = 'met' | 'close' | 'gap'

/**
 * Maximum shortfall (in percentage points) still treated as "close" rather
 * than a full "gap". A delta of exactly -CLOSE_THRESHOLD_PCT is "close".
 */
export const CLOSE_THRESHOLD_PCT = 5

/**
 * Classify a signed delta (actual − target, in percentage points) into a
 * gap status.
 *
 *   deltaPct >= 0                    -> 'met'
 *   -CLOSE_THRESHOLD_PCT <= d < 0    -> 'close'
 *   d < -CLOSE_THRESHOLD_PCT         -> 'gap'
 */
export function classify(deltaPct: number): GapStatus {
  if (deltaPct >= 0) return 'met'
  if (deltaPct >= -CLOSE_THRESHOLD_PCT) return 'close'
  return 'gap'
}
