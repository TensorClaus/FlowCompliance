import {
  BARRIER_CATEGORIES,
  BarrierCategoryEnum,
  DesignationStatusSchema,
  type BarrierEntry,
  type BarriersRemovalPlan,
} from '@simplifi/shared'
import React from 'react'

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

function categoryLabel(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ---------------------------------------------------------------------------
// buildNilReturnEntry — pure data factory for EEA12 nil return
// ---------------------------------------------------------------------------

/**
 * Builds a BarrierEntry that satisfies the EEA12 nil-return requirement:
 * at least one explicit "other" entry documenting that no barriers were
 * found after analysis (per BarriersAnalysisSchema JSDoc).
 *
 * Callers (EEA12 consumers) use this for one-click nil-return insertion.
 */
export function buildNilReturnEntry(): BarrierEntry {
  // targetCompletionDate must be non-empty to pass BarrierEntrySchema (z.string().min(1)).
  // For a nil return the natural deadline is the next annual review cycle (31 October).
  const nextOctober = new Date()
  nextOctober.setFullYear(nextOctober.getFullYear() + (nextOctober.getMonth() >= 9 ? 1 : 0))
  nextOctober.setMonth(9)
  nextOctober.setDate(31)
  const targetDate = nextOctober.toISOString().slice(0, 10)

  return {
    category: 'other',
    description:
      'No barriers to employment equity were identified during the annual analysis conducted in terms of EEA s.19(1) and Regulation 4.',
    severity: 'low',
    affectedDesignatedGroups: [],
    mitigationActions: ['Continue annual barrier monitoring'],
    targetCompletionDate: targetDate,
  }
}

// ---------------------------------------------------------------------------
// Discriminated-union props API
// ---------------------------------------------------------------------------

export type BarrierCategoryBlockProps =
  | {
      mode: 'analysis'
      value: BarrierEntry
      onChange: (v: BarrierEntry) => void
      onRemove?: () => void
    }
  | {
      mode: 'removal-plan'
      value: BarriersRemovalPlan
      onChange: (v: BarriersRemovalPlan) => void
      onRemove?: () => void
    }
  | {
      mode: 'summary'
      value: BarrierEntry | BarriersRemovalPlan
    }

// ---------------------------------------------------------------------------
// Type guard — distinguishes BarrierEntry from BarriersRemovalPlan
// ---------------------------------------------------------------------------

function isBarrierEntry(value: BarrierEntry | BarriersRemovalPlan): value is BarrierEntry {
  return 'severity' in value
}

// ---------------------------------------------------------------------------
// Severity chip
// ---------------------------------------------------------------------------

const SEVERITY_CLASSES: Record<string, string> = {
  low: 'inline-flex items-center rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800',
  medium:
    'inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800',
  high: 'inline-flex items-center rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800',
}

const SEVERITY_SELECTED_CLASSES: Record<'low' | 'medium' | 'high', string> = {
  low: 'border-green-400 bg-green-100 text-green-800',
  medium: 'border-amber-400 bg-amber-100 text-amber-800',
  high: 'border-red-400 bg-red-100 text-red-800',
}

function SeverityChip({ severity }: { severity: string }): React.ReactElement {
  const cls = SEVERITY_CLASSES[severity] ?? SEVERITY_CLASSES['low']
  return <span className={cls}>{severity}</span>
}

// ---------------------------------------------------------------------------
// CategoryChip — read-only category display
// ---------------------------------------------------------------------------

function CategoryChip({ category }: { category: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      {categoryLabel(category)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Shared category <select> — always driven by BarrierCategoryEnum.options
// ---------------------------------------------------------------------------

function CategorySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}): React.ReactElement {
  return (
    <select
      aria-label="Barrier category"
      className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      onChange={(e) => {
        onChange(e.target.value)
      }}
      value={value}
    >
      {BarrierCategoryEnum.options.map((cat) => (
        <option key={cat} value={cat}>
          {categoryLabel(cat)}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// AnalysisBlock — BarrierEntry editing
// ---------------------------------------------------------------------------

function AnalysisBlock({
  value,
  onChange,
  onRemove,
}: {
  value: BarrierEntry
  onChange: (v: BarrierEntry) => void
  onRemove?: () => void
}): React.ReactElement {
  const patch = (partial: Partial<BarrierEntry>): void => {
    onChange({ ...value, ...partial })
  }

  const addMitigationAction = (): void => {
    patch({ mitigationActions: [...value.mitigationActions, ''] })
  }

  const updateMitigationAction = (index: number, text: string): void => {
    const next = value.mitigationActions.map((a, i) => (i === index ? text : a))
    patch({ mitigationActions: next })
  }

  const removeMitigationAction = (index: number): void => {
    if (value.mitigationActions.length <= 1) return
    const next = value.mitigationActions.filter((_, i) => i !== index)
    patch({ mitigationActions: next })
  }

  const toggleDesignationGroup = (code: string): void => {
    const parsed = DesignationStatusSchema.safeParse(code)
    if (!parsed.success) return
    const group = parsed.data
    const already = value.affectedDesignatedGroups.includes(group)
    const next = already
      ? value.affectedDesignatedGroups.filter((g) => g !== group)
      : [...value.affectedDesignatedGroups, group]
    patch({ affectedDesignatedGroups: next })
  }

  return (
    <div className="grid gap-4 rounded border border-slate-200 bg-white p-4">
      {/* Category */}
      <label className="grid gap-1">
        <span className="text-sm font-medium text-slate-700">Barrier category</span>
        <CategorySelect
          onChange={(cat) => {
            const parsed = BarrierCategoryEnum.safeParse(cat)
            if (parsed.success) patch({ category: parsed.data })
          }}
          value={value.category}
        />
      </label>

      {/* Description */}
      <label className="grid gap-1">
        <span className="text-sm font-medium text-slate-700">Description</span>
        <textarea
          aria-label="Barrier description"
          className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          onChange={(e) => {
            patch({ description: e.target.value })
          }}
          rows={3}
          value={value.description}
        />
      </label>

      {/* Severity chip group */}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-700">Severity</legend>
        <div className="flex gap-3" role="group" aria-label="Severity selection">
          {(['low', 'medium', 'high'] as const).map((level) => (
            <label
              key={level}
              className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                value.severity === level
                  ? SEVERITY_SELECTED_CLASSES[level]
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <input
                aria-label={`Severity ${level}`}
                checked={value.severity === level}
                className="sr-only"
                name="severity"
                onChange={() => {
                  patch({ severity: level })
                }}
                type="radio"
                value={level}
              />
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Affected designated groups multi-select */}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-700">Affected designated groups</legend>
        <div className="flex flex-wrap gap-2">
          {DesignationStatusSchema.options.map((code) => {
            const selected = value.affectedDesignatedGroups.includes(code)
            return (
              <label
                key={code}
                className={`flex cursor-pointer items-center gap-1.5 rounded border px-3 py-1 text-sm font-medium transition-colors ${
                  selected
                    ? 'border-slate-500 bg-slate-700 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  aria-label={`Designated group ${code}`}
                  checked={selected}
                  className="sr-only"
                  onChange={() => {
                    toggleDesignationGroup(code)
                  }}
                  type="checkbox"
                />
                {code}
              </label>
            )
          })}
        </div>
      </fieldset>

      {/* Mitigation actions */}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-700">
          Mitigation actions
          <span className="ml-1 text-xs font-normal text-slate-500">(min 1)</span>
        </legend>
        <div className="grid gap-2">
          {value.mitigationActions.map((action, index) => (
            <div key={index} className="flex gap-2">
              <input
                aria-label={`Mitigation action ${String(index + 1)}`}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                onChange={(e) => {
                  updateMitigationAction(index, e.target.value)
                }}
                type="text"
                value={action}
              />
              <button
                aria-label={`Remove mitigation action ${String(index + 1)}`}
                className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={value.mitigationActions.length <= 1}
                onClick={() => {
                  removeMitigationAction(index)
                }}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          className="self-start rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          onClick={addMitigationAction}
          type="button"
        >
          Add action
        </button>
      </fieldset>

      {/* Target completion date */}
      <label className="grid gap-1">
        <span className="text-sm font-medium text-slate-700">Target completion date</span>
        <input
          aria-label="Target completion date"
          className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          onChange={(e) => {
            patch({ targetCompletionDate: e.target.value })
          }}
          type="date"
          value={value.targetCompletionDate}
        />
      </label>

      {/* Remove entry button */}
      {onRemove === undefined ? null : (
        <div className="flex justify-end">
          <button
            aria-label="Remove barrier entry"
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            onClick={onRemove}
            type="button"
          >
            Remove entry
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RemovalPlanBlock — BarriersRemovalPlan editing
// ---------------------------------------------------------------------------

const ONGOING_ERROR_MESSAGE =
  'Timeline must be a concrete date or period — "ongoing" is not accepted'

function RemovalPlanBlock({
  value,
  onChange,
  onRemove,
}: {
  value: BarriersRemovalPlan
  onChange: (v: BarriersRemovalPlan) => void
  onRemove?: () => void
}): React.ReactElement {
  const patch = (partial: Partial<BarriersRemovalPlan>): void => {
    onChange({ ...value, ...partial })
  }

  const timelineHasOngoing = value.timeline.toLowerCase().includes('ongoing')

  return (
    <div className="grid gap-4 rounded border border-slate-200 bg-white p-4">
      {/* Barrier category */}
      <label className="grid gap-1">
        <span className="text-sm font-medium text-slate-700">Barrier category</span>
        <CategorySelect
          onChange={(cat) => {
            const parsed = BarrierCategoryEnum.safeParse(cat)
            if (parsed.success) patch({ barrierCategory: parsed.data })
          }}
          value={value.barrierCategory}
        />
      </label>

      {/* Action */}
      <label className="grid gap-1">
        <span className="text-sm font-medium text-slate-700">Action</span>
        <input
          aria-label="Action"
          className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          onChange={(e) => {
            patch({ action: e.target.value })
          }}
          type="text"
          value={value.action}
        />
      </label>

      {/* Responsible */}
      <label className="grid gap-1">
        <span className="text-sm font-medium text-slate-700">Responsible</span>
        <input
          aria-label="Responsible"
          className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          onChange={(e) => {
            patch({ responsible: e.target.value })
          }}
          type="text"
          value={value.responsible}
        />
      </label>

      {/* Timeline — inline rejection for "ongoing" */}
      <div className="grid gap-1">
        <label className="grid gap-1">
          <span className="text-sm font-medium text-slate-700">Timeline</span>
          <input
            aria-invalid={timelineHasOngoing}
            aria-label="Timeline"
            className={`rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              timelineHasOngoing
                ? 'border-red-400 focus:ring-red-300'
                : 'border-slate-300 focus:ring-slate-400'
            }`}
            onChange={(e) => {
              patch({ timeline: e.target.value })
            }}
            type="text"
            value={value.timeline}
          />
        </label>
        {timelineHasOngoing ? (
          <p className="text-xs text-red-700" role="alert">
            {ONGOING_ERROR_MESSAGE}
          </p>
        ) : null}
      </div>

      {/* Measurable outcome */}
      <label className="grid gap-1">
        <span className="text-sm font-medium text-slate-700">Measurable outcome</span>
        <input
          aria-label="Measurable outcome"
          className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          onChange={(e) => {
            patch({ measurableOutcome: e.target.value })
          }}
          type="text"
          value={value.measurableOutcome}
        />
      </label>

      {/* Remove entry button */}
      {onRemove === undefined ? null : (
        <div className="flex justify-end">
          <button
            aria-label="Remove removal plan entry"
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            onClick={onRemove}
            type="button"
          >
            Remove entry
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SummaryBlock — read-only rendering of either shape
// ---------------------------------------------------------------------------

function SummaryBarrierEntry({ value }: { value: BarrierEntry }): React.ReactElement {
  return (
    <div className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryChip category={value.category} />
        <SeverityChip severity={value.severity} />
      </div>
      <p className="text-sm text-slate-700">{value.description}</p>
      {value.affectedDesignatedGroups.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {value.affectedDesignatedGroups.map((group) => (
            <span
              key={group}
              className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700"
            >
              {group}
            </span>
          ))}
        </div>
      ) : null}
      {value.mitigationActions.length > 0 ? (
        <ul className="grid gap-1 pl-4 text-sm text-slate-600" style={{ listStyle: 'disc' }}>
          {value.mitigationActions.map((action, i) => (
            <li key={i}>{action}</li>
          ))}
        </ul>
      ) : null}
      {value.targetCompletionDate ? (
        <p className="text-xs text-slate-500">Target: {value.targetCompletionDate}</p>
      ) : null}
    </div>
  )
}

function SummaryRemovalPlan({ value }: { value: BarriersRemovalPlan }): React.ReactElement {
  return (
    <div className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryChip category={value.barrierCategory} />
      </div>
      <div className="grid gap-1 text-sm">
        <span className="text-slate-500">Action</span>
        <span className="text-slate-800">{value.action}</span>
      </div>
      <div className="grid gap-1 text-sm">
        <span className="text-slate-500">Responsible</span>
        <span className="text-slate-800">{value.responsible}</span>
      </div>
      <div className="grid gap-1 text-sm">
        <span className="text-slate-500">Timeline</span>
        <span className="text-slate-800">{value.timeline}</span>
      </div>
      <div className="grid gap-1 text-sm">
        <span className="text-slate-500">Measurable outcome</span>
        <span className="text-slate-800">{value.measurableOutcome}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BarrierCategoryBlock — public export
// ---------------------------------------------------------------------------

// Verify the BARRIER_CATEGORIES array has 23 entries at module load — this
// assertion surfaces immediately if the shared enum ever diverges.
const _: 23 = BARRIER_CATEGORIES.length

export function BarrierCategoryBlock(props: BarrierCategoryBlockProps): React.ReactElement {
  if (props.mode === 'analysis') {
    return (
      <AnalysisBlock
        onChange={props.onChange}
        value={props.value}
        {...(props.onRemove === undefined ? {} : { onRemove: props.onRemove })}
      />
    )
  }

  if (props.mode === 'removal-plan') {
    return (
      <RemovalPlanBlock
        onChange={props.onChange}
        value={props.value}
        {...(props.onRemove === undefined ? {} : { onRemove: props.onRemove })}
      />
    )
  }

  // summary mode
  if (isBarrierEntry(props.value)) {
    return <SummaryBarrierEntry value={props.value} />
  }
  return <SummaryRemovalPlan value={props.value} />
}
