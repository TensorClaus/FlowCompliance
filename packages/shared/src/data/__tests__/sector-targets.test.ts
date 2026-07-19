import { describe, it, expect } from 'vitest'
import {
  GN6124_VERSION,
  SECTOR_CODES,
  TARGET_OCCUPATIONAL_LEVELS,
  SECTOR_TARGETS,
  OCCUPATIONAL_LEVEL_LABELS,
  getSectorTarget,
  getSectorTargetByLevel,
  targetLevelForOccupationalLevel,
} from '../sector-targets.js'
import type { SectorCode, TargetOccupationalLevel, SectorTargetLevel } from '../sector-targets.js'

// ---------------------------------------------------------------------------
// SECTOR_CODES
// ---------------------------------------------------------------------------

describe('SECTOR_CODES', () => {
  it('contains exactly 18 sector codes', () => {
    expect(SECTOR_CODES).toHaveLength(18)
  })

  it('includes key gazetted sectors', () => {
    expect(SECTOR_CODES).toContain('agriculture_forestry_fishing')
    expect(SECTOR_CODES).toContain('mining_quarrying')
    expect(SECTOR_CODES).toContain('finance_insurance')
    expect(SECTOR_CODES).toContain('information_communication')
    expect(SECTOR_CODES).toContain('arts_entertainment_recreation')
    expect(SECTOR_CODES).toContain('water_supply')
  })

  it('has no duplicate entries', () => {
    const unique = new Set(SECTOR_CODES)
    expect(unique.size).toBe(SECTOR_CODES.length)
  })
})

// ---------------------------------------------------------------------------
// TARGET_OCCUPATIONAL_LEVELS
// ---------------------------------------------------------------------------

describe('TARGET_OCCUPATIONAL_LEVELS', () => {
  it('contains exactly 4 gazetted target levels', () => {
    expect(TARGET_OCCUPATIONAL_LEVELS).toHaveLength(4)
  })

  it('has no duplicate entries', () => {
    const unique = new Set(TARGET_OCCUPATIONAL_LEVELS)
    expect(unique.size).toBe(TARGET_OCCUPATIONAL_LEVELS.length)
  })
})

// ---------------------------------------------------------------------------
// GN6124_VERSION
// ---------------------------------------------------------------------------

describe('GN6124_VERSION', () => {
  it('equals "GN6124-2025-04-15"', () => {
    expect(GN6124_VERSION).toBe('GN6124-2025-04-15')
  })
})

// ---------------------------------------------------------------------------
// SECTOR_TARGETS
// ---------------------------------------------------------------------------

describe('SECTOR_TARGETS', () => {
  it('has one entry per sector code (18 entries)', () => {
    expect(SECTOR_TARGETS).toHaveLength(18)
  })

  it('each entry (if any) has a sectorCode matching one of SECTOR_CODES', () => {
    for (const entry of SECTOR_TARGETS) {
      expect(SECTOR_CODES).toContain(entry.sectorCode)
    }
  })

  it('each entry (if any) has a non-empty sectorName', () => {
    for (const entry of SECTOR_TARGETS) {
      expect(entry.sectorName.length).toBeGreaterThan(0)
    }
  })

  it('each entry (if any) has targets for all 4 gazetted target occupational levels', () => {
    for (const entry of SECTOR_TARGETS) {
      for (const level of TARGET_OCCUPATIONAL_LEVELS) {
        const target = entry.targets[level]
        expect(target).toBeDefined()
      }
    }
  })

  it('all percentage values (if any) are between 0 and 100', () => {
    const percentageKeys: (keyof SectorTargetLevel)[] = [
      'designatedGroupMale',
      'designatedGroupFemale',
    ]
    for (const entry of SECTOR_TARGETS) {
      for (const level of TARGET_OCCUPATIONAL_LEVELS) {
        const target = entry.targets[level]
        for (const key of percentageKeys) {
          const value = target[key]
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(100)
        }
      }
      expect(entry.disabilityTarget).toBeGreaterThanOrEqual(0)
      expect(entry.disabilityTarget).toBeLessThanOrEqual(100)
    }
  })

  // Per gazette clause 3.1, designated-group gender targets are NOT required
  // to sum to 100% — white non-disabled males and foreign nationals are
  // excluded from both the numerator and the frame of reference. A
  // sum-to-100 invariant would therefore be statutorily wrong and is
  // intentionally NOT asserted here. See 01-RESEARCH.md "Target semantics".
})

// ---------------------------------------------------------------------------
// OCCUPATIONAL_LEVEL_LABELS (7-level workforce-classification scheme —
// unchanged by this plan; a separate concern from the 4-level target scope)
// ---------------------------------------------------------------------------

describe('OCCUPATIONAL_LEVEL_LABELS', () => {
  it('maps all 7 workforce-classification levels', () => {
    expect(Object.keys(OCCUPATIONAL_LEVEL_LABELS)).toHaveLength(7)
  })

  it('returns correct label for level 1', () => {
    expect(OCCUPATIONAL_LEVEL_LABELS[1]).toBe('Top Management')
  })

  it('returns correct label for level 7', () => {
    expect(OCCUPATIONAL_LEVEL_LABELS[7]).toBe('Non-Permanent')
  })
})

// ---------------------------------------------------------------------------
// getSectorTarget
// ---------------------------------------------------------------------------

describe('getSectorTarget', () => {
  it('returns the SectorTarget for a populated gazetted sector code', () => {
    // SECTOR_TARGETS is now populated (Wave 2 transcription complete), so a
    // valid gazetted sector code resolves to its full target profile.
    const result = getSectorTarget('mining_quarrying')
    expect(result).toBeDefined()
    expect(result?.sectorCode).toBe('mining_quarrying')
    expect(result?.sectorName).toBe('Mining and Quarrying')
  })

  it('returns undefined for an invalid code', () => {
    // Cast to satisfy type system — this tests runtime behaviour
    const result = getSectorTarget('nonexistent' as SectorCode)
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getSectorTargetByLevel
// ---------------------------------------------------------------------------

describe('getSectorTargetByLevel', () => {
  it('returns the SectorTargetLevel for a populated sector and level', () => {
    // SECTOR_TARGETS is now populated (Wave 2 transcription complete). See
    // the "gazetted value spot-checks" describe block below for exact
    // verbatim value assertions with in-test gazette citations.
    const result = getSectorTargetByLevel('finance_insurance', 'top_management')
    expect(result).toBeDefined()
  })

  it('returns undefined for an invalid sector code', () => {
    const result = getSectorTargetByLevel(
      'fake_sector' as SectorCode,
      'top_management' as TargetOccupationalLevel,
    )
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// targetLevelForOccupationalLevel — 7-level workforce -> 4-level target scope
// ---------------------------------------------------------------------------

describe('targetLevelForOccupationalLevel', () => {
  it('maps the top four workforce levels onto the gazetted target levels', () => {
    expect(targetLevelForOccupationalLevel(1)).toBe('top_management')
    expect(targetLevelForOccupationalLevel(2)).toBe('senior_management')
    expect(targetLevelForOccupationalLevel(3)).toBe('professionally_qualified_middle_management')
    expect(targetLevelForOccupationalLevel(4)).toBe('skilled_technical')
  })

  it('returns undefined for levels 5-7 (no gazetted target)', () => {
    expect(targetLevelForOccupationalLevel(5)).toBeUndefined()
    expect(targetLevelForOccupationalLevel(6)).toBeUndefined()
    expect(targetLevelForOccupationalLevel(7)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// SECTOR_TARGETS — gazetted value spot-checks
// ---------------------------------------------------------------------------
//
// Per 01-RESEARCH.md "Common Pitfall #4": range/count invariants alone can't
// catch content errors — a fabricated in-range value would pass every test
// above. These spot-checks assert exact, verbatim gazetted values (toBe, not
// range) with the specific gazette citation in each test body, so a wrong
// transcription fails loudly.
//
// All 5 assertions below were visually verified against the rendered PDF
// table for both the primary source (gov.za) and the DEL mirror
// (ee.labour.gov.za) — see 01-02-SUMMARY.md for the full verification
// record, including a documented correction of 01-RESEARCH.md's own
// gender-mislabeled "pre-verified" values (18.6/30.0/27.6 are the gazette's
// Top Management MALE targets for these three sectors, not Female).

describe('SECTOR_TARGETS — gazetted value spot-checks', () => {
  it('matches GN 6124 gazetted value for Accommodation and Food Service — Top Management, Male', () => {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, "5-Year Sectoral
    // Numerical Targets for All Sectors" table, p.6 — Accommodation and Food
    // Service Activities column, Top management / Male row.
    const result = getSectorTargetByLevel('accommodation_food_service', 'top_management')
    expect(result?.designatedGroupMale).toBe(18.6)
  })

  it('matches GN 6124 gazetted value for Construction — Top Management, Male', () => {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.7 —
    // Construction column, Top management / Male row.
    const result = getSectorTarget('construction')
    expect(result?.targets.top_management.designatedGroupMale).toBe(30)
  })

  it('matches GN 6124 gazetted value for Human Health and Social Work Activities — Top Management, Male', () => {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.8 — Human
    // Health and Social Work Activities column, Top management / Male row.
    const result = getSectorTarget('health_social_work')
    expect(result?.targets.top_management.designatedGroupMale).toBe(27.6)
  })

  it('matches GN 6124 gazetted disability target for Accommodation and Food Service Activities', () => {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.6 —
    // Accommodation and Food Service Activities column, "Disability only |
    // All" row.
    const result = getSectorTarget('accommodation_food_service')
    expect(result?.disabilityTarget).toBe(3)
  })

  it('matches GN 6124 gazetted disability target for Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles', () => {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.10 —
    // Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles
    // column, "Disability only | All" row.
    const result = getSectorTarget('wholesale_retail_trade')
    expect(result?.disabilityTarget).toBe(3)
  })
})
