import {
  EEA12ReportingPeriodSchema,
  type EapProvince,
  type EEAEvent,
  type OccupationalMatrix,
  type SectorCode,
} from '@simplifi/shared'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEEAAutosave } from '../eea/hooks/use-eea-autosave'
import { WizardFormContext } from '../eea/wizard-form-context'
import type { StepId } from '../eea/wizard-types'
import { EEA12_STEP_IDS, EEA12_STEP_REGISTRY } from './eea12-step-registry'
import {
  EEA12_LINKED_EEA2_DISABILITY_STEP_ID,
  EEA12_LINKED_EEA2_WORKFORCE_STEP_ID,
} from './sections/eea12-section-b'
import { EEA12SectionC } from './sections/eea12-section-c'

/**
 * Step id for the EAP comparison (Section C). The historical key retains the
 * "-stub" suffix from when the section was a placeholder; the component and
 * schema are now the real EAP comparison. Renaming the key would break
 * persisted drafts and step-nav labels, so the key is intentionally kept.
 */
const EEA12_SECTION_C_STEP_ID = 'eea12-section-c-stub'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EEA12FormProps {
  formId: string
  tenantId: string
  /** Linked EEA2 workforce matrix (Table 1.1) — for Section B prefill. */
  linkedEEA2Workforce?: OccupationalMatrix
  /** Linked EEA2 disability matrix (Table 1.2) — for Section B prefill. */
  linkedEEA2Disability?: OccupationalMatrix
  /**
   * Employer province (EAP display name) for Section C EAP lookup. Sourced by
   * the route from the employer profile; EmployerProfile carries an optional
   * province, so this may be undefined — Section C falls back to 'National'.
   */
  province?: EapProvince
  /**
   * GN 6124 sector code for the Section C display-only sector target. Sourced
   * by the route; EmployerProfile has no SectorCode (its industrySector is free
   * text), so it is passed in explicitly and may be undefined.
   */
  sectorCode?: SectorCode
  /** Override autosave endpoint (useful in tests). */
  autosaveEndpoint?: string
}

interface ReportingPeriod {
  startDate: string
  endDate: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAutosaveEvent(formId: string, tenantId: string, payload: unknown): EEAEvent {
  return {
    eventId: crypto.randomUUID(),
    tenantId,
    formType: 'EEA12',
    formId,
    eventType: 'FIELD_UPDATED',
    fieldPath: 'eea12.document',
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
  'eea12-section-a': 'Section A — Barriers analysis',
  'eea12-section-b': 'Section B — Workforce profile',
  'eea12-section-c-stub': 'Section C — EAP comparison',
}

// ---------------------------------------------------------------------------
// Reporting period picker sub-component
// ---------------------------------------------------------------------------

interface ReportingPeriodPickerProps {
  value: ReportingPeriod
  onChange: (next: ReportingPeriod) => void
}

function ReportingPeriodPicker({
  value,
  onChange,
}: ReportingPeriodPickerProps): React.ReactElement {
  const refineResult = EEA12ReportingPeriodSchema.safeParse(value)
  const periodError: string | null = (() => {
    if (value.startDate.length === 0 || value.endDate.length === 0) return null
    if (refineResult.success) return null
    const endDateError = refineResult.error.issues.find((e) => e.path[0] === 'endDate')
    return endDateError?.message ?? 'End date must be after start date'
  })()

  return (
    <div
      className="rounded border border-slate-200 bg-slate-50 px-4 py-4"
      data-testid="eea12-reporting-period"
    >
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Reporting period</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-medium text-slate-600">Start date</span>
          <input
            aria-label="Reporting period start date"
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            onChange={(e) => {
              onChange({ ...value, startDate: e.target.value })
            }}
            type="date"
            value={value.startDate}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-medium text-slate-600">End date</span>
          <input
            aria-invalid={periodError !== null}
            aria-label="Reporting period end date"
            className={`rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              periodError === null
                ? 'border-slate-300 focus:ring-slate-400'
                : 'border-red-400 focus:ring-red-300'
            }`}
            onChange={(e) => {
              onChange({ ...value, endDate: e.target.value })
            }}
            type="date"
            value={value.endDate}
          />
        </label>
      </div>
      {periodError === null ? null : (
        <p className="mt-2 text-xs text-red-700" data-testid="eea12-period-error" role="alert">
          {periodError}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form shell
// ---------------------------------------------------------------------------

/**
 * EEA12 Barriers Analysis and Workforce Profile form shell.
 *
 * Shell responsibilities:
 *  - Reporting period header with inline refine validation
 *  - WizardFormContext provision for Section A, B, C steps
 *  - Step navigation with autosave on each step data change
 *  - Passes linked EEA2 matrices into formState so EEA12SectionB can prefill
 *
 * Step completion:
 *  Section A advances only when entries.length >= 1 (enforced in EEA12SectionA).
 *  The period error blocks step advancement by disabling the step nav buttons
 *  when the period is invalid.
 */
export function EEA12Form({
  formId,
  tenantId,
  linkedEEA2Workforce,
  linkedEEA2Disability,
  province,
  sectorCode,
  autosaveEndpoint,
}: EEA12FormProps): React.ReactElement {
  // ---- Reporting period ---------------------------------------------------

  const [reportingPeriod, setReportingPeriod] = useState({
    startDate: '',
    endDate: '',
  })

  const periodValid = EEA12ReportingPeriodSchema.safeParse(reportingPeriod).success

  // ---- Step navigation ----------------------------------------------------

  const [currentStep, setCurrentStep] = useState(EEA12_STEP_IDS[0] ?? 'eea12-section-a')

  const activeIndex = Math.max(EEA12_STEP_IDS.indexOf(currentStep), 0)

  // ---- Form state ---------------------------------------------------------

  const [formState, setFormState] = useState<Record<StepId, unknown>>(() => {
    const initial: Record<StepId, unknown> = {}
    if (linkedEEA2Workforce !== undefined) {
      initial[EEA12_LINKED_EEA2_WORKFORCE_STEP_ID] = linkedEEA2Workforce
    }
    if (linkedEEA2Disability !== undefined) {
      initial[EEA12_LINKED_EEA2_DISABILITY_STEP_ID] = linkedEEA2Disability
    }
    return initial
  })

  // Keep linked matrices in sync when props change (route re-renders after fetch).
  useEffect(() => {
    setFormState((previous) => {
      const next = { ...previous }
      let changed = false
      if (linkedEEA2Workforce !== previous[EEA12_LINKED_EEA2_WORKFORCE_STEP_ID]) {
        next[EEA12_LINKED_EEA2_WORKFORCE_STEP_ID] = linkedEEA2Workforce
        changed = true
      }
      if (linkedEEA2Disability !== previous[EEA12_LINKED_EEA2_DISABILITY_STEP_ID]) {
        next[EEA12_LINKED_EEA2_DISABILITY_STEP_ID] = linkedEEA2Disability
        changed = true
      }
      return changed ? next : previous
    })
  }, [linkedEEA2Workforce, linkedEEA2Disability])

  // ---- Autosave -----------------------------------------------------------

  const { autosave, isSaving } = useEEAAutosave({
    endpoint: autosaveEndpoint ?? '/api/event-store/append',
    retryOnFailure: true,
  })

  const lastSavedRef = useRef('')

  const triggerAutosave = useCallback(
    (nextState: Record<StepId, unknown>) => {
      const payload = { formId, reportingPeriod, formState: nextState }
      const serialised = JSON.stringify(payload)
      if (serialised === lastSavedRef.current) return
      lastSavedRef.current = serialised
      void autosave(buildAutosaveEvent(formId, tenantId, payload))
    },
    [autosave, formId, tenantId, reportingPeriod],
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

  const activeRegistryEntry = EEA12_STEP_REGISTRY[currentStep]
  const ActiveStep = activeRegistryEntry?.component

  // Period must be valid before user can advance past step 1.
  const canNavigateForward = periodValid

  return (
    <WizardFormContext.Provider value={formController}>
      <section
        className="mx-auto flex w-full max-w-5xl flex-col gap-5 border border-slate-200 bg-white p-6"
        data-testid="eea12-form-shell"
      >
        {/* Header */}
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900">
              EEA12 — Barriers Analysis & Workforce Profile
            </h1>
            <p className="text-sm text-slate-500">
              Form ID: <span className="font-mono text-xs">{formId}</span>
              {isSaving ? <span className="ml-2 text-amber-600"> · Saving…</span> : null}
            </p>
          </div>

          {/* Step navigation */}
          <p className="text-sm font-semibold text-slate-700">
            Step {activeIndex + 1} of {EEA12_STEP_IDS.length}
          </p>
          <p className="text-sm text-slate-600">{STEP_LABELS[currentStep]}</p>
          <nav aria-label="EEA12 form steps" className="flex flex-wrap gap-2">
            {EEA12_STEP_IDS.map((stepId, stepIndex) => (
              <button
                aria-current={currentStep === stepId ? 'step' : undefined}
                aria-label={STEP_LABELS[stepId]}
                className="h-9 w-9 rounded border border-slate-300 text-sm font-medium aria-[current=step]:border-slate-900 aria-[current=step]:bg-slate-900 aria-[current=step]:text-white"
                key={stepId}
                onClick={() => {
                  setCurrentStep(stepId)
                }}
                type="button"
              >
                {stepIndex + 1}
              </button>
            ))}
          </nav>
        </header>

        {/* Reporting period header — always visible */}
        <ReportingPeriodPicker
          onChange={(next) => {
            setReportingPeriod(next)
          }}
          value={reportingPeriod}
        />

        {/* Active step content */}
        {ActiveStep === undefined ? null : currentStep === EEA12_SECTION_C_STEP_ID ? (
          <EEA12SectionC
            completedSteps={new Set<StepId>()}
            formId={formId}
            goToStep={setCurrentStep}
            isLocked={false}
            onAdvance={() => {
              if (!canNavigateForward) return
              const nextStep = EEA12_STEP_IDS[activeIndex + 1]
              if (nextStep !== undefined) {
                setCurrentStep(nextStep)
              }
            }}
            {...(province === undefined ? {} : { province })}
            {...(sectorCode === undefined ? {} : { sectorCode })}
            updateWizardContext={() => {}}
            wizardContext={wizardContext}
          />
        ) : (
          <ActiveStep
            completedSteps={new Set<StepId>()}
            formId={formId}
            goToStep={setCurrentStep}
            isLocked={false}
            onAdvance={() => {
              if (!canNavigateForward) return
              const nextStep = EEA12_STEP_IDS[activeIndex + 1]
              if (nextStep !== undefined) {
                setCurrentStep(nextStep)
              }
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
              const prevStep = EEA12_STEP_IDS[activeIndex - 1]
              if (prevStep !== undefined) setCurrentStep(prevStep)
            }}
            type="button"
          >
            Back
          </button>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canNavigateForward}
            onClick={() => {
              const nextStep = EEA12_STEP_IDS[activeIndex + 1]
              if (nextStep !== undefined) setCurrentStep(nextStep)
            }}
            type="button"
          >
            {activeIndex === EEA12_STEP_IDS.length - 1 ? 'Submit' : 'Next'}
          </button>
        </footer>
      </section>
    </WizardFormContext.Provider>
  )
}
