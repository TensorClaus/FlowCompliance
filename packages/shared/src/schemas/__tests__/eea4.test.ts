import { describe, it, expect } from 'vitest'
import {
  RemunerationGapRangeSchema,
  SectionESchema,
  EEA4ReportSchema,
  EEA4FormSchema,
} from '../eea4.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEMOGRAPHIC_KEYS = [
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

function buildRow<T>(cell: T): Record<(typeof DEMOGRAPHIC_KEYS)[number], T> {
  return Object.fromEntries(DEMOGRAPHIC_KEYS.map((key) => [key, cell])) as Record<
    (typeof DEMOGRAPHIC_KEYS)[number],
    T
  >
}

function buildMatrix<T>(
  cell: T,
): Record<(typeof LEVEL_KEYS)[number], ReturnType<typeof buildRow<T>>> {
  return Object.fromEntries(LEVEL_KEYS.map((key) => [key, buildRow(cell)])) as Record<
    (typeof LEVEL_KEYS)[number],
    ReturnType<typeof buildRow<T>>
  >
}

const remunerationMatrix = buildMatrix({ headcount: 2, totalRemuneration: 480_000 })
const breakdownMatrix = buildMatrix({ fixed: 200_000, variable: 40_000, total: 240_000 })

const employerProfile = {
  tradeName: 'Ubuntu Traders',
  dtiRegistrationName: 'Ubuntu Traders (Pty) Ltd',
  dtiRegistrationNumber: '2019/123456/07',
  payeSarsNumber: '7530123456',
  uifReferenceNumber: 'U123456789',
  eapType: 'national' as const,
  industrySector: 'Wholesale and Retail',
  setaClassification: 'W&RSETA',
  telephone: '0215551234',
  postalAddress: {
    line1: 'PO Box 123',
    city: 'Cape Town',
    province: 'western_cape' as const,
    postalCode: '8000',
  },
  physicalAddress: {
    line1: '1 Long Street',
    city: 'Cape Town',
    province: 'western_cape' as const,
    postalCode: '8001',
  },
  ceoName: 'Sipho Nkosi',
  ceoTelephone: '0215551235',
  ceoEmail: 'ceo@ubuntutraders.example',
  seniorManagerName: 'Lerato Dlamini',
  seniorManagerTelephone: '0215551236',
  seniorManagerEmail: 'hr@ubuntutraders.example',
  businessType: 'private_company' as const,
  organOfState: false,
  employeeCountBand: '50-149' as const,
  partOfGroup: false,
}

const sectionE = {
  median: 220_000,
  top5pctRange: { lowest: 900_000, highest: 2_400_000 },
  bottom5pctRange: { lowest: 96_000, highest: 120_000 },
}

function buildValidReport() {
  return {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    linkedEEA2Id: '660e8400-e29b-41d4-a716-446655440001',
    sectionA: employerProfile,
    sectionC: remunerationMatrix,
    sectionD1: breakdownMatrix,
    sectionD2: breakdownMatrix,
    sectionE,
    status: 'draft' as const,
  }
}

// ---------------------------------------------------------------------------
// RemunerationGapRangeSchema / SectionESchema
// ---------------------------------------------------------------------------

describe('RemunerationGapRangeSchema', () => {
  it('accepts a non-negative ZAR range', () => {
    expect(RemunerationGapRangeSchema.safeParse({ lowest: 0, highest: 100_000 }).success).toBe(true)
  })

  it('rejects negative boundaries', () => {
    expect(RemunerationGapRangeSchema.safeParse({ lowest: -1, highest: 100 }).success).toBe(false)
  })
})

describe('SectionESchema', () => {
  it('accepts a valid median + gap ranges structure', () => {
    expect(SectionESchema.safeParse(sectionE).success).toBe(true)
  })

  it('rejects a negative median', () => {
    expect(SectionESchema.safeParse({ ...sectionE, median: -5 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// EEA4ReportSchema
// ---------------------------------------------------------------------------

describe('EEA4ReportSchema', () => {
  it('accepts a valid draft report without a declaration', () => {
    expect(EEA4ReportSchema.safeParse(buildValidReport()).success).toBe(true)
  })

  it('requires linkedEEA2Id to be a UUID — the EEA4 cannot exist unlinked', () => {
    const result = EEA4ReportSchema.safeParse({ ...buildValidReport(), linkedEEA2Id: 'none' })
    expect(result.success).toBe(false)
  })

  it('accepts a signed report carrying a CEO declaration', () => {
    const result = EEA4ReportSchema.safeParse({
      ...buildValidReport(),
      status: 'signed',
      declaration: {
        fullName: 'Sipho Nkosi',
        organisationName: 'Ubuntu Traders (Pty) Ltd',
        signatureDataUrl: 'data:image/png;base64,sig123',
        date: '2026-01-12',
        place: 'Cape Town',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a declaration with an empty signature', () => {
    const result = EEA4ReportSchema.safeParse({
      ...buildValidReport(),
      declaration: {
        fullName: 'Sipho Nkosi',
        organisationName: 'Ubuntu Traders (Pty) Ltd',
        signatureDataUrl: '',
        date: '2026-01-12',
        place: 'Cape Town',
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a negative headcount inside Section C', () => {
    const report = buildValidReport()
    const broken = {
      ...report,
      sectionC: {
        ...report.sectionC,
        topManagement: {
          ...report.sectionC.topManagement,
          africanMale: { headcount: -1, totalRemuneration: 100 },
        },
      },
    }
    expect(EEA4ReportSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects a fractional headcount inside Section C', () => {
    const report = buildValidReport()
    const broken = {
      ...report,
      sectionC: {
        ...report.sectionC,
        unskilled: {
          ...report.sectionC.unskilled,
          whiteFemale: { headcount: 1.5, totalRemuneration: 100 },
        },
      },
    }
    expect(EEA4ReportSchema.safeParse(broken).success).toBe(false)
  })

  it('accepts D1/D2 cells with the auto-calculated total omitted', () => {
    const report = buildValidReport()
    const withOmittedTotal = {
      ...report,
      sectionD1: {
        ...report.sectionD1,
        semiSkilled: {
          ...report.sectionD1.semiSkilled,
          indianFemale: { fixed: 150_000, variable: 0 },
        },
      },
    }
    expect(EEA4ReportSchema.safeParse(withOmittedTotal).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// EEA4FormSchema
// ---------------------------------------------------------------------------

describe('EEA4FormSchema', () => {
  const validForm = {
    id: '770e8400-e29b-41d4-a716-446655440002',
    report: buildValidReport(),
    status: 'draft' as const,
    createdAt: '2026-01-10T08:00:00Z',
    updatedAt: '2026-01-10T08:05:00Z',
  }

  it('accepts a valid persistence wrapper and coerces timestamps', () => {
    const result = EEA4FormSchema.safeParse(validForm)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date)
    }
  })

  it('rejects a non-UUID form id', () => {
    expect(EEA4FormSchema.safeParse({ ...validForm, id: '42' }).success).toBe(false)
  })

  it('rejects an unknown lifecycle status', () => {
    expect(EEA4FormSchema.safeParse({ ...validForm, status: 'finalised' }).success).toBe(false)
  })
})
