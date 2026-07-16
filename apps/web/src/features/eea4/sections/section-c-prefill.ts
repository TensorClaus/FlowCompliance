import type {
  MatrixRow,
  OccupationalMatrix,
  RemunerationMatrix,
  RemunerationRow,
} from '@simplifi/shared'

export const EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID = 'eea4-linked-eea2-workforce-profile'

export const SECTION_C_ROW_ORDER = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'totalPermanent',
  'temporaryEmployees',
  'grandTotal',
] as const satisfies ReadonlyArray<keyof RemunerationMatrix>

export const SECTION_C_EDITABLE_ROWS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'temporaryEmployees',
] as const satisfies ReadonlyArray<keyof RemunerationMatrix>

export const SECTION_C_PERMANENT_ROWS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
] as const satisfies ReadonlyArray<keyof RemunerationMatrix>

export const SECTION_C_DEMO_COLUMN_ORDER = [
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

export const SECTION_C_COLUMN_ORDER = [...SECTION_C_DEMO_COLUMN_ORDER, 'total'] as const

export const SECTION_C_ROW_LABELS: Record<(typeof SECTION_C_ROW_ORDER)[number], string> = {
  topManagement: 'Top management',
  seniorManagement: 'Senior management',
  professionallyQualified:
    'Professionally qualified and experienced specialists and mid-management',
  skilledTechnical:
    'Skilled technical and academically qualified workers, junior management, supervisors, foremen, and superintendents',
  semiSkilled: 'Semi-skilled and discretionary decision-making',
  unskilled: 'Unskilled and defined decision-making',
  totalPermanent: 'Total permanent',
  temporaryEmployees: 'Temporary employees',
  grandTotal: 'Grand total',
}

export const SECTION_C_COLUMN_LABELS: Record<(typeof SECTION_C_COLUMN_ORDER)[number], string> = {
  africanMale: 'African Male',
  africanFemale: 'African Female',
  colouredMale: 'Coloured Male',
  colouredFemale: 'Coloured Female',
  indianMale: 'Indian/Asian Male',
  indianFemale: 'Indian/Asian Female',
  whiteMale: 'White Male',
  whiteFemale: 'White Female',
  foreignNationalMale: 'Foreign National Male',
  foreignNationalFemale: 'Foreign National Female',
  total: 'Total',
}

function prefillRow(
  source: OccupationalMatrix[keyof OccupationalMatrix],
  existing: RemunerationRow | undefined,
): RemunerationRow {
  return Object.fromEntries(
    SECTION_C_COLUMN_ORDER.map((colKey) => {
      const headcount = source[colKey].value
      return [
        colKey,
        {
          headcount,
          totalRemuneration: headcount === 0 ? 0 : (existing?.[colKey].totalRemuneration ?? 0),
        },
      ]
    }),
  ) as RemunerationRow
}

/**
 * Builds EEA4 Section C from linked EEA2 Table 1.1.
 *
 * Preserve rule: existing `totalRemuneration` is carried forward per matching
 * cell when the linked EEA2 headcount for that cell is non-zero. Overwrite
 * rule: every `headcount` is replaced from EEA2 on every call, and zero-headcount
 * cells always have `totalRemuneration` forced to 0 so the UI cannot persist
 * remuneration for employees that do not exist in the linked EEA2 cell.
 */
export function prefillSectionC(
  eea2Matrix: OccupationalMatrix,
  existing?: RemunerationMatrix,
): RemunerationMatrix {
  return Object.fromEntries(
    SECTION_C_ROW_ORDER.map((rowKey) => [
      rowKey,
      prefillRow(eea2Matrix[rowKey], existing?.[rowKey]),
    ]),
  ) as RemunerationMatrix
}
