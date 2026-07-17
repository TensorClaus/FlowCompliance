import {
  getSectorTargetByLevel,
  targetLevelForOccupationalLevel,
  type SectorCode,
} from '../data/sector-targets.js'
import type { NumericalGoal } from '../schemas/eea13.js'

export type GoalMinimumBinding = 'sectoral' | 'eap'

export const TARGET_BELOW_EFFECTIVE_MINIMUM_MESSAGE =
  'Target must meet or exceed the binding baseline'

export const TIMEFRAME_ONGOING_MESSAGE =
  'Timeframe must be a concrete date or period — "ongoing" is not accepted (EEA Regulation 4)'

export const MEASURES_EMPTY_MESSAGE = 'At least one concrete measure is required'

export type TargetBelowEffectiveMinimumViolation = {
  code: 'TARGET_BELOW_EFFECTIVE_MINIMUM'
  severity: 'error'
  fieldPath: ['target']
  message: typeof TARGET_BELOW_EFFECTIVE_MINIMUM_MESSAGE
  binding: GoalMinimumBinding
  eapBenchmark: number
  effectiveMinimum: number
  sectoralTarget?: number
}

export type TimeframeOngoingViolation = {
  code: 'TIMEFRAME_ONGOING'
  severity: 'error'
  fieldPath: ['timeframe']
  message: typeof TIMEFRAME_ONGOING_MESSAGE
}

export type MeasuresEmptyViolation = {
  code: 'MEASURES_EMPTY'
  severity: 'error'
  fieldPath: ['measures']
  message: typeof MEASURES_EMPTY_MESSAGE
}

export type GoalViolation =
  | TargetBelowEffectiveMinimumViolation
  | TimeframeOngoingViolation
  | MeasuresEmptyViolation

export type GoalMinimumValidationResult = {
  binding: GoalMinimumBinding
  effectiveMinimum: number
  sectoralTarget?: number
  violations: GoalViolation[]
}

/**
 * Resolve the GN 6124 sectoral minimum percentage for a goal, or undefined
 * when the gazette sets no target for that combination (EAP-only branch).
 *
 * GN 6124 gazettes targets only for the top four occupational levels, and
 * only as designated-group aggregates split by GENDER — never by race. So a
 * sectoral floor exists only when BOTH of these hold:
 *
 *   1. targetLevelForOccupationalLevel(level) is defined (levels 1-4);
 *      levels 5-7 have no gazetted target.
 *   2. the goal targets a gender group: 'M' -> designatedGroupMale,
 *      'F' -> designatedGroupFemale.
 *
 * Race-coded goals ('A' | 'C' | 'I' | 'W') fall through to the EAP-only
 * branch: the gazette sets designated-group-by-gender aggregates, not
 * per-race targets, so a race goal has no sectoral floor and binds to EAP.
 */
function getSectoralTarget(goal: NumericalGoal, sectorCode: SectorCode): number | undefined {
  const levelKey = targetLevelForOccupationalLevel(goal.occupationalLevel)
  if (levelKey === undefined) return undefined
  const target = getSectorTargetByLevel(sectorCode, levelKey)
  if (target === undefined) return undefined
  if (goal.designatedGroup === 'M') return target.designatedGroupMale
  if (goal.designatedGroup === 'F') return target.designatedGroupFemale
  return undefined
}

export function validateGoalAgainstMinimums(
  goal: NumericalGoal,
  sectorCode: SectorCode,
): GoalMinimumValidationResult {
  const sectoralTarget = getSectoralTarget(goal, sectorCode)
  const hasSectoralTarget = sectoralTarget !== undefined
  const binding: GoalMinimumBinding =
    hasSectoralTarget && sectoralTarget > goal.eapBenchmark ? 'sectoral' : 'eap'
  const effectiveMinimum = hasSectoralTarget
    ? Math.max(goal.eapBenchmark, sectoralTarget)
    : goal.eapBenchmark

  const violations: GoalViolation[] = []

  if (goal.target < effectiveMinimum) {
    violations.push({
      code: 'TARGET_BELOW_EFFECTIVE_MINIMUM',
      severity: 'error',
      fieldPath: ['target'],
      message: TARGET_BELOW_EFFECTIVE_MINIMUM_MESSAGE,
      binding,
      eapBenchmark: goal.eapBenchmark,
      effectiveMinimum,
      ...(hasSectoralTarget ? { sectoralTarget } : {}),
    })
  }

  if (goal.timeframe.toLowerCase().includes('ongoing')) {
    violations.push({
      code: 'TIMEFRAME_ONGOING',
      severity: 'error',
      fieldPath: ['timeframe'],
      message: TIMEFRAME_ONGOING_MESSAGE,
    })
  }

  if (goal.measures.length === 0) {
    violations.push({
      code: 'MEASURES_EMPTY',
      severity: 'error',
      fieldPath: ['measures'],
      message: MEASURES_EMPTY_MESSAGE,
    })
  }

  return {
    binding,
    effectiveMinimum,
    ...(hasSectoralTarget ? { sectoralTarget } : {}),
    violations,
  }
}
