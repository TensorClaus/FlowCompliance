/**
 * Live-data adapter — bridges @simplifi/shared EEA2/EEA4 matrices onto the
 * DemoCompany fixture shape the M2.5 compliance dashboards were built
 * against.
 *
 * The dashboards (features/compliance/components/*) render from the
 * DemoCompany fixture (features/compliance/fixtures/demo-company.ts), which
 * predates the M3 wizard forms and their @simplifi/shared schemas. This
 * module is the only place that knows how to translate a live
 * OccupationalMatrix (EEA2 Table 1.1 / 1.2) and RemunerationMatrix (EEA4
 * Section C) into the DemoCompany sub-shapes, so the dashboards can later
 * render real tenant data with zero changes to their rendering code.
 *
 * `adaptWorkforce` and `adaptRemuneration` are pure. `useComplianceData` is
 * the single composition point that attempts a live build and falls back to
 * the fixture — nothing under features/compliance/components imports it yet;
 * wiring the dashboards to it is a later milestone.
 */

import {
  OccupationalMatrixSchema,
  RemunerationMatrixSchema,
  type MatrixRow,
  type OccupationalLevel,
  type OccupationalMatrix,
  type RemunerationCell,
  type RemunerationMatrix,
} from '@simplifi/shared'
import { useEffect, useState } from 'react'
import {
  DEMO_COMPANY,
  type DemoCompany,
  type GenderSplit,
  type GroupPay,
  type LevelHeadcount,
  type PayRace,
} from '../fixtures/demo-company'

// ---------------------------------------------------------------------------
// Shared level mapping (mirrors features/eea12/decompose-workforce.ts)
// ---------------------------------------------------------------------------

/**
 * The seven "real" occupational levels present in both OccupationalMatrix and
 * RemunerationMatrix. totalPermanent/grandTotal are computed aggregates of
 * these rows — iterating them would double-count every employee. This
 * mirrors REAL_LEVEL_KEYS in features/eea12/decompose-workforce.ts; it is
 * re-declared locally rather than imported because that module only exports
 * decomposeEEA2Workforce, not its internal constants.
 */
const REAL_LEVEL_KEYS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'temporaryEmployees',
] as const

type RealLevelKey = (typeof REAL_LEVEL_KEYS)[number]

const LEVEL_KEY_TO_CODE: Record<RealLevelKey, OccupationalLevel> = {
  topManagement: 1,
  seniorManagement: 2,
  professionallyQualified: 3,
  skilledTechnical: 4,
  semiSkilled: 5,
  unskilled: 6,
  temporaryEmployees: 7,
}

/**
 * Race -> matrix column mapping. MatrixRow and RemunerationRow declare the
 * identical set of demographic column names, so this single mapping is valid
 * for both OccupationalMatrix and RemunerationMatrix rows.
 */
const RACE_COLUMNS: Record<PayRace, { male: keyof MatrixRow; female: keyof MatrixRow }> = {
  african: { male: 'africanMale', female: 'africanFemale' },
  coloured: { male: 'colouredMale', female: 'colouredFemale' },
  indian: { male: 'indianMale', female: 'indianFemale' },
  white: { male: 'whiteMale', female: 'whiteFemale' },
}

const PAY_RACES = Object.keys(RACE_COLUMNS) as PayRace[]

// ---------------------------------------------------------------------------
// adaptWorkforce — EEA2 Table 1.1 (+ Table 1.2) -> LevelHeadcount[]
// ---------------------------------------------------------------------------

function genderSplit(row: MatrixRow, race: PayRace): GenderSplit {
  const cols = RACE_COLUMNS[race]
  return { male: row[cols.male].value, female: row[cols.female].value }
}

/**
 * Total disabled headcount for one level, excluding foreign nationals.
 *
 * `representation.ts` computes the disability share as
 * `pct(row.disabled, citizens)`, where `citizens` excludes foreign nationals
 * (rule_eea_006). To stay consistent with that denominator, the numerator
 * here is also restricted to the four designated-group race columns; foreign
 * national disability counts are not carried anywhere else in the DemoCompany
 * shape, so they are dropped rather than folded into the citizen total —
 * the same separate-not-merged treatment the EEA12 decomposition
 * (features/eea12/decompose-workforce.ts) applies to foreign nationals.
 */
function citizenDisabledCount(row: MatrixRow): number {
  return (
    row.africanMale.value +
    row.africanFemale.value +
    row.colouredMale.value +
    row.colouredFemale.value +
    row.indianMale.value +
    row.indianFemale.value +
    row.whiteMale.value +
    row.whiteFemale.value
  )
}

/**
 * Builds the DemoCompany workforce sub-shape (`LevelHeadcount[]`) from the
 * live EEA2 Table 1.1 workforce matrix, optionally overlaying Table 1.2
 * disability counts.
 *
 * Foreign nationals: unlike `adaptRemuneration`, `LevelHeadcount` carries an
 * explicit `foreignNational: GenderSplit` field, so FN headcounts are mapped
 * through directly — reported separately from the four designated race
 * columns, never merged into them, exactly as rule_eea_006 requires and as
 * `workforce-heatmap.tsx` already renders them (distinct FN columns).
 *
 * @param eea2Matrix EEA2 Table 1.1 — total headcount matrix.
 * @param disability EEA2 Table 1.2 — employees with disabilities matrix.
 *                    Omit when unavailable; every level's `disabled` count
 *                    then defaults to 0.
 */
export function adaptWorkforce(
  eea2Matrix: OccupationalMatrix,
  disability?: OccupationalMatrix,
): LevelHeadcount[] {
  return REAL_LEVEL_KEYS.map((levelKey) => {
    const row = eea2Matrix[levelKey]
    const disabilityRow = disability?.[levelKey]

    return {
      level: LEVEL_KEY_TO_CODE[levelKey],
      african: genderSplit(row, 'african'),
      coloured: genderSplit(row, 'coloured'),
      indian: genderSplit(row, 'indian'),
      white: genderSplit(row, 'white'),
      foreignNational: {
        male: row.foreignNationalMale.value,
        female: row.foreignNationalFemale.value,
      },
      disabled: disabilityRow === undefined ? 0 : citizenDisabledCount(disabilityRow),
    }
  })
}

// ---------------------------------------------------------------------------
// adaptRemuneration — EEA4 Section C -> LevelRemuneration[]-compatible shape
// ---------------------------------------------------------------------------

/**
 * A `GroupPay` cell with an explicit flag marking that `medianMonthlyCtc` is
 * not a true median — see `buildGroupPay` for why. Structurally identical to
 * `GroupPay` plus one extra field, so `DerivedLevelRemuneration[]` is
 * assignable anywhere a `LevelRemuneration[]` is expected (e.g. onto
 * `DemoCompany.remuneration`); screens built against the plain `GroupPay`
 * shape read straight through it and never see the flag.
 */
export interface DerivedGroupPay extends GroupPay {
  /**
   * Always `true` for adapter output. `RemunerationMatrix` cells (EEA4
   * Section C) carry only `headcount` + `totalRemuneration` per demographic
   * cell — an aggregate with no individual salary distribution — so no true
   * median is derivable from them. `medianMonthlyCtc` is therefore set equal
   * to `avgMonthlyCtc`. Screens that don't recognise this flag can safely
   * ignore it; it exists so a future consumer that cares about median
   * fidelity can distinguish a derived value from a real one.
   */
  derivedMedian: true
}

export interface DerivedLevelRemuneration {
  level: OccupationalLevel
  groups: Record<PayRace, { male: DerivedGroupPay; female: DerivedGroupPay }>
}

/**
 * Converts one `RemunerationCell` into the DemoCompany `GroupPay` shape.
 *
 * `totalRemuneration` is total ANNUAL remuneration in ZAR (DC-004 — see
 * `packages/shared/src/schemas/matrix.ts` `RemunerationCellSchema` and
 * `packages/shared/src/schemas/eea4.ts` `SectionESchema` docs). DemoCompany's
 * `GroupPay.avgMonthlyCtc` is monthly CTC, so the annual figure is divided
 * across the cell's headcount and then across 12 months:
 *
 *   avgMonthlyCtc = round(totalRemuneration / headcount / 12)
 *
 * A zero-headcount cell short-circuits to 0 avgMonthlyCtc (no division by
 * zero) — an empty demographic cell contributes no pay figure, matching how
 * `buildRemuneration()` in demo-company.ts also zeroes empty cells.
 */
function buildGroupPay(cell: RemunerationCell): DerivedGroupPay {
  const avgMonthlyCtc =
    cell.headcount === 0 ? 0 : Math.round(cell.totalRemuneration / cell.headcount / 12)
  return {
    headcount: cell.headcount,
    avgMonthlyCtc,
    medianMonthlyCtc: avgMonthlyCtc,
    derivedMedian: true,
  }
}

/**
 * Builds the DemoCompany remuneration sub-shape from the live EEA4 Section C
 * remuneration matrix.
 *
 * Foreign nationals: DemoCompany's `PayRace` union has only four members
 * (african | coloured | indian | white) — there is no FN pay group in the
 * fixture shape, so `foreignNationalMale`/`foreignNationalFemale` cells are
 * excluded from the output entirely. This is consistent with rule_eea_006
 * and the EEA12 decomposition precedent (`features/eea12/decompose-
 * workforce.ts`), which likewise excludes FN from race-coded rows and
 * reports FN totals separately instead of merging them in.
 *
 * @param sectionC EEA4 Section C — remuneration matrix (headcount + total
 *                 annual remuneration per demographic cell).
 */
export function adaptRemuneration(sectionC: RemunerationMatrix): DerivedLevelRemuneration[] {
  return REAL_LEVEL_KEYS.map((levelKey) => {
    const row = sectionC[levelKey]
    const groups = {} as Record<PayRace, { male: DerivedGroupPay; female: DerivedGroupPay }>
    for (const race of PAY_RACES) {
      const cols = RACE_COLUMNS[race]
      groups[race] = {
        male: buildGroupPay(row[cols.male]),
        female: buildGroupPay(row[cols.female]),
      }
    }
    return { level: LEVEL_KEY_TO_CODE[levelKey], groups }
  })
}

// ---------------------------------------------------------------------------
// useComplianceData — composition point (not yet wired into any screen)
// ---------------------------------------------------------------------------

export interface UseComplianceDataOptions {
  /** Tenant to source live data for. Empty (default) always yields the fixture. */
  tenantId?: string
  /** Reporting year to source live data for. Defaults to the current year. */
  reportingYear?: number
  /**
   * The EEA4 form id to source remuneration from. There is no tenant-scoped
   * EEA4 list endpoint anywhere in this codebase (only fetch-by-id, per
   * apps/web/src/routes/eea4-form.tsx and BundleDashboard.fetchWrapper) — the
   * caller is expected to already know which EEA4 document is linked, exactly
   * as `BundlePeriodRef.eea4FormId` does in the submission-bundle feature.
   * Omitting it (the default) always yields the fixture.
   */
  eea4FormId?: string
}

export interface UseComplianceDataResult {
  company: DemoCompany
  source: 'live' | 'fixture'
}

const FIXTURE_RESULT: UseComplianceDataResult = { company: DEMO_COMPANY, source: 'fixture' }

interface Eea2ListItem {
  report?: {
    sectionB?: {
      workforceProfile?: unknown
      disabilityProfile?: unknown
    }
  }
}

interface Eea4WrapperResponse {
  report?: {
    sectionC?: unknown
  }
}

function extractMatrix(value: unknown): OccupationalMatrix | undefined {
  const parsed = OccupationalMatrixSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

interface LiveWorkforce {
  workforce: OccupationalMatrix
  disability?: OccupationalMatrix
}

/**
 * Fetches the tenant's EEA2 list (same endpoint + query shape as
 * apps/web/src/routes/eea4-form.tsx) and returns the first item whose
 * Table 1.1 workforce matrix validates. Never throws — any fetch failure,
 * non-OK response, or schema mismatch resolves to `undefined` so the caller
 * can fall back to the fixture. Never logs the response body (may contain
 * employment data).
 */
async function fetchLiveWorkforce(
  tenantId: string,
  reportingYear: number,
  signal: AbortSignal,
): Promise<LiveWorkforce | undefined> {
  try {
    const response = await fetch(
      `/api/eea2?tenantId=${encodeURIComponent(tenantId)}&reportingYear=${encodeURIComponent(String(reportingYear))}`,
      { signal },
    )
    if (!response.ok) return undefined
    const body: unknown = await response.json()
    const items: Eea2ListItem[] = Array.isArray(body) ? (body as Eea2ListItem[]) : []
    for (const item of items) {
      const workforce = extractMatrix(item.report?.sectionB?.workforceProfile)
      if (workforce !== undefined) {
        const disability = extractMatrix(item.report?.sectionB?.disabilityProfile)
        return disability === undefined ? { workforce } : { workforce, disability }
      }
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Fetches one EEA4 form by id (same endpoint shape as
 * apps/web/src/routes/eea4-form.tsx and BundleDashboard.fetchWrapper) and
 * returns its Section C remuneration matrix if present and valid. Never
 * throws or logs the response body.
 */
async function fetchLiveRemuneration(
  eea4FormId: string,
  signal: AbortSignal,
): Promise<RemunerationMatrix | undefined> {
  try {
    const response = await fetch(`/api/eea4/${encodeURIComponent(eea4FormId)}`, { signal })
    if (!response.ok) return undefined
    const body = (await response.json()) as Eea4WrapperResponse
    const parsed = RemunerationMatrixSchema.safeParse(body.report?.sectionC)
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

/**
 * Composition point for the M2.5 compliance dashboards to eventually render
 * live tenant data. Attempts to build a DemoCompany-shaped object from a live
 * EEA2 workforce matrix + linked EEA4 remuneration matrix using the adapters
 * above; falls back to the `DEMO_COMPANY` fixture whenever either input is
 * absent, invalid, or the request fails.
 *
 * All-or-nothing by design: EEA4 Section C headcounts must reconcile against
 * the linked EEA2 Table 1.1 (see the cross-form constraint documented on
 * `EEA4ReportSchema` in packages/shared/src/schemas/eea4.ts), so a mixed
 * live-workforce/fixture-remuneration result (or vice versa) would silently
 * violate that invariant. A `'live'` result is only returned when BOTH
 * matrices are sourced and schema-valid; every other field on `DemoCompany`
 * (name, sector, actions, deadlines, Gini series, etc.) has no live
 * equivalent yet and is carried over from the fixture unchanged.
 *
 * `features/compliance/components/*` do NOT call this hook yet — wiring the
 * dashboards to it is a later milestone; this is purely the integration seam.
 * Callers omitting `tenantId` or `eea4FormId` (the default) never issue a
 * network request and resolve to the fixture synchronously-on-mount.
 */
export function useComplianceData(options: UseComplianceDataOptions = {}): UseComplianceDataResult {
  const { tenantId = '', reportingYear = new Date().getFullYear(), eea4FormId } = options
  const [result, setResult] = useState(FIXTURE_RESULT)

  useEffect(() => {
    if (tenantId.length === 0 || eea4FormId === undefined || eea4FormId.length === 0) {
      setResult(FIXTURE_RESULT)
      return
    }

    const controller = new AbortController()

    void (async () => {
      const [liveWorkforce, remuneration] = await Promise.all([
        fetchLiveWorkforce(tenantId, reportingYear, controller.signal),
        fetchLiveRemuneration(eea4FormId, controller.signal),
      ])

      if (controller.signal.aborted) return

      if (liveWorkforce === undefined || remuneration === undefined) {
        setResult(FIXTURE_RESULT)
        return
      }

      setResult({
        company: {
          ...DEMO_COMPANY,
          workforce: adaptWorkforce(liveWorkforce.workforce, liveWorkforce.disability),
          remuneration: adaptRemuneration(remuneration),
        },
        source: 'live',
      })
    })()

    return () => {
      controller.abort()
    }
  }, [tenantId, reportingYear, eea4FormId])

  return result
}
