import { describe, it, expect } from 'vitest'
import {
  GN6124_VERSION,
  SECTOR_CODES,
  SECTOR_TARGETS,
  OCCUPATIONAL_LEVEL_LABELS,
  getSectorTarget,
  getSectorTargetByLevel,
} from '../sector-targets.js'
import type { SectorCode, DesignatedGroupTarget } from '../sector-targets.js'

// ---------------------------------------------------------------------------
// SECTOR_CODES
// ---------------------------------------------------------------------------

describe('SECTOR_CODES', () => {
  it('contains exactly 19 sector codes', () => {
    expect(SECTOR_CODES).toHaveLength(19)
  })

  it('includes key sectors', () => {
    expect(SECTOR_CODES).toContain('agriculture')
    expect(SECTOR_CODES).toContain('mining')
    expect(SECTOR_CODES).toContain('finance_insurance')
    expect(SECTOR_CODES).toContain('information_technology')
    expect(SECTOR_CODES).toContain('domestic_services')
  })

  it('has no duplicate entries', () => {
    const unique = new Set(SECTOR_CODES)
    expect(unique.size).toBe(SECTOR_CODES.length)
  })
})

// ---------------------------------------------------------------------------
// GN6124_VERSION
// ---------------------------------------------------------------------------

describe('GN6124_VERSION', () => {
  it('equals "GN6124-2024"', () => {
    expect(GN6124_VERSION).toBe('GN6124-2024')
  })
})

// ---------------------------------------------------------------------------
// SECTOR_TARGETS
// ---------------------------------------------------------------------------

describe('SECTOR_TARGETS', () => {
  it('has one entry per sector code (19 entries)', () => {
    expect(SECTOR_TARGETS).toHaveLength(19)
  })

  it('each entry has a sectorCode matching one of SECTOR_CODES', () => {
    for (const entry of SECTOR_TARGETS) {
      expect(SECTOR_CODES).toContain(entry.sectorCode)
    }
  })

  it('each entry has a non-empty sectorName', () => {
    for (const entry of SECTOR_TARGETS) {
      expect(entry.sectorName.length).toBeGreaterThan(0)
    }
  })

  it('each entry has targets for all 7 occupational levels', () => {
    for (const entry of SECTOR_TARGETS) {
      for (let level = 1; level <= 7; level++) {
        const target = entry.targets[level as 1 | 2 | 3 | 4 | 5 | 6 | 7]
        expect(target).toBeDefined()
      }
    }
  })

  it('all percentage values are between 0 and 100', () => {
    const percentageKeys: (keyof DesignatedGroupTarget)[] = [
      'african',
      'coloured',
      'indian',
      'white',
      'male',
      'female',
      'disabledTarget',
    ]
    for (const entry of SECTOR_TARGETS) {
      for (let level = 1; level <= 7; level++) {
        const target = entry.targets[level as 1 | 2 | 3 | 4 | 5 | 6 | 7]
        for (const key of percentageKeys) {
          const value = target[key]
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(100)
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// OCCUPATIONAL_LEVEL_LABELS
// ---------------------------------------------------------------------------

describe('OCCUPATIONAL_LEVEL_LABELS', () => {
  it('maps all 7 levels', () => {
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
  it('returns the correct SectorTarget for a valid code', () => {
    const result = getSectorTarget('mining')
    expect(result).toBeDefined()
    expect(result?.sectorCode).toBe('mining')
    expect(result?.sectorName).toBe('Mining and Quarrying')
  })

  it('returns undefined for an invalid code', () => {
    // Cast to satisfy type system — this tests runtime behaviour
    const result = getSectorTarget('nonexistent' as SectorCode)
    expect(result).toBeUndefined()
  })

  it('returns target with all 7 levels populated', () => {
    const result = getSectorTarget('education')
    expect(result).toBeDefined()
    for (let level = 1; level <= 7; level++) {
      expect(result?.targets[level as 1 | 2 | 3 | 4 | 5 | 6 | 7]).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
// getSectorTargetByLevel
// ---------------------------------------------------------------------------

describe('getSectorTargetByLevel', () => {
  it('returns a DesignatedGroupTarget for valid sector and level', () => {
    const result = getSectorTargetByLevel('finance_insurance', 1)
    expect(result).toBeDefined()
    expect(result?.african).toBeGreaterThan(0)
    expect(result?.male).toBeGreaterThan(0)
    expect(result?.female).toBeGreaterThan(0)
  })

  it('returns undefined for an invalid sector code', () => {
    const result = getSectorTargetByLevel('fake_sector' as SectorCode, 1)
    expect(result).toBeUndefined()
  })

  it('returns different targets for different levels in the same sector', () => {
    const level1 = getSectorTargetByLevel('mining', 1)
    const level6 = getSectorTargetByLevel('mining', 6)
    expect(level1).toBeDefined()
    expect(level6).toBeDefined()
    // Mining has different african targets at senior vs unskilled levels
    expect(level1?.african).not.toBe(level6?.african)
  })
})
