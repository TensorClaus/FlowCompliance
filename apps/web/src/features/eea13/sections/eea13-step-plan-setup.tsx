import { SECTOR_CODES } from '@simplifi/shared'
import React, { useCallback, useEffect, useId } from 'react'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import type { EEA13PlanSetupData } from '../eea13-types'

const STEP_ID = 'eea13-plan-setup'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a SECTOR_CODES string to a human-readable label.
 * "electricity_gas_water" → "Electricity Gas Water"
 */
function sectorLabel(code: string): string {
  return code
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Add exactly 5 years to a date string, adjusting for leap years by clamping
 * Feb 29 to Feb 28 on non-leap target years.
 */
function addFiveYears(isoDate: string): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return ''
  const targetYear = d.getFullYear() + 5
  const targetDate = new Date(d)
  targetDate.setFullYear(targetYear)
  // If the date rolled over (e.g. Feb 29 on non-leap year), setFullYear
  // already advances the month — restore to last day of Feb.
  if (targetDate.getMonth() !== d.getMonth()) {
    targetDate.setDate(0)
  }
  return targetDate.toISOString().slice(0, 10)
}

/**
 * Calculate the difference in calendar days between two ISO date strings.
 * Returns NaN when either string is not a valid date.
 */
function daysBetween(start: string, end: string): number {
  const s = Date.parse(start)
  const e = Date.parse(end)
  if (Number.isNaN(s) || Number.isNaN(e)) return Number.NaN
  return (e - s) / (1000 * 60 * 60 * 24)
}

const PLAN_PERIOD_MIN_DAYS = 1795
const PLAN_PERIOD_MAX_DAYS = 1857
const PLAN_PERIOD_ERROR = 'Plan period must span 5 years (EEA s.20(2)(b))'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EEA13 Step 1 — Plan Setup.
 *
 * Collects:
 *  - sectorCode: Required gate — later steps are locked until a sector is chosen.
 *  - planPeriod.startDate / endDate: End auto-suggested as start + 5 years; live
 *    day-count indicator; period refine error blocks step advancement.
 *  - consultation: consultedWithEmployees checkbox gate (non-bypassable banner);
 *    eecfEstablished checkbox; consultationDate date input.
 *
 * Compliance guards:
 *  - Sector is required: no default, no null fallback.
 *  - Period must satisfy 1795–1857 days (EEA s.20(2)(b)).
 *  - consultedWithEmployees=false → persistent blocking banner with no dismiss
 *    control (mirrors top-level EEA13Schema refine).
 */
export function EEA13StepPlanSetup({ onAdvance }: StepProps): React.ReactElement {
  const { formState, setStepData } = useWizardFormController()

  const raw = formState[STEP_ID] as EEA13PlanSetupData | undefined
  const data: EEA13PlanSetupData = raw ?? {
    sectorCode: '',
    planPeriod: { startDate: '', endDate: '' },
    consultation: {
      consultedWithEmployees: false,
      eecfEstablished: false,
      consultationDate: '',
    },
  }

  const sectorSelectId = useId()
  const startDateId = useId()
  const endDateId = useId()
  const consultationDateId = useId()

  // When startDate changes, auto-suggest endDate as start + 5 years
  // (only when endDate is not yet set or was previously auto-suggested).
  useEffect(() => {
    if (data.planPeriod.startDate.length === 0) return
    const suggested = addFiveYears(data.planPeriod.startDate)
    if (suggested.length === 0) return
    // Only auto-fill if endDate is empty — don't overwrite manual edits.
    if (data.planPeriod.endDate.length === 0) {
      setStepData(STEP_ID, {
        ...data,
        planPeriod: { ...data.planPeriod, endDate: suggested },
      })
    }
    // Deliberately depends only on startDate: data/setStepData are captured at
    // call time and re-running on every data change would fight manual edits
    // to endDate.
  }, [data.planPeriod.startDate])

  const update = useCallback(
    (patch: Partial<EEA13PlanSetupData>) => {
      setStepData(STEP_ID, { ...data, ...patch })
    },
    [data, setStepData],
  )

  const updatePeriod = useCallback(
    (patch: Partial<EEA13PlanSetupData['planPeriod']>) => {
      update({ planPeriod: { ...data.planPeriod, ...patch } })
    },
    [data.planPeriod, update],
  )

  const updateConsultation = useCallback(
    (patch: Partial<EEA13PlanSetupData['consultation']>) => {
      update({ consultation: { ...data.consultation, ...patch } })
    },
    [data.consultation, update],
  )

  // ---- Derived validation -------------------------------------------------

  const sectorSelected = data.sectorCode.length > 0

  const days = daysBetween(data.planPeriod.startDate, data.planPeriod.endDate)
  const hasBothDates = data.planPeriod.startDate.length > 0 && data.planPeriod.endDate.length > 0
  const periodValid =
    !hasBothDates || (days >= PLAN_PERIOD_MIN_DAYS && days <= PLAN_PERIOD_MAX_DAYS)
  const showPeriodError = hasBothDates && !periodValid

  const consultationComplete =
    data.consultation.consultedWithEmployees && data.consultation.consultationDate.length > 0

  const canAdvance = sectorSelected && periodValid && consultationComplete

  return (
    <section aria-label="Plan Setup" data-testid="eea13-step-plan-setup">
      <h2 className="mb-1 text-base font-semibold text-slate-800">Step 1 — Plan Setup</h2>
      <p className="mb-5 text-sm text-slate-600">
        Configure the sector, 5-year plan period, and consultation record before proceeding. GN 6124
        numerical targets depend on the sector; employee consultation is a legal prerequisite under
        EEA s.16.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* SECTOR                                                              */}
      {/* ------------------------------------------------------------------ */}

      <fieldset className="mb-6 rounded border border-slate-200 bg-slate-50 px-4 py-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">Sector (GN 6124)</legend>

        <label className="mt-2 grid gap-1" htmlFor={sectorSelectId}>
          <span className="text-xs font-medium text-slate-600">
            Sector{' '}
            <span aria-hidden="true" className="text-red-600">
              *
            </span>
          </span>
          <select
            aria-describedby="eea13-sector-hint"
            aria-required="true"
            className={`rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              sectorSelected
                ? 'border-slate-300 focus:ring-slate-400'
                : 'border-red-400 focus:ring-red-300'
            }`}
            data-testid="eea13-sector-select"
            id={sectorSelectId}
            onChange={(e) => {
              update({ sectorCode: e.target.value })
            }}
            value={data.sectorCode}
          >
            <option value="">— select sector —</option>
            {SECTOR_CODES.map((code) => (
              <option key={code} value={code}>
                {sectorLabel(code)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500" id="eea13-sector-hint">
            GN 6124 Schedule 1 sector — determines your mandatory numerical targets. Required before
            later steps unlock.
          </p>
          {sectorSelected ? null : (
            <p
              className="mt-1 text-xs text-red-700"
              data-testid="eea13-sector-required-error"
              role="alert"
            >
              Sector is required. Yearly Plans and goal calculations cannot proceed without a sector
              selection.
            </p>
          )}
        </label>
      </fieldset>

      {/* ------------------------------------------------------------------ */}
      {/* PLAN PERIOD                                                         */}
      {/* ------------------------------------------------------------------ */}

      <fieldset className="mb-6 rounded border border-slate-200 bg-slate-50 px-4 py-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          Plan Period (EEA s.20(2)(b))
        </legend>

        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1" htmlFor={startDateId}>
            <span className="text-xs font-medium text-slate-600">Start date</span>
            <input
              aria-label="Plan period start date"
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid="eea13-period-start"
              id={startDateId}
              onChange={(e) => {
                updatePeriod({ startDate: e.target.value, endDate: '' })
              }}
              type="date"
              value={data.planPeriod.startDate}
            />
          </label>

          <label className="grid gap-1" htmlFor={endDateId}>
            <span className="text-xs font-medium text-slate-600">End date (auto-suggested)</span>
            <input
              aria-invalid={showPeriodError}
              aria-label="Plan period end date"
              className={`rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                showPeriodError
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-slate-300 focus:ring-slate-400'
              }`}
              data-testid="eea13-period-end"
              id={endDateId}
              onChange={(e) => {
                updatePeriod({ endDate: e.target.value })
              }}
              type="date"
              value={data.planPeriod.endDate}
            />
          </label>
        </div>

        {/* Live day-count indicator */}
        {hasBothDates && !Number.isNaN(days) ? (
          <p
            className={`mt-2 text-xs ${periodValid ? 'text-slate-500' : 'text-red-700'}`}
            data-testid="eea13-period-day-count"
          >
            {Math.round(days)} days
            {periodValid
              ? ' — within the 5-year window'
              : ` — outside the 5-year window (${PLAN_PERIOD_MIN_DAYS.toString()}–${PLAN_PERIOD_MAX_DAYS.toString()} days required)`}
          </p>
        ) : null}

        {/* Period refine error — exact schema message */}
        {showPeriodError ? (
          <p className="mt-2 text-xs text-red-700" data-testid="eea13-period-error" role="alert">
            {PLAN_PERIOD_ERROR}
          </p>
        ) : null}
      </fieldset>

      {/* ------------------------------------------------------------------ */}
      {/* CONSULTATION                                                        */}
      {/* ------------------------------------------------------------------ */}

      <fieldset className="mb-6 rounded border border-slate-200 bg-slate-50 px-4 py-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">
          Employee Consultation (EEA s.16)
        </legend>

        {/* Non-bypassable blocking banner — no dismiss control */}
        {data.consultation.consultedWithEmployees ? null : (
          <div
            aria-live="assertive"
            className="mb-4 rounded border border-red-400 bg-red-50 px-4 py-3"
            data-testid="eea13-consultation-banner"
            role="alert"
          >
            <p className="text-sm font-semibold text-red-800">Consultation required — EEA s.16</p>
            <p className="mt-1 text-sm text-red-700">
              Genuine employee consultation under EEA s.16 is a legal prerequisite before an
              Employment Equity Plan can be adopted or submitted. This plan cannot be submitted
              until consultation has occurred and is confirmed below.
            </p>
            <p className="mt-1 text-xs text-red-600">
              Non-compliance may attract penalties under EEA s.65 (up to R2,700,000 or 10% of annual
              turnover on repeated offences).
            </p>
          </div>
        )}

        <div className="mt-2 grid gap-4">
          <label className="flex items-start gap-3">
            <input
              checked={data.consultation.consultedWithEmployees}
              className="mt-0.5 h-4 w-4 rounded border-slate-400"
              data-testid="eea13-consulted-checkbox"
              onChange={(e) => {
                updateConsultation({ consultedWithEmployees: e.target.checked })
              }}
              type="checkbox"
            />
            <span className="text-sm text-slate-700">
              Genuine employee consultation has occurred as required by EEA s.16
              <span className="ml-1 text-xs text-slate-500">(mandatory)</span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              checked={data.consultation.eecfEstablished}
              className="mt-0.5 h-4 w-4 rounded border-slate-400"
              data-testid="eea13-eecf-checkbox"
              onChange={(e) => {
                updateConsultation({ eecfEstablished: e.target.checked })
              }}
              type="checkbox"
            />
            <span className="text-sm text-slate-700">
              Employment Equity Consultative Forum (EECF) has been established
              <span className="ml-1 text-xs text-slate-500">(rule_eea_015)</span>
            </span>
          </label>

          <label className="grid gap-1" htmlFor={consultationDateId}>
            <span className="text-xs font-medium text-slate-600">Consultation date</span>
            <input
              aria-label="Consultation date"
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              data-testid="eea13-consultation-date"
              id={consultationDateId}
              onChange={(e) => {
                updateConsultation({ consultationDate: e.target.value })
              }}
              type="date"
              value={data.consultation.consultationDate}
            />
          </label>
        </div>
      </fieldset>

      {/* Step advance */}
      <div className="flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="eea13-plan-setup-next"
          disabled={!canAdvance}
          onClick={() => {
            if (canAdvance) onAdvance()
          }}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  )
}
