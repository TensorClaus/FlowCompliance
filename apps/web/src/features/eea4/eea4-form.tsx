import {
  EEA4FormSchema,
  type EEA4Form,
  type EEA4Report,
  type EmployerProfile,
  type EEAEvent,
  type EEAFormStatus,
  type OccupationalMatrix,
} from '@simplifi/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useEEAAutosave } from '../eea/hooks/use-eea-autosave'
import { WizardFormContext } from '../eea/wizard-form-context'
import type { StepId } from '../eea/wizard-types'
import { EEA4_STEP_IDS, EEA4_STEP_REGISTRY } from './eea4-step-registry'
import { EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID } from './sections/section-c-prefill'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal descriptor for available EEA2 forms shown in the picker.
 * The route provides this list; the form does not fetch it internally.
 */
export interface EEA2Descriptor {
  id: string
  reportingYear: number
  status: string
  /** Employer profile snapshot — used to populate sectionA on link. */
  employerProfile: EmployerProfile
  workforceProfile?: OccupationalMatrix
  /**
   * Full EEA2 FORM WRAPPER ({ id, report, status }) for this descriptor.
   * The cross-form validation engine needs the whole linked EEA2 document
   * (Rule 2 reads the wrapper id; the headcount rule reads
   * report.sectionB.workforceProfile). The route builds this; the matrix-only
   * `workforceProfile` key above stays the data source for Sections C/D.
   */
  form?: unknown
}

export interface EEA4FormProps {
  /** Unique EEA4 form ID (UUID). */
  formId: string
  /** Tenant scoping. */
  tenantId: string
  /** Reporting year for this EEA4. */
  reportingYear: number
  /**
   * Available EEA2 forms for this tenant/period — provided by the route layer
   * so the form component stays free of fetch logic.
   */
  availableEEA2Forms: EEA2Descriptor[]
  /**
   * Initial persisted form document.
   * When undefined the form starts as a blank draft.
   * Zod-parsed on entry; invalid payloads are treated as blank draft.
   */
  initialForm?: unknown
  /** Override the autosave endpoint (useful in tests). */
  autosaveEndpoint?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Coerce an unknown payload into a typed EEA4Form. Returns null on failure. */
function parseForm(raw: unknown): EEA4Form | null {
  const result = EEA4FormSchema.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Derive the sectionA snapshot from an EEA2 employerProfile.
 * Snapshot is taken once at link time — later drift is the cross-validator's
 * job (task_07). This function is NOT called on re-render; it is called only
 * when the user selects an EEA2 in the picker.
 */
function snapshotEmployerProfile(profile: EmployerProfile): EmployerProfile {
  // Return a shallow copy so mutations to the source cannot affect the snapshot.
  return { ...profile }
}

function buildAutosaveEvent(form: EEA4Form, tenantId: string): EEAEvent {
  return {
    eventId: crypto.randomUUID(),
    tenantId,
    formType: 'EEA4',
    formId: form.id,
    eventType: 'FIELD_UPDATED',
    fieldPath: 'eea4.document',
    previousValue: null,
    newValue: form.report as unknown as Record<string, unknown>,
    metadata: {
      triggeredBy: 'browser-session',
      ip: '0.0.0.0',
      userAgent: typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent,
      sessionId: form.id,
      reason: 'manual_edit',
    },
    timestamp: new Date(),
  }
}

const stepLabels: Record<string, string> = {
  'eea4-section-c': 'Section C — Remuneration matrix',
  'eea4-section-d1': 'Section D1 — Highest-paid employees',
  'eea4-section-d2': 'Section D2 — Lowest-paid employees',
  'eea4-section-e': 'Section E — Median and income gap',
  'eea4-declaration': 'Declaration — CEO sign-off',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EEA2Picker({
  availableEEA2Forms,
  onSelect,
}: {
  availableEEA2Forms: EEA2Descriptor[]
  onSelect: (descriptor: EEA2Descriptor) => void
}) {
  if (availableEEA2Forms.length === 0) {
    return (
      <div
        className="rounded border border-amber-300 bg-amber-50 px-6 py-8 text-center"
        data-testid="eea4-eea2-empty-state"
      >
        <p className="mb-2 text-sm font-semibold text-amber-900">No EEA2 found for this period</p>
        <p className="mb-4 text-sm text-amber-800">
          An EEA2 Annual Report must be completed before an EEA4 Income Differential Statement can
          be started. The EEA4 snapshots the employer profile and headcount data from the linked
          EEA2.
        </p>
        <a
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          href="/eea2/new"
        >
          Complete EEA2 first
        </a>
      </div>
    )
  }

  return (
    <div className="grid gap-3" data-testid="eea4-eea2-picker">
      <p className="text-sm text-slate-700">
        Select the EEA2 Annual Report this Income Differential Statement is linked to. The employer
        profile will be snapshotted from the selected EEA2 and rendered read-only in Section A.
      </p>
      <ul className="grid gap-2">
        {availableEEA2Forms.map((descriptor) => (
          <li key={descriptor.id}>
            <button
              className="flex w-full items-center justify-between rounded border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-slate-400"
              data-testid={`eea4-eea2-option-${descriptor.id}`}
              onClick={() => {
                onSelect(descriptor)
              }}
              type="button"
            >
              <span className="font-medium">{descriptor.employerProfile.tradeName}</span>
              <span className="text-slate-500">
                {descriptor.reportingYear} · {descriptor.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SectionAReadOnly({
  profile,
  linkedEEA2Id,
  reportingYear,
}: {
  profile: EmployerProfile
  linkedEEA2Id: string
  reportingYear: number
}) {
  return (
    <section
      aria-label="Section A — Employer profile"
      className="grid gap-4"
      data-testid="eea4-section-a"
    >
      <div className="rounded border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
        Snapshot from linked EEA2 — source of truth: EEA2 &middot; ID:{' '}
        <span className="font-mono">{linkedEEA2Id}</span> &middot; Period: {reportingYear}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ReadOnlyField label="Trading name" value={profile.tradeName} />
        <ReadOnlyField label="DTI registration name" value={profile.dtiRegistrationName} />
        <ReadOnlyField label="DTI registration number" value={profile.dtiRegistrationNumber} />
        <ReadOnlyField label="PAYE SARS number" value={profile.payeSarsNumber} />
        <ReadOnlyField label="UIF reference number" value={profile.uifReferenceNumber} />
        <ReadOnlyField label="Industry sector" value={profile.industrySector} />
        <ReadOnlyField label="Province" value={profile.province ?? '—'} />
        <ReadOnlyField label="CEO name" value={profile.ceoName} />
        <ReadOnlyField label="Senior manager" value={profile.seniorManagerName} />
      </div>
    </section>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string | number | boolean }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        {String(value)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

/**
 * EEA4 Income Differential form shell.
 *
 * Responsibility split:
 * - This file owns: routing gate (EEA2 picker / empty state), Section A snapshot,
 *   WizardFormContext provision, step navigation, autosave wiring.
 * - Later tasks own: Section C, D1, D2, E real implementations, Declaration HITL.
 *
 * Linkage gate (rule xform:eea4-requires-eea2):
 *   Until `linkedEEA2Id` is set in the report, all content sections are
 *   locked and only the EEA2 picker is shown. Linking is a one-time write per
 *   form document — the picker disappears once a selection is made.
 *
 * Section A snapshot:
 *   Taken once at link time from the selected EEA2's `employerProfile`.
 *   Not re-synced on subsequent renders — drift detection is task_07's job.
 *
 * Autosave:
 *   The entire form document is flushed through `useEEAAutosave` against
 *   EEA4FormSchema. `form.status` mirrors `report.status` at all times so
 *   indexed queries never need to deserialise the full payload.
 */
export function EEA4Form({
  formId,
  tenantId,
  reportingYear,
  availableEEA2Forms,
  initialForm,
  autosaveEndpoint,
}: EEA4FormProps) {
  // ---- Parse / initialise form document -----------------------------------

  const parsedInitial = useMemo(() => parseForm(initialForm), [initialForm])

  const [form, setForm] = useState<EEA4Form>(() => {
    if (parsedInitial !== null) {
      return parsedInitial
    }
    // Blank draft — linkedEEA2Id deliberately omitted; will be set at link time.
    return {
      id: formId,
      status: 'draft' as EEAFormStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
      report: {
        tenantId,
        linkedEEA2Id: '',
        sectionA: null as unknown as EmployerProfile,
        sectionC: {} as EEA4Report['sectionC'],
        sectionD1: {} as EEA4Report['sectionD1'],
        sectionD2: {} as EEA4Report['sectionD2'],
        sectionE: {
          median: 0,
          top5pctRange: { lowest: 0, highest: 0 },
          bottom5pctRange: { lowest: 0, highest: 0 },
        },
        status: 'draft' as EEAFormStatus,
      },
    }
  })

  const isLinked =
    form.report.linkedEEA2Id.length > 0 &&
    (form.report.sectionA as EEA4Report['sectionA'] | null) !== null

  // ---- Autosave -----------------------------------------------------------

  const { autosave, isSaving } = useEEAAutosave({
    endpoint: autosaveEndpoint ?? '/api/event-store/append',
    retryOnFailure: true,
  })

  // Track last-saved serialisation to avoid redundant flushes.
  const lastSavedRef = useRef('')

  const triggerAutosave = useCallback(
    (nextForm: EEA4Form) => {
      const serialised = JSON.stringify(nextForm.report)
      if (serialised === lastSavedRef.current) {
        return
      }
      lastSavedRef.current = serialised
      void autosave(buildAutosaveEvent(nextForm, tenantId))
    },
    [autosave, tenantId],
  )

  // ---- EEA2 linking -------------------------------------------------------

  const handleLinkEEA2 = useCallback(
    (descriptor: EEA2Descriptor) => {
      const snapshot = snapshotEmployerProfile(descriptor.employerProfile)
      if (descriptor.workforceProfile !== undefined) {
        setFormState((previous) => ({
          ...previous,
          [EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID]: descriptor.workforceProfile,
        }))
      }
      setForm((previous) => {
        const next: EEA4Form = {
          ...previous,
          updatedAt: new Date(),
          report: {
            ...previous.report,
            linkedEEA2Id: descriptor.id,
            sectionA: snapshot,
          },
        }
        triggerAutosave(next)
        return next
      })
    },
    [triggerAutosave],
  )

  // ---- Step navigation (mirrors EEAWizard pattern) ------------------------

  const [currentStep, setCurrentStep] = useState(EEA4_STEP_IDS[0] ?? 'eea4-section-c')
  const [formState, setFormState] = useState<Record<StepId, unknown>>(() => {
    if (parsedInitial === null) {
      return {}
    }

    const state: Record<StepId, unknown> = {
      'eea4-section-c': parsedInitial.report.sectionC,
    }
    const linked = availableEEA2Forms.find(
      (descriptor) => descriptor.id === parsedInitial.report.linkedEEA2Id,
    )
    if (linked?.workforceProfile !== undefined) {
      state[EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID] = linked.workforceProfile
    }
    return state
  })

  const setStepData = useCallback(
    (stepId: StepId, updater: object | ((previous: unknown) => unknown)) => {
      setFormState((previous) => {
        const previousData = previous[stepId]
        const nextData: unknown = typeof updater === 'function' ? updater(previousData) : updater
        if (nextData === previousData) {
          return previous
        }
        const next = { ...previous, [stepId]: nextData }

        // Mirror step data into the report and trigger autosave.
        setForm((previousForm) => {
          const registryEntry = EEA4_STEP_REGISTRY[stepId]
          if (registryEntry === undefined) {
            return previousForm
          }
          const nextReport = { ...previousForm.report, [registryEntry.sectionKey]: nextData }
          const nextForm: EEA4Form = {
            ...previousForm,
            updatedAt: new Date(),
            report: nextReport as EEA4Report,
          }
          triggerAutosave(nextForm)
          return nextForm
        })

        return next
      })
    },
    [triggerAutosave],
  )

  useEffect(() => {
    if (!isLinked) {
      return
    }
    const linked = availableEEA2Forms.find(
      (descriptor) => descriptor.id === form.report.linkedEEA2Id,
    )
    if (linked?.workforceProfile === undefined) {
      return
    }
    setFormState((previous) => {
      if (previous[EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID] === linked.workforceProfile) {
        return previous
      }
      return {
        ...previous,
        [EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID]: linked.workforceProfile,
      }
    })
  }, [availableEEA2Forms, form.report.linkedEEA2Id, isLinked])

  const activeIndex = Math.max(EEA4_STEP_IDS.indexOf(currentStep), 0)
  const activeRegistryEntry = EEA4_STEP_REGISTRY[currentStep]
  const ActiveStep = activeRegistryEntry?.component

  // ---- Full linked EEA2 form (for the cross-form declaration gate) ---------
  // The engine needs the whole EEA2 FORM WRAPPER, not just the matrix. The
  // matrix context key (EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID) still drives
  // Sections C/D; this is the wrapper the declaration gate validates against.

  const linkedEEA2Form = useMemo(() => {
    if (form.report.linkedEEA2Id.length === 0) {
      return
    }
    const descriptor = availableEEA2Forms.find((entry) => entry.id === form.report.linkedEEA2Id)
    return descriptor?.form
  }, [availableEEA2Forms, form.report.linkedEEA2Id])

  // ---- WizardFormContext value (same shape as EEAWizard) ------------------

  const formController = useMemo(
    () => ({
      tenantId,
      reportingYear,
      prefillOptions: { autoLoad: false },
      formState,
      setStepData,
      linkedEEA2Form,
      eea4Form: form,
      setEEA4Form: (updater: (previous: unknown) => unknown) => {
        setForm((previous) => {
          const next = updater(previous)
          const nextForm = (isRecord(next) ? next : previous) as EEA4Form
          triggerAutosave(nextForm)
          return nextForm
        })
      },
    }),
    [tenantId, reportingYear, formState, setStepData, linkedEEA2Form, form, triggerAutosave],
  )

  // Placeholder wizard-context — sections C/D/E/Declaration will populate flags.
  const wizardContext = useMemo(
    () => ({
      disabilityFlagActive: false,
      barrierTerminationFlag: false,
      accommodationOverdueFlag: false,
      sectionBTotals: null,
    }),
    [],
  )

  // Ensure form.status === report.status at all times.
  useEffect(() => {
    if (form.status !== form.report.status) {
      setForm((previous) => ({ ...previous, status: previous.report.status }))
    }
  }, [form.status, form.report.status])

  // ---- Render -------------------------------------------------------------

  return (
    <WizardFormContext.Provider value={formController}>
      <section
        className="mx-auto flex w-full max-w-5xl flex-col gap-5 border border-slate-200 bg-white p-6"
        data-testid="eea4-form-shell"
      >
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900">
              EEA4 Income Differential Statement
            </h1>
            <p className="text-sm text-slate-500">
              Form ID: <span className="font-mono text-xs">{formId}</span>
              {isSaving ? <span className="ml-2 text-amber-600"> · Saving…</span> : null}
            </p>
          </div>

          {/* Step nav — only shown when linked */}
          {isLinked ? (
            <>
              <p className="text-sm font-semibold text-slate-700">
                Step {activeIndex + 1} of {EEA4_STEP_IDS.length}
              </p>
              <p className="text-sm text-slate-600">{stepLabels[currentStep]}</p>
              <nav aria-label="EEA4 form steps" className="flex flex-wrap gap-2">
                {EEA4_STEP_IDS.map((stepId, stepIndex) => (
                  <button
                    aria-current={currentStep === stepId ? 'step' : undefined}
                    aria-label={stepLabels[stepId]}
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
            </>
          ) : null}
        </header>

        {/* ---- Linkage gate ---- */}
        {isLinked ? (
          <>
            {/* ---- Section A snapshot ---- */}
            <SectionAReadOnly
              linkedEEA2Id={form.report.linkedEEA2Id}
              profile={form.report.sectionA}
              reportingYear={reportingYear}
            />

            {/* ---- Active step (C / D1 / D2 / E / Declaration stubs) ---- */}
            {ActiveStep === undefined ? null : (
              <ActiveStep
                completedSteps={new Set<StepId>()}
                formId={formId}
                goToStep={setCurrentStep}
                isLocked={false}
                onAdvance={() => {
                  const nextIndex = activeIndex + 1
                  const nextStep = EEA4_STEP_IDS[nextIndex]
                  if (nextStep !== undefined) {
                    setCurrentStep(nextStep)
                  }
                }}
                updateWizardContext={() => {}}
                wizardContext={wizardContext}
              />
            )}

            {/* ---- Navigation footer ---- */}
            <footer className="flex items-center gap-2 border-t border-slate-200 pt-4">
              <button
                className="rounded border border-slate-300 px-3 py-2 text-sm font-medium"
                disabled={activeIndex === 0}
                onClick={() => {
                  const prevStep = EEA4_STEP_IDS[activeIndex - 1]
                  if (prevStep !== undefined) {
                    setCurrentStep(prevStep)
                  }
                }}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  const nextStep = EEA4_STEP_IDS[activeIndex + 1]
                  if (nextStep !== undefined) {
                    setCurrentStep(nextStep)
                  }
                }}
                type="button"
              >
                {activeIndex === EEA4_STEP_IDS.length - 1 ? 'Submit' : 'Next'}
              </button>
            </footer>
          </>
        ) : (
          <div data-testid="eea4-linkage-gate">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              Link to an EEA2 Annual Report
            </h2>
            <EEA2Picker availableEEA2Forms={availableEEA2Forms} onSelect={handleLinkEEA2} />
          </div>
        )}
      </section>
    </WizardFormContext.Provider>
  )
}
