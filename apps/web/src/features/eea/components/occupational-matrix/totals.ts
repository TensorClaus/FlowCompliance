import type { MatrixCell, MatrixRow, OccupationalMatrix } from '@simplifi/shared'

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

type DemoCol = (typeof DEMO_COLS)[number]

function buildRow(colValues: Record<DemoCol, MatrixCell>): MatrixRow {
  const total = DEMO_COLS.reduce((s, c) => s + colValues[c].value, 0)
  return { ...colValues, total: { value: total } } as MatrixRow
}

function withRowTotal(row: MatrixRow): MatrixRow {
  const total = DEMO_COLS.reduce((s, c) => s + row[c].value, 0)
  return { ...row, total: { value: total } }
}

function colSums(rows: MatrixRow[]): Record<DemoCol, MatrixCell> {
  const result = {} as Record<DemoCol, MatrixCell>
  for (const col of DEMO_COLS) {
    result[col] = { value: rows.reduce((s, r) => s + r[col].value, 0) }
  }
  return result
}

export function computeMatrixTotals(data: OccupationalMatrix): OccupationalMatrix {
  const topManagement = withRowTotal(data.topManagement)
  const seniorManagement = withRowTotal(data.seniorManagement)
  const professionallyQualified = withRowTotal(data.professionallyQualified)
  const skilledTechnical = withRowTotal(data.skilledTechnical)
  const semiSkilled = withRowTotal(data.semiSkilled)
  const unskilled = withRowTotal(data.unskilled)
  const temporaryEmployees = withRowTotal(data.temporaryEmployees)

  const permanentRows = [
    topManagement,
    seniorManagement,
    professionallyQualified,
    skilledTechnical,
    semiSkilled,
    unskilled,
  ]

  const totalPermanent = buildRow(colSums(permanentRows))

  const grandColValues = {} as Record<DemoCol, MatrixCell>
  for (const col of DEMO_COLS) {
    grandColValues[col] = { value: totalPermanent[col].value + temporaryEmployees[col].value }
  }
  const grandTotal = buildRow(grandColValues)

  return {
    topManagement,
    seniorManagement,
    professionallyQualified,
    skilledTechnical,
    semiSkilled,
    unskilled,
    totalPermanent,
    temporaryEmployees,
    grandTotal,
  }
}
