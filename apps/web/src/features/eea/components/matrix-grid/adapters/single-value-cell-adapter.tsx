import type { MatrixCell } from '@simplifi/shared'
import { clsx } from 'clsx'
import type { CellAdapter, PasteWarning } from '../types'

const SUB_FIELDS = ['value'] as const

/**
 * Parse a single clipboard token into a MatrixCell.
 * Valid tokens are non-negative integers; anything else becomes 0 with a PASTE_NON_NUMERIC warning.
 * cellPath is filled in by the grid (left blank here).
 */
function parseSingleValue(token: string): { value: number; warning: boolean } {
  const raw = token.trim()
  const num = Number(raw)
  const isValid = raw !== '' && Number.isFinite(num) && Number.isInteger(num) && num >= 0
  return { value: isValid ? num : 0, warning: !isValid && raw !== '' }
}

/**
 * Adapter reproducing M2 OccupationalMatrix cell behaviour: a single editable integer `value`.
 */
export const singleValueCellAdapter: CellAdapter<MatrixCell> = {
  subFields: SUB_FIELDS,

  zero() {
    return { value: 0 }
  },

  add(a, b) {
    return { value: a.value + b.value }
  },

  parseTokens(tokens) {
    const [token = ''] = tokens
    const { value, warning } = parseSingleValue(token)
    const warnings: PasteWarning[] = []
    if (warning) {
      warnings.push({
        code: 'PASTE_NON_NUMERIC',
        cellPath: '',
        severity: 'warning',
        message: `Non-numeric value "${token.trim()}" replaced with 0 during paste.`,
      })
    }
    return { cell: { value }, warnings }
  },

  render(context, value) {
    const { mode, hasError, hasWarning, disabled, onSubFieldChange, onSubFieldFocus } = context
    const isEditInteractive = mode === 'edit' || mode === 'validate'
    const isReadOnly = context.readOnlyField('value')

    if (!isEditInteractive || isReadOnly) {
      return <span data-testid="matrix-cell">{value.value}</span>
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
        disabled={disabled}
        min={0}
        onBlur={() => {
          context.onSubFieldBlur('value')
        }}
        onChange={(e) => {
          const raw = e.target.valueAsNumber
          const safe = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0
          onSubFieldChange('value', { value: safe })
        }}
        onFocus={() => {
          onSubFieldFocus('value')
        }}
        onPaste={(e) => {
          context.onPaste(e, 'value')
        }}
        step={1}
        type="number"
        value={value.value}
      />
    )
  },
}
