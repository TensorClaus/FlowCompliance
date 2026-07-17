import { PlanYearSchema } from '@simplifi/shared'
import { z } from 'zod'
import type { StepRegistry } from '../eea/wizard-types'
import { EEA13StepBarriersRemoval } from './sections/eea13-step-barriers-removal'
import { EEA13StepDeclaration } from './sections/eea13-step-declaration'
import { EEA13StepDisputeMonitoring } from './sections/eea13-step-dispute-monitoring'
import { EEA13StepPlanSetup } from './sections/eea13-step-plan-setup'
import { EEA13StepWorkforceAnalysis } from './sections/eea13-step-workforce-analysis'
import { EEA13StepYearlyPlans } from './sections/eea13-step-yearly-plans'

// Stub validation schemas for draft steps.
// Full schema validation against EEA13Schema occurs at submission time.
const StubSchema = z.unknown()
const YearlyPlansStepSchema = z.object({
  entries: z.array(PlanYearSchema).min(3).max(5),
})

export const EEA13_STEP_REGISTRY: StepRegistry = {
  'eea13-plan-setup': {
    sectionKey: 'planSetup',
    component: EEA13StepPlanSetup,
    validationSchema: StubSchema,
    requiresHITL: false,
  },
  'eea13-workforce': {
    sectionKey: 'workforceAnalysis',
    component: EEA13StepWorkforceAnalysis,
    validationSchema: StubSchema,
    requiresHITL: false,
  },
  'eea13-yearly-plans': {
    sectionKey: 'yearlyPlans',
    component: EEA13StepYearlyPlans,
    validationSchema: YearlyPlansStepSchema,
    requiresHITL: false,
  },
  'eea13-barriers-stub': {
    sectionKey: 'barriersRemovalPlan',
    component: EEA13StepBarriersRemoval,
    validationSchema: StubSchema,
    requiresHITL: false,
  },
  'eea13-dispute-monitoring': {
    sectionKey: 'disputeResolution',
    component: EEA13StepDisputeMonitoring,
    validationSchema: StubSchema,
    requiresHITL: false,
  },
  'eea13-declaration': {
    sectionKey: 'ceoDeclaration',
    component: EEA13StepDeclaration,
    validationSchema: StubSchema,
    requiresHITL: false,
  },
}

export const EEA13_STEP_IDS = Object.keys(EEA13_STEP_REGISTRY)
