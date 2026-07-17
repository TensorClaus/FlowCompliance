import { describe, it, expect } from 'vitest'
import { EEA2FormSchema, EEA2ReportSchema } from '../eea2.js'
import { EEA4FormSchema, EEA4ReportSchema } from '../eea4.js'
import {
  CROSS_FORM_RULES,
  DerivedFormMetaSchema,
  type DerivedFormMeta,
} from '../validation-rules.js'

// ---------------------------------------------------------------------------
// Canonical wildcard expansion order (mirrors validation-rules.ts JSDoc)
// ---------------------------------------------------------------------------

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

/**
 * Expand a path template into every concrete path per the resolution contract:
 * first `*` -> occupational level, second `*` -> demographic cell.
 */
function expandTemplate(template: string): string[] {
  const starCount = (template.match(/\*/g) ?? []).length
  if (starCount === 0) return [template]
  if (starCount === 1) {
    return OCCUPATIONAL_LEVELS.map((lvl) => template.replace('*', lvl))
  }
  // Two wildcards: level (first) then cell (second).
  const paths: string[] = []
  for (const lvl of OCCUPATIONAL_LEVELS) {
    for (const cell of DEMOGRAPHIC_CELLS) {
      paths.push(template.replace('*', lvl).replace('*', cell))
    }
  }
  return paths
}

/** Resolve a dot-notation path against an object; returns the value or undefined. */
function resolvePath(root: unknown, path: string): unknown {
  let current: unknown = root
  for (const key of path.split('.')) {
    if (
      current !== null &&
      typeof current === 'object' &&
      key in (current as Record<string, unknown>)
    ) {
      current = (current as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return current
}

// ---------------------------------------------------------------------------
// Minimal fixtures built from the REAL Zod schemas (parse-validated below)
// ---------------------------------------------------------------------------

function matrixCell() {
  return { value: 1, percent: 100 }
}

function matrixRow() {
  return Object.fromEntries(DEMOGRAPHIC_CELLS.map((c) => [c, matrixCell()]))
}

function occupationalMatrix() {
  return Object.fromEntries(OCCUPATIONAL_LEVELS.map((l) => [l, matrixRow()]))
}

function remunerationCell() {
  return { headcount: 1, totalRemuneration: 1000 }
}

function remunerationRow() {
  return Object.fromEntries(DEMOGRAPHIC_CELLS.map((c) => [c, remunerationCell()]))
}

function remunerationMatrix() {
  return Object.fromEntries(OCCUPATIONAL_LEVELS.map((l) => [l, remunerationRow()]))
}

function remBreakdownCell() {
  return { fixed: 500, variable: 500, total: 1000 }
}

function remBreakdownRow() {
  return Object.fromEntries(DEMOGRAPHIC_CELLS.map((c) => [c, remBreakdownCell()]))
}

function remBreakdownMatrix() {
  return Object.fromEntries(OCCUPATIONAL_LEVELS.map((l) => [l, remBreakdownRow()]))
}

const ceoDeclaration = {
  fullName: 'Jane Doe',
  organisationName: 'Acme Holdings (Pty) Ltd',
  signatureDataUrl: 'data:image/png;base64,iVBOR',
  date: '2025-06-01',
  place: 'Johannesburg',
}

const address = {
  line1: '1 Main Rd',
  city: 'Cape Town',
  province: 'western_cape' as const,
  postalCode: '8001',
}

const employerProfile = {
  tradeName: 'Acme',
  dtiRegistrationName: 'Acme Holdings',
  dtiRegistrationNumber: '2020/123456/07',
  payeSarsNumber: '7123456789',
  uifReferenceNumber: 'U123456789',
  eapType: 'national' as const,
  industrySector: 'finance',
  setaClassification: 'FASSET',
  telephone: '0210000000',
  postalAddress: address,
  physicalAddress: address,
  ceoName: 'Jane Doe',
  ceoTelephone: '0210000001',
  ceoEmail: 'ceo@acme.co.za',
  seniorManagerName: 'John Smith',
  seniorManagerTelephone: '0210000002',
  seniorManagerEmail: 'hr@acme.co.za',
  businessType: 'private_company' as const,
  organOfState: false,
  employeeCountBand: '150+' as const,
  partOfGroup: false,
}

function buildEEA2Report() {
  return {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    reportingYear: 2025,
    reportingPeriod: { from: '2024-10-01', to: '2025-09-30' },
    eePlanDuration: { from: '2025-01-01', to: '2029-12-31' },
    employerProfile,
    sectionB: {
      workforceProfile: occupationalMatrix(),
      disabilityProfile: occupationalMatrix(),
      annualTargets: occupationalMatrix(),
      disabilityTarget: { profilePct: 2, targetPct: 3 },
      targetsAchieved: true,
    },
    sectionC: {
      recruitment: occupationalMatrix(),
      promotions: occupationalMatrix(),
      terminations: occupationalMatrix(),
    },
    sectionD: { skillsDevelopment: occupationalMatrix() },
    sectionE: {
      sectorTargets5Year: [],
      annualTargetsNextYear: occupationalMatrix(),
      disabilityTargetNextYear: { value: 5, pct: 3 },
    },
    sectionF: {
      consultation: { consultativeBody: true, tradeUnion: false, employees: true },
      barriers: Array.from({ length: 23 }, (_, i) => ({
        categoryId: i + 1,
        label: `Barrier ${String(i + 1)}`,
        barrierExists: false,
        aaMeasuresDeveloped: false,
      })),
    },
    sectionG: { monitoringFrequency: 'quarterly' as const, objectivesAchieved: true },
    sectionH: ceoDeclaration,
    status: 'signed' as const,
  }
}

function buildEEA2Form() {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    report: buildEEA2Report(),
    status: 'signed' as const,
    createdAt: '2025-10-01T00:00:00Z',
    updatedAt: '2025-10-02T00:00:00Z',
  }
}

function buildEEA4Report() {
  return {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    linkedEEA2Id: '550e8400-e29b-41d4-a716-446655440001',
    sectionA: employerProfile,
    sectionC: remunerationMatrix(),
    sectionD1: remBreakdownMatrix(),
    sectionD2: remBreakdownMatrix(),
    sectionE: {
      median: 100_000,
      top5pctRange: { lowest: 500_000, highest: 900_000 },
      bottom5pctRange: { lowest: 50_000, highest: 80_000 },
    },
    declaration: ceoDeclaration,
    status: 'signed' as const,
  }
}

function buildEEA4Form() {
  return {
    id: '550e8400-e29b-41d4-a716-446655440002',
    report: buildEEA4Report(),
    status: 'signed' as const,
    createdAt: '2025-10-01T00:00:00Z',
    updatedAt: '2025-10-02T00:00:00Z',
  }
}

/** DerivedFormMeta projections the engine materialises for `meta.*` paths. */
const eea2Meta: DerivedFormMeta = { status: 'signed', priorSectionsComplete: true }
const eea4Meta: DerivedFormMeta = { status: 'signed', headcountValidationPassed: true }

/**
 * Resolution root per form. `meta` is the virtual projection; `id` is the
 * wrapper identity used by the requires-linkage rule. Everything else resolves
 * against the report payload.
 */
function eea2Root() {
  const form = EEA2FormSchema.parse(buildEEA2Form())
  return { ...form.report, meta: eea2Meta, id: form.id }
}

function eea4Root() {
  const form = EEA4FormSchema.parse(buildEEA4Form())
  return { ...form.report, meta: eea4Meta, id: form.id }
}

const ROOTS: Record<'EEA2' | 'EEA4', () => Record<string, unknown>> = {
  EEA2: eea2Root,
  EEA4: eea4Root,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fixtures parse against real schemas', () => {
  it('EEA2 form fixture is schema-valid', () => {
    expect(EEA2FormSchema.safeParse(buildEEA2Form()).success).toBe(true)
    expect(EEA2ReportSchema.safeParse(buildEEA2Report()).success).toBe(true)
  })
  it('EEA4 form fixture is schema-valid', () => {
    expect(EEA4FormSchema.safeParse(buildEEA4Form()).success).toBe(true)
    expect(EEA4ReportSchema.safeParse(buildEEA4Report()).success).toBe(true)
  })
  it('DerivedFormMeta projections are schema-valid', () => {
    expect(DerivedFormMetaSchema.safeParse(eea2Meta).success).toBe(true)
    expect(DerivedFormMetaSchema.safeParse(eea4Meta).success).toBe(true)
  })
})

describe('CROSS_FORM_RULES path resolution', () => {
  it('registry has exactly 8 rules', () => {
    expect(CROSS_FORM_RULES).toHaveLength(8)
  })

  for (const rule of CROSS_FORM_RULES) {
    describe(rule.ruleId, () => {
      it('every expanded sourcePath resolves to a defined value', () => {
        const root = ROOTS[rule.sourceForm as 'EEA2' | 'EEA4']()
        for (const path of expandTemplate(rule.sourcePath)) {
          expect(resolvePath(root, path), `sourcePath ${path}`).toBeDefined()
        }
      })

      it('every expanded targetPath resolves to a defined value', () => {
        if (rule.targetPath === null) return
        // Resolution root selection (mirrors validation-rules.ts JSDoc):
        //  - `meta.*` targets ALWAYS resolve against the SOURCE form projection,
        //    even on cross-form rules (targetForm names the data dependency,
        //    not the meta resolution root).
        //  - otherwise cross-form rules read the targetForm root; intra-form
        //    rules (targetForm null) read the sourceForm root.
        const rootForm = rule.targetPath.startsWith('meta.')
          ? (rule.sourceForm as 'EEA2' | 'EEA4')
          : ((rule.targetForm ?? rule.sourceForm) as 'EEA2' | 'EEA4')
        const root = ROOTS[rootForm]()
        for (const path of expandTemplate(rule.targetPath)) {
          expect(resolvePath(root, path), `targetPath ${path}`).toBeDefined()
        }
      })
    })
  }
})
