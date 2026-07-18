import { describe, expect, it } from 'vitest'
import {
  MatrixCellSchema,
  OccupationalMatrixSchema,
  RemBreakdownCellSchema,
  RemBreakdownMatrixSchema,
  RemunerationCellSchema,
  RemunerationMatrixSchema,
} from '../matrix.js'

const OCCUPATIONAL_LEVELS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'totalPermanent',
  'temporaryEmployees',
  'grandTotal',
] as const

const DEMOGRAPHIC_CELLS = [
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
  'total',
] as const

function buildRow<T>(cell: T): Record<(typeof DEMOGRAPHIC_CELLS)[number], T> {
  return Object.fromEntries(DEMOGRAPHIC_CELLS.map((key) => [key, cell])) as Record<
    (typeof DEMOGRAPHIC_CELLS)[number],
    T
  >
}

function buildMatrix<T>(
  row: Record<string, T>,
): Record<(typeof OCCUPATIONAL_LEVELS)[number], Record<string, T>> {
  return Object.fromEntries(OCCUPATIONAL_LEVELS.map((key) => [key, row])) as Record<
    (typeof OCCUPATIONAL_LEVELS)[number],
    Record<string, T>
  >
}

describe('MatrixCellSchema', () => {
  it('accepts a non-negative integer value with an optional percent', () => {
    expect(MatrixCellSchema.safeParse({ value: 5, percent: 12.5 }).success).toBe(true)
  })

  it('accepts a value with no percent (percent is optional)', () => {
    expect(MatrixCellSchema.safeParse({ value: 0 }).success).toBe(true)
  })

  it('rejects a negative value (headcounts cannot be negative)', () => {
    expect(MatrixCellSchema.safeParse({ value: -1 }).success).toBe(false)
  })

  it('rejects a non-integer value', () => {
    expect(MatrixCellSchema.safeParse({ value: 1.5 }).success).toBe(false)
  })

  it('rejects a percent above 100', () => {
    expect(MatrixCellSchema.safeParse({ value: 1, percent: 100.1 }).success).toBe(false)
  })

  it('rejects a negative percent', () => {
    expect(MatrixCellSchema.safeParse({ value: 1, percent: -0.1 }).success).toBe(false)
  })

  it('accepts the percent boundary values 0 and 100', () => {
    expect(MatrixCellSchema.safeParse({ value: 1, percent: 0 }).success).toBe(true)
    expect(MatrixCellSchema.safeParse({ value: 1, percent: 100 }).success).toBe(true)
  })
})

describe('RemunerationCellSchema', () => {
  it('accepts non-negative headcount and totalRemuneration', () => {
    expect(
      RemunerationCellSchema.safeParse({ headcount: 3, totalRemuneration: 450_000 }).success,
    ).toBe(true)
  })

  it('rejects a fractional headcount', () => {
    expect(
      RemunerationCellSchema.safeParse({ headcount: 3.5, totalRemuneration: 450_000 }).success,
    ).toBe(false)
  })

  it('rejects negative totalRemuneration', () => {
    expect(RemunerationCellSchema.safeParse({ headcount: 1, totalRemuneration: -1 }).success).toBe(
      false,
    )
  })
})

describe('RemBreakdownCellSchema', () => {
  it('accepts fixed and variable components with an explicit total', () => {
    expect(
      RemBreakdownCellSchema.safeParse({ fixed: 300_000, variable: 100_000, total: 400_000 })
        .success,
    ).toBe(true)
  })

  it('accepts an omitted total (auto-calculated downstream as fixed + variable)', () => {
    expect(RemBreakdownCellSchema.safeParse({ fixed: 300_000, variable: 100_000 }).success).toBe(
      true,
    )
  })

  it('rejects a negative fixed or variable component', () => {
    expect(RemBreakdownCellSchema.safeParse({ fixed: -1, variable: 0 }).success).toBe(false)
    expect(RemBreakdownCellSchema.safeParse({ fixed: 0, variable: -1 }).success).toBe(false)
  })
})

describe('OccupationalMatrixSchema', () => {
  it('accepts a full 9-level x 11-cell matrix of MatrixCells', () => {
    const matrix = buildMatrix(buildRow({ value: 1, percent: 100 }))
    expect(OccupationalMatrixSchema.safeParse(matrix).success).toBe(true)
  })

  it('rejects a matrix missing an occupational level row', () => {
    const matrix = buildMatrix(buildRow({ value: 1, percent: 100 })) as Record<string, unknown>
    delete matrix.grandTotal

    expect(OccupationalMatrixSchema.safeParse(matrix).success).toBe(false)
  })
})

describe('RemunerationMatrixSchema', () => {
  it('accepts a full matrix of RemunerationCells', () => {
    const matrix = buildMatrix(buildRow({ headcount: 1, totalRemuneration: 100_000 }))
    expect(RemunerationMatrixSchema.safeParse(matrix).success).toBe(true)
  })
})

describe('RemBreakdownMatrixSchema', () => {
  it('accepts a full matrix of RemBreakdownCells', () => {
    const matrix = buildMatrix(buildRow({ fixed: 50_000, variable: 10_000, total: 60_000 }))
    expect(RemBreakdownMatrixSchema.safeParse(matrix).success).toBe(true)
  })
})
