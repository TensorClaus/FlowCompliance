export {
  EmployerDetailsForm,
  EmployerDetailsFormSchema,
  type EmployerDetailsValues,
} from './components/employer-details-form'
export { EEAWizard, UNSAVED_CHANGES_WARNING, type EEAWizardProps } from './components/eea-wizard'
export {
  STEP_IDS,
  STEP_REGISTRY,
  SECTION_A_SCHEMA,
  SECTION_B_SCHEMA,
  calculateSectionBTotals,
} from './wizard-step-registry'
export {
  useEEAWizard,
  type UseEEAWizardOptions,
  type UseEEAWizardResult,
} from './hooks/use-eea-wizard'
export type {
  PatchDraftStateInput,
  SectionAData,
  SectionAReadOnlyFields,
  SectionBData,
  SectionBRowData,
  StepId,
  StepProps,
  StepRegistry,
  WizardContext,
} from './wizard-types'
export {
  EVENT_EMITTER_ENDPOINT,
  useEEAAutosave,
  type UseEEAAutosaveOptions,
  type UseEEAAutosaveResult,
} from './hooks/use-eea-autosave'
export {
  extractPrefillData,
  PREFILL_ENDPOINT,
  usePrefill,
  type PrefillData,
  type UsePrefillOptions,
  type UsePrefillResult,
} from './hooks/use-prefill'
