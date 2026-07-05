import type { OccupationalLevel, SectorCode } from '@simplifi/shared'

export interface GenderSplit {
  male: number
  female: number
}

export interface LevelHeadcount {
  level: OccupationalLevel
  african: GenderSplit
  coloured: GenderSplit
  indian: GenderSplit
  white: GenderSplit
  foreignNational: GenderSplit
  disabled: number
}

export type ActionSeverity = 'critical' | 'warning' | 'info'

export interface ComplianceAction {
  id: string
  title: string
  detail: string
  dueDate: string
  severity: ActionSeverity
  ruleRef: string
}

export interface ComplianceDeadline {
  date: string
  label: string
  status: 'done' | 'upcoming' | 'overdue'
  ruleRef?: string
}

export interface GroupPay {
  headcount: number
  avgMonthlyCtc: number
  medianMonthlyCtc: number
}

export type PayRace = 'african' | 'coloured' | 'indian' | 'white'

export interface LevelRemuneration {
  level: OccupationalLevel
  groups: Record<PayRace, { male: GroupPay; female: GroupPay }>
}

export interface GiniPoint {
  year: number
  gini: number
}

export interface DemoCompany {
  name: string
  registrationNumber: string
  sectorCode: SectorCode
  sectorName: string
  province: string
  annualTurnoverZar: number
  priorOffenceCount: number
  designatedSince: string
  eepCycleStart: string
  eepCycleEnd: string
  reportingYear: number
  workforce: LevelHeadcount[]
  remuneration: LevelRemuneration[]
  giniSeries: GiniPoint[]
  actions: ComplianceAction[]
  deadlines: ComplianceDeadline[]
}

const BASE_CTC_BY_LEVEL: Record<OccupationalLevel, number> = {
  1: 145_000,
  2: 95_000,
  3: 62_000,
  4: 38_000,
  5: 21_000,
  6: 12_500,
  7: 9800,
}

// Pay skew multipliers chosen so the fixture exhibits realistic differentials,
// including >15% designated-group gaps that trigger the rule_eea_019 flag.
const RACE_PAY_SKEW: Record<PayRace, number> = {
  african: 0.94,
  coloured: 0.97,
  indian: 1.08,
  white: 1.18,
}
const FEMALE_PAY_SKEW = 0.93

function buildRemuneration(workforce: LevelHeadcount[]): LevelRemuneration[] {
  return workforce.map((row) => {
    const base = BASE_CTC_BY_LEVEL[row.level]
    const groups = {} as LevelRemuneration['groups']
    for (const race of ['african', 'coloured', 'indian', 'white'] as const) {
      const pay = (gender: 'male' | 'female'): GroupPay => {
        const headcount = row[race][gender]
        const avg = Math.round(
          base * RACE_PAY_SKEW[race] * (gender === 'female' ? FEMALE_PAY_SKEW : 1),
        )
        return {
          headcount,
          avgMonthlyCtc: headcount === 0 ? 0 : avg,
          medianMonthlyCtc: headcount === 0 ? 0 : Math.round(avg * 0.96),
        }
      }
      groups[race] = { male: pay('male'), female: pay('female') }
    }
    return { level: row.level, groups }
  })
}

function level(
  lvl: OccupationalLevel,
  african: GenderSplit,
  coloured: GenderSplit,
  indian: GenderSplit,
  white: GenderSplit,
  foreignNational: GenderSplit,
  disabled: number,
): LevelHeadcount {
  return { level: lvl, african, coloured, indian, white, foreignNational, disabled }
}

const WORKFORCE: LevelHeadcount[] = [
  level(
    1,
    { male: 1, female: 0 },
    { male: 0, female: 0 },
    { male: 1, female: 0 },
    { male: 2, female: 0 },
    { male: 0, female: 0 },
    0,
  ),
  level(
    2,
    { male: 2, female: 1 },
    { male: 1, female: 0 },
    { male: 1, female: 0 },
    { male: 2, female: 1 },
    { male: 0, female: 0 },
    0,
  ),
  level(
    3,
    { male: 4, female: 3 },
    { male: 1, female: 1 },
    { male: 1, female: 1 },
    { male: 2, female: 1 },
    { male: 0, female: 0 },
    1,
  ),
  level(
    4,
    { male: 9, female: 8 },
    { male: 2, female: 2 },
    { male: 1, female: 1 },
    { male: 2, female: 1 },
    { male: 0, female: 0 },
    1,
  ),
  level(
    5,
    { male: 15, female: 14 },
    { male: 3, female: 3 },
    { male: 1, female: 0 },
    { male: 1, female: 1 },
    { male: 1, female: 0 },
    1,
  ),
  level(
    6,
    { male: 9, female: 9 },
    { male: 1, female: 2 },
    { male: 0, female: 0 },
    { male: 0, female: 0 },
    { male: 1, female: 0 },
    0,
  ),
  level(
    7,
    { male: 4, female: 3 },
    { male: 0, female: 1 },
    { male: 0, female: 0 },
    { male: 0, female: 0 },
    { male: 0, female: 0 },
    0,
  ),
]

/**
 * Thandela Retail Group — fixture designated employer used for static
 * frontend development. 121 employees, Wholesale & Retail sector, Gauteng,
 * mid-way through its first EEP cycle. Deliberately under target at senior
 * levels so dashboards render meaningful gaps.
 */
export const DEMO_COMPANY: DemoCompany = {
  name: 'Thandela Retail Group (Pty) Ltd',
  registrationNumber: '2014/187234/07',
  sectorCode: 'retail_wholesale',
  sectorName: 'Wholesale and Retail Trade',
  province: 'Gauteng',
  annualTurnoverZar: 86_400_000,
  priorOffenceCount: 0,
  designatedSince: '2019-03-01',
  eepCycleStart: '2025-01-01',
  eepCycleEnd: '2029-12-31',
  reportingYear: 2026,
  workforce: WORKFORCE,
  remuneration: buildRemuneration(WORKFORCE),
  giniSeries: [
    { year: 2022, gini: 0.47 },
    { year: 2023, gini: 0.49 },
    { year: 2024, gini: 0.52 },
    { year: 2025, gini: 0.55 },
    { year: 2026, gini: 0.58 },
  ],
  actions: [
    {
      id: 'act-eecf-q2',
      title: 'Q2 EECF meeting not yet held',
      detail:
        'Quarterly consultative forum meeting required; last signed minutes dated 12 March 2026.',
      dueDate: '2026-06-30',
      severity: 'critical',
      ruleRef: 'rule_eea_015',
    },
    {
      id: 'act-barriers',
      title: 'Annual barriers analysis update',
      detail: 'Policies, environment, culture and structure review due before 31 October.',
      dueDate: '2026-10-31',
      severity: 'warning',
      ruleRef: 'rule_eea_007',
    },
    {
      id: 'act-top-mgmt-gap',
      title: 'Top management below sector target',
      detail:
        'African representation at Level 1 is 25% against a 58% sector target. Document recruitment steps.',
      dueDate: '2026-09-30',
      severity: 'warning',
      ruleRef: 'rule_eea_009',
    },
    {
      id: 'act-accommodation',
      title: 'Accessibility assessment cycle',
      detail:
        'Three-year workplace accessibility assessment due following the Midrand DC expansion.',
      dueDate: '2026-08-15',
      severity: 'info',
      ruleRef: 'rule_eea_013',
    },
  ],
  deadlines: [
    {
      date: '2026-01-12',
      label: 'EEA2 annual report submitted to DEL',
      status: 'done',
      ruleRef: 'rule_eea_016',
    },
    {
      date: '2026-03-12',
      label: 'Q1 EECF meeting (minutes signed)',
      status: 'done',
      ruleRef: 'rule_eea_015',
    },
    { date: '2026-06-30', label: 'Q2 EECF meeting', status: 'upcoming', ruleRef: 'rule_eea_015' },
    {
      date: '2026-06-30',
      label: 'WSP submission (SETA)',
      status: 'upcoming',
      ruleRef: 'rule_eea_012',
    },
    {
      date: '2026-09-01',
      label: 'EAP data & OFO table refresh',
      status: 'upcoming',
      ruleRef: 'rule_eea_020',
    },
    {
      date: '2026-10-01',
      label: 'Workforce profile snapshot (EEA1)',
      status: 'upcoming',
      ruleRef: 'rule_eea_005',
    },
    {
      date: '2026-10-31',
      label: 'Barriers analysis & EEP annual review',
      status: 'upcoming',
      ruleRef: 'rule_eea_007',
    },
    {
      date: '2026-10-31',
      label: 'Annual training outcomes report',
      status: 'upcoming',
      ruleRef: 'rule_eea_012',
    },
    {
      date: '2026-11-30',
      label: 'Employee consultation complete',
      status: 'upcoming',
      ruleRef: 'rule_eea_014',
    },
    {
      date: '2026-12-31',
      label: 'EEA4 reconciled & Gini calculated',
      status: 'upcoming',
      ruleRef: 'rule_eea_018',
    },
    {
      date: '2027-01-01',
      label: 'EEA2 submission window opens',
      status: 'upcoming',
      ruleRef: 'rule_eea_016',
    },
    {
      date: '2027-01-12',
      label: 'CEO escalation if EEA2 not submitted',
      status: 'upcoming',
      ruleRef: 'rule_eea_017',
    },
    {
      date: '2027-01-15',
      label: 'EEA2 submission deadline (DEL)',
      status: 'upcoming',
      ruleRef: 'rule_eea_017',
    },
  ],
}
