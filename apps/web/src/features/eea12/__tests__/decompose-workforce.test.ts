import type { OccupationalMatrix } from '@simplifi/shared'
import { describe, expect, it } from 'vitest'
import { decomposeEEA2Workforce } from '../decompose-workforce'

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeCell(value: number) {
  return { value, percent: 0 }
}

function makeEmptyRow() {
  return {
    africanMale: makeCell(0),
    africanFemale: makeCell(0),
    colouredMale: makeCell(0),
    colouredFemale: makeCell(0),
    indianMale: makeCell(0),
    indianFemale: makeCell(0),
    whiteMale: makeCell(0),
    whiteFemale: makeCell(0),
    foreignNationalMale: makeCell(0),
    foreignNationalFemale: makeCell(0),
    total: makeCell(0),
  }
}

function mustFind<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new TypeError('Expected value to be defined')
  }
  return value
}

function makeMatrix(overrides: Partial<OccupationalMatrix> = {}): OccupationalMatrix {
  return {
    topManagement: makeEmptyRow(),
    seniorManagement: makeEmptyRow(),
    professionallyQualified: makeEmptyRow(),
    skilledTechnical: makeEmptyRow(),
    semiSkilled: makeEmptyRow(),
    unskilled: makeEmptyRow(),
    totalPermanent: makeEmptyRow(),
    temporaryEmployees: makeEmptyRow(),
    grandTotal: makeEmptyRow(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('decomposeEEA2Workforce', () => {
  it('returns empty rows, anomalies, and foreignNationals for all-zero matrices', () => {
    const result = decomposeEEA2Workforce(makeMatrix(), makeMatrix())

    expect(result.rows).toHaveLength(0)
    expect(result.anomalies).toHaveLength(0)
    expect(result.foreignNationals).toHaveLength(0)
  })

  it('emits one non-disabled row for a single non-zero cell with no disability', () => {
    const workforce = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanMale: makeCell(3),
        total: makeCell(3),
      },
    })

    const result = decomposeEEA2Workforce(workforce, makeMatrix())

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({
      occupationalLevel: 1,
      race: 'A',
      gender: 'M',
      disability: false,
      count: 3,
    })
    expect(result.anomalies).toHaveLength(0)
  })

  it('emits both a disability row and a non-disabled row when disabilityCount > 0 and < workforceCount', () => {
    const workforce = makeMatrix({
      seniorManagement: {
        ...makeEmptyRow(),
        whiteFemale: makeCell(10),
        total: makeCell(10),
      },
    })
    const disability = makeMatrix({
      seniorManagement: {
        ...makeEmptyRow(),
        whiteFemale: makeCell(2),
        total: makeCell(2),
      },
    })

    const result = decomposeEEA2Workforce(workforce, disability)

    expect(result.rows).toHaveLength(2)

    const disabilityRow = result.rows.find((r) => r.disability)
    const nonDisabledRow = result.rows.find((r) => !r.disability)

    expect(disabilityRow).toEqual({
      occupationalLevel: 2,
      race: 'W',
      gender: 'F',
      disability: true,
      count: 2,
    })
    expect(nonDisabledRow).toEqual({
      occupationalLevel: 2,
      race: 'W',
      gender: 'F',
      disability: false,
      count: 8,
    })
  })

  it('suppresses zero-count rows — disability row absent when disabilityCount is 0', () => {
    const workforce = makeMatrix({
      unskilled: {
        ...makeEmptyRow(),
        colouredMale: makeCell(5),
        total: makeCell(5),
      },
    })

    const result = decomposeEEA2Workforce(workforce, makeMatrix())

    // Only one row: non-disabled
    expect(result.rows).toHaveLength(1)
    const firstRow = mustFind(result.rows[0])
    expect(firstRow.disability).toBe(false)
    expect(firstRow.count).toBe(5)
  })

  it('suppresses non-disabled row when workforceCount === disabilityCount (all disabled)', () => {
    const workforce = makeMatrix({
      skilledTechnical: {
        ...makeEmptyRow(),
        indianMale: makeCell(4),
        total: makeCell(4),
      },
    })
    const disability = makeMatrix({
      skilledTechnical: {
        ...makeEmptyRow(),
        indianMale: makeCell(4),
        total: makeCell(4),
      },
    })

    const result = decomposeEEA2Workforce(workforce, disability)

    expect(result.rows).toHaveLength(1)
    const firstRow = mustFind(result.rows[0])
    expect(firstRow.disability).toBe(true)
    expect(firstRow.count).toBe(4)
  })

  // ---- Anomaly path (disability > workforce) --------------------------------

  it('records cell path in anomalies when disabilityCount exceeds workforceCount', () => {
    const workforce = makeMatrix({
      professionallyQualified: {
        ...makeEmptyRow(),
        colouredFemale: makeCell(2),
        total: makeCell(2),
      },
    })
    const disability = makeMatrix({
      professionallyQualified: {
        ...makeEmptyRow(),
        colouredFemale: makeCell(5),
        total: makeCell(5),
      },
    })

    const result = decomposeEEA2Workforce(workforce, disability)

    // Anomaly path must be present
    expect(result.anomalies).toContain('professionallyQualified.CF')

    // Disability row is still emitted at raw disabilityCount (validation layer handles it)
    const disabilityRow = result.rows.find((r) => r.disability)
    expect(disabilityRow).toBeDefined()
    expect(mustFind(disabilityRow).count).toBe(5)

    // Non-disabled row must NOT be emitted (nonDisabled = max(0, 2-5) = 0)
    const nonDisabledRow = result.rows.find((r) => !r.disability)
    expect(nonDisabledRow).toBeUndefined()
  })

  it('anomalies contain cell paths only — no counts embedded in the string', () => {
    const workforce = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanFemale: makeCell(1),
        total: makeCell(1),
      },
    })
    const disability = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanFemale: makeCell(3),
        total: makeCell(3),
      },
    })

    const result = decomposeEEA2Workforce(workforce, disability)

    for (const path of result.anomalies) {
      // Cell path format: <levelKey>.<raceCode><genderCode>
      // Must not contain digits (which would mean a count is embedded)
      expect(path).toMatch(/^[a-zA-Z]+\.[ACIW][MF]$/)
    }
  })

  // ---- Foreign national exclusion ------------------------------------------

  it('excludes foreign nationals from rows and returns per-level totals', () => {
    const workforce = makeMatrix({
      semiSkilled: {
        ...makeEmptyRow(),
        africanMale: makeCell(10),
        foreignNationalMale: makeCell(3),
        foreignNationalFemale: makeCell(2),
        total: makeCell(15),
      },
    })

    const result = decomposeEEA2Workforce(workforce, makeMatrix())

    // Foreign national rows must NOT appear in rows[]
    for (const row of result.rows) {
      // All race codes in the flat shape are A/C/I/W
      expect(['A', 'C', 'I', 'W']).toContain(row.race)
    }

    // foreignNationals summary must capture the level total
    expect(result.foreignNationals).toHaveLength(1)
    expect(result.foreignNationals[0]).toEqual({ level: 'semiSkilled', count: 5 })
  })

  it('foreignNationals is empty when no foreign nationals are present', () => {
    const workforce = makeMatrix({
      unskilled: {
        ...makeEmptyRow(),
        whiteMale: makeCell(7),
        total: makeCell(7),
      },
    })

    const result = decomposeEEA2Workforce(workforce, makeMatrix())

    expect(result.foreignNationals).toHaveLength(0)
  })

  // ---- Skips totalPermanent and grandTotal ---------------------------------

  it('does not produce rows from totalPermanent or grandTotal even when populated', () => {
    // These are computed aggregate rows — iterating them would double-count
    const workforce = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanMale: makeCell(2),
        total: makeCell(2),
      },
      // totalPermanent and grandTotal have same value (as they would in a real EEA2)
      totalPermanent: {
        ...makeEmptyRow(),
        africanMale: makeCell(2),
        total: makeCell(2),
      },
      grandTotal: {
        ...makeEmptyRow(),
        africanMale: makeCell(2),
        total: makeCell(2),
      },
    })

    const result = decomposeEEA2Workforce(workforce, makeMatrix())

    // Only the real row from topManagement should appear
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({
      occupationalLevel: 1,
      race: 'A',
      gender: 'M',
      disability: false,
      count: 2,
    })
  })

  // ---- temporaryEmployees is a real level (OFO 7) --------------------------

  it('includes temporaryEmployees rows as occupationalLevel 7', () => {
    const workforce = makeMatrix({
      temporaryEmployees: {
        ...makeEmptyRow(),
        africanFemale: makeCell(6),
        total: makeCell(6),
      },
    })

    const result = decomposeEEA2Workforce(workforce, makeMatrix())

    const tempRow = result.rows.find((r) => r.occupationalLevel === 7)
    expect(tempRow).toBeDefined()
    expect(mustFind(tempRow).count).toBe(6)
  })

  // ---- Multi-level fixture — spot-check exact row set ---------------------

  it('produces the exact expected row set from a known multi-level fixture', () => {
    const workforce = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanMale: makeCell(5),
        whiteFemale: makeCell(2),
        total: makeCell(7),
      },
      unskilled: {
        ...makeEmptyRow(),
        colouredMale: makeCell(3),
        total: makeCell(3),
      },
    })
    const disability = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanMale: makeCell(1),
        total: makeCell(1),
      },
    })

    const result = decomposeEEA2Workforce(workforce, disability)

    // Expected rows:
    // topManagement · A · M · disability=true  → 1
    // topManagement · A · M · disability=false → 4
    // topManagement · W · F · disability=false → 2
    // unskilled     · C · M · disability=false → 3

    expect(result.rows).toHaveLength(4)

    expect(result.rows).toContainEqual({
      occupationalLevel: 1,
      race: 'A',
      gender: 'M',
      disability: true,
      count: 1,
    })
    expect(result.rows).toContainEqual({
      occupationalLevel: 1,
      race: 'A',
      gender: 'M',
      disability: false,
      count: 4,
    })
    expect(result.rows).toContainEqual({
      occupationalLevel: 1,
      race: 'W',
      gender: 'F',
      disability: false,
      count: 2,
    })
    expect(result.rows).toContainEqual({
      occupationalLevel: 6,
      race: 'C',
      gender: 'M',
      disability: false,
      count: 3,
    })

    expect(result.anomalies).toHaveLength(0)
  })
})
