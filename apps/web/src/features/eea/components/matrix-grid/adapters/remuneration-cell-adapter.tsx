import type { RemunerationCell } from '@simplifi/shared'
import { clsx } from 'clsx'
import type { CellAdapter, PasteWarning } from '../types'

const SUB_FIELDS = ['headcount', 'totalRemuneration'] as const

interface SubFieldSpec {
  key: (typeof SUB_FIELDS)[number]
  /** headcount is integer; remuneration is a non-negative decimal (ZAR). */
  integer: boolean
}

const SUB_FIELD_SPECS: readonly SubFieldSpec[] = [
  { key: 'headcount', integer: true },
  { key: 'totalRemuneration', integer: false },
]

function parseNumber(token: string, integer: boolean): { value: number; warning: boolean } {
  const raw = token.trim()
  const num = Number(raw)
  const isValid =
    raw !== '' && Number.isFinite(num) && num >= 0 && (!integer || Number.isInteger(num))
  return { value: isValid ? num : 0, warning: !isValid && raw !== '' }
}

/**
 * Adapter for EEA4 Section C remuneration cells (headcount + totalRemuneration).
 *
 * Both sub-fields are editable by default. Consumers may render `headcount` (or any sub-field)
 * read-only via the grid's per-sub-field `readOnlyField` override — this adapter does NOT hardcode
 * any EEA4 policy; it simply honours the read-only signal from the render context.
 */
export const remunerationCellAdapter: CellAdapter<RemunerationCell> = {
  subFields: SUB_FIELDS,

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
    const warnings: PasteWarning[] = []
    const cell = { ...this.zero() } as RemunerationCell
    for (const [index, spec] of SUB_FIELD_SPECS.entries()) {
      const token = tokens[index] ?? ''
      const { value, warning } = parseNumber(token, spec.integer)
      cell[spec.key] = value
      if (warning) {
        warnings.push({
          code: 'PASTE_NON_NUMERIC',
          cellPath: '',
          severity: 'warning',
          message: `Non-numeric value "${token.trim()}" replaced with 0 during paste.`,
        })
      }
    }
    return { cell, warnings }
  },

  render(context, value) {
    const { mode, hasError, hasWarning, disabled } = context
    const isEditInteractive = mode === 'edit' || mode === 'validate'

    return (
      <span className="inline-flex gap-1">
        {SUB_FIELD_SPECS.map((spec) => {
          const readOnly = context.readOnlyField(spec.key)
          const raw = value[spec.key]

          if (!isEditInteractive || readOnly) {
            return (
              <span data-subfield={spec.key} data-testid="matrix-cell" key={spec.key}>
                {raw}
              </span>
            )
          }

          return (
            <input
              aria-invalid={hasError || undefined}
              className={clsx(
                'w-14 rounded border px-1 py-0.5 text-center text-xs',
                hasError
                  ? 'border-red-400 bg-red-50'
                  : hasWarning
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-slate-300',
              )}
              data-subfield={spec.key}
              disabled={disabled}
              key={spec.key}
              min={0}
              onBlur={() => {
                context.onSubFieldBlur(spec.key)
              }}
              onChange={(e) => {
                const next = e.target.valueAsNumber
                const safe =
                  Number.isFinite(next) && next >= 0 ? (spec.integer ? Math.floor(next) : next) : 0
                context.onSubFieldChange(spec.key, { ...value, [spec.key]: safe })
              }}
              onFocus={() => {
                context.onSubFieldFocus(spec.key)
              }}
              onPaste={(e) => {
                context.onPaste(e, spec.key)
              }}
              step={spec.integer ? 1 : 'any'}
              type="number"
              value={raw}
            />
          )
        })}
      </span>
    )
  },
}
