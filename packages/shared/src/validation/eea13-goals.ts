import {
  getSectorTargetByLevel,
  type DesignatedGroupTarget,
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

const SECTOR_TARGET_FIELD_BY_GROUP: Readonly<
  Record<NumericalGoal['designatedGroup'], keyof DesignatedGroupTarget>
> = {
  A: 'african',
  C: 'coloured',
  I: 'indian',
  W: 'white',
  M: 'male',
  F: 'female',
}

function getSectoralTarget(goal: NumericalGoal, sectorCode: SectorCode): number | undefined {
  const targets = getSectorTargetByLevel(sectorCode, goal.occupationalLevel)
  if (targets === undefined) return undefined
  return targets[SECTOR_TARGET_FIELD_BY_GROUP[goal.designatedGroup]]
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
