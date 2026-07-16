import {
  CEODeclarationSchema,
  RemBreakdownMatrixSchema,
  RemunerationMatrixSchema,
  SectionESchema,
} from '@simplifi/shared'
import type { StepRegistry } from '../eea/wizard-types'
import { DeclarationSection } from './declaration/DeclarationSection'
import { SectionCRemuneration } from './sections/SectionCRemuneration'
import { SectionD1HighestPaid } from './sections/SectionD1HighestPaid'
import { SectionD2LowestPaid } from './sections/SectionD2LowestPaid'
import { SectionEMedianGap } from './sections/SectionEMedianGap'

export const EEA4_STEP_REGISTRY: StepRegistry = {
  'eea4-section-c': {
    sectionKey: 'sectionC',
    component: SectionCRemuneration,
    validationSchema: RemunerationMatrixSchema,
    requiresHITL: false,
  },
  'eea4-section-d1': {
    sectionKey: 'sectionD1',
    component: SectionD1HighestPaid,
    validationSchema: RemBreakdownMatrixSchema,
    requiresHITL: false,
  },
  'eea4-section-d2': {
    sectionKey: 'sectionD2',
    component: SectionD2LowestPaid,
    validationSchema: RemBreakdownMatrixSchema,
    requiresHITL: false,
  },
  'eea4-section-e': {
    sectionKey: 'sectionE',
    component: SectionEMedianGap,
    validationSchema: SectionESchema,
    requiresHITL: false,
  },
  'eea4-declaration': {
    sectionKey: 'declaration',
    component: DeclarationSection,
    validationSchema: CEODeclarationSchema,
    requiresHITL: true,
  },
}

export const EEA4_STEP_IDS = Object.keys(EEA4_STEP_REGISTRY)
