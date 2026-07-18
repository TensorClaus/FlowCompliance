import { describe, it, expect } from 'vitest'
import {
  EAP_DATASET_VERSION,
  PROVINCES,
  EAP_DATA,
  getEapByProvince,
  getEapByProvinceAndLevel,
} from '../eap.js'
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

  it('contains 560 data points (10 provinces x 7 levels x 4 races x 2 genders)', () => {
    expect(EAP_DATA).toHaveLength(560)
  })

  it('every data point has a percentage between 0 and 100', () => {
    for (const dp of EAP_DATA) {
      expect(dp.percentage).toBeGreaterThanOrEqual(0)
      expect(dp.percentage).toBeLessThanOrEqual(100)
    }
  })

  it('every data point has a non-negative population', () => {
    for (const dp of EAP_DATA) {
      expect(dp.population).toBeGreaterThanOrEqual(0)
    }
  })

  it('every data point has a valid province from PROVINCES', () => {
    const provinceSet = new Set<string>(PROVINCES)
    for (const dp of EAP_DATA) {
      expect(provinceSet.has(dp.province)).toBe(true)
    }
  })

  it('every data point has occupationalLevel between 1 and 7', () => {
    for (const dp of EAP_DATA) {
      expect(dp.occupationalLevel).toBeGreaterThanOrEqual(1)
      expect(dp.occupationalLevel).toBeLessThanOrEqual(7)
    }
  })

  it('every data point has a valid race', () => {
    const validRaces = new Set(['African', 'Coloured', 'Indian/Asian', 'White'])
    for (const dp of EAP_DATA) {
      expect(validRaces.has(dp.race)).toBe(true)
    }
  })

  it('every data point has a valid gender', () => {
    const validGenders = new Set(['Male', 'Female'])
    for (const dp of EAP_DATA) {
      expect(validGenders.has(dp.gender)).toBe(true)
    }
  })

  it('every data point has source and year populated', () => {
    for (const dp of EAP_DATA) {
      expect(dp.source.length).toBeGreaterThan(0)
      expect(dp.year).toBe(2024)
    }
  })
})

// ---------------------------------------------------------------------------
// getEapByProvince
// ---------------------------------------------------------------------------

describe('getEapByProvince', () => {
  it('returns 56 data points for "National" (7 levels x 4 races x 2 genders)', () => {
    const results = getEapByProvince('National')
    expect(results).toHaveLength(56)
    for (const dp of results) {
      expect(dp.province).toBe('National')
    }
  })

  it('returns 56 data points for "Gauteng"', () => {
    const results = getEapByProvince('Gauteng')
    expect(results).toHaveLength(56)
  })

  it('returns 56 data points for stub provinces', () => {
    const results = getEapByProvince('Limpopo')
    expect(results).toHaveLength(56)
  })

  it('returns empty array for an invalid province', () => {
    const results = getEapByProvince('Mars' as EapProvince)
    expect(results).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// getEapByProvinceAndLevel
// ---------------------------------------------------------------------------

describe('getEapByProvinceAndLevel', () => {
  it('returns 8 data points for National level 1 (4 races x 2 genders)', () => {
    const results = getEapByProvinceAndLevel('National', 1)
    expect(results).toHaveLength(8)
    for (const dp of results) {
      expect(dp.province).toBe('National')
      expect(dp.occupationalLevel).toBe(1)
    }
  })

  it('returns 8 data points for Western Cape level 3', () => {
    const results = getEapByProvinceAndLevel('Western Cape', 3)
    expect(results).toHaveLength(8)
  })

  it('returns empty array for invalid level', () => {
    const results = getEapByProvinceAndLevel('National', 99)
    expect(results).toHaveLength(0)
  })

  it('returns empty array for invalid province', () => {
    const results = getEapByProvinceAndLevel('Invalid' as EapProvince, 1)
    expect(results).toHaveLength(0)
  })
})
