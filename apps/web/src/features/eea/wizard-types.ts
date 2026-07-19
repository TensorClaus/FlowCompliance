import type React from 'react'
import type { z } from 'zod'

export type StepId = string

export type WizardContext = {
  // Live condition, recomputed from the manually-captured disability headcount
  // against the workforce total (rule_eea_013). Unlike the two event flags below
  // it is NOT latched — a compliant count clears it.
  disabilityFlagActive: boolean
  // Manually-captured count of employees with disabilities (Section C1).
  // Optional so existing context literals stay valid; absent = 0 captured.
  disabilityHeadcount?: number
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
