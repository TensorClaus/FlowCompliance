import { describe, it, expect } from 'vitest'
import {
  GN6124_VERSION,
  SECTOR_CODES,
  TARGET_OCCUPATIONAL_LEVELS,
  SECTOR_TARGETS,
  OCCUPATIONAL_LEVEL_LABELS,
  getSectorTarget,
  getSectorTargetByLevel,
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
  it('is an array (Wave 2 transcription populates entries)', () => {
    // TODO(Wave 2): tighten to `toHaveLength(18)` once all sectors are
    // transcribed from the gazette. Left as a shape-only check for now.
    expect(Array.isArray(SECTOR_TARGETS)).toBe(true)
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
  it('returns undefined for any code while SECTOR_TARGETS is empty', () => {
    // TODO(Wave 2): once transcription lands, assert a populated sector
    // resolves to its full target profile.
    const result = getSectorTarget('mining_quarrying')
    expect(result).toBeUndefined()
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
  it('returns undefined for any sector/level while SECTOR_TARGETS is empty', () => {
    // TODO(Wave 2): once transcription lands, assert a populated
    // sector/level pair resolves to its SectorTargetLevel, and add >= 3
    // verbatim spot-check tests asserting exact gazetted values (toBe, not
    // range) with the specific gazette citation in each test body — range/
    // count invariants alone can't catch content errors.
    const result = getSectorTargetByLevel('finance_insurance', 'top_management')
    expect(result).toBeUndefined()
  })

  it('returns undefined for an invalid sector code', () => {
    const result = getSectorTargetByLevel(
      'fake_sector' as SectorCode,
      'top_management' as TargetOccupationalLevel,
    )
    expect(result).toBeUndefined()
  })
})
