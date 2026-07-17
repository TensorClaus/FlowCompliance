import type { MatrixRow, OccupationalMatrix } from '@simplifi/shared'
import { computeGridTotals, type GridTotalsConfig } from '../matrix-grid'
import { singleValueCellAdapter } from '../matrix-grid'

const DEMO_COLS = [
  'africanMale',
  'africanFemale',
  'colouredMale',
  'colouredFemale',
  'indianMale',
  'indianFemale',
  'whiteMale',
  'whiteFemale',
  'foreignNationalMale',
  'foreignNationalFemale',
] as const satisfies ReadonlyArray<keyof Omit<MatrixRow, 'total'>>

const TOTALS_CONFIG: GridTotalsConfig<keyof OccupationalMatrix, keyof MatrixRow> = {
  demoCols: DEMO_COLS,
  totalCol: 'total',
  editableRows: [
    'topManagement',
    'seniorManagement',
    'professionallyQualified',
    'skilledTechnical',
    'semiSkilled',
    'unskilled',
    'temporaryEmployees',
  ],
  permanentRows: [
    'topManagement',
    'seniorManagement',
    'professionallyQualified',
    'skilledTechnical',
    'semiSkilled',
    'unskilled',
  ],
  totalPermanentRow: 'totalPermanent',
  temporaryRow: 'temporaryEmployees',
  grandTotalRow: 'grandTotal',
}

/**
 * Single-value re-export of the generic grid totals for EEA2 Table 1.1.
 * Signature is unchanged so existing callers (OccupationalMatrix, validate tests) are untouched.
 */
export function computeMatrixTotals(data: OccupationalMatrix): OccupationalMatrix {
  return computeGridTotals(data, singleValueCellAdapter, TOTALS_CONFIG)
}
