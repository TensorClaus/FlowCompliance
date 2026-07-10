import { OCCUPATIONAL_LEVEL_LABELS } from '@simplifi/shared'
import { Link } from '@tanstack/react-router'
import { DEMO_COMPANY, type GenderSplit, type LevelHeadcount } from '../fixtures/demo-company'

interface HeatmapColumn {
  key: string
  label: string
  foreignNational: boolean
  count: (row: LevelHeadcount) => number
}

const COLUMNS: HeatmapColumn[] = [
  { key: 'africanMale', label: 'African M', foreignNational: false, count: (r) => r.african.male },
  {
    key: 'africanFemale',
    label: 'African F',
    foreignNational: false,
    count: (r) => r.african.female,
  },
  {
    key: 'colouredMale',
    label: 'Coloured M',
    foreignNational: false,
    count: (r) => r.coloured.male,
  },
  {
    key: 'colouredFemale',
    label: 'Coloured F',
    foreignNational: false,
    count: (r) => r.coloured.female,
  },
  { key: 'indianMale', label: 'Indian M', foreignNational: false, count: (r) => r.indian.male },
  { key: 'indianFemale', label: 'Indian F', foreignNational: false, count: (r) => r.indian.female },
  { key: 'whiteMale', label: 'White M', foreignNational: false, count: (r) => r.white.male },
  { key: 'whiteFemale', label: 'White F', foreignNational: false, count: (r) => r.white.female },
  { key: 'fnMale', label: 'FN M', foreignNational: true, count: (r) => r.foreignNational.male },
  { key: 'fnFemale', label: 'FN F', foreignNational: true, count: (r) => r.foreignNational.female },
]

const sumSplit = (s: GenderSplit) => s.male + s.female

function rowTotal(row: LevelHeadcount): number {
  return (
    sumSplit(row.african) +
    sumSplit(row.coloured) +
    sumSplit(row.indian) +
    sumSplit(row.white) +
    sumSplit(row.foreignNational)
  )
}

function HeatCell({
  count,
  total,
  foreignNational,
}: {
  count: number
  total: number
  foreignNational: boolean
}) {
  const share = total === 0 ? 0 : count / total
  // Sequential indigo ramp for citizens; neutral slate for the FN columns so
  // the separately-reported group reads as visually distinct (rule_eea_006).
  const background = foreignNational
    ? `rgba(100, 116, 139, ${String(Math.min(0.85, share * 1.6))})`
    : `rgba(67, 56, 202, ${String(Math.min(0.9, share * 1.6))})`
  return (
    <td className="border border-slate-200 p-0">
      <div
        className="flex h-11 w-full items-center justify-center text-sm tabular-nums"
        style={{
          backgroundColor: count === 0 ? 'transparent' : background,
          color: share > 0.32 ? 'white' : '#1e293b',
        }}
        title={`${String(count)} of ${String(total)} at this level (${String(Math.round(share * 100))}%)`}
      >
        {count === 0 ? <span className="text-slate-300">·</span> : count}
      </div>
    </td>
  )
}

export function WorkforceHeatmap() {
  const company = DEMO_COMPANY
  const grandTotal = company.workforce.reduce((s, r) => s + rowTotal(r), 0)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Workforce profile · EEA1 aggregate · {company.reportingYear}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Occupational level heatmap
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {company.name} · {grandTotal} employees · cell shading shows share of level headcount
          </p>
        </div>
        <Link
          to="/dashboard"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Dashboard
        </Link>
      </header>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Occupational level
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold text-slate-600"
                >
                  {col.label}
                </th>
              ))}
              <th className="border border-slate-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {company.workforce.map((row) => {
              const total = rowTotal(row)
              return (
                <tr key={row.level}>
                  <th className="border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800">
                    {row.level}. {OCCUPATIONAL_LEVEL_LABELS[row.level]}
                  </th>
                  {COLUMNS.map((col) => (
                    <HeatCell
                      key={col.key}
                      count={col.count(row)}
                      total={total}
                      foreignNational={col.foreignNational}
                    />
                  ))}
                  <td className="border border-slate-200 px-2 text-center text-sm font-semibold tabular-nums text-slate-900">
                    {total}
                  </td>
                </tr>
              )
            })}
            <tr className="bg-slate-50">
              <th className="border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">
                Total
              </th>
              {COLUMNS.map((col) => (
                <td
                  key={col.key}
                  className="border border-slate-200 px-2 py-2 text-center text-sm font-semibold tabular-nums text-slate-900"
                >
                  {company.workforce.reduce((s, r) => s + col.count(r), 0)}
                </td>
              ))}
              <td className="border border-slate-200 px-2 py-2 text-center text-sm font-bold tabular-nums text-slate-900">
                {grandTotal}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'rgba(67, 56, 202, 0.7)' }}
          />
          SA citizens (designated-group reporting)
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: 'rgba(100, 116, 139, 0.7)' }}
          />
          Foreign nationals — separate EEA1 column, excluded from designated counts (rule_eea_006)
        </span>
      </div>
    </div>
  )
}
