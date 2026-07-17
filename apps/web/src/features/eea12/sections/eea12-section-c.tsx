import {
  OCCUPATIONAL_LEVEL_LABELS,
  type EapProvince,
  type SectorCode,
  type WorkforceProfile,
  type WorkforceProfileRow,
} from '@simplifi/shared'
import React, { useEffect, useMemo, useRef } from 'react'
import type { GapStatus } from '../../compliance/lib/gap-status'
import { ProvisionalEapBadge as SharedProvisionalEapBadge } from '../../eea/components/ProvisionalEapBadge'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import { buildEapComparison, type EapComparisonRowContext } from '../eap-comparison'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEP_ID = 'eea12-section-c-stub'
const SECTION_B_STEP_ID = 'eea12-section-b'

const STATUS_CHIP_STYLE: Record<GapStatus, string> = {
  met: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  close: 'border-amber-300 bg-amber-50 text-amber-800',
  gap: 'border-red-300 bg-red-50 text-red-800',
}

const STATUS_CHIP_LABEL: Record<GapStatus, string> = {
  met: 'Met',
  close: 'Close',
  gap: 'Gap',
}

// ---------------------------------------------------------------------------
// Provisional badge — single, non-dismissible marker
// ---------------------------------------------------------------------------

/**
 * The one provisional-data marker used on every EAP-derived cell. It renders
 * no dismiss affordance: there is deliberately no close button and no state
 * that can hide it, so the provisional nature of the figure is always visible
 * for as long as the placeholder dataset is in use.
 */
export function ProvisionalEapBadge(): React.ReactElement {
  return <SharedProvisionalEapBadge testId="eea12-provisional-badge" />
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Section C accepts the employer province and GN 6124 sector code as explicit
 * props sourced by the route/form shell. EmployerProfile carries an optional
 * province but no SectorCode (its industrySector is free text), so these are
 * threaded in explicitly rather than derived here. Province is optional and
 * falls back to 'National' inside buildEapComparison.
 */
export interface EEA12SectionCProps extends StepProps {
  readonly province?: EapProvince
  readonly sectorCode?: SectorCode
}

// ---------------------------------------------------------------------------
// Cell formatting
// ---------------------------------------------------------------------------

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatGap(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EEA12 Section C — Economically Active Population comparison.
 *
 * For each occupational level it shows the actual designated-group share of
 * citizen headcount against two baselines: the StatsSA EAP designated share
 * (which drives the gap and status) and the GN 6124 sector target (display
 * only). Every EAP-derived figure carries a non-dismissible provisional
 * badge. On mount it persists the comparison rows plus both dataset versions
 * into the form payload so a saved submission records exactly which datasets
 * produced its numbers.
 *
 * Nothing here blocks: EAP-derived shortfalls surface as chips/badges only.
 */
export function EEA12SectionC({
  onAdvance,
  province,
  sectorCode,
}: EEA12SectionCProps): React.ReactElement {
  const { formState, setStepData } = useWizardFormController()

  const workforce = formState[SECTION_B_STEP_ID] as WorkforceProfile | undefined
  const rows: WorkforceProfileRow[] = useMemo(() => workforce?.rows ?? [], [workforce])

  const comparison = useMemo(
    () => buildEapComparison(rows, province, sectorCode === undefined ? {} : { sectorCode }),
    [rows, province, sectorCode],
  )

  const contextByLevel = useMemo(() => {
    const map = new Map<number, EapComparisonRowContext>()
    for (const c of comparison.context) map.set(c.occupationalLevel, c)
    return map
  }, [comparison])

  // Persist the comparison + dataset versions so the saved payload is
  // auditable against the exact datasets used. Re-persist whenever the derived
  // rows or versions change; guard against redundant writes via a signature.
  const lastPersistedRef = useRef('')
  useEffect(() => {
    const payload = {
      rows: comparison.rows,
      eapDatasetVersion: comparison.eapDatasetVersion,
      sectorTargetVersion: comparison.sectorTargetVersion,
      province: comparison.province,
    }
    const signature = JSON.stringify(payload)
    if (signature === lastPersistedRef.current) return
    lastPersistedRef.current = signature
    setStepData(STEP_ID, payload)
  }, [comparison, setStepData])

  return (
    <section aria-label="Section C — EAP comparison" data-testid="eea12-section-c">
      <h2 className="mb-1 text-base font-semibold text-slate-800">
        Section C — Economically Active Population Comparison
      </h2>
      <p className="mb-3 text-sm text-slate-600">
        Designated-group representation per occupational level compared against the StatsSA QLFS
        Economically Active Population and the GN 6124 sector target. Actual figures are the
        designated-group (African, Coloured, Indian/Asian) share of South African citizen headcount;
        foreign nationals are excluded upstream per rule_eea_006.
      </p>

      {/* Provisional data disclosure banner — non-dismissible */}
      <div
        className="mb-4 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        data-testid="eea12-provisional-banner"
        role="note"
      >
        <ProvisionalEapBadge />
        <span>
          EAP percentages, gaps and statuses below are derived from placeholder StatsSA QLFS data
          pending ingestion of the licensed dataset ({comparison.eapDatasetVersion}). Treat them as
          provisional; do not rely on them externally.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-left text-sm"
          data-testid="eea12-section-c-table"
        >
          <thead>
            <tr className="border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-semibold" scope="col">
                Occupational level
              </th>
              <th className="px-3 py-2 text-right font-semibold" scope="col">
                Actual %
              </th>
              <th className="px-3 py-2 text-right font-semibold" scope="col">
                EAP % <ProvisionalEapBadge />
              </th>
              <th className="px-3 py-2 text-right font-semibold" scope="col">
                Gap <ProvisionalEapBadge />
              </th>
              <th className="px-3 py-2 font-semibold" scope="col">
                Status <ProvisionalEapBadge />
              </th>
              <th className="px-3 py-2 text-right font-semibold" scope="col">
                GN 6124 sector target
                <span
                  className="ml-1 inline-flex items-center rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                  data-testid="eea12-sector-version-badge"
                  title={`GN 6124 sector target dataset ${comparison.sectorTargetVersion}`}
                >
                  {comparison.sectorTargetVersion}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => {
              const ctx = contextByLevel.get(row.occupationalLevel)
              const status: GapStatus = ctx?.status ?? 'met'
              const sectorTarget = ctx?.sectorTarget
              return (
                <tr
                  className="border-b border-slate-100"
                  data-testid={`eea12-eap-row-${String(row.occupationalLevel)}`}
                  key={row.occupationalLevel}
                >
                  <td className="px-3 py-2 text-slate-700">
                    {OCCUPATIONAL_LEVEL_LABELS[row.occupationalLevel]}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums text-slate-800"
                    data-testid={`eea12-eap-actual-${String(row.occupationalLevel)}`}
                  >
                    {formatPct(row.actualPct)}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums text-slate-800"
                    data-testid={`eea12-eap-eap-${String(row.occupationalLevel)}`}
                  >
                    <span className="align-middle">{formatPct(row.eapPct)}</span>
                    <ProvisionalEapBadge />
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums text-slate-800"
                    data-testid={`eea12-eap-gap-${String(row.occupationalLevel)}`}
                  >
                    <span className="align-middle">{formatGap(row.gapPct)}</span>
                    <ProvisionalEapBadge />
                  </td>
                  <td
                    className="px-3 py-2"
                    data-testid={`eea12-eap-status-${String(row.occupationalLevel)}`}
                  >
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_CHIP_STYLE[status]}`}
                    >
                      {STATUS_CHIP_LABEL[status]}
                    </span>
                    <ProvisionalEapBadge />
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums text-slate-800"
                    data-testid={`eea12-eap-sector-${String(row.occupationalLevel)}`}
                  >
                    {sectorTarget === undefined ? (
                      '—'
                    ) : (
                      <span>
                        <span
                          data-testid={`eea12-eap-sector-male-${String(row.occupationalLevel)}`}
                        >
                          M {formatPct(sectorTarget.designatedGroupMale)}
                        </span>
                        <span className="mx-1 text-slate-400">·</span>
                        <span
                          data-testid={`eea12-eap-sector-female-${String(row.occupationalLevel)}`}
                        >
                          F {formatPct(sectorTarget.designatedGroupFemale)}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Navigation footer */}
      <div className="mt-6 flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          data-testid="eea12-section-c-next"
          onClick={onAdvance}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  )
}
