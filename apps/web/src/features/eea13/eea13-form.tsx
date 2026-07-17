import type { EEAEvent } from '@simplifi/shared'
import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useEEAAutosave } from '../eea/hooks/use-eea-autosave'
import { WizardFormContext } from '../eea/wizard-form-context'
import type { StepId } from '../eea/wizard-types'
import { EEA13_STEP_IDS, EEA13_STEP_REGISTRY } from './eea13-step-registry'
import type { EEA13PlanSetupData } from './eea13-types'
import type { EEA13PrefillSource } from './sections/eea13-step-workforce-analysis'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EEA13FormProps {
  /** Unique EEA13 form ID (UUID). */
  formId: string
  /** Tenant scoping. */
  tenantId: string
  /**
   * Optional EEA12 decompose result to prefill the Workforce Analysis step.
   * When provided, totalEmployees, designatedEmployees and foreignNationals are
   * derived from the rows and foreignNationals summary and shown read-only until
   * the user edits them.
   */
  linkedEEA12Prefill?: EEA13PrefillSource
  /** Override the autosave endpoint (useful in tests). */
  autosaveEndpoint?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAutosaveEvent(formId: string, tenantId: string, payload: unknown): EEAEvent {
  return {
    eventId: crypto.randomUUID(),
    tenantId,
    formType: 'EEA13',
    formId,
    eventType: 'FIELD_UPDATED',
    fieldPath: 'eea13.document',
    previousValue: null,
    newValue: payload as Record<string, unknown>,
    metadata: {
      triggeredBy: 'browser-session',
      ip: '0.0.0.0',
      userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
      sessionId: formId,
      reason: 'manual_edit',
    },
    timestamp: new Date(),
  }
}

const STEP_LABELS: Record<string, string> = {
  'eea13-plan-setup': 'Step 1 — Plan Setup',
  'eea13-workforce': 'Step 2 — Workforce Analysis',
  'eea13-yearly-plans': 'Step 3 — Yearly Plans',
  'eea13-barriers-stub': 'Step 4 — Barriers Removal',
  'eea13-dispute-monitoring': 'Step 5 — Dispute Resolution and Monitoring',
  'eea13-declaration': 'Step 6 — Declaration',
}

// Internal key for the EEA12 prefill source stored in formState.
const PREFILL_STEP_KEY = 'eea13-prefill-source'

// ---------------------------------------------------------------------------
// Sector gate check
// ---------------------------------------------------------------------------

/**
 * Returns true when the Plan Setup step has a valid sector code.
 * Later steps (Yearly Plans, in particular) cannot function without a sector
 * because the goals editor depends on GN 6124 sector targets.
 */
function planSetupHasSector(formState: Record<StepId, unknown>): boolean {
  const setup = formState['eea13-plan-setup'] as EEA13PlanSetupData | undefined
  return (setup?.sectorCode ?? '').length > 0
}

// ---------------------------------------------------------------------------
// Main form shell
// ---------------------------------------------------------------------------

/**
 * EEA13 5-Year Employment Equity Plan builder shell.
 *
 * Responsibilities:
 *  - WizardFormContext provision for all six steps.
 *  - Step navigation: forward gated on sector selection (Plan Setup) for steps
 *    3+ (Yearly Plans cannot run without a sector code).
 *  - Autosave on every step data change via useEEAAutosave.
 *  - EEA12 prefill source injected into formState so Workforce Analysis can
 *    derive totalEmployees / designatedEmployees / foreignNationals.
 *
 * Compliance surface:
 *  - The consultation banner in Plan Setup is rendered by EEA13StepPlanSetup
 *    and cannot be bypassed by any prop from this shell.
 *  - The sector requirement gate cannot be bypassed by any prop from this shell.
 */
export function EEA13Form({
  formId,
  tenantId,
  linkedEEA12Prefill,
  autosaveEndpoint,
}: EEA13FormProps): React.ReactElement {
  // ---- Step navigation ----------------------------------------------------

  const [currentStep, setCurrentStep] = useState(EEA13_STEP_IDS[0] ?? 'eea13-plan-setup')
  const activeIndex = Math.max(EEA13_STEP_IDS.indexOf(currentStep), 0)

  // ---- Form state ---------------------------------------------------------

  const [formState, setFormState] = useState<Record<StepId, unknown>>(() => {
    const initial: Record<StepId, unknown> = {}
    if (linkedEEA12Prefill !== undefined) {
      initial[PREFILL_STEP_KEY] = linkedEEA12Prefill
    }
    return initial
  })

  // ---- Autosave -----------------------------------------------------------

  const { autosave, isSaving } = useEEAAutosave({
    endpoint: autosaveEndpoint ?? '/api/event-store/append',
    retryOnFailure: true,
  })

  const lastSavedRef = useRef('')

  const triggerAutosave = useCallback(
    (nextState: Record<StepId, unknown>) => {
      const payload = { formId, formState: nextState }
      const serialised = JSON.stringify(payload)
      if (serialised === lastSavedRef.current) return
      lastSavedRef.current = serialised
      void autosave(buildAutosaveEvent(formId, tenantId, payload))
    },
    [autosave, formId, tenantId],
  )

  const setStepData = useCallback(
    (stepId: StepId, updater: object | ((previous: unknown) => unknown)) => {
      setFormState((previous) => {
        const previousData = previous[stepId]
        const nextData: unknown = typeof updater === 'function' ? updater(previousData) : updater
        if (nextData === previousData) return previous
        const next = { ...previous, [stepId]: nextData }
        triggerAutosave(next)
        return next
      })
    },
    [triggerAutosave],
  )

  // ---- Navigation gate ----------------------------------------------------

  /**
   * Steps 3+ (Yearly Plans onwards) are locked until the Plan Setup step has
   * a valid sector code. The goals editor cannot function without a sector.
   */
  const canNavigateToStep = useCallback(
    (stepIndex: number): boolean => {
      // Steps 0–1 are always navigable.
      if (stepIndex <= 1) return true
      // Steps 2+ require a sector to be selected.
      return planSetupHasSector(formState)
    },
    [formState],
  )

  const hasSector = planSetupHasSector(formState)

  // ---- WizardFormContext --------------------------------------------------

  const formController = useMemo(
    () => ({
      tenantId,
      reportingYear: new Date().getFullYear(),
      prefillOptions: { autoLoad: false },
      formState,
      setStepData,
    }),
    [tenantId, formState, setStepData],
  )

  const wizardContext = useMemo(
    () => ({
      disabilityFlagActive: false,
      barrierTerminationFlag: false,
      accommodationOverdueFlag: false,
      sectionBTotals: null,
    }),
    [],
  )

  // ---- Active step --------------------------------------------------------

  const activeRegistryEntry = EEA13_STEP_REGISTRY[currentStep]
  const ActiveStep = activeRegistryEntry?.component

  const canGoForward = activeIndex < EEA13_STEP_IDS.length - 1 && canNavigateToStep(activeIndex + 1)

  return (
    <WizardFormContext.Provider value={formController}>
      <section
        className="mx-auto flex w-full max-w-5xl flex-col gap-5 border border-slate-200 bg-white p-6"
        data-testid="eea13-form-shell"
      >
        {/* Header */}
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900">
              EEA13 — 5-Year Employment Equity Plan
            </h1>
            <p className="text-sm text-slate-500">
              Form ID: <span className="font-mono text-xs">{formId}</span>
              {isSaving ? <span className="ml-2 text-amber-600"> · Saving…</span> : null}
            </p>
            <p className="text-xs text-slate-400">
              GN 6124 mandatory sector targets apply 2025–2029. Penalties under EEA s.65: up to
              R2,700,000 or 10% of annual turnover on repeated offences.
            </p>
          </div>

          {/* Sector gate banner — shown when steps 3+ would be blocked */}
          {hasSector ? null : (
            <div
              className="rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800"
              data-testid="eea13-sector-gate-banner"
            >
              Select a sector in Step 1 to unlock Yearly Plans and later steps. GN 6124 numerical
              goal targets are sector-specific and cannot be computed without it.
            </div>
          )}

          {/* Step indicator */}
          <p className="text-sm font-semibold text-slate-700">
            Step {(activeIndex + 1).toString()} of {EEA13_STEP_IDS.length.toString()}
          </p>
          <p className="text-sm text-slate-600">{STEP_LABELS[currentStep]}</p>

          {/* Step navigation */}
          <nav aria-label="EEA13 form steps" className="flex flex-wrap gap-2">
            {EEA13_STEP_IDS.map((stepId, stepIndex) => {
              const isLocked = !canNavigateToStep(stepIndex)
              return (
                <button
                  aria-current={currentStep === stepId ? 'step' : undefined}
                  aria-disabled={isLocked}
                  aria-label={STEP_LABELS[stepId]}
                  className="h-9 w-9 rounded border border-slate-300 text-sm font-medium aria-[current=step]:border-slate-900 aria-[current=step]:bg-slate-900 aria-[current=step]:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isLocked}
                  key={stepId}
                  onClick={() => {
                    if (!isLocked) setCurrentStep(stepId)
                  }}
                  type="button"
                >
                  {(stepIndex + 1).toString()}
                </button>
              )
            })}
          </nav>
        </header>

        {/* Active step content */}
        {ActiveStep === undefined ? null : (
          <ActiveStep
            completedSteps={new Set<StepId>()}
            formId={formId}
            goToStep={setCurrentStep}
            isLocked={false}
            onAdvance={() => {
              if (!canGoForward) return
              const nextStep = EEA13_STEP_IDS[activeIndex + 1]
              if (nextStep !== undefined) setCurrentStep(nextStep)
            }}
            updateWizardContext={() => {}}
            wizardContext={wizardContext}
          />
        )}

        {/* Navigation footer */}
        <footer className="flex items-center gap-2 border-t border-slate-200 pt-4">
          <button
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            disabled={activeIndex === 0}
            onClick={() => {
              const prevStep = EEA13_STEP_IDS[activeIndex - 1]
              if (prevStep !== undefined) setCurrentStep(prevStep)
            }}
            type="button"
          >
            Back
          </button>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="eea13-footer-next"
            disabled={!canGoForward}
            onClick={() => {
              if (!canGoForward) return
              const nextStep = EEA13_STEP_IDS[activeIndex + 1]
              if (nextStep !== undefined) setCurrentStep(nextStep)
            }}
            type="button"
          >
            {activeIndex === EEA13_STEP_IDS.length - 1 ? 'Submit' : 'Next'}
          </button>
        </footer>
      </section>
    </WizardFormContext.Provider>
  )
}
