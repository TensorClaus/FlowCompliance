import { useEffect, useState } from 'react'
import { EmployerDetailsForm, type EmployerDetailsValues } from './employer-details-form'

const UNSAVED_CHANGES_WARNING = 'You have unsaved changes. Leave this step without saving?'

export interface EEAWizardProps {
  confirmNavigation?: (message: string) => boolean
  onComplete?: (values: EmployerDetailsValues) => void
}

const stepLabels = ['Employer details', 'Review and submit'] as const

const defaultConfirmNavigation = (message: string): boolean => globalThis.confirm(message)

export function EEAWizard({
  confirmNavigation = defaultConfirmNavigation,
  onComplete,
}: EEAWizardProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [employerDetails, setEmployerDetails] = useState<EmployerDetailsValues | null>(null)

  const navigateToStep = (nextStep: number): void => {
    if (nextStep === activeStep) {
      return
    }

    if (isDirty) {
      const shouldContinue = confirmNavigation(UNSAVED_CHANGES_WARNING)
      if (!shouldContinue) {
        return
      }
      setIsDirty(false)
    }

    if (nextStep > 0 && employerDetails === null) {
      setValidationMessage('Complete Employer details before opening Review and submit.')
      return
    }

    setValidationMessage(null)
    setActiveStep(nextStep)
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

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-slate-900">EEA Wizard</h1>
        <nav aria-label="Wizard steps" className="flex gap-2">
          {stepLabels.map((stepLabel, stepIndex) => (
            <button
              aria-current={activeStep === stepIndex ? 'step' : undefined}
              className="rounded border border-slate-300 px-3 py-2 text-sm font-medium"
              disabled={stepIndex > 0 && employerDetails === null}
              key={stepLabel}
              onClick={(): void => {
                navigateToStep(stepIndex)
              }}
              type="button"
            >
              {stepLabel}
            </button>
          ))}
        </nav>
        {isDirty ? <p className="text-sm text-amber-700">Unsaved changes</p> : null}
        {validationMessage ? <p className="text-sm text-red-700">{validationMessage}</p> : null}
      </header>

      {activeStep === 0 ? (
        <EmployerDetailsForm
          {...(employerDetails ? { defaultData: employerDetails } : {})}
          onDirtyChange={setIsDirty}
          onSubmit={(values): void => {
            setEmployerDetails(values)
            setIsDirty(false)
            setValidationMessage(null)
            setActiveStep(1)
          }}
        />
      ) : null}

      {activeStep === 1 && employerDetails ? (
        <section aria-label="Review and submit" className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
            <span className="font-semibold">Trade name</span>
            <span>{employerDetails.tradeName}</span>
            <span className="font-semibold">DTI registration</span>
            <span>{employerDetails.dtiRegistrationNumber}</span>
            <span className="font-semibold">CEO email</span>
            <span>{employerDetails.ceoEmail}</span>
            <span className="font-semibold">EAP type</span>
            <span>{employerDetails.eapType}</span>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded border border-slate-300 px-3 py-2 text-sm font-medium"
              onClick={(): void => {
                setActiveStep(0)
              }}
              type="button"
            >
              Back
            </button>
            <button
              className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={(): void => {
                if (onComplete) {
                  onComplete(employerDetails)
                }
              }}
              type="button"
            >
              Submit
            </button>
          </div>
        </section>
      ) : null}
    </section>
  )
}

export { UNSAVED_CHANGES_WARNING }
