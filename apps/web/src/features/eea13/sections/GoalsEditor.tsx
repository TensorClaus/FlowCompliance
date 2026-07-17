import {
  GN6124_VERSION,
  MEASURES_EMPTY_MESSAGE,
  OCCUPATIONAL_LEVEL_LABELS,
  PROVINCES,
  TIMEFRAME_ONGOING_MESSAGE,
  getEapByProvinceAndLevel,
  validateGoalAgainstMinimums,
  type EapComparisonRow,
  type EapProvince,
  type NumericalGoal,
  type OccupationalLevel,
  type SectorCode,
} from '@simplifi/shared'
import React, { useEffect, useMemo, useState } from 'react'
import { ProvisionalEapBadge } from '../../eea/components/ProvisionalEapBadge'
import type { EEA13PrefillSource } from './eea13-step-workforce-analysis'

type DesignatedGroup = NumericalGoal['designatedGroup']

interface GoalsEditorProps {
  entryNum: number
  goals: NumericalGoal[]
  sectorCode: string
  prefill: EEA13PrefillSource | undefined
  onChange: (goals: NumericalGoal[]) => void
}

const OCCUPATIONAL_LEVELS: OccupationalLevel[] = [1, 2, 3, 4, 5, 6, 7]
const DESIGNATED_GROUPS: Array<{ code: DesignatedGroup; label: string }> = [
  { code: 'A', label: 'A - African' },
  { code: 'C', label: 'C - Coloured' },
  { code: 'I', label: 'I - Indian/Asian' },
  { code: 'W', label: 'W - White' },
  { code: 'M', label: 'M - Male' },
  { code: 'F', label: 'F - Female' },
]

function roundOne(value: number): number {
  return Math.round(value * 10) / 10
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function resolveProvince(prefill: EEA13PrefillSource | undefined): EapProvince {
  if (prefill?.province !== undefined && PROVINCES.includes(prefill.province)) {
    return prefill.province
  }
  return 'National'
}

function eapBenchmarkForGroup(
  province: EapProvince,
  level: OccupationalLevel,
  group: DesignatedGroup,
): number {
  const points = getEapByProvinceAndLevel(province, level)
  let total = 0
  for (const point of points) {
    if (group === 'A' && point.race === 'African') total += point.percentage
    if (group === 'C' && point.race === 'Coloured') total += point.percentage
    if (group === 'I' && point.race === 'Indian/Asian') total += point.percentage
    if (group === 'W' && point.race === 'White') total += point.percentage
    if (group === 'M' && point.gender === 'Male') total += point.percentage
    if (group === 'F' && point.gender === 'Female') total += point.percentage
  }
  return roundOne(total)
}

function currentFromRows(
  rows: EEA13PrefillSource['rows'] | undefined,
  level: OccupationalLevel,
  group: DesignatedGroup,
): number | undefined {
  const levelRows = (rows ?? []).filter((row) => row.occupationalLevel === level)
  const denominator = levelRows.reduce((acc, row) => acc + row.count, 0)
  if (denominator === 0) return undefined

  let numerator = 0
  for (const row of levelRows) {
    if (group === 'A' || group === 'C' || group === 'I' || group === 'W') {
      if (row.race === group) numerator += row.count
    } else if (row.gender === group) {
      numerator += row.count
    }
  }

  return roundOne((numerator / denominator) * 100)
}

function currentFromSectionC(
  rows: EapComparisonRow[] | undefined,
  level: OccupationalLevel,
  group: DesignatedGroup,
): number | undefined {
  if (group !== 'A' && group !== 'C' && group !== 'I') return undefined
  return rows?.find((row) => row.occupationalLevel === level)?.actualPct
}

function deriveCurrentRepresentation(
  prefill: EEA13PrefillSource | undefined,
  level: OccupationalLevel,
  group: DesignatedGroup,
): { value: number; source: 'eea12-rows' | 'eea12-section-c' | 'none' } {
  const rowValue = currentFromRows(prefill?.rows, level, group)
  if (rowValue !== undefined) return { value: rowValue, source: 'eea12-rows' }

  const sectionCValue = currentFromSectionC(prefill?.eapComparisonRows, level, group)
  if (sectionCValue !== undefined) return { value: sectionCValue, source: 'eea12-section-c' }

  return { value: 0, source: 'none' }
}

function defaultGoal(prefill: EEA13PrefillSource | undefined): NumericalGoal {
  const level: OccupationalLevel = 1
  const group: DesignatedGroup = 'A'
  const province = resolveProvince(prefill)
  const current = deriveCurrentRepresentation(prefill, level, group)
  const eapBenchmark = eapBenchmarkForGroup(province, level, group)
  return {
    occupationalLevel: level,
    designatedGroup: group,
    currentRepresentation: current.value,
    target: eapBenchmark,
    eapBenchmark,
    timeframe: '',
    targetDate: '',
    measures: [''],
  }
}

function sanitizeMeasures(measures: string[]): string[] {
  return measures.map((measure) => measure.trim()).filter((measure) => measure.length > 0)
}

export function GoalsEditor({
  entryNum,
  goals,
  sectorCode,
  prefill,
  onChange,
}: GoalsEditorProps): React.ReactElement {
  const [draft, setDraft] = useState<NumericalGoal>(() => defaultGoal(prefill))
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const province = resolveProvince(prefill)
  const current = useMemo(
    () => deriveCurrentRepresentation(prefill, draft.occupationalLevel, draft.designatedGroup),
    [draft.designatedGroup, draft.occupationalLevel, prefill],
  )
  const eapBenchmark = useMemo(
    () => eapBenchmarkForGroup(province, draft.occupationalLevel, draft.designatedGroup),
    [draft.designatedGroup, draft.occupationalLevel, province],
  )

  useEffect(() => {
    setDraft((previous) => ({
      ...previous,
      currentRepresentation: current.value,
      eapBenchmark,
      target: previous.target === previous.eapBenchmark ? eapBenchmark : previous.target,
    }))
  }, [current.value, eapBenchmark])

  const goalForValidation: NumericalGoal = {
    ...draft,
    currentRepresentation: current.value,
    eapBenchmark,
    measures: sanitizeMeasures(draft.measures),
  }
  const validation = validateGoalAgainstMinimums(goalForValidation, sectorCode as SectorCode)
  const targetViolation = validation.violations.find(
    (violation) => violation.code === 'TARGET_BELOW_EFFECTIVE_MINIMUM',
  )
  const timeframeViolation = validation.violations.find(
    (violation) => violation.code === 'TIMEFRAME_ONGOING',
  )
  const measuresViolation = validation.violations.find(
    (violation) => violation.code === 'MEASURES_EMPTY',
  )
  const requiredFieldsMissing =
    draft.targetDate.length === 0 ||
    draft.timeframe.length === 0 ||
    sanitizeMeasures(draft.measures).length === 0
  const canSave =
    !requiredFieldsMissing &&
    targetViolation === undefined &&
    timeframeViolation === undefined &&
    measuresViolation === undefined

  function patch(partial: Partial<NumericalGoal>): void {
    setDraft((previous) => ({ ...previous, ...partial }))
  }

  function addMeasure(): void {
    patch({ measures: [...draft.measures, ''] })
  }

  function updateMeasure(index: number, value: string): void {
    patch({ measures: draft.measures.map((measure, i) => (i === index ? value : measure)) })
  }

  function removeMeasure(index: number): void {
    if (draft.measures.length <= 1) return
    patch({ measures: draft.measures.filter((_, i) => i !== index) })
  }

  function saveGoal(): void {
    if (!canSave) return
    const saved = { ...goalForValidation, measures: sanitizeMeasures(draft.measures) }
    const next =
      editingIndex === null
        ? [...goals, saved]
        : goals.map((goal, index) => (index === editingIndex ? saved : goal))
    onChange(next)
    setEditingIndex(null)
    setDraft(defaultGoal(prefill))
  }

  function editGoal(index: number): void {
    const goal = goals[index]
    if (goal === undefined) return
    setEditingIndex(index)
    setDraft(goal)
  }

  function removeGoal(index: number): void {
    onChange(goals.filter((_, i) => i !== index))
    if (editingIndex === index) {
      setEditingIndex(null)
      setDraft(defaultGoal(prefill))
    }
  }

  let targetMessage: string | null = null
  if (targetViolation?.binding === 'sectoral') {
    targetMessage = 'Target must meet or exceed the sectoral baseline.'
  } else if (targetViolation?.binding === 'eap') {
    targetMessage = 'Target must meet or exceed the EAP benchmark.'
  }

  return (
    <div className="mt-4 rounded border border-slate-200 bg-white px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-700">Numerical goals</h4>
        <span className="text-xs text-slate-500">{goals.length.toString()} saved</span>
      </div>

      {goals.length > 0 ? (
        <div className="mb-4 grid gap-2">
          {goals.map((goal, index) => (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              data-testid={`eea13-saved-goal-${entryNum.toString()}-${(index + 1).toString()}`}
              key={`${String(goal.occupationalLevel)}-${goal.designatedGroup}-${index.toString()}`}
            >
              <span>
                {OCCUPATIONAL_LEVEL_LABELS[goal.occupationalLevel]} / {goal.designatedGroup} /
                target {formatPct(goal.target)}
              </span>
              <span className="flex gap-2">
                <button
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-white"
                  onClick={() => {
                    editGoal(index)
                  }}
                  type="button"
                >
                  Edit
                </button>
                <button
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                  onClick={() => {
                    removeGoal(index)
                  }}
                  type="button"
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Occupational level</span>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid={`eea13-goal-level-${entryNum.toString()}`}
              onChange={(event) => {
                patch({ occupationalLevel: Number(event.target.value) as OccupationalLevel })
              }}
              value={draft.occupationalLevel}
            >
              {OCCUPATIONAL_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level} - {OCCUPATIONAL_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Designated group</span>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid={`eea13-goal-group-${entryNum.toString()}`}
              onChange={(event) => {
                patch({ designatedGroup: event.target.value as DesignatedGroup })
              }}
              value={draft.designatedGroup}
            >
              {DESIGNATED_GROUPS.map((group) => (
                <option key={group.code} value={group.code}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">
              Current representation <ProvisionalEapBadge />
            </span>
            <input
              className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              data-testid={`eea13-goal-current-${entryNum.toString()}`}
              readOnly
              type="number"
              value={current.value}
            />
            <span className="text-xs text-slate-400">
              {current.source === 'eea12-rows'
                ? 'From EEA12 rows for selected level and group.'
                : null}
              {current.source === 'eea12-section-c'
                ? 'From EEA12 Section C designated-group aggregate.'
                : null}
              {current.source !== 'eea12-rows' && current.source !== 'eea12-section-c'
                ? 'No EEA12 source available; defaults to 0.0%.'
                : null}
            </span>
          </label>

          <label className="grid gap-1" data-testid={`eea13-goal-eap-field-${entryNum.toString()}`}>
            <span className="text-xs font-medium text-slate-600">
              EAP benchmark <ProvisionalEapBadge />
            </span>
            <input
              className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              data-testid={`eea13-goal-eap-${entryNum.toString()}`}
              readOnly
              type="number"
              value={eapBenchmark}
            />
            <span className="text-xs text-slate-400">{province} EAP lookup</span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Target (%)</span>
            <input
              aria-invalid={targetViolation !== undefined}
              className={`rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                targetViolation === undefined
                  ? 'border-slate-300 focus:ring-slate-400'
                  : 'border-red-400 focus:ring-red-300'
              }`}
              data-testid={`eea13-goal-target-${entryNum.toString()}`}
              max={100}
              min={0}
              onChange={(event) => {
                const value = Number(event.target.value)
                patch({ target: Number.isNaN(value) ? 0 : value })
              }}
              type="number"
              value={draft.target}
            />
            {targetMessage === null ? null : (
              <span
                className="text-xs text-red-700"
                data-testid={`eea13-goal-target-error-${entryNum.toString()}`}
                role="alert"
              >
                {targetMessage}
              </span>
            )}
          </label>
        </div>

        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
          <div className="grid gap-1">
            <p data-testid={`eea13-goal-eap-baseline-${entryNum.toString()}`}>
              EAP benchmark: {formatPct(eapBenchmark)}
              {validation.binding === 'eap' ? (
                <span
                  className="ml-2 rounded border border-slate-500 bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white"
                  data-testid={`eea13-goal-binding-eap-${entryNum.toString()}`}
                >
                  binding
                </span>
              ) : null}
            </p>
            {validation.sectoralTarget === undefined ? (
              <p data-testid={`eea13-goal-no-sectoral-target-${entryNum.toString()}`}>
                No GN 6124 target for this combination - EAP benchmark applies
              </p>
            ) : (
              <p data-testid={`eea13-goal-sectoral-baseline-${entryNum.toString()}`}>
                GN 6124 sectoral minimum: {formatPct(validation.sectoralTarget)} ({GN6124_VERSION})
                {validation.binding === 'sectoral' ? (
                  <span
                    className="ml-2 rounded border border-slate-500 bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white"
                    data-testid={`eea13-goal-binding-sectoral-${entryNum.toString()}`}
                  >
                    binding
                  </span>
                ) : null}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Timeframe</span>
            <input
              aria-invalid={timeframeViolation !== undefined}
              className={`rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                timeframeViolation === undefined
                  ? 'border-slate-300 focus:ring-slate-400'
                  : 'border-red-400 focus:ring-red-300'
              }`}
              data-testid={`eea13-goal-timeframe-${entryNum.toString()}`}
              onChange={(event) => {
                patch({ timeframe: event.target.value })
              }}
              type="text"
              value={draft.timeframe}
            />
            {timeframeViolation === undefined ? null : (
              <span
                className="text-xs text-red-700"
                data-testid={`eea13-goal-timeframe-error-${entryNum.toString()}`}
                role="alert"
              >
                {TIMEFRAME_ONGOING_MESSAGE}
              </span>
            )}
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-600">Target date</span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid={`eea13-goal-target-date-${entryNum.toString()}`}
              onChange={(event) => {
                patch({ targetDate: event.target.value })
              }}
              type="date"
              value={draft.targetDate}
            />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="text-xs font-medium text-slate-600">
            Measures <span className="font-normal text-slate-500">(min 1)</span>
          </legend>
          <div className="grid gap-2">
            {draft.measures.map((measure, index) => (
              <div className="flex gap-2" key={index}>
                <input
                  aria-label={`Goal measure ${String(index + 1)}`}
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                  data-testid={`eea13-goal-measure-${entryNum.toString()}-${(index + 1).toString()}`}
                  onChange={(event) => {
                    updateMeasure(index, event.target.value)
                  }}
                  type="text"
                  value={measure}
                />
                <button
                  className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={draft.measures.length <= 1}
                  onClick={() => {
                    removeMeasure(index)
                  }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {measuresViolation === undefined ? null : (
            <span className="text-xs text-red-700" role="alert">
              {MEASURES_EMPTY_MESSAGE}
            </span>
          )}
          <button
            className="self-start rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            onClick={addMeasure}
            type="button"
          >
            Add measure
          </button>
        </fieldset>

        <div className="flex justify-end">
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            data-testid={`eea13-goal-save-${entryNum.toString()}`}
            disabled={!canSave}
            onClick={saveGoal}
            type="button"
          >
            {editingIndex === null ? 'Save goal' : 'Update goal'}
          </button>
        </div>
      </div>
    </div>
  )
}
