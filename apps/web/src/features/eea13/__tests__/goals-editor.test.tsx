import { TIMEFRAME_ONGOING_MESSAGE, type SectorCode } from '@simplifi/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React, { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WizardFormContext } from '../../eea/wizard-form-context'
import type { StepId } from '../../eea/wizard-types'
import { EEA13StepYearlyPlans } from '../sections/eea13-step-yearly-plans'

const BASE_SETUP = {
  sectorCode: 'agriculture',
  planPeriod: { startDate: '2025-01-01', endDate: '2030-01-01' },
  consultation: {
    consultedWithEmployees: true,
    eecfEstablished: true,
    consultationDate: '2025-01-15',
  },
}

const PREFILL = {
  province: 'National',
  rows: [
    { occupationalLevel: 1, race: 'A', gender: 'M', disability: false, count: 20 },
    { occupationalLevel: 1, race: 'W', gender: 'M', disability: false, count: 80 },
  ],
  foreignNationals: [],
  periodLabel: '2025-01-01 - 2025-12-31',
}

function renderYearlyPlans(
  opts: {
    sectorCode?: string
    onStateChange?: (state: Record<StepId, unknown>) => void
  } = {},
) {
  const onAdvance = vi.fn()

  function Harness() {
    const [formState, setFormState] = useState<Record<StepId, unknown>>({
      'eea13-plan-setup': {
        ...BASE_SETUP,
        sectorCode: opts.sectorCode ?? BASE_SETUP.sectorCode,
      },
      'eea13-prefill-source': PREFILL,
    })

    const setStepData = (stepId: StepId, updater: object | ((previous: unknown) => unknown)) => {
      setFormState((previous) => {
        const nextData =
          typeof updater === 'function'
            ? (updater as (previous: unknown) => unknown)(previous[stepId])
            : updater
        const next = { ...previous, [stepId]: nextData }
        opts.onStateChange?.(next)
        return next
      })
    }

    return (
      <WizardFormContext.Provider
        value={{
          tenantId: 'tenant',
          reportingYear: 2025,
          prefillOptions: { autoLoad: false },
          formState,
          setStepData,
        }}
      >
        <EEA13StepYearlyPlans
          completedSteps={new Set<StepId>()}
          formId="form"
          goToStep={() => {}}
          isLocked={false}
          onAdvance={onAdvance}
          updateWizardContext={() => {}}
          wizardContext={{
            disabilityFlagActive: false,
            barrierTerminationFlag: false,
            accommodationOverdueFlag: false,
            sectionBTotals: null,
          }}
        />
        <pre data-testid="form-state-json">{JSON.stringify(formState)}</pre>
      </WizardFormContext.Provider>
    )
  }

  const view = render(<Harness />)
  return { ...view, onAdvance }
}

async function makeFirstGoalValid(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByTestId('eea13-goal-target-1'))
  await user.type(screen.getByTestId('eea13-goal-target-1'), '58')
  await user.type(screen.getByTestId('eea13-goal-timeframe-1'), 'By 31 December 2029')
  await user.type(screen.getByTestId('eea13-goal-target-date-1'), '2029-12-31')
  await user.type(screen.getByTestId('eea13-goal-measure-1-1'), 'Targeted recruitment')
}

describe('EEA13 goals editor', () => {
  it('blocks saving below the sectoral effective minimum', async () => {
    const user = userEvent.setup()
    renderYearlyPlans()

    await makeFirstGoalValid(user)
    await user.clear(screen.getByTestId('eea13-goal-target-1'))
    await user.type(screen.getByTestId('eea13-goal-target-1'), '57')

    expect(screen.getByTestId('eea13-goal-binding-sectoral-1')).toBeInTheDocument()
    expect(screen.getByTestId('eea13-goal-save-1')).toBeDisabled()
    expect(screen.getByTestId('eea13-goal-target-1')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('eea13-goal-target-error-1')).toHaveTextContent('sectoral baseline')
    expect(screen.getByTestId('eea13-goal-target-error-1')).not.toHaveTextContent(/\d/)
  })

  it('blocks saving below the EAP effective minimum', async () => {
    const user = userEvent.setup()
    renderYearlyPlans()

    await user.selectOptions(screen.getByTestId('eea13-goal-group-1'), 'W')
    await user.clear(screen.getByTestId('eea13-goal-target-1'))
    await user.type(screen.getByTestId('eea13-goal-target-1'), '29')
    await user.type(screen.getByTestId('eea13-goal-timeframe-1'), 'By 31 December 2029')
    await user.type(screen.getByTestId('eea13-goal-target-date-1'), '2029-12-31')
    await user.type(screen.getByTestId('eea13-goal-measure-1-1'), 'Retention review')

    expect(screen.getByTestId('eea13-goal-binding-eap-1')).toBeInTheDocument()
    expect(screen.getByTestId('eea13-goal-save-1')).toBeDisabled()
    expect(screen.getByTestId('eea13-goal-target-error-1')).toHaveTextContent('EAP benchmark')
    expect(screen.getByTestId('eea13-goal-target-error-1')).not.toHaveTextContent(/\d/)
  })

  it('accepts equality with the effective minimum', async () => {
    const user = userEvent.setup()
    renderYearlyPlans()

    await makeFirstGoalValid(user)

    expect(screen.getByTestId('eea13-goal-save-1')).not.toBeDisabled()
    await user.click(screen.getByTestId('eea13-goal-save-1'))
    expect(screen.getByTestId('eea13-saved-goal-1-1')).toBeInTheDocument()
  })

  it('renders the EAP-only path when no GN 6124 target exists', () => {
    renderYearlyPlans({ sectorCode: 'missing_sector' as SectorCode })

    expect(screen.getByTestId('eea13-goal-no-sectoral-target-1')).toHaveTextContent(
      'No GN 6124 target for this combination',
    )
    expect(screen.getByTestId('eea13-goal-binding-eap-1')).toBeInTheDocument()
  })

  it('blocks ongoing timeframes as the user types', async () => {
    const user = userEvent.setup()
    renderYearlyPlans()

    await user.clear(screen.getByTestId('eea13-goal-target-1'))
    await user.type(screen.getByTestId('eea13-goal-target-1'), '58')
    await user.type(screen.getByTestId('eea13-goal-timeframe-1'), 'ONGOING')
    await user.type(screen.getByTestId('eea13-goal-target-date-1'), '2029-12-31')
    await user.type(screen.getByTestId('eea13-goal-measure-1-1'), 'Review pipeline')

    expect(screen.getByTestId('eea13-goal-timeframe-1')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('eea13-goal-timeframe-error-1')).toHaveTextContent(
      TIMEFRAME_ONGOING_MESSAGE,
    )
    expect(screen.getByTestId('eea13-goal-save-1')).toBeDisabled()
  })

  it('marks the prefilled EAP benchmark as provisional', () => {
    renderYearlyPlans()

    const eapField = screen.getByTestId('eea13-goal-eap-field-1')
    expect(within(eapField).getByTestId('eea-provisional-badge')).toBeInTheDocument()
  })

  it('persists saved goals into PlanYear formState', async () => {
    const user = userEvent.setup()
    renderYearlyPlans()

    await makeFirstGoalValid(user)
    await user.click(screen.getByTestId('eea13-goal-save-1'))

    const state = JSON.parse(screen.getByTestId('form-state-json').textContent) as {
      'eea13-yearly-plans'?: { entries?: Array<{ goals?: unknown[] }> }
    }
    expect(state['eea13-yearly-plans']?.entries?.[0]?.goals).toEqual([
      expect.objectContaining({
        occupationalLevel: 1,
        designatedGroup: 'A',
        target: 58,
        eapBenchmark: 55,
        currentRepresentation: 20,
      }),
    ])
  })
})
