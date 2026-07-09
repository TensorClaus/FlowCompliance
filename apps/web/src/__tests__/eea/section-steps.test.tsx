import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DisabilityFlagBanner } from '@/features/eea/components/occupational-matrix/DisabilityFlagBanner'
import {
  SectionH2AccessibilityStep,
  SECTION_H2_ACCESSIBILITY_SCHEMA,
} from '@/features/eea/components/sections/SectionH2Accessibility'
import { WizardFormContext, type WizardFormController } from '@/features/eea/wizard-form-context'
import type { StepId } from '@/features/eea/wizard-types'

// ---------------------------------------------------------------------------
// DisabilityFlagBanner — rule_eea_013 / EEA s27, non-suppressible
// ---------------------------------------------------------------------------

describe('DisabilityFlagBanner', () => {
  it('renders the threshold alert with formatted percentage and headcount', () => {
    render(<DisabilityFlagBanner headcount={1} percentage={1.5} total={66} />)

    const banner = screen.getByTestId('disability-flag-banner')
    expect(banner).toHaveAttribute('role', 'alert')
    expect(banner).toHaveAttribute('aria-live', 'assertive')
    expect(banner).toHaveTextContent('Disability representation below 3% threshold')
    expect(banner).toHaveTextContent('1.50% (1 of 66 employees)')
    expect(banner).toHaveTextContent('This notice cannot be dismissed.')
  })

  it('offers no dismiss affordance — the banner is non-suppressible', () => {
    render(<DisabilityFlagBanner headcount={0} percentage={0} total={10} />)

    expect(document.querySelector('[data-dismiss]')).toBeNull()
    expect(document.querySelector('button')).toBeNull()
  })

  it('supports a scoped testId for context-specific rendering', () => {
    render(
      <DisabilityFlagBanner
        headcount={2}
        percentage={2}
        testId="review-disability-flag"
        total={100}
      />,
    )

    expect(screen.getByTestId('review-disability-flag')).toBeInTheDocument()
    expect(screen.queryByTestId('disability-flag-banner')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// SectionH2AccessibilityStep — rule_eea_013 three-year assessment cycle
// ---------------------------------------------------------------------------

function renderStep(options: {
  stepData?: unknown
  isLocked?: boolean
  setStepData?: WizardFormController['setStepData']
}) {
  const controller: WizardFormController = {
    tenantId: 'tenant-001',
    reportingYear: 2026,
    prefillOptions: {} as WizardFormController['prefillOptions'],
    formState: { 'section-h-hitl': options.stepData } as Record<StepId, unknown>,
    setStepData: options.setStepData ?? vi.fn(),
  }
  return render(
    <WizardFormContext.Provider value={controller}>
      <SectionH2AccessibilityStep
        completedSteps={new Set<StepId>()}
        formId="form-123"
        goToStep={vi.fn()}
        isLocked={options.isLocked ?? false}
        onAdvance={vi.fn()}
        updateWizardContext={vi.fn()}
        wizardContext={{
          disabilityFlagActive: false,
          barrierTerminationFlag: false,
          accommodationOverdueFlag: false,
          sectionBTotals: null,
        }}
      />
    </WizardFormContext.Provider>,
  )
}

describe('SectionH2AccessibilityStep', () => {
  it('renders empty date inputs when no step data exists', () => {
    renderStep({})

    expect(screen.getByLabelText('Last assessment date')).toHaveValue('')
    expect(screen.getByLabelText('Next scheduled date')).toHaveValue('')
    expect(screen.queryByTestId('accessibility-stale-banner')).not.toBeInTheDocument()
  })

  it('patches step data through the wizard controller on change', () => {
    const setStepData = vi.fn()
    renderStep({ setStepData })

    fireEvent.change(screen.getByLabelText('Last assessment date'), {
      target: { value: '2026-01-15' },
    })

    expect(setStepData).toHaveBeenCalledWith('section-h-hitl', {
      lastAssessmentDate: '2026-01-15',
      nextScheduledDate: '',
    })
  })

  it('shows the stale banner when the last assessment is older than three years (rule_eea_013)', () => {
    renderStep({ stepData: { lastAssessmentDate: '2020-01-01', nextScheduledDate: '' } })

    const banner = screen.getByTestId('accessibility-stale-banner')
    expect(banner).toHaveTextContent('more than three years old')
    expect(banner).toHaveTextContent('rule_eea_013')
  })

  it('shows no stale banner for a recent assessment', () => {
    renderStep({ stepData: { lastAssessmentDate: '2026-01-01', nextScheduledDate: '' } })

    expect(screen.queryByTestId('accessibility-stale-banner')).not.toBeInTheDocument()
  })

  it('treats an unparseable date as not stale rather than crashing', () => {
    renderStep({ stepData: { lastAssessmentDate: 'not-a-date', nextScheduledDate: '' } })

    expect(screen.queryByTestId('accessibility-stale-banner')).not.toBeInTheDocument()
  })

  it('renders read-only values without inputs when locked', () => {
    renderStep({
      isLocked: true,
      stepData: { lastAssessmentDate: '2025-06-01', nextScheduledDate: '2028-06-01' },
    })

    expect(screen.queryByLabelText('Last assessment date')).not.toBeInTheDocument()
    expect(screen.getByText('2025-06-01')).toBeInTheDocument()
    expect(screen.getByText('2028-06-01')).toBeInTheDocument()
  })

  it('schema requires both assessment dates', () => {
    expect(
      SECTION_H2_ACCESSIBILITY_SCHEMA.safeParse({ lastAssessmentDate: '', nextScheduledDate: '' })
        .success,
    ).toBe(false)
    expect(
      SECTION_H2_ACCESSIBILITY_SCHEMA.safeParse({
        lastAssessmentDate: '2026-01-01',
        nextScheduledDate: '2029-01-01',
      }).success,
    ).toBe(true)
  })
})
