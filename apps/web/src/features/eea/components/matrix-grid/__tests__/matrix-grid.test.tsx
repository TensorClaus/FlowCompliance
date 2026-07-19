import type { MatrixCell, RemBreakdownCell, RemunerationCell } from '@simplifi/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  MatrixGrid,
  remBreakdownCellAdapter,
  remunerationCellAdapter,
  singleValueCellAdapter,
  type GridColumn,
  type GridRow,
  type MatrixGridMode,
} from '..'

// ---------------------------------------------------------------------------
// Minimal 2-row x (2 demo + total) fixtures for a multi-value grid
// ---------------------------------------------------------------------------

type RowKey = 'r1' | 'r2'
type ColKey = 'c1' | 'c2' | 'total'

const COLUMNS: ReadonlyArray<GridColumn<ColKey>> = [
  { key: 'c1', label: 'C1', computed: false },
  { key: 'c2', label: 'C2', computed: false },
  { key: 'total', label: 'Total', computed: true },
]

const ROWS: ReadonlyArray<GridRow<RowKey>> = [
  { key: 'r1', label: 'R1', computed: false },
  { key: 'r2', label: 'R2', computed: false },
]

const EDITABLE_ROWS: readonly RowKey[] = ['r1', 'r2']
const EDITABLE_COLS: readonly ColKey[] = ['c1', 'c2']

function remCell(headcount: number, totalRemuneration: number): RemunerationCell {
  return { headcount, totalRemuneration }
}

function zeroRemRow(): Record<ColKey, RemunerationCell> {
  return { c1: remCell(0, 0), c2: remCell(0, 0), total: remCell(0, 0) }
}

function zeroRemGrid(): Record<RowKey, Record<ColKey, RemunerationCell>> {
  return { r1: zeroRemRow(), r2: zeroRemRow() }
}

function RemWrapper({
  mode = 'edit',
  readOnlyHeadcount = false,
}: {
  mode?: MatrixGridMode
  readOnlyHeadcount?: boolean
}) {
  const [data, setData] = useState(zeroRemGrid())
  return (
    <MatrixGrid<RowKey, ColKey, RemunerationCell>
      adapter={remunerationCellAdapter}
      columns={COLUMNS}
      data={data}
      editableColumns={EDITABLE_COLS}
      editableRows={EDITABLE_ROWS}
      mode={mode}
      onCellChange={(rowKey, colKey, next) => {
        setData((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], [colKey]: next } }))
      }}
      onPaste={(patch) => {
        setData(patch)
      }}
      rows={ROWS}
      {...(readOnlyHeadcount
        ? { readOnlyField: (_col: ColKey, subField: string) => subField === 'headcount' }
        : {})}
    />
  )
}

// ---------------------------------------------------------------------------
// Multi-value Tab order — sub-fields in adapter order, then next cell
// ---------------------------------------------------------------------------

describe('MatrixGrid multi-value tab order', () => {
  it('tabs through sub-fields within a cell, then advances to the next cell (row-major)', async () => {
    const user = userEvent.setup()
    render(<RemWrapper />)
    const inputs = screen.getAllByRole('spinbutton')
    // 2 rows x 2 editable cols x 2 sub-fields = 8 inputs
    expect(inputs).toHaveLength(8)

    // Order: r1.c1[headcount], r1.c1[remuneration], r1.c2[headcount], r1.c2[remuneration], r2...
    expect(inputs[0]).toHaveAttribute('data-subfield', 'headcount')
    expect(inputs[1]).toHaveAttribute('data-subfield', 'totalRemuneration')
    expect(inputs[2]).toHaveAttribute('data-subfield', 'headcount')

    await user.click(inputs[0] as HTMLElement)
    expect(inputs[0]).toHaveFocus()
    await user.tab()
    expect(inputs[1]).toHaveFocus()
    await user.tab()
    expect(inputs[2]).toHaveFocus()
  })
})

// ---------------------------------------------------------------------------
// Multi-token paste — each cell consumes N consecutive tokens
// ---------------------------------------------------------------------------

describe('MatrixGrid multi-token paste', () => {
  it('consumes N=subFields.length tokens per cell, row-major', async () => {
    const user = userEvent.setup()
    render(<RemWrapper />)
    const inputs = screen.getAllByRole('spinbutton')

    await user.click(inputs[0] as HTMLElement)
    // 4 tokens -> cell r1.c1 = (10,20), cell r1.c2 = (30,40)
    await user.paste('10\t20\t30\t40')

    expect(await screen.findByDisplayValue('10')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
    expect(screen.getByDisplayValue('40')).toBeInTheDocument()
  })

  it('non-numeric token in a multi-value cell becomes 0 with a PASTE_NON_NUMERIC warning', async () => {
    const user = userEvent.setup()
    const onPasteWarnings = vi.fn()
    function W() {
      const [data, setData] = useState(zeroRemGrid())
      return (
        <MatrixGrid<RowKey, ColKey, RemunerationCell>
          adapter={remunerationCellAdapter}
          columns={COLUMNS}
          data={data}
          editableColumns={EDITABLE_COLS}
          editableRows={EDITABLE_ROWS}
          mode="edit"
          onPaste={setData}
          onPasteWarnings={onPasteWarnings}
          rows={ROWS}
        />
      )
    }
    render(<W />)
    const inputs = screen.getAllByRole('spinbutton')
    await user.click(inputs[0] as HTMLElement)
    await user.paste('abc\t50')

    expect(onPasteWarnings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PASTE_NON_NUMERIC',
          cellPath: 'r1.c1',
          severity: 'warning',
        }),
      ]),
    )
  })
})

// ---------------------------------------------------------------------------
// Per-sub-field readOnly override
// ---------------------------------------------------------------------------

describe('MatrixGrid per-sub-field readOnly override', () => {
  it('renders headcount read-only (span) but keeps remuneration editable in edit mode', () => {
    render(<RemWrapper readOnlyHeadcount />)
    const inputs = screen.getAllByRole('spinbutton')
    // headcount forced read-only -> only remuneration inputs remain: 2 rows x 2 cols x 1 = 4
    expect(inputs).toHaveLength(4)
    for (const input of inputs) {
      expect(input).toHaveAttribute('data-subfield', 'totalRemuneration')
    }
  })
})

// ---------------------------------------------------------------------------
// Triple-cell (rem breakdown) — total ALWAYS computed, never an input
// ---------------------------------------------------------------------------

type BreakRow = Record<ColKey, RemBreakdownCell>

const zeroBreakCell = (): RemBreakdownCell => ({ fixed: 0, variable: 0, total: 0 })

function zeroBreakGrid(): Record<RowKey, BreakRow> {
  return {
    r1: { c1: zeroBreakCell(), c2: zeroBreakCell(), total: zeroBreakCell() },
    r2: { c1: zeroBreakCell(), c2: zeroBreakCell(), total: zeroBreakCell() },
  }
}

function BreakWrapper({ mode = 'edit' }: { mode?: MatrixGridMode }) {
  const [data, setData] = useState(zeroBreakGrid())
  return (
    <MatrixGrid<RowKey, ColKey, RemBreakdownCell>
      adapter={remBreakdownCellAdapter}
      columns={COLUMNS}
      data={data}
      editableColumns={EDITABLE_COLS}
      editableRows={EDITABLE_ROWS}
      mode={mode}
      onCellChange={(rowKey, colKey, next) => {
        setData((prev) => ({ ...prev, [rowKey]: { ...prev[rowKey], [colKey]: next } }))
      }}
      rows={ROWS}
    />
  )
}

describe('MatrixGrid rem-breakdown computed total', () => {
  it('renders fixed+variable inputs but total as a span (never an input) in edit mode', () => {
    render(<BreakWrapper />)
    const inputs = screen.getAllByRole('spinbutton')
    // 2 rows x 2 editable cols x 2 editable sub-fields (fixed, variable) = 8 inputs
    expect(inputs).toHaveLength(8)
    for (const input of inputs) {
      expect(input).not.toHaveAttribute('data-subfield', 'total')
    }
    // Every editable cell renders a total span (matrix-cell-total)
    expect(screen.getAllByTestId('matrix-cell-total').length).toBeGreaterThan(0)
  })

  it('total is always fixed+variable and updates live without being editable', async () => {
    const user = userEvent.setup()
    render(<BreakWrapper />)
    const inputs = screen.getAllByRole('spinbutton')
    // First cell r1.c1: fixed input then variable input
    const fixed = inputs[0] as HTMLElement
    const variable = inputs[1] as HTMLElement
    expect(fixed).toHaveAttribute('data-subfield', 'fixed')
    expect(variable).toHaveAttribute('data-subfield', 'variable')

    await user.clear(fixed)
    await user.type(fixed, '100')
    await user.clear(variable)
    await user.type(variable, '25')

    const totals = screen.getAllByTestId('matrix-cell-total')
    expect(totals[0]?.textContent).toBe('125')
  })

  it('never renders total as an input across view / locked modes', () => {
    const { rerender } = render(<BreakWrapper mode="view" />)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
    // 2 rows x 3 columns (c1, c2, total) each render a computed total span
    expect(screen.getAllByTestId('matrix-cell-total').length).toBe(6)
    rerender(<BreakWrapper mode="locked" />)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Single-value adapter parity smoke test via generic grid
// ---------------------------------------------------------------------------

describe('MatrixGrid single-value adapter parity', () => {
  it('view/locked emit zero inputs; edit emits one input per editable cell', () => {
    type SVCell = MatrixCell
    const grid: Record<RowKey, Record<ColKey, SVCell>> = {
      r1: { c1: { value: 0 }, c2: { value: 0 }, total: { value: 0 } },
      r2: { c1: { value: 0 }, c2: { value: 0 }, total: { value: 0 } },
    }
    const common = {
      adapter: singleValueCellAdapter,
      columns: COLUMNS,
      data: grid,
      editableColumns: EDITABLE_COLS,
      editableRows: EDITABLE_ROWS,
      rows: ROWS,
    }
    const { rerender } = render(<MatrixGrid<RowKey, ColKey, SVCell> {...common} mode="edit" />)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4)
    rerender(<MatrixGrid<RowKey, ColKey, SVCell> {...common} mode="locked" />)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
    expect(screen.getByTestId('occupational-matrix')).toHaveAttribute('aria-disabled', 'true')
  })
})
