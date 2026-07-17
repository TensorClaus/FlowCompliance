import { describe, expect, it } from 'vitest'
import type { NumericalGoal, SectorCode } from '../../index.js'
import {
  MEASURES_EMPTY_MESSAGE,
  TARGET_BELOW_EFFECTIVE_MINIMUM_MESSAGE,
  TIMEFRAME_ONGOING_MESSAGE,
  validateGoalAgainstMinimums,
} from '../eea13-goals.js'

function goal(overrides: Partial<NumericalGoal> = {}): NumericalGoal {
  return {
    occupationalLevel: 1,
    designatedGroup: 'A',
    currentRepresentation: 20,
    target: 60,
    eapBenchmark: 40,
    timeframe: 'By 31 December 2029',
    targetDate: '2029-12-31',
    measures: ['Targeted recruitment'],
    ...overrides,
  }
}

describe('validateGoalAgainstMinimums', () => {
  it('binds to sectoral when the GN 6124 gender target exceeds EAP', () => {
    // agriculture_forestry_fishing skilled_technical (level 4), male target
    // is the gazetted 49.8 (GN 6124, table p.6). With EAP 40 below it, the
    // sectoral floor binds.
    const result = validateGoalAgainstMinimums(
      goal({ designatedGroup: 'M', occupationalLevel: 4, eapBenchmark: 40, target: 49 }),
      'agriculture_forestry_fishing',
    )

    expect(result.binding).toBe('sectoral')
    expect(result.effectiveMinimum).toBe(49.8)
    expect(result.sectoralTarget).toBe(49.8)
    expect(result.violations).toEqual([
      expect.objectContaining({
        code: 'TARGET_BELOW_EFFECTIVE_MINIMUM',
        severity: 'error',
        fieldPath: ['target'],
        binding: 'sectoral',
        eapBenchmark: 40,
        sectoralTarget: 49.8,
        effectiveMinimum: 49.8,
        message: TARGET_BELOW_EFFECTIVE_MINIMUM_MESSAGE,
      }),
    ])
  })

  it('binds to EAP when EAP exceeds the GN 6124 gender target', () => {
    // agriculture_forestry_fishing top management (level 1), female target is
    // the gazetted 20.8; an EAP benchmark of 30 exceeds it, so EAP binds.
    const result = validateGoalAgainstMinimums(
      goal({ designatedGroup: 'F', occupationalLevel: 1, eapBenchmark: 30, target: 29 }),
      'agriculture_forestry_fishing',
    )

    expect(result.binding).toBe('eap')
    expect(result.effectiveMinimum).toBe(30)
    expect(result.sectoralTarget).toBe(20.8)
    expect(result.violations[0]).toMatchObject({
      code: 'TARGET_BELOW_EFFECTIVE_MINIMUM',
      binding: 'eap',
      eapBenchmark: 30,
      sectoralTarget: 20.8,
      effectiveMinimum: 30,
      message: TARGET_BELOW_EFFECTIVE_MINIMUM_MESSAGE,
    })
  })

  it('uses EAP only for a race-coded goal (gazette sets no per-race target)', () => {
    // The gazette sets designated-group-by-gender aggregates, not per-race
    // targets, so a race goal has no sectoral floor even in a gazetted sector.
    const result = validateGoalAgainstMinimums(
      goal({ designatedGroup: 'A', occupationalLevel: 1, eapBenchmark: 40, target: 39 }),
      'agriculture_forestry_fishing',
    )

    expect(result.binding).toBe('eap')
    expect(result.effectiveMinimum).toBe(40)
    expect(result.sectoralTarget).toBeUndefined()
    expect(result.violations[0]).toMatchObject({
      code: 'TARGET_BELOW_EFFECTIVE_MINIMUM',
      binding: 'eap',
      eapBenchmark: 40,
      effectiveMinimum: 40,
    })
  })

  it('uses EAP only for a level outside the gazetted top four', () => {
    // GN 6124 sets no target below skilled_technical, so a level-5 goal binds
    // to EAP regardless of designated group.
    const result = validateGoalAgainstMinimums(
      goal({ designatedGroup: 'M', occupationalLevel: 5, eapBenchmark: 40, target: 39 }),
      'agriculture_forestry_fishing',
    )

    expect(result.binding).toBe('eap')
    expect(result.effectiveMinimum).toBe(40)
    expect(result.sectoralTarget).toBeUndefined()
  })

  it('uses EAP only when the sector has no gazette entry', () => {
    const result = validateGoalAgainstMinimums(
      goal({ designatedGroup: 'M', occupationalLevel: 1, eapBenchmark: 40, target: 39 }),
      'missing_sector' as SectorCode,
    )

    expect(result.binding).toBe('eap')
    expect(result.effectiveMinimum).toBe(40)
    expect(result.sectoralTarget).toBeUndefined()
    expect(result.violations[0]).toMatchObject({
      code: 'TARGET_BELOW_EFFECTIVE_MINIMUM',
      binding: 'eap',
      eapBenchmark: 40,
      effectiveMinimum: 40,
    })
  })

  it('accepts equality with the effective minimum', () => {
    const result = validateGoalAgainstMinimums(
      goal({ designatedGroup: 'M', occupationalLevel: 4, eapBenchmark: 40, target: 49.8 }),
      'agriculture_forestry_fishing',
    )

    expect(result.binding).toBe('sectoral')
    expect(result.effectiveMinimum).toBe(49.8)
    expect(result.violations).toEqual([])
  })

  it('rejects ongoing timeframe case-insensitively', () => {
    const result = validateGoalAgainstMinimums(
      goal({ timeframe: 'ONGOING until reviewed', target: 58 }),
      'agriculture_forestry_fishing',
    )

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        code: 'TIMEFRAME_ONGOING',
        severity: 'error',
        fieldPath: ['timeframe'],
        message: TIMEFRAME_ONGOING_MESSAGE,
      }),
    )
  })

  it('rejects empty measures', () => {
    const result = validateGoalAgainstMinimums(
      goal({ measures: [], target: 58 }),
      'agriculture_forestry_fishing',
    )

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        code: 'MEASURES_EMPTY',
        severity: 'error',
        fieldPath: ['measures'],
        message: MEASURES_EMPTY_MESSAGE,
      }),
    )
  })
})
