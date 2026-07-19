import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { useCallback } from 'react'
import type { CellAdapter, CellRenderContext, MatrixGridMode, PasteWarning } from './types'

// ---------------------------------------------------------------------------
// Column / row configuration
// ---------------------------------------------------------------------------

export interface GridColumn<TColKey extends string> {
  key: TColKey
  label: string
  /** True for the computed total column — never editable, never a paste target. */
  computed: boolean
}

export interface GridRow<TRowKey extends string> {
  key: TRowKey
  label: string
  /** True for computed rows (totalPermanent, grandTotal) — never editable. */
  computed: boolean
}

// ---------------------------------------------------------------------------
// Lock icon — inline SVG, no external dependency (identical to M2)
// ---------------------------------------------------------------------------

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mb-0.5 inline h-3 w-3"
      fill="currentColor"
      viewBox="0 0 12 12"
    >
      <rect height="6" rx="1" width="8" x="2" y="5.5" />
      <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MatrixGridProps<TRowKey extends string, TColKey extends string, TCell> {
  mode: MatrixGridMode
  data: Record<TRowKey, Record<TColKey, TCell>>
  adapter: CellAdapter<TCell>
  rows: ReadonlyArray<GridRow<TRowKey>>
  columns: ReadonlyArray<GridColumn<TColKey>>
  /** Editable rows in visual order (drives paste target addressing). */
  editableRows: readonly TRowKey[]
  /** Editable (demographic) columns in visual order (drives paste target addressing). */
  editableColumns: readonly TColKey[]
  disabled?: boolean
  columnHeaderLabel?: string
  /**
   * Per-sub-field read-only override. Return true to force a sub-field to render read-only in
   * edit/validate modes without changing the adapter. Consumers use this for policy such as EEA4
   * read-only headcount — the adapter itself stays policy-free.
   */
  readOnlyField?: (colKey: TColKey, subField: keyof TCell & string) => boolean
  /** Error/warning lookup by cell path, e.g. `topManagement.africanMale`. */
  errorsByCellPath?: Map<string, Array<{ severity: 'error' | 'warning' }>>
  onCellChange?: (rowKey: TRowKey, colKey: TColKey, next: TCell) => void
  onCellFocus?: (rowKey: TRowKey, colKey: TColKey) => void
  onCellBlur?: (rowKey: TRowKey, colKey: TColKey) => void
  onPasteWarnings?: (warnings: PasteWarning[]) => void
  /** Called with the fully pasted grid patch (row-major, boundary-clamped). */
  onPaste?: (patch: Record<TRowKey, Record<TColKey, TCell>>) => void
  banner?: ReactNode
  /** Rendered above the table when true (matrix-level saving indicator). */
  savingIndicator?: ReactNode
  testId?: string
}

// ---------------------------------------------------------------------------
// MatrixGrid — generic, cell-shape agnostic grid
// ---------------------------------------------------------------------------

/**
 * Generic EEA-style matrix grid.
 *
 * Modes (identical DOM guarantees to the original OccupationalMatrix):
 * - view / locked: cells render read-only (adapters emit zero <input>); locked adds aria-disabled
 *   on the wrapper, a lock icon in every column header, and pointer-events:none.
 * - validate: adds cell--error / cell--warning classes and aria-invalid on erroring inputs.
 *
 * Tab / Shift-Tab order: row-major across editable cells. For multi-value cells, sub-fields are
 * traversed in adapter `subFields` order WITHIN a cell before advancing to the next cell — this is
 * the natural DOM order because the adapter renders sub-field inputs in `subFields` order and the
 * grid emits cells left-to-right, top-to-bottom, so no manual tabIndex management is required.
 *
 * TSV paste (from a focused editable input, row-major): each cell consumes
 * N = adapter.subFields.length consecutive tokens per TSV row. A non-numeric token becomes 0 and
 * emits a PASTE_NON_NUMERIC warning. Pasting is clamped to the editable row/column bounds.
 */
export function MatrixGrid<TRowKey extends string, TColKey extends string, TCell>({
  mode,
  data,
  adapter,
  rows,
  columns,
  editableRows,
  editableColumns,
  disabled = false,
  columnHeaderLabel = 'Occupational level',
  readOnlyField,
  errorsByCellPath,
  onCellChange,
  onCellFocus,
  onCellBlur,
  onPasteWarnings,
  onPaste,
  banner,
  savingIndicator,
  testId = 'occupational-matrix',
}: MatrixGridProps<TRowKey, TColKey, TCell>) {
  const isDisabled = disabled || mode === 'locked'
  const subFieldCount = adapter.subFields.length

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, startRowIdx: number, startColIdx: number) => {
      e.preventDefault()
      const tsv = e.clipboardData.getData('text/plain')
      const tsvRows = tsv.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim().split('\n')

      const warnings: PasteWarning[] = []
      let patch = { ...data }

      for (const [r, tsvRow] of tsvRows.entries()) {
        const tokens = tsvRow.split('\t')
        const cellCount = Math.ceil(tokens.length / subFieldCount)
        for (let cellIdx = 0; cellIdx < cellCount; cellIdx += 1) {
          const targetRowIdx = startRowIdx + r
          const targetColIdx = startColIdx + cellIdx
          if (targetRowIdx >= editableRows.length) break
          if (targetColIdx >= editableColumns.length) break

          const rowKey = editableRows[targetRowIdx]
          const colKey = editableColumns[targetColIdx]
          if (rowKey === undefined || colKey === undefined) continue

          const cellTokens = tokens.slice(
            cellIdx * subFieldCount,
            cellIdx * subFieldCount + subFieldCount,
          )
          const parsed = adapter.parseTokens(cellTokens)
          for (const warning of parsed.warnings) {
            warnings.push({ ...warning, cellPath: `${rowKey}.${colKey}` })
          }

          patch = {
            ...patch,
            [rowKey]: { ...patch[rowKey], [colKey]: parsed.cell },
          }
        }
      }

      if (warnings.length > 0) {
        onPasteWarnings?.(warnings)
      }
      onPaste?.(patch)
    },
    [data, adapter, editableRows, editableColumns, subFieldCount, onPaste, onPasteWarnings],
  )

  return (
    <div
      aria-disabled={isDisabled ? 'true' : undefined}
      className={clsx('overflow-x-auto', isDisabled && 'pointer-events-none opacity-75')}
      data-testid={testId}
    >
      {savingIndicator}
      {banner}

      <table className="w-full border-collapse text-xs" role="grid">
        <thead>
          <tr>
            <th className="border border-slate-300 bg-slate-50 px-2 py-1 text-left font-semibold">
              {columnHeaderLabel}
            </th>
            {columns.map((col) => (
              <th
                className="border border-slate-300 bg-slate-50 px-2 py-1 text-center font-semibold"
                key={col.key}
                scope="col"
              >
                {mode === 'locked' && <LockIcon />} {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const editableRowIdx = editableRows.indexOf(row.key)

            return (
              <tr
                className={clsx(
                  row.computed && 'bg-slate-50 font-semibold',
                  mode === 'locked' && 'bg-slate-100',
                )}
                key={row.key}
              >
                <td className="border border-slate-300 px-2 py-1">{row.label}</td>

                {columns.map((col) => {
                  const cell = data[row.key][col.key]
                  const cellPath = `${row.key}.${col.key}`
                  const cellErrors = errorsByCellPath?.get(cellPath) ?? []
                  const hasError = cellErrors.some((x) => x.severity === 'error')
                  const hasWarning = !hasError && cellErrors.some((x) => x.severity === 'warning')
                  const editableColIdx = editableColumns.indexOf(col.key)
                  const isCellComputed = row.computed || col.computed

                  const context: CellRenderContext<TCell> = {
                    mode: isCellComputed ? 'view' : mode,
                    hasError,
                    hasWarning,
                    disabled,
                    cellPath,
                    readOnlyField: (subField) => readOnlyField?.(col.key, subField) ?? false,
                    onSubFieldChange: (_subField, next) => {
                      onCellChange?.(row.key, col.key, next)
                    },
                    onSubFieldFocus: () => {
                      onCellFocus?.(row.key, col.key)
                    },
                    onSubFieldBlur: () => {
                      onCellBlur?.(row.key, col.key)
                    },
                    onPaste: (event) => {
                      if (editableRowIdx !== -1 && editableColIdx !== -1) {
                        handlePaste(event, editableRowIdx, editableColIdx)
                      }
                    },
                  }

                  return (
                    <td
                      className={clsx(
                        'border border-slate-300 px-1 py-0.5 text-center',
                        isCellComputed && 'bg-slate-50',
                        mode === 'locked' && 'bg-slate-100',
                        hasError && 'cell--error bg-red-50',
                        hasWarning && 'cell--warning bg-amber-50',
                      )}
                      data-cell={cellPath}
                      key={col.key}
                    >
                      {adapter.render(context, cell)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
