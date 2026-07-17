import type {
  MatrixCell,
  OccupationalMatrix,
  RemunerationCell,
  RemunerationMatrix,
} from '@simplifi/shared'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { DEMO_COMPANY } from '../fixtures/demo-company'
import { adaptRemuneration, adaptWorkforce, useComplianceData } from '../lib/live-data-adapter'
import { server } from '@/test/server'

// ---------------------------------------------------------------------------
// Matrix builders — full 9-row matrices matching the shared schema shape.
// ---------------------------------------------------------------------------

const LEVEL_KEYS = [
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

const OCC_COLUMNS = [
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

type OccOverrides = Partial<Record<(typeof OCC_COLUMNS)[number], number>>
type RemOverrides = Partial<
  Record<(typeof OCC_COLUMNS)[number], { headcount: number; totalRemuneration: number }>
>

function occRow(overrides: OccOverrides = {}): Record<string, MatrixCell> {
  const row: Record<string, MatrixCell> = {}
  for (const col of OCC_COLUMNS) row[col] = { value: overrides[col] ?? 0 }
  return row
}

function remRow(overrides: RemOverrides = {}): Record<string, RemunerationCell> {
  const row: Record<string, RemunerationCell> = {}
  for (const col of OCC_COLUMNS) {
    row[col] = overrides[col] ?? { headcount: 0, totalRemuneration: 0 }
  }
  return row
}

function buildOccMatrix(
  rowOverrides: Partial<Record<string, OccOverrides>> = {},
): OccupationalMatrix {
  const matrix: Record<string, Record<string, MatrixCell>> = {}
  for (const level of LEVEL_KEYS) matrix[level] = occRow(rowOverrides[level])
  return matrix as unknown as OccupationalMatrix
}

function buildRemMatrix(
  rowOverrides: Partial<Record<string, RemOverrides>> = {},
): RemunerationMatrix {
  const matrix: Record<string, Record<string, RemunerationCell>> = {}
  for (const level of LEVEL_KEYS) matrix[level] = remRow(rowOverrides[level])
  return matrix as unknown as RemunerationMatrix
}

// ---------------------------------------------------------------------------
// adaptWorkforce
// ---------------------------------------------------------------------------

describe('adaptWorkforce', () => {
  it('maps exact per-level headcounts and excludes FN from the designated race columns', () => {
    const workforce = buildOccMatrix({
      topManagement: {
        africanMale: 3,
        africanFemale: 1,
        indianMale: 1,
        whiteMale: 2,
        whiteFemale: 1,
        foreignNationalMale: 1,
        total: 9,
      },
    })

    const rows = adaptWorkforce(workforce)

    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7])

    const topMgmt = rows[0]
    expect(topMgmt).toBeDefined()
    expect(topMgmt?.african).toEqual({ male: 3, female: 1 })
    expect(topMgmt?.coloured).toEqual({ male: 0, female: 0 })
    expect(topMgmt?.indian).toEqual({ male: 1, female: 0 })
    expect(topMgmt?.white).toEqual({ male: 2, female: 1 })
    // Foreign nationals are reported separately, never merged into a race column.
    expect(topMgmt?.foreignNational).toEqual({ male: 1, female: 0 })
    // No disability matrix supplied -> disabled defaults to 0 everywhere.
    expect(rows.every((r) => r.disabled === 0)).toBe(true)
  })

  it('sums disability counts per level, excluding foreign nationals (rule_eea_006)', () => {
    const workforce = buildOccMatrix({
      topManagement: { africanMale: 3, whiteMale: 2, foreignNationalMale: 1, total: 6 },
    })
    const disability = buildOccMatrix({
      topManagement: {
        africanMale: 1,
        whiteMale: 1,
        foreignNationalMale: 1, // must be excluded from the citizen disabled count
        total: 3,
      },
    })

    const rows = adaptWorkforce(workforce, disability)
    const topMgmt = rows[0]
    expect(topMgmt?.disabled).toBe(2)
    // Every other level had a zero disability row.
    expect(rows.slice(1).every((r) => r.disabled === 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// adaptRemuneration
// ---------------------------------------------------------------------------

describe('adaptRemuneration', () => {
  it('converts annual totalRemuneration to monthly avg CTC exactly and flags derivedMedian', () => {
    const sectionC = buildRemMatrix({
      skilledTechnical: {
        whiteMale: { headcount: 2, totalRemuneration: 1_200_000 },
      },
    })

    const rows = adaptRemuneration(sectionC)
    const skilledTechnical = rows.find((r) => r.level === 4)
    expect(skilledTechnical).toBeDefined()

    const whiteMale = skilledTechnical?.groups.white.male
    expect(whiteMale?.headcount).toBe(2)
    // 1,200,000 annual / 2 employees / 12 months = 50,000 monthly.
    expect(whiteMale?.avgMonthlyCtc).toBe(50_000)
    expect(whiteMale?.medianMonthlyCtc).toBe(50_000)
    expect(whiteMale?.derivedMedian).toBe(true)
  })

  it('produces a zero pay row for a zero-headcount cell without a division error', () => {
    const sectionC = buildRemMatrix()
    const rows = adaptRemuneration(sectionC)

    for (const level of rows) {
      for (const race of ['african', 'coloured', 'indian', 'white'] as const) {
        for (const gender of ['male', 'female'] as const) {
          const cell = level.groups[race][gender]
          expect(cell.headcount).toBe(0)
          expect(cell.avgMonthlyCtc).toBe(0)
          expect(Number.isNaN(cell.avgMonthlyCtc)).toBe(false)
          expect(cell.medianMonthlyCtc).toBe(0)
          expect(cell.derivedMedian).toBe(true)
        }
      }
    }
  })

  it('excludes foreign-national columns from the remuneration groups entirely', () => {
    const sectionC = buildRemMatrix()
    const rows = adaptRemuneration(sectionC)
    for (const level of rows) {
      expect(Object.keys(level.groups).sort()).toEqual(['african', 'coloured', 'indian', 'white'])
    }
  })
})

// ---------------------------------------------------------------------------
// useComplianceData
// ---------------------------------------------------------------------------

describe('useComplianceData', () => {
  const TENANT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const EEA4_FORM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

  it('defaults to the fixture and fires no network requests when unconfigured', async () => {
    const { result } = renderHook(() => useComplianceData())

    await waitFor(() => {
      expect(result.current.source).toBe('fixture')
    })
    expect(result.current.company).toBe(DEMO_COMPANY)
  })

  it('builds a live company from MSW-served EEA2 + EEA4 forms', async () => {
    const workforce = buildOccMatrix({
      topManagement: { africanMale: 3, whiteMale: 2, total: 5 },
    })
    const sectionC = buildRemMatrix({
      topManagement: { whiteMale: { headcount: 2, totalRemuneration: 2_400_000 } },
    })

    server.use(
      http.get('/api/eea2', () =>
        HttpResponse.json([
          {
            id: 'eea2-1',
            reportingYear: 2026,
            status: 'submitted',
            report: { sectionB: { workforceProfile: workforce, disabilityProfile: workforce } },
          },
        ]),
      ),
      http.get(`/api/eea4/${EEA4_FORM_ID}`, () =>
        HttpResponse.json({ id: EEA4_FORM_ID, status: 'submitted', report: { sectionC } }),
      ),
    )

    const { result } = renderHook(() =>
      useComplianceData({ tenantId: TENANT_ID, reportingYear: 2026, eea4FormId: EEA4_FORM_ID }),
    )

    await waitFor(() => {
      expect(result.current.source).toBe('live')
    })

    expect(result.current.company.workforce).toEqual(adaptWorkforce(workforce, workforce))
    expect(result.current.company.remuneration).toEqual(adaptRemuneration(sectionC))
    // Fields with no live equivalent still come from the fixture.
    expect(result.current.company.name).toBe(DEMO_COMPANY.name)
    expect(result.current.company.actions).toBe(DEMO_COMPANY.actions)
  })

  it('falls back to the fixture when the EEA2 list has no valid workforce matrix', async () => {
    const sectionC = buildRemMatrix()
    server.use(
      http.get('/api/eea2', () => HttpResponse.json([])),
      http.get(`/api/eea4/${EEA4_FORM_ID}`, () =>
        HttpResponse.json({ id: EEA4_FORM_ID, status: 'submitted', report: { sectionC } }),
      ),
    )

    const { result } = renderHook(() =>
      useComplianceData({ tenantId: TENANT_ID, reportingYear: 2026, eea4FormId: EEA4_FORM_ID }),
    )

    await waitFor(() => {
      expect(result.current.source).toBe('fixture')
    })
    expect(result.current.company).toBe(DEMO_COMPANY)
  })

  it('falls back to the fixture when the EEA4 form request fails (404)', async () => {
    const workforce = buildOccMatrix()
    server.use(
      http.get('/api/eea2', () =>
        HttpResponse.json([
          {
            id: 'eea2-1',
            reportingYear: 2026,
            status: 'submitted',
            report: { sectionB: { workforceProfile: workforce } },
          },
        ]),
      ),
      http.get(`/api/eea4/${EEA4_FORM_ID}`, () => new HttpResponse(null, { status: 404 })),
    )

    const { result } = renderHook(() =>
      useComplianceData({ tenantId: TENANT_ID, reportingYear: 2026, eea4FormId: EEA4_FORM_ID }),
    )

    await waitFor(() => {
      expect(result.current.source).toBe('fixture')
    })
  })
})
