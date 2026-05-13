import { describe, expect, it } from 'vitest'
import { SectionFSchema } from './eea2.js'

const createBarrier = (categoryId: number) => ({
  categoryId,
  label: `Barrier ${String(categoryId)}`,
  barrierExists: false,
  aaMeasuresDeveloped: false,
})

describe('EEA2 shared schemas', () => {
  it('requires Section F to include exactly 23 barrier categories', () => {
    const baseSectionF = {
      consultation: {
        consultativeBody: true,
        tradeUnion: false,
        employees: false,
      },
    }

    expect(
      SectionFSchema.safeParse({
        ...baseSectionF,
        barriers: Array.from({ length: 22 }, (_, index) => createBarrier(index + 1)),
      }).success,
    ).toBe(false)

    expect(
      SectionFSchema.safeParse({
        ...baseSectionF,
        barriers: Array.from({ length: 23 }, (_, index) => createBarrier(index + 1)),
      }).success,
    ).toBe(true)
  })
})
