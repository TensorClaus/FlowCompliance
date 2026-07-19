import { describe, it, expect } from 'vitest'
import { RACE_LABELS, GENDER_LABELS } from '../constants.js'
import { PROVINCES, EAP_DATA, getEapByProvince } from '../eap.js'
import type { EapProvince } from '../eap.js'

// ---------------------------------------------------------------------------
// EAP_DATASET_VERSION
// ---------------------------------------------------------------------------

describe('EAP_DATASET_VERSION', () => {
  it('carries the PLACEHOLDER prefix until real StatsSA QLFS data is ingested', () => {
    // Load-bearing per the module doc comment: consumers persist this string
    // alongside EAP-derived output so a reviewer can tell the figures are
    // provisional. Dropping the prefix must happen in the same commit that
    // replaces the underlying data.
    expect(EAP_DATASET_VERSION.startsWith('PLACEHOLDER')).toBe(true)
  })

  it('identifies the StatsSA QLFS source quarter', () => {
    expect(EAP_DATASET_VERSION).toContain('StatsSA')
    expect(EAP_DATASET_VERSION).toContain('QLFS')
  })
})

// ---------------------------------------------------------------------------
// PROVINCES
// ---------------------------------------------------------------------------

describe('PROVINCES', () => {
  it('contains exactly 10 entries (9 provinces + National)', () => {
    expect(PROVINCES).toHaveLength(10)
  })

  it('includes "National"', () => {
    expect(PROVINCES).toContain('National')
  })

  it('includes all 9 South African provinces', () => {
    const expected = [
      'Eastern Cape',
      'Free State',
      'Gauteng',
      'KwaZulu-Natal',
      'Limpopo',
      'Mpumalanga',
      'North West',
      'Northern Cape',
      'Western Cape',
    ]
    for (const province of expected) {
      expect(PROVINCES).toContain(province)
    }
  })

  it('has no duplicate entries', () => {
    const unique = new Set(PROVINCES)
    expect(unique.size).toBe(PROVINCES.length)
  })
})

// ---------------------------------------------------------------------------
// EAP_DATA
// ---------------------------------------------------------------------------

describe('EAP_DATA', () => {
  it('is non-empty', () => {
    expect(EAP_DATA.length).toBeGreaterThan(0)
  })

  it('contains exactly 80 data points (10 geographies x 4 races x 2 genders, no level dimension)', () => {
    expect(EAP_DATA).toHaveLength(80)
  })

  it('every data point has a valid race', () => {
    const validRaces = new Set(Object.values(RACE_LABELS))
    for (const dp of EAP_DATA) {
      expect(validRaces.has(dp.race)).toBe(true)
    }
  })

  it('every data point has a valid gender', () => {
    const validGenders = new Set(Object.values(GENDER_LABELS))
    for (const dp of EAP_DATA) {
      expect(validGenders.has(dp.gender)).toBe(true)
    }
  })

  it('every data point has a valid province from PROVINCES', () => {
    const provinceSet = new Set<string>(PROVINCES)
    for (const dp of EAP_DATA) {
      expect(provinceSet.has(dp.province)).toBe(true)
    }
  })

  it('every data point has non-negative economicallyActiveThousands, employedThousands, and unemployedThousands', () => {
    for (const dp of EAP_DATA) {
      expect(dp.economicallyActiveThousands).toBeGreaterThanOrEqual(0)
      expect(dp.employedThousands).toBeGreaterThanOrEqual(0)
      expect(dp.unemployedThousands).toBeGreaterThanOrEqual(0)
    }
  })

  it('every data point has economicallyActivePct between 0 and 100', () => {
    for (const dp of EAP_DATA) {
      expect(dp.economicallyActivePct).toBeGreaterThanOrEqual(0)
      expect(dp.economicallyActivePct).toBeLessThanOrEqual(100)
    }
  })

  it('no data point has an occupationalLevel property', () => {
    for (const dp of EAP_DATA) {
      expect('occupationalLevel' in dp).toBe(false)
    }
  })

  it('every data point has source and quarter populated', () => {
    for (const dp of EAP_DATA) {
      expect(dp.source.length).toBeGreaterThan(0)
      expect(dp.quarter.length).toBeGreaterThan(0)
    }
  })

  // No-stub invariant (ACTIVATED — Plan 02 loaded real StatsSA values): each
  // province's set of economicallyActiveThousands values must NOT be a
  // uniform scalar multiple of National's (the placeholder-era stub pattern
  // this phase eliminates). Previously guarded with it.runIf on non-zero
  // data to avoid a spurious pass against Plan 01's all-zero scaffold; now a
  // plain, unconditional assertion since every province is independently
  // sourced from the QLFS EAP sheet.
  it('no province is a uniform scalar multiple of National (anti-stub check)', () => {
    const national = getEapByProvince('National')
    for (const province of PROVINCES) {
      if (province === 'National') continue
      const rows = getEapByProvince(province)
      const ratios = rows.map((row) => {
        const match = national.find((n) => n.race === row.race && n.gender === row.gender)
        if (!match || match.economicallyActiveThousands === 0) return null
        return row.economicallyActiveThousands / match.economicallyActiveThousands
      })
      const definedRatios = ratios.filter((r): r is number => r !== null)
      const allIdentical = definedRatios.every((r) => r === definedRatios[0])
      expect(allIdentical).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Verbatim spot-checks (StatsSA QLFS Q1 2026, sheet "EAP")
// ---------------------------------------------------------------------------

// Each value below was confirmed directly against the verified local xlsx
// artifact during 02-02 execution (programmatic extraction + arithmetic
// identity checks), not trusted blindly from 02-RESEARCH.md's sample
// (Phase 1's founder gate previously caught 3 mislabeled research samples).
describe('EAP_DATA verbatim spot-checks', () => {
  it('matches QLFS Q1 2026 value for Western Cape, Black African, Male, Economically active', () => {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape",
    // race row "Black African" (row 16), Male block, col D (Economically active).
    const result = getEapByProvince('Western Cape').find(
      (d) => d.race === RACE_LABELS.A && d.gender === GENDER_LABELS.M,
    )
    expect(result?.economicallyActiveThousands).toBeCloseTo(838.862_953_239_343_37, 2)
  })

  it('matches QLFS Q1 2026 value for National, Black African, Male, Economically active', () => {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa"
    // (National), race row "Black African" (row 9), Male block, col D
    // (Economically active).
    const result = getEapByProvince('National').find(
      (d) => d.race === RACE_LABELS.A && d.gender === GENDER_LABELS.M,
    )
    expect(result?.economicallyActiveThousands).toBeCloseTo(10_837.023_538_860_407, 2)
  })

  it('matches QLFS Q1 2026 value for Gauteng, White, Female, Economically active', () => {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng",
    // race row "White" (row 61), Female block, col I (Economically active).
    const result = getEapByProvince('Gauteng').find(
      (d) => d.race === RACE_LABELS.W && d.gender === GENDER_LABELS.F,
    )
    expect(result?.economicallyActiveThousands).toBeCloseTo(359.529_881_791_388, 2)
  })

  it('matches the QLFS Q1 2026 national grand total (Total row, Total-gender block, Economically active column)', () => {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", "South Africa" Total row
    // (row 13), Total-gender block, col N (Economically active). Sum of all
    // 8 National race-gender economicallyActiveThousands values.
    const national = getEapByProvince('National')
    const sum = national.reduce((acc, d) => acc + d.economicallyActiveThousands, 0)
    expect(sum).toBeCloseTo(24_890.968_414_811_73, 2)
  })
})

// ---------------------------------------------------------------------------
// Arithmetic-consistency check (Identity 2: Employed + Unemployed = Economically active)
// ---------------------------------------------------------------------------

describe('EAP_DATA arithmetic consistency', () => {
  it('Employed + Unemployed equals Economically active for every National race-gender point', () => {
    const national = getEapByProvince('National')
    for (const dp of national) {
      expect(dp.employedThousands + dp.unemployedThousands).toBeCloseTo(
        dp.economicallyActiveThousands,
        2,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// getEapByProvince
// ---------------------------------------------------------------------------

describe('getEapByProvince', () => {
  it('returns 8 data points for "National" (4 races x 2 genders)', () => {
    const results = getEapByProvince('National')
    expect(results).toHaveLength(8)
    for (const dp of results) {
      expect(dp.province).toBe('National')
    }
  })

  it('returns 8 data points for "Gauteng"', () => {
    const results = getEapByProvince('Gauteng')
    expect(results).toHaveLength(8)
  })

  it('returns 8 data points for a former-stub province ("Limpopo")', () => {
    const results = getEapByProvince('Limpopo')
    expect(results).toHaveLength(8)
  })

  it('returns empty array for an invalid province', () => {
    const results = getEapByProvince('Mars' as EapProvince)
    expect(results).toHaveLength(0)
  })
})
