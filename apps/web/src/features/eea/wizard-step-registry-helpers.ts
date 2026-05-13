import { OccupationalMatrixSchema, type OccupationalMatrix } from '@simplifi/shared'

const emptyMatrixCell = { value: 0 }

const createEmptyMatrixRow = (): OccupationalMatrix['topManagement'] => ({
  africanMale: emptyMatrixCell,
  africanFemale: emptyMatrixCell,
  colouredMale: emptyMatrixCell,
  colouredFemale: emptyMatrixCell,
  indianMale: emptyMatrixCell,
  indianFemale: emptyMatrixCell,
  whiteMale: emptyMatrixCell,
  whiteFemale: emptyMatrixCell,
  foreignNationalMale: emptyMatrixCell,
  foreignNationalFemale: emptyMatrixCell,
  total: emptyMatrixCell,
})

export const createEmptyOccupationalMatrix = (): OccupationalMatrix => ({
  topManagement: createEmptyMatrixRow(),
  seniorManagement: createEmptyMatrixRow(),
  professionallyQualified: createEmptyMatrixRow(),
  skilledTechnical: createEmptyMatrixRow(),
  semiSkilled: createEmptyMatrixRow(),
  unskilled: createEmptyMatrixRow(),
  temporaryEmployees: createEmptyMatrixRow(),
  totalPermanent: createEmptyMatrixRow(),
  grandTotal: createEmptyMatrixRow(),
})

export const getOccupationalMatrix = (value: unknown): OccupationalMatrix => {
  const parsed = OccupationalMatrixSchema.safeParse(value)
  return parsed.success ? parsed.data : createEmptyOccupationalMatrix()
}

export const getOccupationalMatrixTotal = (value: unknown): number =>
  getOccupationalMatrix(value).grandTotal.total.value
