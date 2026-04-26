import { describe, it, expect } from 'vitest'
import {
  BARRIER_CATEGORIES,
  OCCUPATIONAL_LEVELS,
  RACE_CODES,
  RACE_LABELS,
  GENDER_CODES,
  GENDER_LABELS,
  DESIGNATION_STATUSES,
  DISABILITY_CATEGORIES,
} from '../constants.js'

// ---------------------------------------------------------------------------
// BARRIER_CATEGORIES
// ---------------------------------------------------------------------------

describe('BARRIER_CATEGORIES', () => {
  it('is non-empty', () => {
    expect(BARRIER_CATEGORIES.length).toBeGreaterThan(0)
  })

  it('contains exactly 23 categories', () => {
    expect(BARRIER_CATEGORIES).toHaveLength(23)
  })

  it('includes key categories', () => {
    expect(BARRIER_CATEGORIES).toContain('recruitment_procedures')
    expect(BARRIER_CATEGORIES).toContain('reasonable_accommodation')
    expect(BARRIER_CATEGORIES).toContain('other')
  })

  it('has no duplicate entries', () => {
    const unique = new Set(BARRIER_CATEGORIES)
    expect(unique.size).toBe(BARRIER_CATEGORIES.length)
  })
})

// ---------------------------------------------------------------------------
// OCCUPATIONAL_LEVELS
// ---------------------------------------------------------------------------

describe('OCCUPATIONAL_LEVELS', () => {
  it('contains 7 levels', () => {
    expect(OCCUPATIONAL_LEVELS).toHaveLength(7)
  })

  it('starts with "Top Management" and ends with "Non-Permanent"', () => {
    expect(OCCUPATIONAL_LEVELS[0]).toBe('Top Management')
    expect(OCCUPATIONAL_LEVELS[6]).toBe('Non-Permanent')
  })
})

// ---------------------------------------------------------------------------
// RACE_CODES and RACE_LABELS
// ---------------------------------------------------------------------------

describe('RACE_CODES', () => {
  it('equals ["A", "C", "I", "W"]', () => {
    expect([...RACE_CODES]).toEqual(['A', 'C', 'I', 'W'])
  })

  it('has exactly 4 entries', () => {
    expect(RACE_CODES).toHaveLength(4)
  })
})

describe('RACE_LABELS', () => {
  it('maps A to "African"', () => {
    expect(RACE_LABELS.A).toBe('African')
  })

  it('maps C to "Coloured"', () => {
    expect(RACE_LABELS.C).toBe('Coloured')
  })

  it('maps I to "Indian/Asian"', () => {
    expect(RACE_LABELS.I).toBe('Indian/Asian')
  })

  it('maps W to "White"', () => {
    expect(RACE_LABELS.W).toBe('White')
  })
})

// ---------------------------------------------------------------------------
// GENDER_CODES and GENDER_LABELS
// ---------------------------------------------------------------------------

describe('GENDER_CODES', () => {
  it('equals ["M", "F"]', () => {
    expect([...GENDER_CODES]).toEqual(['M', 'F'])
  })

  it('has exactly 2 entries', () => {
    expect(GENDER_CODES).toHaveLength(2)
  })
})

describe('GENDER_LABELS', () => {
  it('maps M to "Male"', () => {
    expect(GENDER_LABELS.M).toBe('Male')
  })

  it('maps F to "Female"', () => {
    expect(GENDER_LABELS.F).toBe('Female')
  })
})

// ---------------------------------------------------------------------------
// DESIGNATION_STATUSES
// ---------------------------------------------------------------------------

describe('DESIGNATION_STATUSES', () => {
  it('contains 4 statuses', () => {
    expect(DESIGNATION_STATUSES).toHaveLength(4)
  })

  it('includes all expected values', () => {
    expect(DESIGNATION_STATUSES).toContain('designated')
    expect(DESIGNATION_STATUSES).toContain('non_designated')
    expect(DESIGNATION_STATUSES).toContain('foreign_national')
    expect(DESIGNATION_STATUSES).toContain('non_disclosure')
  })
})

// ---------------------------------------------------------------------------
// DISABILITY_CATEGORIES
// ---------------------------------------------------------------------------

describe('DISABILITY_CATEGORIES', () => {
  it('contains 7 categories', () => {
    expect(DISABILITY_CATEGORIES).toHaveLength(7)
  })

  it('includes "none" for employees without disabilities', () => {
    expect(DISABILITY_CATEGORIES).toContain('none')
  })

  it('includes key disability types', () => {
    expect(DISABILITY_CATEGORIES).toContain('physical')
    expect(DISABILITY_CATEGORIES).toContain('sensory')
    expect(DISABILITY_CATEGORIES).toContain('intellectual')
  })
})
