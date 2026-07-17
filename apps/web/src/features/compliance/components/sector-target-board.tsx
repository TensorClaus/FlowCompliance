import { GN6124_VERSION, OCCUPATIONAL_LEVEL_LABELS } from '@simplifi/shared'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { DEMO_COMPANY } from '../fixtures/demo-company'
import {
  computeSectorCompliance,
  type GapStatus,
  type GroupGap,
  type GroupKey,
} from '../lib/representation'

const GROUP_LABELS: Record<GroupKey, string> = {
  designatedMale: 'Designated male',
  designatedFemale: 'Designated female',
  disabled: 'Disability',
}

const GROUP_ORDER: GroupKey[] = ['designatedMale', 'designatedFemale', 'disabled']

const BAR_FILL: Record<GapStatus, string> = {
  met: 'bg-emerald-500',
  close: 'bg-amber-500',
  gap: 'bg-red-500',
}

const STATUS_BADGE: Record<GapStatus, { label: string; className: string }> = {
  met: { label: 'On target', className: 'bg-emerald-100 text-emerald-800' },
  close: { label: 'Within 5pp', className: 'bg-amber-100 text-amber-800' },
  gap: { label: 'Under target', className: 'bg-red-100 text-red-800' },
}

function GroupBar({ gap }: { gap: GroupGap }) {
  const scaleMax = Math.max(gap.actualPct, gap.targetPct, 1) * 1.15
  const actualWidth = (gap.actualPct / scaleMax) * 100
  const targetOffset = (gap.targetPct / scaleMax) * 100

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-700">{GROUP_LABELS[gap.group]}</span>
        <span className="tabular-nums text-slate-500">
          {gap.actualPct}% <span className="text-slate-400">/ {gap.targetPct}% target</span>{' '}
          <span
            className={clsx(
              'font-semibold',
              gap.deltaPct >= 0 ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            ({gap.deltaPct >= 0 ? '+' : ''}
            {gap.deltaPct}
            pp)
          </span>
        </span>
      </div>
      <div className="relative mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={clsx('h-full rounded-full transition-all', BAR_FILL[gap.status])}
          style={{ width: `${String(actualWidth)}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-slate-900"
          style={{ left: `${String(targetOffset)}%` }}
          title={`GN 6124 target: ${String(gap.targetPct)}%`}
        />
      </div>
    </div>
  )
}

export interface SectorTargetBoardProps {
  now?: Date
}

export function SectorTargetBoard({ now = new Date() }: SectorTargetBoardProps) {
  const company = DEMO_COMPANY
  const { levels } = computeSectorCompliance(company)
  // GN 6124 sets numerical targets only for the top four occupational levels;
  // levels 5-7 carry no gazetted target and are excluded from this board.
  const gazettedLevels = levels.filter((l) => l.groups.length > 0)

  const cycleEnd = new Date(company.eepCycleEnd)
  const monthsRemaining = Math.max(
    0,
    (cycleEnd.getFullYear() - now.getFullYear()) * 12 + (cycleEnd.getMonth() - now.getMonth()),
  )
  const levelsOnTrack = gazettedLevels.filter((l) => l.status === 'met').length

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Sector numerical targets · {GN6124_VERSION}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {company.sectorName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {company.name} · workforce profile vs GN 6124 Schedule 1 targets
          </p>
        </div>
        <Link
          to="/dashboard"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-900 px-4 py-3 text-white">
        <p className="text-sm">
          <strong className="tabular-nums">{monthsRemaining} months</strong> remaining to achieve
          mandatory targets · deadline{' '}
          {cycleEnd.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <p className="text-sm tabular-nums text-slate-300">
          {levelsOnTrack}/{gazettedLevels.length} levels on target
        </p>
      </div>

      <div className="space-y-4">
        {gazettedLevels.map((lvl) => {
          const badge = STATUS_BADGE[lvl.status]
          return (
            <section
              key={lvl.level}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Level {lvl.level} — {OCCUPATIONAL_LEVEL_LABELS[lvl.level]}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-slate-500">
                    {lvl.citizenHeadcount} SA citizens
                    {lvl.foreignNationalHeadcount > 0 &&
                      ` · ${String(lvl.foreignNationalHeadcount)} foreign national${lvl.foreignNationalHeadcount === 1 ? '' : 's'}`}
                  </span>
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {GROUP_ORDER.map((key) => {
                  const gap = lvl.groups.find((g) => g.group === key)
                  return gap ? <GroupBar key={key} gap={gap} /> : null
                })}
              </div>
            </section>
          )
        })}
      </div>

      <footer className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Percentages are calculated over SA citizens only; foreign nationals are excluded from
        designated-group counts and reported in a separate EEA1 column (rule_eea_006). The black
        marker on each bar shows the GN 6124 sector target. Targets below current placeholder values
        pending gazette ingestion.
      </footer>
    </div>
  )
}
