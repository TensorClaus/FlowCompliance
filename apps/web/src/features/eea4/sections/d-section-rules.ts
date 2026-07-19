import type { OccupationalMatrix } from '@simplifi/shared'
import { SECTION_C_ROW_ORDER } from './section-c-prefill'

export type DSectionRowKey = keyof OccupationalMatrix

export function levelHeadcountTotalsByRow(
  sourceMatrix: OccupationalMatrix,
): Record<DSectionRowKey, number> {
  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [rowKey, sourceMatrix[rowKey].total.value]),
  ) as Record<DSectionRowKey, number>
}

export function singleEmployeeRows(sourceMatrix: OccupationalMatrix): ReadonlySet<DSectionRowKey> {
  const totals = levelHeadcountTotalsByRow(sourceMatrix)
  return new Set(SECTION_C_ROW_ORDER.filter((rowKey) => totals[rowKey] === 1))
}
