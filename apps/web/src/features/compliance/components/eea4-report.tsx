import { OCCUPATIONAL_LEVEL_LABELS } from '@simplifi/shared'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { DEMO_COMPANY, type PayRace } from '../fixtures/demo-company'
import {
  GINI_ESCALATION_THRESHOLD,
  computeEea4Breakdown,
  computeIncomeDifferentialRatio,
} from '../lib/eea4'
import { formatZar } from '../lib/representation'

const RACE_LABELS: Record<PayRace, string> = {
  african: 'African',
  coloured: 'Coloured',
  indian: 'Indian/Asian',
  white: 'White',
}

function GiniSparkline({ series }: { series: { year: number; gini: number }[] }) {
  const width = 160
  const height = 40
  const min = Math.min(...series.map((p) => p.gini))
  const max = Math.max(...series.map((p) => p.gini))
  const range = max - min || 1
  const points = series
    .map((p, i) => {
      const x = (i / (series.length - 1)) * (width - 8) + 4
      const y = height - 6 - ((p.gini - min) / range) * (height - 12)
      return `${String(x)},${String(y)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} role="img" aria-label="Gini coefficient trend">
      <polyline points={points} fill="none" stroke="#dc2626" strokeWidth="2" />
      {series.map((p, i) => {
        const x = (i / (series.length - 1)) * (width - 8) + 4
        const y = height - 6 - ((p.gini - min) / range) * (height - 12)
        return <circle key={p.year} cx={x} cy={y} r="2.5" fill="#dc2626" />
      })}
    </svg>
  )
}

function gapTextClass(row: { gapVsBenchmarkPct: number | null; flagged: boolean }): string {
  if (row.gapVsBenchmarkPct === null) return 'text-slate-400'
  if (row.flagged) return 'text-red-700'
  if (row.gapVsBenchmarkPct < 0) return 'text-amber-700'
  return 'text-emerald-700'
}

export function Eea4Report() {
  const company = DEMO_COMPANY
  const breakdown = computeEea4Breakdown(company)
  const ratio = computeIncomeDifferentialRatio(company)
  const latestGini = company.giniSeries.at(-1)
  const totalFlags = breakdown.reduce((s, l) => s + l.flaggedCount, 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            EEA4 · Income differential statement · {company.reportingYear}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Remuneration by occupational level
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {company.name} · monthly CTC · benchmark = White Male average at same level
          </p>
        </div>
        <Link
          to="/dashboard"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Vertical differential
          </h2>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {ratio === null ? '—' : `${String(ratio)}×`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Top management avg CTC vs lowest permanent level · rule_eea_018
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Gini coefficient
              </h2>
              <p
                className={clsx(
                  'mt-2 text-3xl font-bold tabular-nums',
                  latestGini && latestGini.gini > GINI_ESCALATION_THRESHOLD
                    ? 'text-red-600'
                    : 'text-slate-900',
                )}
              >
                {latestGini ? latestGini.gini.toFixed(2) : '—'}
              </p>
            </div>
            <GiniSparkline series={company.giniSeries} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            5-year trend · EECF escalation at &gt;{GINI_ESCALATION_THRESHOLD.toFixed(2)} ·
            rule_eea_019
          </p>
        </section>

        <section
          className={clsx(
            'rounded-lg border p-4 shadow-sm',
            totalFlags > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white',
          )}
        >
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Pay gap flags
          </h2>
          <p
            className={clsx(
              'mt-2 text-3xl font-bold tabular-nums',
              totalFlags > 0 ? 'text-red-600' : 'text-emerald-600',
            )}
          >
            {totalFlags}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Designated groups &gt;15% below benchmark at same level
          </p>
        </section>
      </div>

      <div className="space-y-4">
        {breakdown.map((lvl) => {
          const populated = lvl.rows.filter((r) => r.headcount > 0)
          if (populated.length === 0) return null
          return (
            <section
              key={lvl.level}
              className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Level {lvl.level} — {OCCUPATIONAL_LEVEL_LABELS[lvl.level]}
                </h2>
                {lvl.flaggedCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                    {lvl.flaggedCount} flag{lvl.flaggedCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2 font-semibold">Group</th>
                    <th className="px-4 py-2 text-right font-semibold">Headcount</th>
                    <th className="px-4 py-2 text-right font-semibold">Avg CTC</th>
                    <th className="px-4 py-2 text-right font-semibold">Median CTC</th>
                    <th className="px-4 py-2 text-right font-semibold">vs benchmark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {populated.map((row) => (
                    <tr
                      key={`${row.race}-${row.gender}`}
                      className={clsx(row.flagged && 'bg-red-50')}
                    >
                      <td className="px-4 py-2 text-slate-800">
                        {RACE_LABELS[row.race]} {row.gender === 'male' ? 'Male' : 'Female'}
                        {row.gapVsBenchmarkPct === null &&
                          row.race === 'white' &&
                          row.gender === 'male' && (
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                              benchmark
                            </span>
                          )}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {row.headcount}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                        {formatZar(row.avgMonthlyCtc)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                        {formatZar(row.medianMonthlyCtc)}
                      </td>
                      <td
                        className={clsx(
                          'px-4 py-2 text-right font-medium tabular-nums',
                          gapTextClass(row),
                        )}
                      >
                        {row.gapVsBenchmarkPct === null
                          ? '—'
                          : `${row.gapVsBenchmarkPct > 0 ? '+' : ''}${String(row.gapVsBenchmarkPct)}%`}
                        {row.flagged && ' ⚑'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )
        })}
      </div>

      <footer className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        Fixture remuneration data for static frontend development. Production EEA4 reconciles to
        payroll before the 31 December deadline (rule_eea_018); flagged rows (⚑) require a narrative
        in the submission and EECF review (rule_eea_019). Salary values are aggregates — individual
        remuneration is never displayed.
      </footer>
    </div>
  )
}
