import type React from 'react'
import type { z } from 'zod'

export type StepId = string

export type WizardContext = {
  disabilityFlagActive: boolean
  barrierTerminationFlag: boolean
  accommodationOverdueFlag: boolean
  sectionBTotals: {
    permanent: number
    nonPermanent: number
    contract: number
    grandTotal: number
  } | null
}

export type StepProps = {
  formId: string
  wizardContext: WizardContext
  completedSteps: Set<StepId>
  updateWizardContext: (patch: Partial<WizardContext>) => void
  goToStep: (stepId: StepId) => void
  onAdvance: () => void
  isLocked?: boolean
}

export type StepRegistry = Record<
  StepId,
  {
    sectionKey: string
    component: React.ComponentType<StepProps>
    validationSchema: z.ZodType
    requiresHITL: boolean
  }
>

export interface SectionAReadOnlyFields {
  registrationNumber: string
  sector: string
  province: string
  totalEmployeesPriorYear: number
}

export interface SectionAData extends SectionAReadOnlyFields {
  primaryContactName: string
  primaryContactEmail: string
  reportingYear: number
}

export interface SectionBRowData {
  male: number
  female: number
}

export interface SectionBData {
  permanent: SectionBRowData
  nonPermanent: SectionBRowData
  contract: SectionBRowData
  totals?: WizardContext['sectionBTotals']
}

export interface PatchDraftStateInput {
  formId: string
  stepId: StepId
  sectionKey: string
  stepData: unknown
  completedSteps: StepId[]
}
