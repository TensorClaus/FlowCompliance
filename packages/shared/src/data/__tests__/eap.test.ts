import { describe, it, expect } from 'vitest'
import { RACE_LABELS, GENDER_LABELS } from '../constants.js'
import { PROVINCES, EAP_DATA, getEapByProvince } from '../eap.js'
import type { EapProvince } from '../eap.js'

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

  // No-stub invariant: each province's set of economicallyActiveThousands
  // values must NOT be a uniform scalar multiple of National's (the
  // placeholder-era stub pattern this phase eliminates). Guarded with
  // it.runIf on non-zero data so it does not spuriously pass against this
  // scaffold-only commit's all-zero data; activates once real values are
  // loaded in the following commit.
  it.runIf(EAP_DATA.some((d) => d.economicallyActiveThousands !== 0))(
    'no province is a uniform scalar multiple of National (anti-stub check)',
    () => {
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
    },
  )
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
