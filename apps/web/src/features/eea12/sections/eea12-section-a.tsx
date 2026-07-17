import type { BarrierEntry, BarriersAnalysis } from '@simplifi/shared'
import React, { useCallback } from 'react'
import {
  BarrierCategoryBlock,
  buildNilReturnEntry,
} from '../../eea/components/barrier-category-block'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'

const STEP_ID = 'eea12-section-a'

function buildDefaultEntry(): BarrierEntry {
  return {
    category: 'recruitment_procedures',
    description: '',
    severity: 'low',
    affectedDesignatedGroups: [],
    mitigationActions: [''],
    targetCompletionDate: '',
  }
}

/**
 * EEA12 Section A — Barriers Analysis.
 *
 * Renders a list of BarrierEntry records using BarrierCategoryBlock mode='analysis'.
 * Invariant: at least one entry must exist at all times (BarriersAnalysisSchema.min(1)).
 * The remove button is disabled when only one entry remains.
 *
 * The "No barriers identified" button inserts buildNilReturnEntry() only when
 * the list is empty. The button is hidden once any entry exists so it cannot
 * be used to append a nil-return entry alongside real entries.
 */
export function EEA12SectionA({ onAdvance }: StepProps): React.ReactElement {
  const { formState, setStepData } = useWizardFormController()

  const barriers = formState[STEP_ID] as BarriersAnalysis | undefined
  const entries: BarrierEntry[] = barriers?.entries ?? []

  const setEntries = useCallback(
    (nextEntries: BarrierEntry[]) => {
      setStepData(STEP_ID, { entries: nextEntries })
    },
    [setStepData],
  )

  const handleAdd = useCallback(() => {
    setEntries([...entries, buildDefaultEntry()])
  }, [entries, setEntries])

  const handleChange = useCallback(
    (index: number, updated: BarrierEntry) => {
      const next = entries.map((entry, i) => (i === index ? updated : entry))
      setEntries(next)
    },
    [entries, setEntries],
  )

  const handleRemove = useCallback(
    (index: number) => {
      if (entries.length <= 1) return
      setEntries(entries.filter((_, i) => i !== index))
    },
    [entries, setEntries],
  )

  const handleNilReturn = useCallback(() => {
    if (entries.length > 0) return
    setEntries([buildNilReturnEntry()])
  }, [entries, setEntries])

  const handleAdvance = useCallback(() => {
    if (entries.length === 0) return
    onAdvance()
  }, [entries.length, onAdvance])

  const canAdvance = entries.length > 0

  return (
    <section aria-label="Section A — Barriers analysis" data-testid="eea12-section-a">
      <h2 className="mb-1 text-base font-semibold text-slate-800">Section A — Barriers Analysis</h2>
      <p className="mb-4 text-sm text-slate-600">
        Record each barrier to employment equity identified during the annual analysis required by
        EEA s.19(1) and Regulation 4. At least one entry is required — use the &quot;No barriers
        identified&quot; button if no barriers were found.
      </p>

      {/* Min-1 enforcement message */}
      {entries.length === 0 ? (
        <p
          className="mb-3 text-sm text-red-700"
          role="alert"
          data-testid="eea12-section-a-min1-error"
        >
          At least one barrier entry is required. Use &quot;Add barrier&quot; to add one, or click
          &quot;No barriers identified&quot; if none were found.
        </p>
      ) : null}

      {/* Nil return — shown only when list is empty */}
      {entries.length === 0 ? (
        <div className="mb-4">
          <button
            className="rounded border border-slate-400 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            data-testid="eea12-nil-return-btn"
            onClick={handleNilReturn}
            type="button"
          >
            No barriers identified
          </button>
        </div>
      ) : null}

      {/* Entry list */}
      <div className="grid gap-4" data-testid="eea12-section-a-entries">
        {entries.map((entry, index) => (
          <BarrierCategoryBlock
            key={index}
            mode="analysis"
            value={entry}
            onChange={(updated) => {
              handleChange(index, updated)
            }}
            {...(entries.length > 1
              ? {
                  onRemove: () => {
                    handleRemove(index)
                  },
                }
              : {})}
          />
        ))}
      </div>

      {/* Add barrier button */}
      <div className="mt-4">
        <button
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          data-testid="eea12-add-barrier-btn"
          onClick={handleAdd}
          type="button"
        >
          Add barrier
        </button>
      </div>

      {/* Navigation footer */}
      <div className="mt-6 flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canAdvance}
          onClick={handleAdvance}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  )
}
