import type { ReactNode } from 'react'

/**
 * Warning emitted when pasting tabular data into the grid.
 * Structurally compatible with the occupational-matrix PASTE_NON_NUMERIC validation error
 * so existing consumers can forward it through onValidationError unchanged.
 */
export interface PasteWarning {
  code: 'PASTE_NON_NUMERIC'
  cellPath: string
  severity: 'warning'
  message: string
}

export type MatrixGridMode = 'view' | 'edit' | 'validate' | 'locked'

/**
 * Per-sub-field rendering context passed to a CellAdapter's render function.
 *
 * `readOnlyField(subField)` lets a consumer force an individual editable sub-field to render
 * read-only (e.g. EEA4 headcount) WITHOUT the adapter hardcoding that policy. Adapters that opt
 * into per-sub-field read-only overrides must consult this predicate; it defaults to always-false.
 */
export interface CellRenderContext<TCell> {
  mode: MatrixGridMode
  /** True when the cell is in an error state (validate mode). Adds cell--error + aria-invalid. */
  hasError: boolean
  /** True when the cell is in a warning state (validate mode). Adds cell--warning. */
  hasWarning: boolean
  /** DOM disabled flag for inputs (locked mode or an explicit disabled prop). */
  disabled: boolean
  /** Stable cell path, e.g. `topManagement.africanMale`. */
  cellPath: string
  /** Returns true when the named sub-field should render read-only regardless of mode. */
  readOnlyField: (subField: keyof TCell & string) => boolean
  /** Called when a sub-field value changes (edit/validate modes only). */
  onSubFieldChange: (subField: keyof TCell & string, next: TCell) => void
  /** Focus handler for autosave previous-value capture. */
  onSubFieldFocus: (subField: keyof TCell & string) => void
  /** Blur handler for autosave (fires the persisted event). */
  onSubFieldBlur: (subField: keyof TCell & string) => void
  /** Paste handler; receives the native clipboard event on any editable sub-field input. */
  onPaste: (event: React.ClipboardEvent<HTMLInputElement>, subField: keyof TCell & string) => void
}

/**
 * Adapter that teaches MatrixGrid how to render, edit, parse, and total a single cell type.
 *
 * Ship one adapter per cell shape. All grid mechanics (mode DOM guarantees, tab order, paste,
 * computed totals) are driven through this interface — the grid itself is cell-shape agnostic.
 */
export interface CellAdapter<TCell> {
  /**
   * Editable sub-fields in visual/tab order. For a single-value cell this is `['value']`; for a
   * two-part cell this is the two editable keys. Computed sub-fields (e.g. a derived total) are
   * NOT listed here — they are never focusable and never consume paste tokens.
   */
  subFields: readonly (keyof TCell & string)[]

  /** Render the cell for the given mode. In view/locked modes must emit zero <input> elements. */
  render(context: CellRenderContext<TCell>, value: TCell): ReactNode

  /**
   * Consume exactly `subFields.length` clipboard tokens (row-major) into a cell.
   * Non-numeric tokens become 0 and produce a PASTE_NON_NUMERIC warning (cellPath filled by grid).
   */
  parseTokens(tokens: string[]): { cell: TCell; warnings: PasteWarning[] }

  /** The additive identity for this cell type — used to seed computed totals. */
  zero(): TCell

  /** Combine two cells for computed row/column totals. */
  add(a: TCell, b: TCell): TCell
}
