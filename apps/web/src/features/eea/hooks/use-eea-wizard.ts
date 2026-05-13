import { useCallback, useMemo, useState } from 'react'
import {
  STEP_IDS,
  STEP_REGISTRY,
  calculateSectionBTotals,
  getOccupationalMatrixTotal,
  getSectionBData,
} from '../wizard-step-registry'
import type { PatchDraftStateInput, StepId, WizardContext } from '../wizard-types'

type StepDataUpdaterFunction = (previous: unknown) => unknown
type StepDataUpdater = object | StepDataUpdaterFunction

export interface UseEEAWizardOptions {
  formId: string
  initialStep?: StepId
  initialFormState?: Record<StepId, unknown>
  initialWizardContext?: WizardContext
  patchDraftState?: (input: PatchDraftStateInput) => Promise<void>
}

export interface UseEEAWizardResult {
  currentStep: StepId
  completedSteps: Set<StepId>
  canAdvance: boolean
  wizardContext: WizardContext
  formState: Record<StepId, unknown>
  goToStep: (stepId: StepId) => void
  advance: () => Promise<void>
  back: () => void
  setStepData: (stepId: StepId, updater: StepDataUpdater) => void
  updateWizardContext: (patch: Partial<WizardContext>) => void
}

const defaultWizardContext: WizardContext = {
  disabilityFlagActive: false,
  barrierTerminationFlag: false,
  accommodationOverdueFlag: false,
  sectionBTotals: null,
}

const defaultPatchDraftState = async ({
  formId,
  stepId,
  sectionKey,
  stepData,
  completedSteps,
}: PatchDraftStateInput): Promise<void> => {
  const response = await fetch(`/api/eea2/${encodeURIComponent(formId)}/draft/state`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      stepId,
      sectionKey,
      state: {
        [sectionKey]: stepData,
      },
      completedSteps,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to patch EEA2 draft state')
  }
}

const getStepIndex = (stepId: StepId): number => STEP_IDS.indexOf(stepId)

const isStepDataUpdaterFunction = (updater: StepDataUpdater): updater is StepDataUpdaterFunction =>
  typeof updater === 'function'

export function useEEAWizard({
  formId,
  initialStep = STEP_IDS[0] ?? 'section-a',
  initialFormState = {},
  initialWizardContext = defaultWizardContext,
  patchDraftState = defaultPatchDraftState,
}: UseEEAWizardOptions): UseEEAWizardResult {
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(() => new Set())
  const [wizardContext, setWizardContext] = useState(initialWizardContext)
  const [formState, setFormState] = useState(initialFormState)

  const currentRegistryEntry = STEP_REGISTRY[currentStep]
  const currentStepData = formState[currentStep] ?? {}
  const schemaCanAdvance =
    currentRegistryEntry?.validationSchema.safeParse(currentStepData).success ?? false
  const canAdvance =
    currentStep === 'section-c1'
      ? schemaCanAdvance &&
        wizardContext.sectionBTotals !== null &&
        getOccupationalMatrixTotal(currentStepData) === wizardContext.sectionBTotals.grandTotal
      : schemaCanAdvance

  const setStepData = useCallback((stepId: StepId, updater: StepDataUpdater): void => {
    setFormState((previous) => {
      const previousStepData = previous[stepId]
      const nextStepData: unknown = isStepDataUpdaterFunction(updater)
        ? updater(previousStepData)
        : updater
      if (nextStepData === previousStepData) {
        return previous
      }
      return {
        ...previous,
        [stepId]: nextStepData,
      }
    })
  }, [])

  const goToStep = useCallback((stepId: StepId): void => {
    if (STEP_REGISTRY[stepId] === undefined) {
      return
    }
    setCurrentStep(stepId)
  }, [])

  const updateWizardContext = useCallback((patch: Partial<WizardContext>): void => {
    setWizardContext((previous) => ({
      ...previous,
      ...patch,
      disabilityFlagActive:
        previous.disabilityFlagActive || patch.disabilityFlagActive === true
          ? true
          : (patch.disabilityFlagActive ?? previous.disabilityFlagActive),
    }))
  }, [])

  const back = useCallback((): void => {
    setCurrentStep((previous) => {
      const previousIndex = getStepIndex(previous)
      if (previousIndex <= 0) {
        return previous
      }
      return STEP_IDS[previousIndex - 1] ?? previous
    })
  }, [])

  const advance = useCallback(async (): Promise<void> => {
    const registryEntry = STEP_REGISTRY[currentStep]
    if (registryEntry === undefined) {
      return
    }

    const stepData = formState[currentStep] ?? {}
    const parsed = registryEntry.validationSchema.safeParse(stepData)
    if (!parsed.success) {
      return
    }

    let nextStepData: unknown = parsed.data
    let nextWizardContext = wizardContext
    if (currentStep === 'section-b') {
      const sectionB = getSectionBData(parsed.data)
      const totals = calculateSectionBTotals(sectionB)
      nextStepData = {
        ...sectionB,
        totals,
      }
      nextWizardContext = {
        ...wizardContext,
        sectionBTotals: totals,
      }
      setWizardContext(nextWizardContext)
      setFormState((previous) => ({
        ...previous,
        [currentStep]: nextStepData,
      }))
    }

    const nextCompletedSteps = new Set(completedSteps)
    nextCompletedSteps.add(currentStep)
    await patchDraftState({
      formId,
      stepId: currentStep,
      sectionKey: registryEntry.sectionKey,
      stepData: nextStepData,
      completedSteps: [...nextCompletedSteps],
    })
    setCompletedSteps(nextCompletedSteps)

    const currentIndex = getStepIndex(currentStep)
    const nextStep = STEP_IDS[currentIndex + 1]
    if (nextStep !== undefined) {
      setCurrentStep(nextStep)
    }
  }, [completedSteps, currentStep, formId, formState, patchDraftState, wizardContext])

  return useMemo(
    () => ({
      currentStep,
      completedSteps,
      canAdvance,
      wizardContext,
      formState,
      goToStep,
      advance,
      back,
      setStepData,
      updateWizardContext,
    }),
    [
      advance,
      back,
      canAdvance,
      completedSteps,
      currentStep,
      formState,
      goToStep,
      setStepData,
      updateWizardContext,
      wizardContext,
    ],
  )
}
