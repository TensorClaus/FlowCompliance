import type { RemBreakdownCell } from '@simplifi/shared'
import { clsx } from 'clsx'
import type { CellAdapter, PasteWarning } from '../types'

const SUB_FIELDS = ['fixed', 'variable'] as const

function parseNumber(token: string): { value: number; warning: boolean } {
  const raw = token.trim()
  const num = Number(raw)
  const isValid = raw !== '' && Number.isFinite(num) && num >= 0
  return { value: isValid ? num : 0, warning: !isValid && raw !== '' }
}

function computeTotal(cell: Pick<RemBreakdownCell, 'fixed' | 'variable'>): number {
  return cell.fixed + cell.variable
}

/**
 * Adapter for EEA4 Sections D1/D2 remuneration breakdown cells.
 *
 * `fixed` and `variable` are editable; `total` is ALWAYS derived as fixed + variable and rendered
 * as a <span> — never an <input>, in any mode. `total` is excluded from `subFields`, so it is never
 * focusable and never consumes a paste token.
 */
export const remBreakdownCellAdapter: CellAdapter<RemBreakdownCell> = {
  subFields: SUB_FIELDS,

  zero() {
    return { fixed: 0, variable: 0, total: 0 }
  },

  add(a, b) {
    const fixed = a.fixed + b.fixed
    const variable = a.variable + b.variable
    return { fixed, variable, total: fixed + variable }
  },

  parseTokens(tokens) {
    const warnings: PasteWarning[] = []
    const [fixedToken = '', variableToken = ''] = tokens
    const fixedParsed = parseNumber(fixedToken)
    const variableParsed = parseNumber(variableToken)
    for (const [token, parsed] of [
      [fixedToken, fixedParsed],
      [variableToken, variableParsed],
    ] as const) {
      if (parsed.warning) {
        warnings.push({
          code: 'PASTE_NON_NUMERIC',
          cellPath: '',
          severity: 'warning',
          message: `Non-numeric value "${token.trim()}" replaced with 0 during paste.`,
        })
      }
    }
    const fixed = fixedParsed.value
    const variable = variableParsed.value
    return { cell: { fixed, variable, total: fixed + variable }, warnings }
  },

  render(context, value) {
    const { mode, hasError, hasWarning, disabled } = context
    const isEditInteractive = mode === 'edit' || mode === 'validate'
    const total = computeTotal(value)

    const inputClass = clsx(
      'w-14 rounded border px-1 py-0.5 text-center text-xs',
      hasError && 'border-red-400 bg-red-50',
      !hasError && hasWarning && 'border-amber-400 bg-amber-50',
      !hasError && !hasWarning && 'border-slate-300',
    )

    return (
      <span className="inline-flex gap-1">
        {SUB_FIELDS.map((subField) => {
          const readOnly = context.readOnlyField(subField)
          const raw = value[subField]

          if (!isEditInteractive || readOnly) {
            return (
              <span data-subfield={subField} data-testid="matrix-cell" key={subField}>
                {raw}
              </span>
            )
          }

          return (
            <input
              aria-invalid={hasError || undefined}
              className={inputClass}
              data-subfield={subField}
              disabled={disabled}
              key={subField}
              min={0}
              onBlur={() => {
                context.onSubFieldBlur(subField)
              }}
              onChange={(e) => {
                const next = e.target.valueAsNumber
                const safe = Number.isFinite(next) && next >= 0 ? next : 0
                const updated = { ...value, [subField]: safe }
                context.onSubFieldChange(subField, { ...updated, total: computeTotal(updated) })
              }}
              onFocus={() => {
                context.onSubFieldFocus(subField)
              }}
              onPaste={(e) => {
                context.onPaste(e, subField)
              }}
              step="any"
              type="number"
              value={raw}
            />
          )
        })}
        <span data-subfield="total" data-testid="matrix-cell-total">
          {total}
        </span>
      </span>
    )
  },
}
