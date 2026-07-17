import { validateGoalAgainstMinimums, type SectorCode } from '@simplifi/shared'
import React, { useCallback, useId } from 'react'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import type { EEA13PlanSetupData, EEA13YearlyPlansData, PlanYearDraft } from '../eea13-types'
import { GoalsEditor } from './GoalsEditor'
import type { EEA13PrefillSource } from './eea13-step-workforce-analysis'

const STEP_ID = 'eea13-yearly-plans'
const PLAN_SETUP_STEP_ID = 'eea13-plan-setup'
const PREFILL_SOURCE_STEP_ID = 'eea13-prefill-source'

const MIN_YEARS = 3
const MAX_YEARS = 5
const YEAR_OPTIONS = [2025, 2026, 2027, 2028, 2029, 2030] as const

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaultYear(year: number): PlanYearDraft {
  return {
    year,
    goals: [],
    reviewDate: '',
    annualBudget: undefined,
  }
}

function nextAvailableYear(usedYears: Set<number>): number {
  for (const y of YEAR_OPTIONS) {
    if (!usedYears.has(y)) return y
  }
  return YEAR_OPTIONS[0]
}

// ---------------------------------------------------------------------------
// PlanYearEntry sub-component
// ---------------------------------------------------------------------------

interface PlanYearEntryProps {
  entry: PlanYearDraft
  index: number
  usedYears: Set<number>
  sectorCode: string
  prefill: EEA13PrefillSource | undefined
  canRemove: boolean
  onChange: (index: number, updated: PlanYearDraft) => void
  onRemove: (index: number) => void
}

function PlanYearEntry({
  entry,
  index,
  usedYears,
  sectorCode,
  prefill,
  canRemove,
  onChange,
  onRemove,
}: PlanYearEntryProps): React.ReactElement {
  const yearId = useId()
  const reviewDateId = useId()
  const budgetId = useId()
  const entryNum = index + 1

  return (
    <div
      className="rounded border border-slate-200 bg-slate-50 px-4 py-4"
      data-testid={`eea13-plan-year-${entryNum.toString()}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Year {entryNum.toString()}</h3>
        {canRemove ? (
          <button
            aria-label={`Remove plan year ${entryNum.toString()}`}
            className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            data-testid={`eea13-remove-year-${entryNum.toString()}`}
            onClick={() => {
              onRemove(index)
            }}
            type="button"
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Year select — no duplicates */}
        <label className="grid gap-1" htmlFor={yearId}>
          <span className="text-xs font-medium text-slate-600">Calendar year</span>
          <select
            aria-label={`Plan year ${entryNum.toString()} calendar year`}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid={`eea13-year-select-${entryNum.toString()}`}
            id={yearId}
            onChange={(e) => {
              onChange(index, { ...entry, year: Number.parseInt(e.target.value, 10) })
            }}
            value={entry.year}
          >
            {YEAR_OPTIONS.map((y) => (
              <option disabled={usedYears.has(y) && y !== entry.year} key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        {/* Review date */}
        <label className="grid gap-1" htmlFor={reviewDateId}>
          <span className="text-xs font-medium text-slate-600">Annual review date</span>
          <input
            aria-label={`Plan year ${entryNum.toString()} review date`}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid={`eea13-review-date-${entryNum.toString()}`}
            id={reviewDateId}
            onChange={(e) => {
              onChange(index, { ...entry, reviewDate: e.target.value })
            }}
            type="date"
            value={entry.reviewDate}
          />
        </label>

        {/* Budget (optional) */}
        <label className="grid gap-1" htmlFor={budgetId}>
          <span className="text-xs font-medium text-slate-600">Annual budget (ZAR, optional)</span>
          <input
            aria-label={`Plan year ${entryNum.toString()} annual budget`}
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid={`eea13-budget-${entryNum.toString()}`}
            id={budgetId}
            min={0}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10)
              onChange(index, {
                ...entry,
                annualBudget: e.target.value.length === 0 || Number.isNaN(v) ? undefined : v,
              })
            }}
            placeholder="e.g. 500000"
            type="number"
            value={entry.annualBudget ?? ''}
          />
        </label>
      </div>

      {sectorCode.length > 0 ? (
        <GoalsEditor
          entryNum={entryNum}
          goals={entry.goals}
          onChange={(goals) => {
            onChange(index, { ...entry, goals })
          }}
          prefill={prefill}
          sectorCode={sectorCode}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main step component
// ---------------------------------------------------------------------------

/**
 * EEA13 Step 3 — Yearly Plans scaffolding.
 *
 * Accordion of PlanYear entries:
 *  - Min 3, max 5 (add disabled at 5, remove disabled at 3).
 *  - Year select options 2025–2030; duplicate years are disabled in sibling selects.
 *  - Each entry: year select, reviewDate date input, optional annualBudget (ZAR integer).
 *
 * Sector must be selected before this step is reachable (gate enforced in shell).
 */
export function EEA13StepYearlyPlans({ onAdvance }: StepProps): React.ReactElement {
  const { formState, setStepData } = useWizardFormController()

  const raw = formState[STEP_ID] as EEA13YearlyPlansData | undefined
  const planSetup = formState[PLAN_SETUP_STEP_ID] as EEA13PlanSetupData | undefined
  const prefill = formState[PREFILL_SOURCE_STEP_ID] as EEA13PrefillSource | undefined
  const sectorCode = planSetup?.sectorCode ?? ''
  const entries: PlanYearDraft[] = (
    raw?.entries ?? [buildDefaultYear(2025), buildDefaultYear(2026), buildDefaultYear(2027)]
  ).map((entry) => ({ ...entry, goals: entry.goals }))

  const usedYears = new Set(entries.map((e) => e.year))

  const setEntries = useCallback(
    (next: PlanYearDraft[]) => {
      setStepData(STEP_ID, { entries: next })
    },
    [setStepData],
  )

  const handleChange = useCallback(
    (index: number, updated: PlanYearDraft) => {
      setEntries(entries.map((e, i) => (i === index ? updated : e)))
    },
    [entries, setEntries],
  )

  const handleAdd = useCallback(() => {
    if (entries.length >= MAX_YEARS) return
    const nextYear = nextAvailableYear(usedYears)
    setEntries([...entries, buildDefaultYear(nextYear)])
  }, [entries, usedYears, setEntries])

  const handleRemove = useCallback(
    (index: number) => {
      if (entries.length <= MIN_YEARS) return
      setEntries(entries.filter((_, i) => i !== index))
    },
    [entries, setEntries],
  )

  const hasSector = sectorCode.length > 0
  const goalsValid = entries.every(
    (entry) =>
      entry.goals.length > 0 &&
      entry.goals.every(
        (goal) =>
          validateGoalAgainstMinimums(goal, sectorCode as SectorCode).violations.length === 0,
      ),
  )
  const canAdvance =
    hasSector &&
    entries.length >= MIN_YEARS &&
    entries.every((e) => e.reviewDate.length > 0) &&
    goalsValid

  return (
    <section aria-label="Yearly Plans" data-testid="eea13-step-yearly-plans">
      <h2 className="mb-1 text-base font-semibold text-slate-800">Step 3 — Yearly Plans</h2>
      <p className="mb-2 text-sm text-slate-600">
        The EEP must include at least 3 and up to 5 annual plans covering the GN 6124 window
        (2025–2030). Each year requires a review date and at least one numerical goal.
      </p>
      <p className="mb-5 text-xs text-slate-500">
        {entries.length.toString()} of {MAX_YEARS.toString()} years configured (minimum{' '}
        {MIN_YEARS.toString()} required).
      </p>

      {hasSector ? null : (
        <p
          className="mb-3 text-sm text-red-700"
          data-testid="eea13-yearly-plans-sector-error"
          role="alert"
        >
          Select a sector in Plan Setup before editing numerical goals.
        </p>
      )}

      {/* Bounds error */}
      {entries.length < MIN_YEARS ? (
        <p
          className="mb-3 text-sm text-red-700"
          data-testid="eea13-yearly-plans-min-error"
          role="alert"
        >
          At least {MIN_YEARS.toString()} yearly plans are required.
        </p>
      ) : null}

      <div className="grid gap-4">
        {entries.map((entry, i) => (
          <PlanYearEntry
            canRemove={entries.length > MIN_YEARS}
            entry={entry}
            index={i}
            key={`${entry.year.toString()}-${i.toString()}`}
            onChange={handleChange}
            onRemove={handleRemove}
            prefill={prefill}
            sectorCode={sectorCode}
            usedYears={usedYears}
          />
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          aria-disabled={entries.length >= MAX_YEARS}
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          data-testid="eea13-add-year"
          disabled={entries.length >= MAX_YEARS}
          onClick={handleAdd}
          type="button"
        >
          Add year
        </button>
        {entries.length >= MAX_YEARS ? (
          <span className="text-xs text-slate-500" data-testid="eea13-add-year-max-hint">
            Maximum {MAX_YEARS.toString()} years reached.
          </span>
        ) : null}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="eea13-yearly-plans-next"
          disabled={!canAdvance}
          onClick={() => {
            if (canAdvance) onAdvance()
          }}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  )
}
