import { Link } from '@tanstack/react-router'
import { clsx } from 'clsx'
import { DEMO_COMPANY, type ComplianceDeadline } from '../fixtures/demo-company'

type ResolvedStatus = 'done' | 'overdue' | 'next' | 'upcoming'

const STATUS_CHIP: Record<ResolvedStatus, { label: string; className: string }> = {
  done: { label: 'Done', className: 'bg-emerald-100 text-emerald-800' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
  next: { label: 'Next up', className: 'bg-slate-900 text-white' },
  upcoming: { label: 'Upcoming', className: 'bg-slate-100 text-slate-600' },
}

const STATUS_DOT: Record<ResolvedStatus, string> = {
  done: 'border-emerald-500 bg-emerald-500',
  overdue: 'border-red-500 bg-red-500',
  next: 'border-slate-900 bg-slate-900',
  upcoming: 'border-slate-300 bg-white',
}

function resolveStatus(deadline: ComplianceDeadline, now: Date): Exclude<ResolvedStatus, 'next'> {
  if (deadline.status === 'done') return 'done'
  return new Date(deadline.date) < now ? 'overdue' : 'upcoming'
}

export interface ComplianceCalendarProps {
  now?: Date
}

export function ComplianceCalendar({ now = new Date() }: ComplianceCalendarProps) {
  const company = DEMO_COMPANY

  const sorted = [...company.deadlines].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
  const firstUpcomingIndex = sorted.findIndex((d) => resolveStatus(d, now) === 'upcoming')

  const entries = sorted.map((deadline, i) => {
    const base = resolveStatus(deadline, now)
    const status: ResolvedStatus = base === 'upcoming' && i === firstUpcomingIndex ? 'next' : base
    return { deadline, status }
  })

  const doneCount = entries.filter((e) => e.status === 'done').length
  const overdueCount = entries.filter((e) => e.status === 'overdue').length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Compliance calendar · {company.reportingYear} cycle
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Annual EEA obligations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {company.name} · {doneCount} complete
            {overdueCount > 0 && (
              <span className="font-semibold text-red-600"> · {overdueCount} overdue</span>
            )}
          </p>
        </div>
        <Link
          to="/dashboard"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Dashboard
        </Link>
      </header>

      <ol className="relative space-y-0 border-l-2 border-slate-200 pl-0">
        {entries.map(({ deadline, status }, i) => (
          <li key={`${deadline.date}-${deadline.label}`} className="relative pb-6 pl-8 last:pb-0">
            <span
              className={clsx(
                'absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2',
                STATUS_DOT[status],
              )}
            />
            <div
              className={clsx(
                'rounded-lg border p-3 shadow-sm',
                status === 'next' ? 'border-slate-900 bg-white' : 'border-slate-200 bg-white',
                status === 'done' && 'opacity-70',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <time className="text-xs font-semibold uppercase tracking-wide tabular-nums text-slate-500">
                  {new Date(deadline.date).toLocaleDateString('en-ZA', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </time>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    STATUS_CHIP[status].className,
                  )}
                >
                  {STATUS_CHIP[status].label}
                </span>
              </div>
              <p
                className={clsx(
                  'mt-1 text-sm font-medium text-slate-900',
                  status === 'done' && 'line-through decoration-slate-400',
                )}
              >
                {deadline.label}
              </p>
              {deadline.ruleRef && (
                <p className="mt-0.5 text-xs text-slate-400">{deadline.ruleRef}</p>
              )}
            </div>
            {i === entries.length - 1 && null}
          </li>
        ))}
      </ol>
    </div>
  )
}
