import type {
  BarrierEntry,
  EapComparisonRow,
  EapProvince,
  OccupationalLevel,
} from '@simplifi/shared'
import React, { useId } from 'react'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import type { EEA13WorkforceData } from '../eea13-types'

const STEP_ID = 'eea13-workforce'
const PREFILL_SOURCE_STEP_ID = 'eea13-prefill-source'

// ---------------------------------------------------------------------------
// Designated-employee derivation
// ---------------------------------------------------------------------------

/**
 * A row from decompose-workforce DecomposeResult.rows.
 * We reference only the fields we need for the designated-count formula.
 */
interface WorkforceRow {
  occupationalLevel?: OccupationalLevel
  race: string
  gender: string
  disability: boolean
  count: number
}

/**
 * Counts designated employees from a flat WorkforceProfileRow array.
 *
 * Formula (per rule_eea_006 and the task spec):
 *   A row is "designated" if ANY of the following hold:
 *     - race ∈ {A, C, I}   (African, Coloured, Indian — SA citizens only)
 *     - gender = 'F'        (female)
 *     - disability = true   (persons with disabilities)
 *
 *   Rows are INDIVIDUAL employee records, not group aggregates.
 *   The `count` field carries the headcount for that race/gender/disability cell.
 *   We sum `count` for all rows that satisfy ANY criterion.
 *
 * Note: rows with race='W' and gender='M' and disability=false are the only
 * non-designated rows. All others qualify.
 */
export function countDesignatedFromRows(rows: WorkforceRow[]): number {
  let total = 0
  for (const row of rows) {
    const isDesignatedRace = row.race === 'A' || row.race === 'C' || row.race === 'I'
    const isFemale = row.gender === 'F'
    const hasDisability = row.disability
    if (isDesignatedRace || isFemale || hasDisability) {
      total += row.count
    }
  }
  return total
}

/**
 * Sum of all foreignNationals summary counts from a DecomposeResult.
 */
export function sumForeignNationals(entries: Array<{ level: string; count: number }>): number {
  return entries.reduce((acc, entry) => acc + entry.count, 0)
}

// ---------------------------------------------------------------------------
// Prefill source context key (set by the shell when EEA12 data is available)
// ---------------------------------------------------------------------------

export interface EEA13PrefillSource {
  rows: WorkforceRow[]
  eapComparisonRows?: EapComparisonRow[]
  foreignNationals: Array<{ level: string; count: number }>
  /** Human-readable period label, e.g. "2025-01-01 – 2025-12-31" */
  periodLabel: string
  province?: EapProvince
  /**
   * Barrier entries from the linked EEA12 Section A. When present, EEA13 Step 4
   * uses these for the ONE-TIME SEED of the barriers removal plan on first mount.
   * After the seed fires, subsequent changes to EEA12 data do NOT propagate.
   */
  barrierEntries?: BarrierEntry[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EEA13 Step 2 — Workforce Analysis.
 *
 * Collects:
 *  - totalEmployees (integer, positive)
 *  - designatedEmployees (integer, nonnegative)
 *  - foreignNationals (integer, nonnegative)
 *
 * When a prefill source is present in formState[PREFILL_SOURCE_STEP_ID]:
 *  - totalEmployees = sum of all row counts (including foreign nationals summary)
 *  - designatedEmployees = countDesignatedFromRows(rows)
 *  - foreignNationals = sumForeignNationals(foreignNationals)
 *
 * All fields remain editable after prefill; a provenance caption is shown.
 * Per EEA s.1 and rule_eea_006, foreign nationals are excluded from designated
 * group counts — the formula therefore operates only on rows (which are
 * SA-citizen race/gender cells) and does not double-count the FN summary.
 */
export function EEA13StepWorkforceAnalysis({ onAdvance }: StepProps): React.ReactElement {
  const { formState, setStepData } = useWizardFormController()

  const prefill = formState[PREFILL_SOURCE_STEP_ID] as EEA13PrefillSource | undefined

  const raw = formState[STEP_ID] as EEA13WorkforceData | undefined

  // Derive prefill values lazily — computed once when prefill source exists and
  // the step has no manual data yet.
  const prefilled: EEA13WorkforceData | null = (() => {
    if (prefill === undefined) return null
    const rowTotal = prefill.rows.reduce((acc, r) => acc + r.count, 0)
    const fnTotal = sumForeignNationals(prefill.foreignNationals)
    return {
      totalEmployees: rowTotal + fnTotal,
      designatedEmployees: countDesignatedFromRows(prefill.rows),
      foreignNationals: fnTotal,
    }
  })()

  const data: EEA13WorkforceData = raw ??
    prefilled ?? {
      totalEmployees: 0,
      designatedEmployees: 0,
      foreignNationals: 0,
    }

  const totalId = useId()
  const designatedId = useId()
  const foreignId = useId()

  function updateField(field: keyof EEA13WorkforceData, raw: string): void {
    const value = Number.parseInt(raw, 10)
    setStepData(STEP_ID, { ...data, [field]: Number.isNaN(value) ? 0 : value })
  }

  const canAdvance = data.totalEmployees > 0

  return (
    <section aria-label="Workforce Analysis" data-testid="eea13-step-workforce">
      <h2 className="mb-1 text-base font-semibold text-slate-800">Step 2 — Workforce Analysis</h2>
      <p className="mb-4 text-sm text-slate-600">
        Record the workforce composition at the time of plan preparation. Foreign nationals are
        excluded from designated group counts per EEA s.1 and rule_eea_006.
      </p>

      {prefill !== undefined && raw === undefined ? (
        <div
          className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800"
          data-testid="eea13-workforce-prefill-notice"
        >
          Prefilled from EEA12 {prefill.periodLabel}. All fields remain editable.
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <label className="grid gap-1" htmlFor={totalId}>
          <span className="text-xs font-medium text-slate-600">Total employees</span>
          <input
            aria-label="Total employees"
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid="eea13-total-employees"
            id={totalId}
            min={1}
            onChange={(e) => {
              updateField('totalEmployees', e.target.value)
            }}
            type="number"
            value={data.totalEmployees === 0 ? '' : data.totalEmployees}
          />
        </label>

        <label className="grid gap-1" htmlFor={designatedId}>
          <span className="text-xs font-medium text-slate-600">Designated employees</span>
          <input
            aria-label="Designated employees"
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid="eea13-designated-employees"
            id={designatedId}
            min={0}
            onChange={(e) => {
              updateField('designatedEmployees', e.target.value)
            }}
            type="number"
            value={data.designatedEmployees === 0 ? '' : data.designatedEmployees}
          />
          <span className="text-xs text-slate-400">race ∈ {'{A,C,I}'} OR female OR disability</span>
        </label>

        <label className="grid gap-1" htmlFor={foreignId}>
          <span className="text-xs font-medium text-slate-600">Foreign nationals</span>
          <input
            aria-label="Foreign nationals"
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid="eea13-foreign-nationals"
            id={foreignId}
            min={0}
            onChange={(e) => {
              updateField('foreignNationals', e.target.value)
            }}
            type="number"
            value={data.foreignNationals === 0 ? '' : data.foreignNationals}
          />
          <span className="text-xs text-slate-400">Excluded from designated counts (EEA s.1)</span>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="eea13-workforce-next"
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
