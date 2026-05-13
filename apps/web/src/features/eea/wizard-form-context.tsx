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
}

export const WizardFormContext = createContext<WizardFormController | null>(null)

export function useWizardFormController(): WizardFormController {
  const controller = useContext(WizardFormContext)
  if (controller === null) {
    throw new Error('Wizard steps must be rendered inside EEAWizard')
  }
  return controller
}
