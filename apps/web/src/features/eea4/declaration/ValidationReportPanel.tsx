import type { ValidationReport, ValidationResult, ValidationSeverity } from '@simplifi/shared'

// ---------------------------------------------------------------------------
// ValidationReportPanel — feature-local render of a cross-form ValidationReport
// ---------------------------------------------------------------------------

/**
 * Renders a ValidationReport produced by the cross-form validation engine.
 *
 * Rendering contract (HARD):
 *   - Actual sourceValue / targetValue remuneration or headcount figures are
 *     rendered ONLY inside a failing result's diff cell. They appear nowhere
 *     else in the panel (not in headers, summaries, or messages).
 *   - Results are grouped by ruleId; each group shows its rule name once.
 *   - A summary line reports 'N errors, M warnings'.
 *
 * The panel does NOT re-derive pass/fail or re-run any rule — it is a pure view
 * over the report the engine returned. Severity grouping is the only shaping
 * applied.
 */

const SEVERITY_ORDER: Record<ValidationSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

const SEVERITY_BADGE_CLASS: Record<ValidationSeverity, string> = {
  error: 'bg-red-100 text-red-800 border-red-300',
  warning: 'bg-amber-100 text-amber-800 border-amber-300',
  info: 'bg-slate-100 text-slate-700 border-slate-300',
}

interface RuleGroup {
  ruleId: string
  results: ValidationResult[]
}

function groupByRule(results: ValidationResult[]): RuleGroup[] {
  const order: string[] = []
  const byRule = new Map<string, ValidationResult[]>()
  for (const result of results) {
    const existing = byRule.get(result.ruleId)
    if (existing === undefined) {
      order.push(result.ruleId)
      byRule.set(result.ruleId, [result])
    } else {
      existing.push(result)
    }
  }
  return order.map((ruleId) => ({ ruleId, results: byRule.get(ruleId) ?? [] }))
}

function highestSeverity(results: ValidationResult[]): ValidationSeverity {
  let worst: ValidationSeverity = 'info'
  for (const result of results) {
    if (SEVERITY_ORDER[result.severity] < SEVERITY_ORDER[worst]) {
      worst = result.severity
    }
  }
  return worst
}

function renderValue(value: unknown): string {
  if (value === undefined) return '—'
  if (value === null) return 'null'
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean') return value.toString()
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export interface ValidationReportPanelProps {
  report: ValidationReport
  /** Human-readable rule names keyed by ruleId (from the rule registry). */
  ruleNames: Record<string, string>
}

export function ValidationReportPanel({ report, ruleNames }: ValidationReportPanelProps) {
  const failing = report.rules.filter((result) => !result.passed)
  const groups = groupByRule(failing)

  return (
    <div
      className="grid gap-4 rounded border border-slate-200 bg-white p-4"
      data-testid="eea4-validation-report-panel"
    >
      <p className="text-sm font-semibold text-slate-800" data-testid="eea4-validation-summary">
        {report.errorCount} {report.errorCount === 1 ? 'error' : 'errors'}, {report.warningCount}{' '}
        {report.warningCount === 1 ? 'warning' : 'warnings'}
      </p>

      {groups.length === 0 ? (
        <p className="text-sm text-emerald-700" data-testid="eea4-validation-clean">
          All cross-form checks passed.
        </p>
      ) : (
        <ul className="grid gap-4">
          {groups.map((group) => {
            const ruleName = ruleNames[group.ruleId] ?? group.ruleId
            const groupSeverity = highestSeverity(group.results)
            return (
              <li
                className="grid gap-2 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                data-rule-id={group.ruleId}
                data-testid={`eea4-validation-group-${group.ruleId}`}
                key={group.ruleId}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-800">{ruleName}</span>
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-semibold uppercase ${SEVERITY_BADGE_CLASS[groupSeverity]}`}
                    data-testid={`eea4-validation-badge-${group.ruleId}`}
                  >
                    {groupSeverity}
                  </span>
                </div>
                <ul className="grid gap-1">
                  {group.results.map((result, index) => (
                    <li
                      className="grid gap-1 rounded bg-slate-50 px-2 py-1.5 text-xs"
                      data-cell-path={result.sourcePath}
                      data-testid={`eea4-validation-result-${group.ruleId}-${index.toString()}`}
                      key={`${result.sourcePath}:${result.targetPath ?? 'none'}:${index.toString()}`}
                    >
                      <span className="font-mono text-slate-600">{result.sourcePath}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono"
                          data-testid="eea4-validation-diff-source"
                        >
                          source: {renderValue(result.sourceValue)}
                        </span>
                        <span aria-hidden className="text-slate-400">
                          vs
                        </span>
                        <span
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono"
                          data-testid="eea4-validation-diff-target"
                        >
                          target: {renderValue(result.targetValue)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
