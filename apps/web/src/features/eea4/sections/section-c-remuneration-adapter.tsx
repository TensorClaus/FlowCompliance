import type { RemunerationCell } from '@simplifi/shared'
import type { CellAdapter, PasteWarning } from '../../eea/components/matrix-grid'
import { parseIntegerZarToken } from './rem-zar-paste'

/**
 * EEA4 Section C adapter derived from the shared remuneration adapter policy.
 *
 * `subFields` deliberately contains only `totalRemuneration`: Section C paste
 * consumes one TSV token per cell because `headcount` is prefilled from linked
 * EEA2 Table 1.1 and is never paste-editable.
 */
export const sectionCRemunerationCellAdapter: CellAdapter<RemunerationCell> = {
  subFields: ['totalRemuneration'],

  zero() {
    return { headcount: 0, totalRemuneration: 0 }
  },

  add(a, b) {
    return {
      headcount: a.headcount + b.headcount,
      totalRemuneration: a.totalRemuneration + b.totalRemuneration,
    }
  },

  parseTokens(tokens) {
    const { value, warnings } = parseIntegerZarToken(tokens[0] ?? '')
    return {
      cell: { headcount: 0, totalRemuneration: value },
      warnings: warnings as PasteWarning[],
    }
  },

  render(context, value) {
    const isEditInteractive = context.mode === 'edit' || context.mode === 'validate'
    const remunerationReadOnly =
      !isEditInteractive || context.readOnlyField('totalRemuneration') || value.headcount === 0
    const title = value.headcount === 0 ? 'No employees in this cell EEA2.' : undefined

    return (
      <span className="inline-flex gap-1">
        <span data-subfield="headcount" data-testid="matrix-cell">
          {value.headcount}
        </span>
        {remunerationReadOnly ? (
          <span data-subfield="totalRemuneration" data-testid="matrix-cell" title={title}>
            {value.headcount === 0 ? 0 : value.totalRemuneration}
          </span>
        ) : (
          <input
            aria-invalid={context.hasError || undefined}
            className="w-16 rounded border border-slate-300 px-1 py-0.5 text-center text-xs"
            data-subfield="totalRemuneration"
            disabled={context.disabled}
            min={0}
            onBlur={() => {
              context.onSubFieldBlur('totalRemuneration')
            }}
            onChange={(event) => {
              const next = event.target.valueAsNumber
              const safe = Number.isFinite(next) && next >= 0 ? Math.trunc(next) : 0
              context.onSubFieldChange('totalRemuneration', {
                ...value,
                totalRemuneration: safe,
              })
            }}
            onFocus={() => {
              context.onSubFieldFocus('totalRemuneration')
            }}
            onPaste={(event) => {
              context.onPaste(event, 'totalRemuneration')
            }}
            step={1}
            type="number"
            value={value.totalRemuneration}
          />
        )}
      </span>
    )
  },
}
