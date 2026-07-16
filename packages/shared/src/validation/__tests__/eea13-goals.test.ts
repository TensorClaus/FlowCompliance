import { describe, expect, it } from 'vitest'
import type { NumericalGoal, SectorCode } from '../../index.js'
import { validateGoalAgainstMinimums } from '../eea13-goals.js'

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
  it('binds to sectoral when the GN 6124 target exceeds EAP', () => {
    const result = validateGoalAgainstMinimums(
      goal({ designatedGroup: 'A', eapBenchmark: 40, target: 57 }),
      'agriculture',
    )

    expect(result.binding).toBe('sectoral')
    expect(result.effectiveMinimum).toBe(58)
    expect(result.sectoralTarget).toBe(58)
    expect(result.violations).toEqual([
      expect.objectContaining({
        code: 'TARGET_BELOW_EFFECTIVE_MINIMUM',
        severity: 'error',
        fieldPath: ['target'],
        binding: 'sectoral',
        eapBenchmark: 40,
        sectoralTarget: 58,
        effectiveMinimum: 58,
      }),
    ])
    expect(result.violations[0]?.message).not.toMatch(/\d/)
  })

  it('binds to EAP when EAP exceeds the GN 6124 target', () => {
    const result = validateGoalAgainstMinimums(
      goal({ designatedGroup: 'W', eapBenchmark: 30, target: 29 }),
      'agriculture',
    )

    expect(result.binding).toBe('eap')
    expect(result.effectiveMinimum).toBe(30)
    expect(result.sectoralTarget).toBe(27)
    expect(result.violations[0]).toMatchObject({
      code: 'TARGET_BELOW_EFFECTIVE_MINIMUM',
      binding: 'eap',
      eapBenchmark: 30,
      sectoralTarget: 27,
      effectiveMinimum: 30,
    })
    expect(result.violations[0]?.message).not.toMatch(/\d/)
  })

  it('uses EAP only when no GN 6124 target exists for the combination', () => {
    const result = validateGoalAgainstMinimums(
      goal({ eapBenchmark: 40, target: 39 }),
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
      goal({ designatedGroup: 'A', eapBenchmark: 40, target: 58 }),
      'agriculture',
    )

    expect(result.binding).toBe('sectoral')
    expect(result.effectiveMinimum).toBe(58)
    expect(result.violations).toEqual([])
  })

  it('rejects ongoing timeframe case-insensitively', () => {
    const result = validateGoalAgainstMinimums(
      goal({ timeframe: 'ONGOING until reviewed', target: 58 }),
      'agriculture',
    )

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        code: 'TIMEFRAME_ONGOING',
        severity: 'error',
        fieldPath: ['timeframe'],
      }),
    )
  })

  it('rejects empty measures', () => {
    const result = validateGoalAgainstMinimums(goal({ measures: [], target: 58 }), 'agriculture')

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        code: 'MEASURES_EMPTY',
        severity: 'error',
        fieldPath: ['measures'],
      }),
    )
  })
})
