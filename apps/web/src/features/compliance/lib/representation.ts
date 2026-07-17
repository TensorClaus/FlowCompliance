import {
  getSectorTargetByLevel,
  type DesignatedGroupTarget,
  type OccupationalLevel,
  type SectorCode,
} from '@simplifi/shared'
import type { DemoCompany, LevelHeadcount } from '../fixtures/demo-company'
import { classify, type GapStatus } from './gap-status'

export type GroupKey = 'african' | 'coloured' | 'indian' | 'white' | 'female' | 'disabled'

export interface GroupGap {
  group: GroupKey
  actualPct: number
  targetPct: number
  /** actualPct - targetPct; negative means under target. */
  deltaPct: number
  status: GapStatus
}

export interface LevelRepresentation {
  level: OccupationalLevel
  /** SA citizens only — foreign nationals are excluded per rule_eea_006. */
  citizenHeadcount: number
  foreignNationalHeadcount: number
  groups: GroupGap[]
  status: GapStatus
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10
}

function groupGap(group: GroupKey, actualPct: number, targetPct: number): GroupGap {
  const deltaPct = Math.round((actualPct - targetPct) * 10) / 10
  return { group, actualPct, targetPct, deltaPct, status: classify(deltaPct) }
}

export function computeLevelRepresentation(
  row: LevelHeadcount,
  target: DesignatedGroupTarget,
): LevelRepresentation {
  const citizens =
    row.african.male +
    row.african.female +
    row.coloured.male +
    row.coloured.female +
    row.indian.male +
    row.indian.female +
    row.white.male +
    row.white.female
  const foreign = row.foreignNational.male + row.foreignNational.female
  const female = row.african.female + row.coloured.female + row.indian.female + row.white.female

  const groups: GroupGap[] = [
    groupGap('african', pct(row.african.male + row.african.female, citizens), target.african),
    groupGap('coloured', pct(row.coloured.male + row.coloured.female, citizens), target.coloured),
    groupGap('indian', pct(row.indian.male + row.indian.female, citizens), target.indian),
    groupGap('white', pct(row.white.male + row.white.female, citizens), target.white),
    groupGap('female', pct(female, citizens), target.female),
    groupGap('disabled', pct(row.disabled, citizens), target.disabledTarget),
  ]

  const worst = groups.some((g) => g.status === 'gap')
    ? 'gap'
    : groups.some((g) => g.status === 'close')
      ? 'close'
      : 'met'

  return {
    level: row.level,
    citizenHeadcount: citizens,
    foreignNationalHeadcount: foreign,
    groups,
    status: worst,
  }
}

export function computeSectorCompliance(company: DemoCompany): {
  levels: LevelRepresentation[]
  sectorCode: SectorCode
} {
  const levels = company.workforce.map((row) => {
    const target = getSectorTargetByLevel(company.sectorCode, row.level)
    if (!target)
      throw new Error(
        `No GN 6124 target for sector ${company.sectorCode} level ${String(row.level)}`,
      )
    return computeLevelRepresentation(row, target)
  })
  return { levels, sectorCode: company.sectorCode }
}

/**
 * Penalty exposure under EEA s.65 / GN 6124 (rule_eea_024).
 * Offence 1–4: greater of R1.5m or (2 × offence)% of turnover.
 * Offence 5+: greater of R2.7m or 10% of turnover.
 */
export function computePenaltyExposure(
  annualTurnoverZar: number,
  priorOffenceCount: number,
): number {
  const nextOffence = priorOffenceCount + 1
  if (nextOffence >= 5) return Math.max(2_700_000, annualTurnoverZar * 0.1)
  return Math.max(1_500_000, (annualTurnoverZar * (nextOffence * 2)) / 100)
}

export interface SubmissionWindow {
  opensOn: Date
  closesOn: Date
  isOpen: boolean
  daysUntilOpen: number
  daysUntilClose: number
}

/** EEA2 submission window runs 1–15 January each year (rule_eea_016). */
export function getEea2SubmissionWindow(now: Date): SubmissionWindow {
  const year = now.getFullYear()
  const thisOpen = new Date(year, 0, 1)
  const thisClose = new Date(year, 0, 15, 23, 59, 59)
  const opensOn = now <= thisClose ? thisOpen : new Date(year + 1, 0, 1)
  const closesOn = now <= thisClose ? thisClose : new Date(year + 1, 0, 15, 23, 59, 59)
  const msPerDay = 86_400_000
  return {
    opensOn,
    closesOn,
    isOpen: now >= opensOn && now <= closesOn,
    daysUntilOpen: Math.max(0, Math.ceil((opensOn.getTime() - now.getTime()) / msPerDay)),
    daysUntilClose: Math.max(0, Math.ceil((closesOn.getTime() - now.getTime()) / msPerDay)),
  }
}

/**
 * Blended score: 60% workforce representation vs sector targets,
 * 40% open compliance actions weighted by severity.
 */
export function computeComplianceScore(company: DemoCompany): number {
  const { levels } = computeSectorCompliance(company)
  const allGroups = levels.flatMap((l) => l.groups)
  let groupPoints = 0
  for (const g of allGroups) {
    if (g.status === 'met') groupPoints += 1
    else if (g.status === 'close') groupPoints += 0.6
  }
  const groupScore = groupPoints / allGroups.length

  const severityWeight = { critical: 0.15, warning: 0.07, info: 0.02 } as const
  let actionPenalty = 0
  for (const a of company.actions) actionPenalty += severityWeight[a.severity]
  const actionScore = Math.max(0, 1 - actionPenalty)

  return Math.round((groupScore * 0.6 + actionScore * 0.4) * 100)
}

export function formatZar(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export { type GapStatus } from './gap-status'
