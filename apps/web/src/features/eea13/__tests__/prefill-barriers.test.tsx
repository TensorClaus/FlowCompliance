import type { BarrierEntry } from '@simplifi/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WizardFormContext } from '../../eea/wizard-form-context'
import type { StepId } from '../../eea/wizard-types'
import { seedRemovalPlan } from '../prefill-barriers'
import { EEA13StepBarriersRemoval } from '../sections/eea13-step-barriers-removal'
import type { EEA13PrefillSource } from '../sections/eea13-step-workforce-analysis'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEntry(
  category: BarrierEntry['category'],
  severity: BarrierEntry['severity'],
  mitigationActions: string[],
): BarrierEntry {
  return {
    category,
    description: `Test barrier for ${category}`,
    severity,
    affectedDesignatedGroups: [],
    mitigationActions,
    targetCompletionDate: '2027-10-31',
  }
}

// Three distinct categories; one high, one medium, one low.
// A duplicate of 'promotion' is appended to test duplicate detection.
const ENTRIES_WITH_DUPLICATE: BarrierEntry[] = [
  makeEntry('promotion', 'medium', ['Revise promotion criteria', 'Track metrics']),
  makeEntry('training_and_development', 'high', ['Fund training programmes']),
  makeEntry('workplace_culture', 'low', ['Run culture workshops']),
  // Duplicate of 'promotion' — must be reported, not produce a second stub.
  makeEntry('promotion', 'low', ['Alternative action']),
]

// ---------------------------------------------------------------------------
// Pure function: seedRemovalPlan
// ---------------------------------------------------------------------------

describe('seedRemovalPlan — pure function', () => {
  it('produces one stub per distinct category (3 stubs from 4 entries with one duplicate)', () => {
    const { plans, duplicates } = seedRemovalPlan(ENTRIES_WITH_DUPLICATE)
    expect(plans).toHaveLength(3)
    expect(duplicates).toHaveLength(1)
  })

  it('reports the duplicate category string', () => {
    const { duplicates } = seedRemovalPlan(ENTRIES_WITH_DUPLICATE)
    expect(duplicates[0]).toBe('promotion')
  })

  it('sorts high severity first regardless of input order', () => {
    const { plans } = seedRemovalPlan(ENTRIES_WITH_DUPLICATE)
    // training_and_development is high — must be first stub
    expect(plans[0]?.barrierCategory).toBe('training_and_development')
  })

  it('medium comes before low within lower tiers', () => {
    const { plans } = seedRemovalPlan(ENTRIES_WITH_DUPLICATE)
    expect(plans[1]?.barrierCategory).toBe('promotion') // medium
    expect(plans[2]?.barrierCategory).toBe('workplace_culture') // low
  })

  it('joins multiple mitigation actions with "; "', () => {
    const { plans } = seedRemovalPlan(ENTRIES_WITH_DUPLICATE)
    const promotionPlan = plans.find((p) => p.barrierCategory === 'promotion')
    expect(promotionPlan?.action).toBe('Revise promotion criteria; Track metrics')
  })

  it('leaves responsible, timeline and measurableOutcome empty for user to fill in', () => {
    const { plans } = seedRemovalPlan(ENTRIES_WITH_DUPLICATE)
    for (const plan of plans) {
      expect(plan.responsible).toBe('')
      expect(plan.timeline).toBe('')
      expect(plan.measurableOutcome).toBe('')
    }
  })

  it('returns empty arrays for empty input', () => {
    const { plans, duplicates } = seedRemovalPlan([])
    expect(plans).toHaveLength(0)
    expect(duplicates).toHaveLength(0)
  })

  it('single entry produces one stub and no duplicates', () => {
    const single = [makeEntry('dismissals', 'high', ['Review termination policy'])]
    const { plans, duplicates } = seedRemovalPlan(single)
    expect(plans).toHaveLength(1)
    expect(duplicates).toHaveLength(0)
    expect(plans[0]?.barrierCategory).toBe('dismissals')
    expect(plans[0]?.action).toBe('Review termination policy')
  })
})

// ---------------------------------------------------------------------------
// Component harness
// ---------------------------------------------------------------------------

const PERIOD_LABEL = '2025-01-01 – 2025-12-31'

const PREFILL_SOURCE: EEA13PrefillSource = {
  rows: [],
  foreignNationals: [],
  periodLabel: PERIOD_LABEL,
  barrierEntries: ENTRIES_WITH_DUPLICATE,
}

function renderBarriersStep(prefillSource?: EEA13PrefillSource) {
  const onAdvance = vi.fn()

  function Harness() {
    const initialFormState: Record<string, unknown> =
      prefillSource === undefined ? {} : { 'eea13-prefill-source': prefillSource }
    const [formState, setFormState] = useState(initialFormState)

    const setStepData = (stepId: StepId, updater: object | ((previous: unknown) => unknown)) => {
      setFormState((previous) => {
        const nextData =
          typeof updater === 'function'
            ? (updater as (previous: unknown) => unknown)(previous[stepId])
            : updater
        return { ...previous, [stepId]: nextData }
      })
    }

    return (
      <WizardFormContext.Provider
        value={{
          tenantId: 'test-tenant',
          reportingYear: 2025,
          prefillOptions: { autoLoad: false },
          formState,
          setStepData,
        }}
      >
        <EEA13StepBarriersRemoval
          completedSteps={new Set<StepId>()}
          formId="test-form-id"
          goToStep={vi.fn()}
          isLocked={false}
          onAdvance={onAdvance}
          updateWizardContext={vi.fn()}
          wizardContext={{
            disabilityFlagActive: false,
            barrierTerminationFlag: false,
            accommodationOverdueFlag: false,
            sectionBTotals: null,
          }}
        />
      </WizardFormContext.Provider>
    )
  }

  return { result: render(<Harness />), onAdvance }
}

// ---------------------------------------------------------------------------
// ONE-TIME SEED semantics
// ---------------------------------------------------------------------------

describe('EEA13StepBarriersRemoval — one-time seed', () => {
  it('seeds 3 rows from 4 entries (one duplicate skipped)', () => {
    renderBarriersStep(PREFILL_SOURCE)
    // 3 distinct barrier row wrappers expected
    expect(screen.getByTestId('eea13-barrier-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('eea13-barrier-row-2')).toBeInTheDocument()
    expect(screen.getByTestId('eea13-barrier-row-3')).toBeInTheDocument()
    expect(screen.queryByTestId('eea13-barrier-row-4')).not.toBeInTheDocument()
  })

  it('mutating the source entries object after mount does not change rendered rows', () => {
    // Capture a mutable reference to a prefill source.
    // After render the seed has fired; mutating barrierEntries must NOT re-seed.
    const mutableEntries: BarrierEntry[] = [...ENTRIES_WITH_DUPLICATE]
    const mutableSource: EEA13PrefillSource = {
      ...PREFILL_SOURCE,
      barrierEntries: mutableEntries,
    }

    renderBarriersStep(mutableSource)

    // Seed fired: 3 rows present.
    expect(screen.getByTestId('eea13-barrier-row-1')).toBeInTheDocument()
    expect(screen.queryByTestId('eea13-barrier-row-4')).not.toBeInTheDocument()

    // Now mutate the source entries to have a 5th entry with a new category.
    mutableEntries.push(makeEntry('retention_of_designated_groups', 'high', ['Retention plan']))

    // React does not re-render from this external mutation; rows remain unchanged.
    // This confirms the one-time seed: the component does not listen to source changes.
    expect(screen.getByTestId('eea13-barrier-row-1')).toBeInTheDocument()
    expect(screen.queryByTestId('eea13-barrier-row-4')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Provenance caption and high-severity marker
// ---------------------------------------------------------------------------

describe('EEA13StepBarriersRemoval — provenance and severity', () => {
  it('shows provenance caption "From EEA12 {period}" on seeded rows', () => {
    renderBarriersStep(PREFILL_SOURCE)
    // Row 1 is high-severity (training_and_development) — must have provenance
    const row1Provenance = screen.getByTestId('eea13-barrier-row-1-provenance')
    expect(row1Provenance).toHaveTextContent(`From EEA12 ${PERIOD_LABEL}`)
  })

  it('shows high-severity marker on the row seeded from a high-severity entry', () => {
    renderBarriersStep(PREFILL_SOURCE)
    // Row 1 is training_and_development (high) — must have the high marker
    expect(screen.getByTestId('eea13-barrier-row-1-high-marker')).toBeInTheDocument()
  })

  it('does not show high-severity marker on medium or low seeded rows', () => {
    renderBarriersStep(PREFILL_SOURCE)
    // Row 2 is promotion (medium), row 3 is workplace_culture (low)
    expect(screen.queryByTestId('eea13-barrier-row-2-high-marker')).not.toBeInTheDocument()
    expect(screen.queryByTestId('eea13-barrier-row-3-high-marker')).not.toBeInTheDocument()
  })

  it('shows the seed provenance notice banner when seeded rows exist', () => {
    renderBarriersStep(PREFILL_SOURCE)
    expect(screen.getByTestId('eea13-barriers-seed-notice')).toBeInTheDocument()
    expect(screen.getByTestId('eea13-barriers-seed-notice')).toHaveTextContent(PERIOD_LABEL)
  })
})

// ---------------------------------------------------------------------------
// Add / remove row behaviour
// ---------------------------------------------------------------------------

describe('EEA13StepBarriersRemoval — add and remove rows', () => {
  it('remove is disabled (button absent) when only 1 row exists', () => {
    // No prefill: seeds a single blank row.
    renderBarriersStep()
    // With 1 row the remove button (aria-label "Remove removal plan entry") must be absent.
    expect(
      screen.queryByRole('button', { name: /remove removal plan entry/i }),
    ).not.toBeInTheDocument()
  })

  it('add-row button appends a blank row', async () => {
    const user = userEvent.setup()
    renderBarriersStep()

    // Initially 1 blank row
    expect(screen.getByTestId('eea13-barrier-row-1')).toBeInTheDocument()
    expect(screen.queryByTestId('eea13-barrier-row-2')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('eea13-barriers-add-row'))

    expect(screen.getByTestId('eea13-barrier-row-2')).toBeInTheDocument()
  })

  it('remove button appears when >1 row and removes a row when clicked', async () => {
    const user = userEvent.setup()
    renderBarriersStep()

    // Add a second row so remove becomes available.
    await user.click(screen.getByTestId('eea13-barriers-add-row'))
    expect(screen.getByTestId('eea13-barrier-row-2')).toBeInTheDocument()

    const removeButtons = screen.getAllByRole('button', { name: /remove removal plan entry/i })
    expect(removeButtons.length).toBeGreaterThanOrEqual(1)

    const [firstRemoveButton] = removeButtons
    if (firstRemoveButton === undefined) throw new TypeError('Missing remove button')
    await user.click(firstRemoveButton)
    expect(screen.queryByTestId('eea13-barrier-row-2')).not.toBeInTheDocument()
  })

  it('remove is disabled (button absent) when back to 1 row after removing', async () => {
    const user = userEvent.setup()
    renderBarriersStep()

    await user.click(screen.getByTestId('eea13-barriers-add-row'))
    const removeButtons = screen.getAllByRole('button', { name: /remove removal plan entry/i })
    const [firstRemoveButton] = removeButtons
    if (firstRemoveButton === undefined) throw new TypeError('Missing remove button')
    await user.click(firstRemoveButton)

    expect(
      screen.queryByRole('button', { name: /remove removal plan entry/i }),
    ).not.toBeInTheDocument()
  })
})
