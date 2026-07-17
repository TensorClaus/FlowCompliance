import type { OccupationalMatrix, WorkforceProfile, WorkforceProfileRow } from '@simplifi/shared'
import { OccupationalMatrixSchema } from '@simplifi/shared'
import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import { decomposeEEA2Workforce } from '../decompose-workforce'

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const STEP_ID = 'eea12-section-b'

/**
 * Context key under which the EEA12 form shell stores the EEA2 workforce
 * matrix when an EEA2 is linked. Matches the key used by the EEA4 shell for
 * the same purpose so the WizardFormContext shape stays consistent.
 */
export const EEA12_LINKED_EEA2_WORKFORCE_STEP_ID = '__eea12_linked_eea2_workforce__'
export const EEA12_LINKED_EEA2_DISABILITY_STEP_ID = '__eea12_linked_eea2_disability__'

const OCCUPATIONAL_LEVEL_LABELS: Record<number, string> = {
  1: 'Top Management',
  2: 'Senior Management',
  3: 'Professionally Qualified',
  4: 'Skilled Technical',
  5: 'Semi-Skilled',
  6: 'Unskilled',
  7: 'Temporary Employees',
}

const RACE_LABELS: Record<string, string> = {
  A: 'African',
  C: 'Coloured',
  I: 'Indian/Asian',
  W: 'White',
}

const GENDER_LABELS: Record<string, string> = {
  M: 'Male',
  F: 'Female',
}

// ---------------------------------------------------------------------------
// Level-divergence computation
// ---------------------------------------------------------------------------

/**
 * For each occupational level, compare the total count in the current rows
 * against the EEA2 source workforce matrix total. Returns the set of level
 * labels where the totals differ. Non-blocking — displayed as a warning banner.
 */
function computeDivergingLevels(
  rows: WorkforceProfileRow[],
  sourceMatrix: OccupationalMatrix | null,
): Set<string> {
  if (sourceMatrix === null) return new Set()

  const levelKey: Record<number, string> = {
    1: 'topManagement',
    2: 'seniorManagement',
    3: 'professionallyQualified',
    4: 'skilledTechnical',
    5: 'semiSkilled',
    6: 'unskilled',
    7: 'temporaryEmployees',
  }

  const diverging = new Set<string>()

  for (const [levelCode, matrixKey] of Object.entries(levelKey)) {
    const code = Number(levelCode)
    const levelRows = rows.filter((r) => r.occupationalLevel === code)
    const currentTotal = levelRows.reduce((sum, r) => sum + r.count, 0)
    const sourceRow = (sourceMatrix as unknown as Record<string, { total: { value: number } }>)[
      matrixKey
    ]
    const sourceTotal = sourceRow?.total.value ?? 0
    if (currentTotal !== sourceTotal) {
      diverging.add(OCCUPATIONAL_LEVEL_LABELS[code] ?? matrixKey)
    }
  }

  return diverging
}

// ---------------------------------------------------------------------------
// Row editor sub-component
// ---------------------------------------------------------------------------

function WorkforceRowEditor({
  row,
  onChange,
}: {
  row: WorkforceProfileRow
  onChange: (updated: WorkforceProfileRow) => void
}): React.ReactElement {
  const label = [
    OCCUPATIONAL_LEVEL_LABELS[row.occupationalLevel] ?? String(row.occupationalLevel),
    RACE_LABELS[row.race] ?? row.race,
    GENDER_LABELS[row.gender] ?? row.gender,
    row.disability ? 'with disability' : 'no disability',
  ].join(' · ')

  return (
    <div className="flex items-center justify-between gap-4 rounded border border-slate-200 bg-white px-4 py-3">
      <span className="flex-1 text-sm text-slate-700">{label}</span>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-slate-600">Count</span>
        <input
          aria-label={`Count for ${label}`}
          className="w-20 rounded border border-slate-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          min={0}
          onChange={(e) => {
            const parsed = Number.parseInt(e.target.value, 10)
            if (!Number.isNaN(parsed) && parsed >= 0) {
              onChange({ ...row, count: parsed })
            }
          }}
          type="number"
          value={row.count}
        />
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------

/**
 * EEA12 Section B — Workforce Profile.
 *
 * Prefills from the linked EEA2 Section B matrices when available.
 * Rows are editable post-prefill. When edited totals diverge from the EEA2
 * source per level, a non-blocking warning banner names the affected level(s).
 *
 * Foreign nationals are excluded from the rows per rule_eea_006 and an info
 * note is shown if the EEA2 source contained any foreign national counts.
 */
export function EEA12SectionB({ onAdvance }: StepProps): React.ReactElement {
  const { formState, setStepData } = useWizardFormController()

  const profile = formState[STEP_ID] as WorkforceProfile | undefined
  const rows: WorkforceProfileRow[] = profile?.rows ?? []

  // Linked EEA2 source matrices (may be undefined if not linked).
  const sourceWorkforce = formState[EEA12_LINKED_EEA2_WORKFORCE_STEP_ID] as
    | OccupationalMatrix
    | undefined
  const sourceDisability = formState[EEA12_LINKED_EEA2_DISABILITY_STEP_ID] as
    | OccupationalMatrix
    | undefined

  const prefillAppliedRef = useRef(false)

  // Prefill once when both source matrices become available and rows are empty.
  useEffect(() => {
    if (prefillAppliedRef.current) return
    if (sourceWorkforce === undefined || sourceDisability === undefined) return
    if (rows.length > 0) {
      // Rows already present (persisted draft) — skip prefill but mark applied.
      prefillAppliedRef.current = true
      return
    }

    const parsedWorkforce = OccupationalMatrixSchema.safeParse(sourceWorkforce)
    const parsedDisability = OccupationalMatrixSchema.safeParse(sourceDisability)
    if (!parsedWorkforce.success || !parsedDisability.success) return

    const result = decomposeEEA2Workforce(parsedWorkforce.data, parsedDisability.data)
    setStepData(STEP_ID, { rows: result.rows })
    prefillAppliedRef.current = true
  }, [sourceWorkforce, sourceDisability, rows.length, setStepData])

  const handleRowChange = useCallback(
    (index: number, updated: WorkforceProfileRow) => {
      const next = rows.map((r, i) => (i === index ? updated : r))
      setStepData(STEP_ID, { rows: next })
    },
    [rows, setStepData],
  )

  // Foreign national info — derive from source on each render (pure, cheap).
  const foreignNationalInfo = useMemo(() => {
    if (sourceWorkforce === undefined || sourceDisability === undefined) return null
    const parsedWorkforce = OccupationalMatrixSchema.safeParse(sourceWorkforce)
    const parsedDisability = OccupationalMatrixSchema.safeParse(sourceDisability)
    if (!parsedWorkforce.success || !parsedDisability.success) return null
    const result = decomposeEEA2Workforce(parsedWorkforce.data, parsedDisability.data)
    const totalFN = result.foreignNationals.reduce((sum, item) => sum + item.count, 0)
    return totalFN > 0 ? totalFN : null
  }, [sourceWorkforce, sourceDisability])

  // Divergence check against the EEA2 source.
  const sourceMatrixForDivergence = useMemo(() => {
    if (sourceWorkforce === undefined) return null
    const parsed = OccupationalMatrixSchema.safeParse(sourceWorkforce)
    return parsed.success ? parsed.data : null
  }, [sourceWorkforce])

  const divergingLevels = useMemo(
    () => computeDivergingLevels(rows, sourceMatrixForDivergence),
    [rows, sourceMatrixForDivergence],
  )

  return (
    <section aria-label="Section B — Workforce profile" data-testid="eea12-section-b">
      <h2 className="mb-1 text-base font-semibold text-slate-800">Section B — Workforce Profile</h2>
      <p className="mb-4 text-sm text-slate-600">
        Review and confirm the workforce profile breakdown by occupational level, race, gender and
        disability status. Counts are prefilled from the linked EEA2 Table 1.1 and Table 1.2 when
        available and may be adjusted.
      </p>

      {/* Foreign nationals info note */}
      {foreignNationalInfo === null ? null : (
        <div
          className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          data-testid="eea12-foreign-nationals-note"
          role="note"
        >
          Foreign nationals: {foreignNationalInfo} — excluded per rule_eea_006, reported separately.
        </div>
      )}

      {/* Divergence warning — non-blocking */}
      {divergingLevels.size > 0 ? (
        <div
          className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          data-testid="eea12-divergence-warning"
          role="alert"
        >
          <span className="font-semibold">Totals diverge from EEA2 Table 1.1</span> at the following
          levels — will be flagged at validation:{' '}
          <span data-testid="eea12-divergence-levels">{[...divergingLevels].join(', ')}</span>
        </div>
      ) : null}

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No workforce profile rows available. Link an EEA2 report on the main form page to prefill
          this section automatically.
        </div>
      ) : null}

      {/* Row list */}
      <div className="grid gap-2" data-testid="eea12-section-b-rows">
        {rows.map((row, index) => (
          <WorkforceRowEditor
            key={`${String(row.occupationalLevel)}-${row.race}-${row.gender}-${String(row.disability)}`}
            onChange={(updated) => {
              handleRowChange(index, updated)
            }}
            row={row}
          />
        ))}
      </div>

      {/* Navigation footer */}
      <div className="mt-6 flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          data-testid="eea12-section-b-next"
          onClick={onAdvance}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  )
}
