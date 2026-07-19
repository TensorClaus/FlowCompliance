import type { BarriersRemovalPlan, BarrierSeverity } from '@simplifi/shared'
import { BarriersRemovalPlanSchema } from '@simplifi/shared'
import React, { useEffect, useRef } from 'react'
import { BarrierCategoryBlock } from '../../eea/components/barrier-category-block'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import { seedRemovalPlan } from '../prefill-barriers'
import type { EEA13PrefillSource } from './eea13-step-workforce-analysis'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_ID = 'eea13-barriers'
const PREFILL_SOURCE_STEP_ID = 'eea13-prefill-source'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/**
 * Per-row provenance metadata stored alongside the plan entries.
 * Never written to the schema-validated output; used only for display.
 */
interface RowMeta {
  /** True when this row was seeded from an EEA12 barrier entry. */
  fromSeed: boolean
  /** Severity of the source EEA12 entry (undefined for user-added rows). */
  seedSeverity?: BarrierSeverity
}

export interface EEA13BarriersStepData {
  entries: BarriersRemovalPlan[]
  meta: RowMeta[]
}

// ---------------------------------------------------------------------------
// Blank row factory
// ---------------------------------------------------------------------------

function blankPlan(): BarriersRemovalPlan {
  return {
    barrierCategory: 'other',
    action: '',
    responsible: '',
    timeline: '',
    measurableOutcome: '',
  }
}

function blankMeta(): RowMeta {
  return { fromSeed: false }
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<BarrierSeverity, string> = {
  high: 'inline-flex items-center rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800',
  medium:
    'inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800',
  low: 'inline-flex items-center rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-800',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EEA13 Step 4 — Barriers Removal Plan.
 *
 * ONE-TIME SEED:
 *   On first mount, if formState['eea13-barriers'] is empty AND a linked EEA12
 *   prefill source exists in formState['eea13-prefill-source'], the step seeds
 *   an initial set of BarriersRemovalPlan stubs via seedRemovalPlan(). This
 *   seed fires once and is then stored in formState. Any subsequent edits to
 *   the EEA12 data do NOT propagate here — the seed is a snapshot, not a live
 *   sync (rule: editing EEA12 after EEA13 creation must NOT mutate EEA13).
 *
 * Row rendering:
 *   - Each row is rendered via BarrierCategoryBlock mode='removal-plan'.
 *   - Seeded rows show a provenance caption 'From EEA12 {period}' and the
 *     source severity chip if the source severity was 'high'.
 *
 * Add / remove:
 *   - "Add row" appends a blank BarriersRemovalPlan.
 *   - Remove is enabled only when there are more than 1 row (schema min 1).
 *
 * Completion:
 *   - "Next" is blocked unless every row parses under BarriersRemovalPlanSchema.
 *   - BarrierCategoryBlock already blocks 'ongoing' inline; remaining Zod
 *     issues (empty required fields) are surfaced in a save-attempt error list.
 */
export function EEA13StepBarriersRemoval({ onAdvance }: StepProps): React.ReactElement {
  const { formState, setStepData } = useWizardFormController()

  const prefill = formState[PREFILL_SOURCE_STEP_ID] as EEA13PrefillSource | undefined
  const raw = formState[STEP_ID] as EEA13BarriersStepData | undefined

  // ---- ONE-TIME SEED -------------------------------------------------------
  // Guard ref ensures we seed at most once, even under React StrictMode double
  // invocation of effects. The actual guard is whether raw is undefined at read
  // time — but we also track whether we've already enqueued a seed this mount.
  const seededRef = useRef(false)

  useEffect(() => {
    if (seededRef.current) return
    if (raw !== undefined) return
    seededRef.current = true

    if (
      prefill === undefined ||
      prefill.barrierEntries === undefined ||
      prefill.barrierEntries.length === 0
    ) {
      // No EEA12 data — start with a single blank row.
      setStepData(STEP_ID, {
        entries: [blankPlan()],
        meta: [blankMeta()],
      } satisfies EEA13BarriersStepData)
      return
    }

    const { plans } = seedRemovalPlan(prefill.barrierEntries)

    // Build meta: carry severity from source entries, keyed by the same sort
    // order that seedRemovalPlan used (high first, then medium, then low, first
    // entry of each category wins).
    const SEVERITY_ORDER: Record<BarrierSeverity, number> = { high: 0, medium: 1, low: 2 }
    const sorted = [...prefill.barrierEntries].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
    )
    const seenCategories = new Set<string>()
    const metas: RowMeta[] = []
    for (const entry of sorted) {
      if (seenCategories.has(entry.category)) continue
      seenCategories.add(entry.category)
      metas.push({ fromSeed: true, seedSeverity: entry.severity })
    }

    setStepData(STEP_ID, {
      entries: plans,
      meta: metas,
    } satisfies EEA13BarriersStepData)
    // Intentional empty-dep array: seed fires exactly once on mount.
    // prefill and raw are captured at mount time — this is the one-time-seed
    // contract; later changes to formState must NOT re-trigger the seed.
  }, [])

  // ---- Derive display data -------------------------------------------------

  const data: EEA13BarriersStepData = raw ?? {
    entries: [],
    meta: [],
  }

  // ---- Validation ----------------------------------------------------------

  const [saveAttempted, setSaveAttempted] = React.useState(false)

  const validationErrors: string[] = React.useMemo(() => {
    if (!saveAttempted) return []
    const errors: string[] = []
    for (const [index, entry] of data.entries.entries()) {
      const result = BarriersRemovalPlanSchema.safeParse(entry)
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push(`Row ${(index + 1).toString()}: ${issue.message}`)
        }
      }
    }
    return errors
  }, [saveAttempted, data.entries])

  const allRowsValid = React.useMemo(
    () =>
      data.entries.length > 0 &&
      data.entries.every((e) => BarriersRemovalPlanSchema.safeParse(e).success),
    [data.entries],
  )

  // ---- Handlers ------------------------------------------------------------

  function updateEntry(index: number, next: BarriersRemovalPlan): void {
    const nextEntries = data.entries.map((e, i) => (i === index ? next : e))
    setStepData(STEP_ID, { ...data, entries: nextEntries })
  }

  function removeEntry(index: number): void {
    if (data.entries.length <= 1) return
    const nextEntries = data.entries.filter((_, i) => i !== index)
    const nextMeta = data.meta.filter((_, i) => i !== index)
    setStepData(STEP_ID, { entries: nextEntries, meta: nextMeta })
  }

  function addEntry(): void {
    setStepData(STEP_ID, {
      entries: [...data.entries, blankPlan()],
      meta: [...data.meta, blankMeta()],
    })
  }

  const canRemove = data.entries.length > 1

  // ---- Render --------------------------------------------------------------

  const periodLabel = prefill?.periodLabel ?? ''

  return (
    <section aria-label="Barriers Removal Plan" data-testid="eea13-step-barriers">
      <h2 className="mb-1 text-base font-semibold text-slate-800">
        Step 4 — Barriers Removal Plan
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        Link barrier categories identified in the EEA12 Barriers Analysis to concrete removal
        actions, responsible parties, and measurable outcomes. &quot;Ongoing&quot; timelines are
        rejected by the schema — every action requires a concrete date (EEA Regulation 4).
      </p>

      {/* Seed provenance notice */}
      {data.entries.some((_, i) => data.meta[i]?.fromSeed) && periodLabel.length > 0 ? (
        <div
          className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800"
          data-testid="eea13-barriers-seed-notice"
        >
          Pre-seeded from EEA12 {periodLabel}. All fields remain editable. Editing the EEA12 after
          this point will not update these rows.
        </div>
      ) : null}

      {/* Row list */}
      <div className="grid gap-6">
        {data.entries.map((entry, index) => {
          const rowMeta = data.meta[index]
          const isHighSeveritySeed = rowMeta?.fromSeed === true && rowMeta.seedSeverity === 'high'

          return (
            <div key={index} data-testid={`eea13-barrier-row-${(index + 1).toString()}`}>
              {/* Per-row provenance + severity header */}
              {rowMeta?.fromSeed === true ? (
                <div
                  className="mb-2 flex flex-wrap items-center gap-2"
                  data-testid={`eea13-barrier-row-${(index + 1).toString()}-provenance`}
                >
                  <span className="text-xs text-slate-500">From EEA12 {periodLabel}</span>
                  {isHighSeveritySeed ? (
                    <span
                      className={SEVERITY_BADGE.high}
                      data-testid={`eea13-barrier-row-${(index + 1).toString()}-high-marker`}
                    >
                      high severity
                    </span>
                  ) : null}
                  {!isHighSeveritySeed && rowMeta.seedSeverity !== undefined ? (
                    <span className={SEVERITY_BADGE[rowMeta.seedSeverity]}>
                      {rowMeta.seedSeverity} severity
                    </span>
                  ) : null}
                </div>
              ) : null}

              <BarrierCategoryBlock
                mode="removal-plan"
                onChange={(next) => {
                  updateEntry(index, next)
                }}
                value={entry}
                {...(canRemove
                  ? {
                      onRemove: () => {
                        removeEntry(index)
                      },
                    }
                  : {})}
              />
            </div>
          )
        })}
      </div>

      {/* Add row */}
      <div className="mt-4">
        <button
          className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          data-testid="eea13-barriers-add-row"
          onClick={addEntry}
          type="button"
        >
          Add removal action
        </button>
      </div>

      {/* Validation errors surfaced on save attempt */}
      {saveAttempted && validationErrors.length > 0 ? (
        <ul
          className="mt-4 grid gap-1 rounded border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800"
          data-testid="eea13-barriers-validation-errors"
          role="alert"
        >
          {validationErrors.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="eea13-barriers-next"
          onClick={() => {
            setSaveAttempted(true)
            if (allRowsValid) onAdvance()
          }}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  )
}
