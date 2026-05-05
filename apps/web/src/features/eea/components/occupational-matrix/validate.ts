import type { MatrixRow, OccupationalMatrix } from '@simplifi/shared'

export type MatrixValidationCode =
  | 'NEGATIVE'
  | 'NON_INTEGER'
  | 'FOREIGN_NATIONAL_IN_DESIGNATED'
  | 'COLUMN_TOTAL_MISMATCH'
  | 'DISABILITY_BELOW_3PCT'
  | 'DESIGNATED_GROUP_MISSING_TOP4'
  | 'CELL_EXCEEDS_GRAND_TOTAL'
  | 'PASTE_NON_NUMERIC'

export type MatrixValidationSeverity = 'error' | 'warning'

export interface MatrixValidationError {
  code: MatrixValidationCode
  cellPath: string | null
  severity: MatrixValidationSeverity
  message: string
}

export interface MatrixValidateOptions {
  isDesignatedEmployer: boolean
  disabilityHeadcount: number
}

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

const ALL_COLS = [...DEMO_COLS, 'total'] as const satisfies ReadonlyArray<keyof MatrixRow>

const ALL_ROWS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'temporaryEmployees',
  'totalPermanent',
  'grandTotal',
] as const satisfies ReadonlyArray<keyof OccupationalMatrix>

const EDITABLE_ROWS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'temporaryEmployees',
] as const satisfies ReadonlyArray<keyof OccupationalMatrix>

const PERMANENT_ROWS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
] as const satisfies ReadonlyArray<keyof OccupationalMatrix>

const DESIGNATED_COLS = [
  'africanMale',
  'africanFemale',
  'colouredMale',
  'colouredFemale',
  'indianMale',
  'indianFemale',
  'whiteMale',
  'whiteFemale',
] as const satisfies ReadonlyArray<keyof Omit<MatrixRow, 'total'>>

const TOP4_ROWS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
] as const satisfies ReadonlyArray<keyof OccupationalMatrix>

export function validateOccupationalMatrix(
  data: OccupationalMatrix,
  opts: MatrixValidateOptions,
): MatrixValidationError[] {
  const errors: MatrixValidationError[] = []

  // NEGATIVE and NON_INTEGER — cell-level structural checks
  for (const rowKey of ALL_ROWS) {
    for (const col of ALL_COLS) {
      const v = data[rowKey][col].value
      const path = `${rowKey}.${col}`

      if (v < 0) {
        errors.push({
          code: 'NEGATIVE',
          cellPath: path,
          severity: 'error',
          message: `Cell ${path} has negative value ${String(v)}.`,
        })
      }

      if (!Number.isInteger(v)) {
        errors.push({
          code: 'NON_INTEGER',
          cellPath: path,
          severity: 'error',
          message: `Cell ${path} must be a whole number (got ${String(v)}).`,
        })
      }
    }
  }

  // FOREIGN_NATIONAL_IN_DESIGNATED — remind that foreign nationals must be excluded from designated counts
  // Fires once at grand total level when foreign national headcount > 0 (rule_eea_006)
  const foreignTotal =
    data.grandTotal.foreignNationalMale.value + data.grandTotal.foreignNationalFemale.value
  if (foreignTotal > 0) {
    errors.push({
      code: 'FOREIGN_NATIONAL_IN_DESIGNATED',
      cellPath: 'grandTotal.foreignNational',
      severity: 'warning',
      message: `${String(foreignTotal)} foreign national(s) detected. Confirm they are excluded from designated group representation calculations (rule_eea_006).`,
    })
  }

  // COLUMN_TOTAL_MISMATCH — row totals and calculated rows must match their constituent sums
  // Check editable row totals
  for (const rowKey of EDITABLE_ROWS) {
    const row = data[rowKey]
    const expected = DEMO_COLS.reduce((s, c) => s + row[c].value, 0)
    const actual = row.total.value
    if (expected !== actual) {
      errors.push({
        code: 'COLUMN_TOTAL_MISMATCH',
        cellPath: `${rowKey}.total`,
        severity: 'error',
        message: `Row total for "${rowKey}" is ${String(actual)} but sum of demographic columns is ${String(expected)}.`,
      })
    }
  }

  // Check totalPermanent per column
  for (const col of ALL_COLS) {
    const expected = PERMANENT_ROWS.reduce((s, r) => s + data[r][col].value, 0)
    const actual = data.totalPermanent[col].value
    if (expected !== actual) {
      errors.push({
        code: 'COLUMN_TOTAL_MISMATCH',
        cellPath: `totalPermanent.${col}`,
        severity: 'error',
        message: `totalPermanent.${col} is ${String(actual)} but sum of permanent levels is ${String(expected)}.`,
      })
    }
  }

  // Check grandTotal per column
  for (const col of ALL_COLS) {
    const expected = data.totalPermanent[col].value + data.temporaryEmployees[col].value
    const actual = data.grandTotal[col].value
    if (expected !== actual) {
      errors.push({
        code: 'COLUMN_TOTAL_MISMATCH',
        cellPath: `grandTotal.${col}`,
        severity: 'error',
        message: `grandTotal.${col} is ${String(actual)} but totalPermanent + temporaryEmployees is ${String(expected)}.`,
      })
    }
  }

  // DISABILITY_BELOW_3PCT — EEA s27, rule_eea_013
  if (opts.isDesignatedEmployer) {
    const grandTotalHeadcount = data.grandTotal.total.value
    if (grandTotalHeadcount > 0) {
      const pct = (opts.disabilityHeadcount / grandTotalHeadcount) * 100
      if (pct < 3) {
        errors.push({
          code: 'DISABILITY_BELOW_3PCT',
          cellPath: null,
          severity: 'error',
          message: `Disability representation is ${pct.toFixed(2)}% (${String(opts.disabilityHeadcount)} of ${String(grandTotalHeadcount)}). Designated employers must reach 3% (rule_eea_013, EEA s27).`,
        })
      }
    }
  }

  // DESIGNATED_GROUP_MISSING_TOP4 — rule_eea_008, GN 6124
  if (opts.isDesignatedEmployer) {
    for (const rowKey of TOP4_ROWS) {
      const designatedSum = DESIGNATED_COLS.reduce((s, c) => s + data[rowKey][c].value, 0)
      if (designatedSum === 0) {
        errors.push({
          code: 'DESIGNATED_GROUP_MISSING_TOP4',
          cellPath: rowKey,
          severity: 'warning',
          message: `No designated group employees at "${rowKey}" level. Designated employers must track representation at all top 4 levels (rule_eea_008, GN 6124).`,
        })
      }
    }
  }

  // CELL_EXCEEDS_GRAND_TOTAL — any demographic cell > grand total
  const grandTotalValue = data.grandTotal.total.value
  if (grandTotalValue > 0) {
    for (const rowKey of ALL_ROWS) {
      for (const col of DEMO_COLS) {
        const v = data[rowKey][col].value
        if (v > grandTotalValue) {
          errors.push({
            code: 'CELL_EXCEEDS_GRAND_TOTAL',
            cellPath: `${rowKey}.${col}`,
            severity: 'error',
            message: `Cell ${rowKey}.${col} (${String(v)}) exceeds grand total (${String(grandTotalValue)}).`,
          })
        }
      }
    }
  }

  // PASTE_NON_NUMERIC is emitted by the paste handler via onValidationError and is not computed here.

  return errors
}
