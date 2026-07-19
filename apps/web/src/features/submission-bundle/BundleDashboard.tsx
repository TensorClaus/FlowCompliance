import { clsx } from 'clsx'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BUNDLE_REASON_LABELS,
  BUNDLE_RULE_NAMES,
  deriveBundleBlockers,
  evaluateBundleGate,
  readLinkedEEA2Id,
  type BundleGateResult,
} from './bundle-gate'
import { ValidationReportPanel } from '@/features/eea4/declaration/ValidationReportPanel'

// ---------------------------------------------------------------------------
// BundleDashboard — the DoEL submission gate surface.
//
// The gate is re-checked on EVERY look: on mount, on window focus /
// visibilitychange, and on a manual Refresh. A form edited after signing
// (status regressed or data changed) flips `ready` to false on the next
// evaluation because each evaluation re-fetches the live wrappers.
//
// M3 scope ends at an audit-logged "bundle validated" state. The Prepare
// action appends ONE audit event and shows a confirmation. It does NOT
// dispatch to any external system.
// ---------------------------------------------------------------------------

const DEFAULT_APPEND_ENDPOINT = '/api/event-store/append'

/** A reporting period and the form ids that make up its bundle. */
export interface BundlePeriodRef {
  periodId: string
  label: string
  /** EEA2 form id, or null when no EEA2 exists for the period. */
  eea2FormId: string | null
  /** EEA4 form id, or null when no EEA4 exists for the period. */
  eea4FormId: string | null
  /** Informational only — EEA12 is NOT part of the DoEL bundle rule. */
  eea12Present: boolean
  /** Informational only — EEA13 is NOT part of the DoEL bundle rule. */
  eea13Present: boolean
}

export interface BundleDashboardProps {
  periods: BundlePeriodRef[]
  /** Injected clock — defaults to new Date(); overridable in tests. */
  clock?: () => Date
  /** Audit-event append endpoint. Defaults to the shared event-store route. */
  appendEndpoint?: string
  /** Period selected on first render; defaults to the first period. */
  initialPeriodId?: string
}

interface WrapperResponse {
  id?: string
  status?: string
  report?: unknown
}

interface EvaluationState {
  periodId: string
  result: BundleGateResult
  reportId: string
  eea2FormId: string | null
  eea4FormId: string | null
  eea2WrapperId: string | null
  eea4LinkedEEA2Id: string | null
}

interface ConfirmedState {
  reportId: string
  validatedAt: string
  eea2FormId: string | null
  eea4FormId: string | null
}

async function fetchWrapper(
  kind: 'eea2' | 'eea4',
  id: string,
): Promise<Record<string, unknown> | undefined> {
  const url =
    kind === 'eea2' ? `/api/eea2/${encodeURIComponent(id)}` : `/api/eea4/${encodeURIComponent(id)}`
  const response = await fetch(url)
  if (!response.ok) return undefined
  const body = (await response.json()) as WrapperResponse
  return { id: body.id ?? id, status: body.status, report: body.report ?? {} }
}

export function BundleDashboard({
  periods,
  clock = () => new Date(),
  appendEndpoint = DEFAULT_APPEND_ENDPOINT,
  initialPeriodId,
}: BundleDashboardProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState(
    initialPeriodId ?? periods[0]?.periodId ?? null,
  )
  const [evaluation, setEvaluation] = useState<EvaluationState | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState<ConfirmedState | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [prepareError, setPrepareError] = useState<string | null>(null)

  // Guards against out-of-order fetch resolutions: only the latest evaluation
  // may write state. Focus + mount + refresh can overlap.
  const requestIdRef = useRef(0)

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.periodId === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  )

  const evaluate = useCallback(async () => {
    if (selectedPeriod === null) {
      setEvaluation(null)
      return
    }
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setLoading(true)
    setConfirmed(null)
    setPrepareError(null)

    const eea2Form = selectedPeriod.eea2FormId
      ? await fetchWrapper('eea2', selectedPeriod.eea2FormId)
      : undefined
    const eea4Form = selectedPeriod.eea4FormId
      ? await fetchWrapper('eea4', selectedPeriod.eea4FormId)
      : undefined

    if (requestId !== requestIdRef.current) return

    const reportId = crypto.randomUUID()
    const result = evaluateBundleGate({ eea2Form, eea4Form, clock, reportId })
    const eea2WrapperId = typeof eea2Form?.['id'] === 'string' ? eea2Form['id'] : null

    setEvaluation({
      periodId: selectedPeriod.periodId,
      result,
      reportId,
      eea2FormId: selectedPeriod.eea2FormId,
      eea4FormId: selectedPeriod.eea4FormId,
      eea2WrapperId,
      eea4LinkedEEA2Id: readLinkedEEA2Id(eea4Form),
    })
    setLoading(false)
  }, [selectedPeriod, clock])

  // Trigger (a): mount + selected-period change.
  useEffect(() => {
    void evaluate()
  }, [evaluate])

  // Trigger (b): window focus / visibility change.
  useEffect(() => {
    const handler = (): void => {
      void evaluate()
    }
    window.addEventListener('focus', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('focus', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [evaluate])

  const handlePrepare = useCallback(async () => {
    if (evaluation === null || !evaluation.result.ready) return
    setPreparing(true)
    setPrepareError(null)

    const validatedAt = clock().toISOString()
    const auditPayload = {
      marker: 'bundle validated',
      eea2FormId: evaluation.eea2FormId,
      eea4FormId: evaluation.eea4FormId,
      reportId: evaluation.reportId,
      validatedAt,
    }

    try {
      const response = await fetch(appendEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eventType: 'SUBMISSION_BUNDLED',
          formId: evaluation.eea2FormId ?? evaluation.eea4FormId ?? 'unknown',
          newValue: JSON.stringify(auditPayload),
        }),
      })
      if (!response.ok) {
        throw new Error(`status ${response.status.toString()}`)
      }
      setConfirmed({
        reportId: evaluation.reportId,
        validatedAt,
        eea2FormId: evaluation.eea2FormId,
        eea4FormId: evaluation.eea4FormId,
      })
    } catch {
      setPrepareError('Could not record the bundle validation event. Try again.')
    } finally {
      setPreparing(false)
    }
  }, [evaluation, appendEndpoint, clock])

  if (selectedPeriod === null) {
    return (
      <div className="mx-auto max-w-5xl" data-testid="bundle-dashboard">
        <p className="rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No reporting periods are available to submit.
        </p>
      </div>
    )
  }

  const result = evaluation?.result ?? null
  const blockers = result === null ? [] : deriveBundleBlockers(result)
  const linkageMatches =
    evaluation !== null &&
    evaluation.eea4LinkedEEA2Id !== null &&
    evaluation.eea2WrapperId !== null &&
    evaluation.eea4LinkedEEA2Id === evaluation.eea2WrapperId

  return (
    <div className="mx-auto grid max-w-5xl gap-6" data-testid="bundle-dashboard">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            DoEL submission gate
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            EEA2 + EEA4 bundle
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Both forms signed and every cross-form rule passing — re-checked on every look.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {periods.length > 1 ? (
            <label className="grid gap-1 text-xs font-medium text-slate-600">
              <span>Reporting period</span>
              <select
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                data-testid="bundle-period-select"
                onChange={(event) => {
                  setSelectedPeriodId(event.target.value)
                }}
                value={selectedPeriod.periodId}
              >
                {periods.map((period) => (
                  <option key={period.periodId} value={period.periodId}>
                    {period.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className="self-end rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            data-testid="bundle-refresh-btn"
            onClick={() => {
              void evaluate()
            }}
            type="button"
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GatingCard
          testId="bundle-card-eea2"
          title="EEA2 annual report"
          status={result?.eea2Status}
          present={result?.eea2Present ?? false}
          statusTestId="bundle-eea2-status"
        >
          <p
            className="mt-1 truncate font-mono text-xs text-slate-500"
            title={evaluation?.eea2FormId ?? ''}
          >
            {evaluation?.eea2FormId ?? 'no EEA2 form'}
          </p>
        </GatingCard>

        <GatingCard
          testId="bundle-card-eea4"
          title="EEA4 income differential"
          status={result?.eea4Status}
          present={result?.eea4Present ?? false}
          statusTestId="bundle-eea4-status"
        >
          <p className="mt-1 text-xs" data-testid="bundle-eea4-linkage">
            {evaluation === null ? <span className="text-slate-400">…</span> : null}
            {evaluation !== null && linkageMatches ? (
              <span className="text-emerald-700">linked to EEA2</span>
            ) : null}
            {evaluation !== null && !linkageMatches ? (
              <span className="text-red-700">not linked</span>
            ) : null}
          </p>
        </GatingCard>

        <InfoCard testId="bundle-card-eea12" title="EEA12" present={selectedPeriod.eea12Present} />
        <InfoCard testId="bundle-card-eea13" title="EEA13" present={selectedPeriod.eea13Present} />
      </div>

      {result !== null && !result.ready ? (
        <div
          className="rounded border border-amber-300 bg-amber-50 px-4 py-3"
          data-testid="bundle-gate-reason"
          role="status"
        >
          <p className="text-sm font-semibold text-amber-900">
            {BUNDLE_REASON_LABELS[result.reason]}
          </p>
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <section className="grid gap-2" data-testid="bundle-blockers">
          <h2 className="text-sm font-semibold text-slate-900">Blocking issues</h2>
          <ul className="grid gap-2">
            {blockers.map((blocker) => (
              <li
                className="rounded border border-red-200 border-l-4 border-l-red-500 bg-red-50 px-3 py-2"
                data-blocker-kind={blocker.kind}
                data-testid={`bundle-blocker-${blocker.key}`}
                key={blocker.key}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">{blocker.label}</span>
                  <span className="rounded border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-semibold uppercase text-red-800">
                    {blocker.severity}
                  </span>
                </div>
                {blocker.kind === 'unsigned' ? (
                  <p className="mt-1 text-xs text-slate-600">status: {blocker.status}</p>
                ) : (
                  <ul className="mt-1 grid gap-0.5">
                    {blocker.cellPaths.map((path) => (
                      <li className="font-mono text-xs text-slate-600" key={path}>
                        {path}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Cross-form validation report</h2>
          {loading ? (
            <span className="text-xs text-slate-500" data-testid="bundle-loading">
              re-checking…
            </span>
          ) : null}
        </div>
        {result === null ? (
          <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Running cross-form checks…
          </p>
        ) : (
          <ValidationReportPanel report={result.report} ruleNames={BUNDLE_RULE_NAMES} />
        )}
      </section>

      {confirmed === null ? (
        <div className="grid gap-2">
          {prepareError === null ? null : (
            <p className="text-sm font-medium text-red-700" data-testid="bundle-prepare-error">
              {prepareError}
            </p>
          )}
          <button
            className={clsx(
              'justify-self-start rounded px-4 py-2 text-sm font-semibold text-white',
              'disabled:cursor-not-allowed disabled:bg-slate-300',
              'bg-slate-900 hover:bg-slate-800',
            )}
            data-testid="bundle-prepare-btn"
            disabled={result === null || !result.ready || preparing}
            onClick={() => {
              void handlePrepare()
            }}
            type="button"
          >
            {preparing ? 'Recording…' : 'Prepare submission'}
          </button>
        </div>
      ) : (
        <div
          className="rounded border border-emerald-300 bg-emerald-50 px-4 py-4"
          data-testid="bundle-confirmation"
          role="status"
        >
          <p className="text-sm font-semibold text-emerald-900">
            Bundle validated — ready for DoEL submission (dispatch not part of M3)
          </p>
          <p className="mt-1 font-mono text-xs text-emerald-800">
            report {confirmed.reportId} · {confirmed.validatedAt}
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

const STATUS_CHIP: Record<string, string> = {
  signed: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  pending_ceo: 'bg-amber-100 text-amber-800 border-amber-300',
  draft: 'bg-slate-100 text-slate-700 border-slate-300',
  submitted: 'bg-sky-100 text-sky-800 border-sky-300',
}

interface GatingCardProps {
  testId: string
  statusTestId: string
  title: string
  status: string | undefined
  present: boolean
  children: React.ReactNode
}

function GatingCard({ testId, statusTestId, title, status, present, children }: GatingCardProps) {
  const label = present ? (status ?? 'unknown') : 'missing'
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      data-testid={testId}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <span
        className={clsx(
          'mt-2 inline-flex rounded border px-2 py-0.5 text-xs font-semibold uppercase',
          STATUS_CHIP[label] ?? 'bg-red-100 text-red-800 border-red-300',
        )}
        data-testid={statusTestId}
      >
        {label}
      </span>
      {children}
    </section>
  )
}

interface InfoCardProps {
  testId: string
  title: string
  present: boolean
}

function InfoCard({ testId, title, present }: InfoCardProps) {
  return (
    <section
      className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"
      data-testid={testId}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <span
        className={clsx(
          'mt-2 inline-flex rounded border px-2 py-0.5 text-xs font-medium',
          present
            ? 'border-slate-300 bg-white text-slate-600'
            : 'border-slate-200 bg-slate-100 text-slate-400',
        )}
        data-testid={`${testId}-presence`}
      >
        {present ? 'present' : 'absent'}
      </span>
      <p className="mt-2 text-[0.65rem] italic text-slate-400">not part of the DoEL bundle rule</p>
    </section>
  )
}
