import {
  BarriersAnalysisSchema,
  EapComparisonSchema,
  WorkforceProfileSchema,
} from '@simplifi/shared'
import type { StepRegistry } from '../eea/wizard-types'
import { EEA12SectionA } from './sections/eea12-section-a'
import { EEA12SectionB } from './sections/eea12-section-b'
import { EEA12SectionC } from './sections/eea12-section-c'

export const EEA12_STEP_REGISTRY: StepRegistry = {
  'eea12-section-a': {
    sectionKey: 'barriers',
    component: EEA12SectionA,
    validationSchema: BarriersAnalysisSchema,
    requiresHITL: false,
  },
  'eea12-section-b': {
    sectionKey: 'workforceProfile',
    component: EEA12SectionB,
    validationSchema: WorkforceProfileSchema,
    requiresHITL: false,
  },
  'eea12-section-c-stub': {
    sectionKey: 'eapComparison',
    component: EEA12SectionC,
    validationSchema: EapComparisonSchema,
    requiresHITL: false,
  },
}

export const EEA12_STEP_IDS = Object.keys(EEA12_STEP_REGISTRY)
