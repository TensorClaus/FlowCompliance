import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEEAWizard, type UseEEAWizardOptions } from '../hooks/use-eea-wizard'
import type { UsePrefillOptions } from '../hooks/use-prefill'
import { WizardFormContext } from '../wizard-form-context'
import { STEP_IDS, STEP_REGISTRY } from '../wizard-step-registry'
import type { PatchDraftStateInput, StepId, WizardContext } from '../wizard-types'

const UNSAVED_CHANGES_WARNING = 'You have unsaved changes. Leave this step without saving?'

export interface EEAWizardProps {
  formId?: string
  tenantId?: string
  reportingYear?: number
  initialFormState?: Record<StepId, unknown>
  initialWizardContext?: WizardContext
  confirmNavigation?: (message: string) => boolean
  onComplete?: (values: Record<StepId, unknown>) => void
  patchDraftState?: (input: PatchDraftStateInput) => Promise<void>
  prefillOptions?: UsePrefillOptions
}

const stepLabels: Record<StepId, string> = {
  'section-a': 'Section A - Employer details',
  'section-b': 'Section B - Workforce totals',
  'section-c1': 'Section C - Current workforce',
  'section-c2': 'Section C - Numerical goals',
  'section-d1': 'Section D - Trained employees',
  'section-d2': 'Section D - Training spend',
  'section-e-sector-targets': 'Section E - Sector targets',
  'section-e-next-year-targets': 'Section E - Next year targets',
  'section-f-consultation': 'Section F - Consultation',
  'section-f-barriers': 'Section F - Barriers',
  'section-g-monitoring': 'Section G - Monitoring',
  'section-h-declaration': 'Section H - Declaration',
  'section-h-hitl': 'Section H - Human review',
  review: 'Review and submit',
}

const defaultConfirmNavigation = (message: string): boolean => globalThis.confirm(message)

const getCurrentYear = (): number => new Date().getFullYear()

export function EEAWizard({
  formId = 'eea2-draft',
  tenantId = '',
  reportingYear = getCurrentYear(),
  initialFormState,
  initialWizardContext,
  confirmNavigation = defaultConfirmNavigation,
  onComplete,
  patchDraftState,
  prefillOptions = {},
}: EEAWizardProps) {
  const wizard = useEEAWizard({
    formId,
    ...(initialFormState === undefined ? {} : { initialFormState }),
    ...(initialWizardContext === undefined ? {} : { initialWizardContext }),
    ...(patchDraftState === undefined ? {} : { patchDraftState }),
  } satisfies UseEEAWizardOptions)
  const [isDirty, setIsDirty] = useState(false)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)

  const activeStepIndex = Math.max(STEP_IDS.indexOf(wizard.currentStep), 0)
  const activeRegistryEntry = STEP_REGISTRY[wizard.currentStep]
  const ActiveStep = activeRegistryEntry?.component

  const setStepData = useCallback(
    (stepId: StepId, updater: object | ((previous: unknown) => unknown)): void => {
      wizard.setStepData(stepId, updater)
      setIsDirty(true)
      setValidationMessage(null)
    },
    [wizard.setStepData],
  )

  const navigateToStep = (nextStep: StepId): void => {
    if (nextStep === wizard.currentStep) {
      return
    }

    if (isDirty) {
      const shouldContinue = confirmNavigation(UNSAVED_CHANGES_WARNING)
      if (!shouldContinue) {
        return
      }
      setIsDirty(false)
    }

    setValidationMessage(null)
    wizard.goToStep(nextStep)
  }

  const advance = async (): Promise<void> => {
    if (!wizard.canAdvance) {
      setValidationMessage('Complete the current section before continuing.')
      return
    }

    const isReview = wizard.currentStep === 'review'
    await wizard.advance()
    setIsDirty(false)
    setValidationMessage(null)
    if (isReview && onComplete !== undefined) {
      onComplete(wizard.formState)
    }
  }

  const back = (): void => {
    wizard.back()
    setValidationMessage(null)
  }

  useEffect(() => {
    if (!isDirty) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Required for browser beforeunload prompts.
      event.returnValue = UNSAVED_CHANGES_WARNING
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  const formController = useMemo(
    () => ({
      tenantId,
      reportingYear,
      prefillOptions,
      formState: wizard.formState,
      setStepData,
    }),
    [prefillOptions, reportingYear, setStepData, tenantId, wizard.formState],
  )

  return (
    <WizardFormContext.Provider value={formController}>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 border border-slate-200 bg-white p-6">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900">EEA Wizard</h1>
            <p className="text-sm font-semibold text-slate-700">Step {activeStepIndex + 1} of 14</p>
            <p className="text-sm text-slate-600">{stepLabels[wizard.currentStep]}</p>
          </div>
          <nav aria-label="Wizard steps" className="flex flex-wrap gap-2">
            {STEP_IDS.map((stepId, stepIndex) => (
              <button
                aria-current={wizard.currentStep === stepId ? 'step' : undefined}
                aria-label={stepLabels[stepId]}
                className="h-9 w-9 rounded border border-slate-300 text-sm font-medium aria-[current=step]:border-slate-900 aria-[current=step]:bg-slate-900 aria-[current=step]:text-white"
                key={stepId}
                onClick={(): void => {
                  navigateToStep(stepId)
                }}
                type="button"
              >
                {stepIndex + 1}
              </button>
            ))}
          </nav>
          {isDirty ? <p className="text-sm text-amber-700">Unsaved changes</p> : null}
          {validationMessage ? <p className="text-sm text-red-700">{validationMessage}</p> : null}
        </header>

        {ActiveStep === undefined ? null : (
          <ActiveStep
            formId={formId}
            onAdvance={(): void => {
              void advance()
            }}
            updateWizardContext={wizard.updateWizardContext}
            wizardContext={wizard.wizardContext}
          />
        )}

        <footer className="flex items-center gap-2 border-t border-slate-200 pt-4">
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium"
            onClick={back}
            type="button"
          >
            Back
          </button>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={!wizard.canAdvance}
            onClick={(): void => {
              void advance()
            }}
            type="button"
          >
            {wizard.currentStep === 'review' ? 'Submit' : 'Next'}
          </button>
        </footer>
      </section>
    </WizardFormContext.Provider>
  )
}

export { UNSAVED_CHANGES_WARNING }
