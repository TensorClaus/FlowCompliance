import type { OccupationalLevel } from '@simplifi/shared'
import type { DemoCompany, GroupPay, PayRace } from '../fixtures/demo-company'

export interface PayGroupRow {
  race: PayRace
  gender: 'male' | 'female'
  headcount: number
  avgMonthlyCtc: number
  medianMonthlyCtc: number
  /** Percentage gap vs the non-designated benchmark (white male) at the same level. */
  gapVsBenchmarkPct: number | null
  /** True when avg CTC is >15% below benchmark — rule_eea_019 flag. */
  flagged: boolean
}

export interface Eea4LevelBreakdown {
  level: OccupationalLevel
  benchmarkAvgCtc: number | null
  rows: PayGroupRow[]
  flaggedCount: number
}

export const PAY_GAP_FLAG_THRESHOLD_PCT = -15

const RACES: PayRace[] = ['african', 'coloured', 'indian', 'white']

function gapPct(pay: GroupPay, benchmark: number | null): number | null {
  if (benchmark === null || benchmark === 0 || pay.headcount === 0) return null
  return Math.round(((pay.avgMonthlyCtc - benchmark) / benchmark) * 1000) / 10
}

export function computeEea4Breakdown(company: DemoCompany): Eea4LevelBreakdown[] {
  return company.remuneration.map((levelRem) => {
    const benchmarkPay = levelRem.groups.white.male
    const benchmark = benchmarkPay.headcount > 0 ? benchmarkPay.avgMonthlyCtc : null

    const rows: PayGroupRow[] = []
    for (const race of RACES) {
      for (const gender of ['male', 'female'] as const) {
        const pay = levelRem.groups[race][gender]
        const isBenchmark = race === 'white' && gender === 'male'
        const gap = isBenchmark ? null : gapPct(pay, benchmark)
        rows.push({
          race,
          gender,
          headcount: pay.headcount,
          avgMonthlyCtc: pay.avgMonthlyCtc,
          medianMonthlyCtc: pay.medianMonthlyCtc,
          gapVsBenchmarkPct: gap,
          flagged: gap !== null && gap < PAY_GAP_FLAG_THRESHOLD_PCT,
        })
      }
    }

    return {
      level: levelRem.level,
      benchmarkAvgCtc: benchmark,
      rows,
      flaggedCount: rows.filter((r) => r.flagged).length,
    }
  })
}

/**
 * Vertical income differential: weighted average CTC of the top occupational
 * level divided by that of the lowest populated permanent level (rule_eea_018).
 */
export function computeIncomeDifferentialRatio(company: DemoCompany): number | null {
  const weightedAvg = (level: OccupationalLevel): number | null => {
    const rem = company.remuneration.find((r) => r.level === level)
    if (!rem) return null
    let total = 0
    let heads = 0
    for (const race of RACES) {
      for (const gender of ['male', 'female'] as const) {
        const pay = rem.groups[race][gender]
        total += pay.avgMonthlyCtc * pay.headcount
        heads += pay.headcount
      }
    }
    return heads === 0 ? null : total / heads
  }

  const top = weightedAvg(1)
  const bottom = weightedAvg(6) ?? weightedAvg(5)
  if (top === null || bottom === null || bottom === 0) return null
  return Math.round((top / bottom) * 10) / 10
}

export const GINI_ESCALATION_THRESHOLD = 0.6
