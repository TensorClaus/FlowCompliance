import { OCCUPATIONAL_LEVEL_LABELS } from '@simplifi/shared'
import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { DEMO_COMPANY } from '../fixtures/demo-company'
import {
  computeComplianceScore,
  computePenaltyExposure,
  computeSectorCompliance,
  formatZar,
  getEea2SubmissionWindow,
  type GapStatus,
} from '../lib/representation'

const STATUS_DOT: Record<GapStatus, string> = {
  met: 'bg-emerald-500',
  close: 'bg-amber-500',
  gap: 'bg-red-500',
}

const SEVERITY_STYLES = {
  critical: 'border-l-red-500 bg-red-50',
  warning: 'border-l-amber-500 bg-amber-50',
  info: 'border-l-sky-500 bg-sky-50',
} as const

const SEVERITY_LABELS = {
  critical: 'text-red-700 bg-red-100',
  warning: 'text-amber-700 bg-amber-100',
  info: 'text-sky-700 bg-sky-100',
} as const

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export interface ComplianceDashboardProps {
  now?: Date
}

export function ComplianceDashboard({ now = new Date() }: ComplianceDashboardProps) {
  const company = DEMO_COMPANY
  const score = computeComplianceScore(company)
  const exposure = computePenaltyExposure(company.annualTurnoverZar, company.priorOffenceCount)
  const window = getEea2SubmissionWindow(now)
  const { levels } = computeSectorCompliance(company)

  const totalCitizens = levels.reduce((s, l) => s + l.citizenHeadcount, 0)
  const totalForeign = levels.reduce((s, l) => s + l.foreignNationalHeadcount, 0)
  const levelsAtRisk = levels.filter((l) => l.status === 'gap').length

  const upcomingDeadlines = company.deadlines.filter((d) => new Date(d.date) >= now).slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Compliance overview · {company.reportingYear}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{company.name}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {company.sectorName} · {company.province} · Designated employer since{' '}
            {formatDate(company.designatedSince)}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            to="/targets"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Sector targets
          </Link>
          <Link
            to="/workforce/matrix"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Workforce
          </Link>
          <Link
            to="/calendar"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Calendar
          </Link>
          <Link
            to="/reports/eea4"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            EEA4
          </Link>
          <Link
            to="/"
            className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white shadow-sm hover:bg-slate-800"
          >
            EEA2 wizard
          </Link>
        </nav>
      </header>

      <div
        role="status"
        className={clsx(
          'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3',
          window.isOpen
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
            : 'border-slate-300 bg-white text-slate-800',
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              'inline-flex h-2.5 w-2.5 rounded-full',
              window.isOpen ? 'animate-pulse bg-emerald-500' : 'bg-slate-400',
            )}
          />
          <p className="text-sm font-medium">
            {window.isOpen ? (
              <>
                EEA2 submission window is <strong>open</strong> — closes in {window.daysUntilClose}{' '}
                day{window.daysUntilClose === 1 ? '' : 's'}
              </>
            ) : (
              <>
                EEA2 submission window opens in <strong>{window.daysUntilOpen} days</strong> (
                {window.opensOn.toLocaleDateString('en-ZA', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                –15 January)
              </>
            )}
          </p>
        </div>
        <p className="text-xs text-slate-500">DEL online portal · rule_eea_016</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Compliance score
          </h2>
          <p
            className={clsx(
              'mt-2 text-4xl font-bold tabular-nums',
              score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600',
            )}
          >
            {score}
            <span className="text-base font-medium text-slate-400">/100</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Representation vs GN 6124 targets and open obligations
          </p>
        </section>

        <section className="rounded-lg bg-slate-900 p-4 text-white shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Penalty exposure
          </h2>
          <p className="mt-2 text-3xl font-bold tabular-nums text-red-400">{formatZar(exposure)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Next offence ({company.priorOffenceCount + 1}st) · greater of R1.5m or 2% of turnover ·
            s65
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Workforce
          </h2>
          <p className="mt-2 text-4xl font-bold tabular-nums text-slate-900">
            {totalCitizens + totalForeign}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {totalCitizens} SA citizens · {totalForeign} foreign national
            {totalForeign === 1 ? '' : 's'} (reported separately)
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Levels at risk
          </h2>
          <p
            className={clsx(
              'mt-2 text-4xl font-bold tabular-nums',
              levelsAtRisk === 0 ? 'text-emerald-600' : 'text-red-600',
            )}
          >
            {levelsAtRisk}
            <span className="text-base font-medium text-slate-400">/{levels.length}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Occupational levels &gt;5pp under sector target
          </p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="text-sm font-semibold text-slate-900">Outstanding actions</h2>
          <ul className="mt-3 space-y-3">
            {company.actions.map((action) => (
              <li
                key={action.id}
                className={clsx(
                  'rounded-md border border-slate-200 border-l-4 p-3 shadow-sm',
                  SEVERITY_STYLES[action.severity],
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{action.detail}</p>
                  </div>
                  <span
                    className={clsx(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      SEVERITY_LABELS[action.severity],
                    )}
                  >
                    {action.severity}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Due {formatDate(action.dueDate)} · {action.ruleRef}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Representation by level</h2>
            <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white shadow-sm">
              {levels.map((lvl) => (
                <li key={lvl.level} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm text-slate-700">
                    {OCCUPATIONAL_LEVEL_LABELS[lvl.level]}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    {lvl.citizenHeadcount + lvl.foreignNationalHeadcount} staff
                    <span className={clsx('h-2 w-2 rounded-full', STATUS_DOT[lvl.status])} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-900">Next deadlines</h2>
            <ol className="mt-3 space-y-0 rounded-lg border border-slate-200 bg-white shadow-sm">
              {upcomingDeadlines.map((deadline, i) => (
                <li
                  key={deadline.date}
                  className={clsx(
                    'flex items-baseline gap-3 px-3 py-2.5',
                    i > 0 && 'border-t border-slate-100',
                  )}
                >
                  <time className="w-20 shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                    {formatDate(deadline.date)}
                  </time>
                  <span className="text-sm text-slate-700">{deadline.label}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}
