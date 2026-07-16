import type { CellAdapter } from './types'

/**
 * Generic total-computation config. Describes the EEA2-style matrix shape without hardcoding the
 * cell type: N demographic columns, a per-row total column, and a fixed set of computed rows
 * (totalPermanent = sum of permanent rows; grandTotal = totalPermanent + temporaryEmployees).
 */
export interface GridTotalsConfig<TRowKey extends string, TColKey extends string> {
  /** Editable demographic columns (excludes the computed total column). */
  demoCols: readonly TColKey[]
  /** The computed total column key. */
  totalCol: TColKey
  /** Editable rows whose total column is derived from demoCols. */
  editableRows: readonly TRowKey[]
  /** Rows summed into the totalPermanent computed row. */
  permanentRows: readonly TRowKey[]
  /** Computed row summing permanentRows. */
  totalPermanentRow: TRowKey
  /** Temporary-employees row (added to totalPermanent to form grandTotal). */
  temporaryRow: TRowKey
  /** Computed grand-total row. */
  grandTotalRow: TRowKey
}

type Row<TColKey extends string, TCell> = Record<TColKey, TCell>
type Grid<TRowKey extends string, TColKey extends string, TCell> = Record<
  TRowKey,
  Row<TColKey, TCell>
>

function withRowTotal<TColKey extends string, TCell>(
  row: Row<TColKey, TCell>,
  demoCols: readonly TColKey[],
  totalCol: TColKey,
  adapter: CellAdapter<TCell>,
): Row<TColKey, TCell> {
  let total = adapter.zero()
  for (const col of demoCols) {
    total = adapter.add(total, row[col])
  }
  return { ...row, [totalCol]: total }
}

function sumRows<TColKey extends string, TCell>(
  rows: Array<Row<TColKey, TCell>>,
  demoCols: readonly TColKey[],
  totalCol: TColKey,
  adapter: CellAdapter<TCell>,
): Row<TColKey, TCell> {
  const result = {} as Row<TColKey, TCell>
  for (const col of demoCols) {
    let sum = adapter.zero()
    for (const row of rows) {
      sum = adapter.add(sum, row[col])
    }
    result[col] = sum
  }
  return withRowTotal(result, demoCols, totalCol, adapter)
}

/**
 * Compute all derived totals for an EEA2-style matrix using the supplied cell adapter.
 * Behaviour is identical to the M2 single-value totals for a single-value adapter, but works for
 * any cell shape (headcount+remuneration, fixed+variable, …) via adapter.add / adapter.zero.
 */
export function computeGridTotals<
  TRowKey extends string,
  TColKey extends string,
  TCell,
  TGrid extends Grid<TRowKey, TColKey, TCell>,
>(data: TGrid, adapter: CellAdapter<TCell>, config: GridTotalsConfig<TRowKey, TColKey>): TGrid {
  const { demoCols, totalCol } = config

  const result = { ...data } as Grid<TRowKey, TColKey, TCell>

  for (const rowKey of config.editableRows) {
    result[rowKey] = withRowTotal(data[rowKey], demoCols, totalCol, adapter)
  }

  const totalPermanent = sumRows(
    config.permanentRows.map((r) => result[r]),
    demoCols,
    totalCol,
    adapter,
  )
  result[config.totalPermanentRow] = totalPermanent

  const grandTotal = sumRows(
    [totalPermanent, result[config.temporaryRow]],
    demoCols,
    totalCol,
    adapter,
  )
  result[config.grandTotalRow] = grandTotal

  return result as TGrid
}
