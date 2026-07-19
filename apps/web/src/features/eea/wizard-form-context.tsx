import { createContext, useContext } from 'react'
import type { UsePrefillOptions } from './hooks/use-prefill'
import type { StepId } from './wizard-types'

type StepDataUpdater = object | ((previous: unknown) => unknown)

export interface WizardFormController {
  tenantId: string
  reportingYear: number
  prefillOptions: UsePrefillOptions
  formState: Record<StepId, unknown>
  setStepData: (stepId: StepId, updater: StepDataUpdater) => void
  /**
   * Full linked EEA2 FORM WRAPPER ({ id, report, status }) provided by the EEA4
   * shell. The cross-form validation engine reads the EEA2 wrapper id and the
   * report's sectionB.workforceProfile — the matrix-only context key remains the
   * data source for Sections C/D. Undefined for the EEA2 wizard itself.
   */
  linkedEEA2Form?: unknown
  /**
   * Current EEA4 FORM WRAPPER ({ id, report, status }) — the live document the
   * declaration gate validates against. Undefined for the EEA2 wizard.
   */
  eea4Form?: unknown
  /**
   * Applies a functional update to the EEA4 form wrapper. The declaration step
   * uses this to write report.status AND form.status together in one call when
   * the CEO signature completes. Undefined for the EEA2 wizard.
   */
  setEEA4Form?: (updater: (previous: unknown) => unknown) => void
}

export const WizardFormContext = createContext<WizardFormController | null>(null)

export function useWizardFormController(): WizardFormController {
  const controller = useContext(WizardFormContext)
  if (controller === null) {
    throw new Error('Wizard steps must be rendered inside EEAWizard')
  }
  return controller
}
