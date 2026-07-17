import {
  EAP_DATASET_VERSION,
  GN6124_VERSION,
  getSectorTargetByLevel,
  targetLevelForOccupationalLevel,
  type EapProvince,
  type OccupationalLevel,
  type WorkforceProfile,
  type WorkforceProfileRow,
} from '@simplifi/shared'
import { render, screen, within } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WizardFormContext } from '../../eea/wizard-form-context'
import type { StepId } from '../../eea/wizard-types'
import { buildEapComparison } from '../eap-comparison'
import { EEA12SectionC } from '../sections/eea12-section-c'

// ---------------------------------------------------------------------------
// Fixture — citizen-only workforce rows (foreign nationals already excluded by
// decomposeEEA2Workforce per rule_eea_006). Chosen so every gap status appears:
//   L1: 6 African (designated) + 4 White  -> actual 60.0, National EAP 69.5 -> gap
//   L2: 8 African + 2 White               -> actual 80.0, National EAP 76.8 -> met
//   L3: 7 Coloured (split disabled/non)   -> actual 70.0, National EAP 82.3 -> gap
//        + 3 White; the disability split must NOT affect the denominator.
//   L4: 40 African + 10 White             -> actual 80.0, National EAP 84.5 -> close
//   L5: empty                             -> actual 0.0,  National EAP 87.8 -> gap
// ---------------------------------------------------------------------------

function mustFind<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new TypeError('Expected value to be defined')
  }
  return value
}

function row(
  occupationalLevel: OccupationalLevel,
  race: WorkforceProfileRow['race'],
  count: number,
  disability = false,
): WorkforceProfileRow {
  return { occupationalLevel, race, gender: 'M', disability, count }
}

const FIXTURE_ROWS: WorkforceProfileRow[] = [
  // L1 — designated share 6/10
  row(1, 'A', 6),
  row(1, 'W', 4),
  // L2 — designated share 8/10
  row(2, 'A', 8),
  row(2, 'W', 2),
  // L3 — designated share 7/10, Coloured split across disability flag
  row(3, 'C', 3, true),
  row(3, 'C', 4, false),
  row(3, 'W', 3),
  // L4 — designated share 40/50
  row(4, 'A', 40),
  row(4, 'W', 10),
  // L5 intentionally empty (zero-headcount level renders 0.0%)
]

interface ExpectedRow {
  readonly level: OccupationalLevel
  readonly actualPct: number
  readonly eapPct: number
  readonly gapPct: number
  readonly status: 'met' | 'close' | 'gap'
}

// EAP figures are the National designated (African + Coloured + Indian/Asian)
// share per level from the placeholder QLFS dataset.
const EXPECTED_NATIONAL: readonly ExpectedRow[] = [
  { level: 1, actualPct: 60, eapPct: 69.5, gapPct: -9.5, status: 'gap' },
  { level: 2, actualPct: 80, eapPct: 76.8, gapPct: 3.2, status: 'met' },
  { level: 3, actualPct: 70, eapPct: 82.3, gapPct: -12.3, status: 'gap' },
  { level: 4, actualPct: 80, eapPct: 84.5, gapPct: -4.5, status: 'close' },
  { level: 5, actualPct: 0, eapPct: 87.8, gapPct: -87.8, status: 'gap' },
  { level: 6, actualPct: 0, eapPct: 89.5, gapPct: -89.5, status: 'gap' },
  { level: 7, actualPct: 0, eapPct: 85.8, gapPct: -85.8, status: 'gap' },
]

// ---------------------------------------------------------------------------
// buildEapComparison — pure computation
// ---------------------------------------------------------------------------

describe('buildEapComparison — per-level figures', () => {
  it('produces exact actual/eap/gap/status for each level (one decimal)', () => {
    const result = buildEapComparison(FIXTURE_ROWS, 'National')

    expect(result.rows).toHaveLength(EXPECTED_NATIONAL.length)
    for (const expected of EXPECTED_NATIONAL) {
      const actualRowRaw = result.rows.find((r) => r.occupationalLevel === expected.level)
      const ctxRaw = result.context.find((c) => c.occupationalLevel === expected.level)
      expect(actualRowRaw, `row for level ${String(expected.level)}`).toBeDefined()
      expect(ctxRaw, `context for level ${String(expected.level)}`).toBeDefined()
      const actualRow = mustFind(actualRowRaw)
      const ctx = mustFind(ctxRaw)
      expect(actualRow.actualPct).toBe(expected.actualPct)
      expect(actualRow.eapPct).toBe(expected.eapPct)
      expect(actualRow.gapPct).toBe(expected.gapPct)
      expect(ctx.status).toBe(expected.status)
    }
  })

  it('sums headcount across the disability flag without double counting', () => {
    // L3 has 3 disabled + 4 non-disabled Coloured + 3 White = 10 citizens.
    const result = buildEapComparison(FIXTURE_ROWS, 'National')
    const level3Ctx = mustFind(result.context.find((c) => c.occupationalLevel === 3))
    expect(level3Ctx.citizenHeadcount).toBe(10)
    const level3Row = mustFind(result.rows.find((r) => r.occupationalLevel === 3))
    expect(level3Row.actualPct).toBe(70)
  })

  it('renders every occupational level 1..7 including zero-headcount levels', () => {
    const result = buildEapComparison(FIXTURE_ROWS, 'National')
    const levels = result.rows.map((r) => r.occupationalLevel)
    expect(levels).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('carries both dataset versions for auditability', () => {
    const result = buildEapComparison(FIXTURE_ROWS, 'National')
    expect(result.eapDatasetVersion).toBe(EAP_DATASET_VERSION)
    expect(result.sectorTargetVersion).toBe(GN6124_VERSION)
  })
})

describe('buildEapComparison — province resolution', () => {
  it('falls back to National when province is undefined', () => {
    const undefinedProvince = buildEapComparison(FIXTURE_ROWS)
    const explicitNational = buildEapComparison(FIXTURE_ROWS, 'National')
    expect(undefinedProvince.province).toBe('National')
    expect(undefinedProvince.rows).toEqual(explicitNational.rows)
  })

  it('uses the province-specific EAP slice when a province is supplied', () => {
    // Western Cape has a materially different designated-group EAP profile from
    // National, so the eapPct (and therefore gapPct) must differ for at least
    // one level. actualPct depends only on the workforce and must not change.
    const national = buildEapComparison(FIXTURE_ROWS, 'National')
    const westernCape = buildEapComparison(FIXTURE_ROWS, 'Western Cape' satisfies EapProvince)
    const differs = westernCape.rows.some((wc) => {
      const nat = mustFind(national.rows.find((n) => n.occupationalLevel === wc.occupationalLevel))
      return wc.eapPct !== nat.eapPct
    })
    expect(differs).toBe(true)
    for (const wc of westernCape.rows) {
      const nat = mustFind(national.rows.find((n) => n.occupationalLevel === wc.occupationalLevel))
      expect(wc.actualPct).toBe(nat.actualPct)
    }
  })
})

describe('buildEapComparison — sector target (display only)', () => {
  it('carries the GN 6124 sector target for the gazetted levels only', () => {
    const result = buildEapComparison(FIXTURE_ROWS, 'National', {
      sectorCode: 'finance_insurance',
    })
    for (const level of [1, 2, 3, 4, 5, 6, 7] as OccupationalLevel[]) {
      const ctx = mustFind(result.context.find((c) => c.occupationalLevel === level))
      const targetLevel = targetLevelForOccupationalLevel(level)
      const expected =
        targetLevel === undefined
          ? undefined
          : getSectorTargetByLevel('finance_insurance', targetLevel)
      expect(ctx.sectorTarget).toEqual(expected)
    }
  })

  it('carries no sector target for levels outside the gazetted top four', () => {
    const result = buildEapComparison(FIXTURE_ROWS, 'National', {
      sectorCode: 'finance_insurance',
    })
    for (const level of [5, 6, 7] as OccupationalLevel[]) {
      const ctx = mustFind(result.context.find((c) => c.occupationalLevel === level))
      expect(ctx.sectorTarget).toBeUndefined()
    }
  })

  it('does not include a sector target when no sectorCode is supplied', () => {
    const result = buildEapComparison(FIXTURE_ROWS, 'National')
    for (const ctx of result.context) {
      expect(ctx.sectorTarget).toBeUndefined()
    }
  })

  it('excludes the sector target from the gap calculation', () => {
    // gapPct must be identical whether or not a sectorCode is supplied.
    const withSector = buildEapComparison(FIXTURE_ROWS, 'National', {
      sectorCode: 'finance_insurance',
    })
    const withoutSector = buildEapComparison(FIXTURE_ROWS, 'National')
    expect(withSector.rows).toEqual(withoutSector.rows)
  })
})

// ---------------------------------------------------------------------------
// EEA12SectionC — component rendering + persistence
// ---------------------------------------------------------------------------

function renderSectionC(opts: {
  rows: WorkforceProfileRow[]
  province?: EapProvince
  sectorCode?: Parameters<typeof buildEapComparison>[2] extends infer O
    ? O extends { sectorCode?: infer S }
      ? S
      : never
    : never
  setStepData?: (stepId: StepId, updater: unknown) => void
}) {
  const workforce: WorkforceProfile = { rows: opts.rows }
  const setStepData = opts.setStepData ?? vi.fn()
  const controller = {
    tenantId: 'test-tenant',
    reportingYear: 2025,
    prefillOptions: { autoLoad: false } as never,
    formState: { 'eea12-section-b': workforce } as Record<StepId, unknown>,
    setStepData: setStepData as never,
  }
  const view = render(
    <WizardFormContext.Provider value={controller}>
      <EEA12SectionC
        completedSteps={new Set<StepId>()}
        formId="test-form"
        goToStep={() => {}}
        isLocked={false}
        onAdvance={() => {}}
        updateWizardContext={() => {}}
        wizardContext={{
          disabilityFlagActive: false,
          barrierTerminationFlag: false,
          accommodationOverdueFlag: false,
          sectionBTotals: null,
        }}
        {...(opts.province === undefined ? {} : { province: opts.province })}
        {...(opts.sectorCode === undefined ? {} : { sectorCode: opts.sectorCode })}
      />
    </WizardFormContext.Provider>,
  )
  return { view, setStepData }
}

describe('EEA12SectionC — persistence', () => {
  it('persists comparison rows plus both dataset versions on mount', () => {
    const setStepData = vi.fn<(stepId: StepId, updater: unknown) => void>()
    renderSectionC({ rows: FIXTURE_ROWS, province: 'National', setStepData })

    expect(setStepData).toHaveBeenCalled()
    const [stepId, payload] = mustFind(setStepData.mock.calls.at(-1))
    expect(stepId).toBe('eea12-section-c-stub')
    const data = payload as {
      rows: unknown[]
      eapDatasetVersion: string
      sectorTargetVersion: string
      province: string
    }
    expect(data.eapDatasetVersion).toBe(EAP_DATASET_VERSION)
    expect(data.sectorTargetVersion).toBe(GN6124_VERSION)
    expect(data.province).toBe('National')
    expect(data.rows).toHaveLength(EXPECTED_NATIONAL.length)
  })

  it('persists the resolved province after National fallback', () => {
    const setStepData = vi.fn<(stepId: StepId, updater: unknown) => void>()
    renderSectionC({ rows: FIXTURE_ROWS, setStepData })
    const [, payload] = mustFind(setStepData.mock.calls.at(-1))
    expect((payload as { province: string }).province).toBe('National')
  })
})

describe('EEA12SectionC — provisional EAP data marker', () => {
  it('marks every EAP-derived cell (eap, gap, status) with a provisional badge', () => {
    renderSectionC({ rows: FIXTURE_ROWS, province: 'National' })

    for (const level of [1, 2, 3, 4, 5, 6, 7]) {
      for (const kind of ['eap', 'gap', 'status'] as const) {
        const cell = screen.getByTestId(`eea12-eap-${kind}-${String(level)}`)
        const badge = within(cell).getByTestId('eea12-provisional-badge')
        expect(badge).toBeInTheDocument()
      }
    }
  })

  it('renders no dismiss affordance on any provisional badge', () => {
    renderSectionC({ rows: FIXTURE_ROWS, province: 'National' })

    const badges = screen.getAllByTestId('eea12-provisional-badge')
    expect(badges.length).toBeGreaterThan(0)
    for (const badge of badges) {
      // No interactive close control inside or on the badge.
      expect(within(badge).queryByRole('button')).toBeNull()
      expect(badge.querySelector('[aria-label*="dismiss" i]')).toBeNull()
      expect(badge.querySelector('[aria-label*="close" i]')).toBeNull()
      expect(badge.tagName.toLowerCase()).not.toBe('button')
    }
  })

  it('does not mark the actual % column as provisional (it is employer data)', () => {
    renderSectionC({ rows: FIXTURE_ROWS, province: 'National' })
    const actualCell = screen.getByTestId('eea12-eap-actual-1')
    expect(within(actualCell).queryByTestId('eea12-provisional-badge')).toBeNull()
  })
})

describe('EEA12SectionC — sector target column', () => {
  it('shows the GN 6124 version badge in the sector target header', () => {
    renderSectionC({ rows: FIXTURE_ROWS, province: 'National', sectorCode: 'finance_insurance' })
    const versionBadge = screen.getByTestId('eea12-sector-version-badge')
    expect(versionBadge).toHaveTextContent(GN6124_VERSION)
  })

  it('renders the designated-group male and female targets when a sectorCode is supplied', () => {
    renderSectionC({ rows: FIXTURE_ROWS, province: 'National', sectorCode: 'finance_insurance' })
    const target = mustFind(getSectorTargetByLevel('finance_insurance', 'top_management'))
    const sectorCell = screen.getByTestId('eea12-eap-sector-1')
    expect(sectorCell).toHaveTextContent(`${target.designatedGroupMale.toFixed(1)}%`)
    expect(sectorCell).toHaveTextContent(`${target.designatedGroupFemale.toFixed(1)}%`)
  })

  it('renders a placeholder when no sectorCode is supplied', () => {
    renderSectionC({ rows: FIXTURE_ROWS, province: 'National' })
    const sectorCell = screen.getByTestId('eea12-eap-sector-1')
    expect(sectorCell).toHaveTextContent('—')
  })
})

describe('EEA12SectionC — status chips', () => {
  it('renders the classified status label for each level', () => {
    renderSectionC({ rows: FIXTURE_ROWS, province: 'National' })
    const labelByStatus = { met: 'Met', close: 'Close', gap: 'Gap' } as const
    for (const expected of EXPECTED_NATIONAL) {
      const cell = screen.getByTestId(`eea12-eap-status-${String(expected.level)}`)
      expect(cell).toHaveTextContent(labelByStatus[expected.status])
    }
  })
})
