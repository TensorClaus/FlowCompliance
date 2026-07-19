import React, { useCallback, useId } from 'react'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import type { EEA13DisputeMonitoringData } from '../eea13-types'

const STEP_ID = 'eea13-dispute-monitoring'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EEA13 Step 5 — Dispute Resolution and Monitoring.
 *
 * Collects:
 *  - internalProcedure  — internal grievance process; 21-day response commitment.
 *  - ccmaReferralProcess — Chapter II disputes (unfair discrimination); CCMA within 6 months.
 *  - labourCourtEscalation — Chapter III disputes (affirmative action); Labour Court within 6 months.
 *  - monitoringMechanism — mechanism for tracking plan progress.
 *
 * All four fields are required (non-empty) for step completion.
 * Statutory helper text is displayed for each field to guide correct completion.
 */
export function EEA13StepDisputeMonitoring({ onAdvance }: StepProps): React.ReactElement {
  const { formState, setStepData } = useWizardFormController()

  const raw = formState[STEP_ID] as EEA13DisputeMonitoringData | undefined
  const data: EEA13DisputeMonitoringData = raw ?? {
    internalProcedure: '',
    ccmaReferralProcess: '',
    labourCourtEscalation: '',
    monitoringMechanism: '',
  }

  const internalId = useId()
  const ccmaId = useId()
  const labourCourtId = useId()
  const monitoringId = useId()

  const update = useCallback(
    (patch: Partial<EEA13DisputeMonitoringData>) => {
      setStepData(STEP_ID, { ...data, ...patch })
    },
    [data, setStepData],
  )

  const canAdvance =
    data.internalProcedure.trim().length > 0 &&
    data.ccmaReferralProcess.trim().length > 0 &&
    data.labourCourtEscalation.trim().length > 0 &&
    data.monitoringMechanism.trim().length > 0

  return (
    <section
      aria-label="Dispute Resolution and Monitoring"
      data-testid="eea13-step-dispute-monitoring"
    >
      <h2 className="mb-1 text-base font-semibold text-slate-800">
        Step 5 — Dispute Resolution and Monitoring
      </h2>
      <p className="mb-5 text-sm text-slate-600">
        Document the dispute resolution procedures required by EEA s.25 and the monitoring mechanism
        that tracks progress against numerical goals.
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Internal Procedure                                                  */}
      {/* ------------------------------------------------------------------ */}

      <div className="mb-5">
        <label className="grid gap-1" htmlFor={internalId}>
          <span className="text-sm font-medium text-slate-700">
            Internal dispute resolution procedure
          </span>
          <span className="text-xs text-slate-500">
            Describe the internal EEA grievance process, including the 21-day response commitment
            (rule_eea_025). Employees must be informed of this procedure.
          </span>
          <textarea
            aria-label="Internal dispute resolution procedure"
            className="mt-1 min-h-[100px] rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid="eea13-internal-procedure"
            id={internalId}
            onChange={(e) => {
              update({ internalProcedure: e.target.value })
            }}
            placeholder="Describe the internal procedure for resolving EEA-related grievances…"
            value={data.internalProcedure}
          />
        </label>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CCMA Referral Process                                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="mb-5">
        <label className="grid gap-1" htmlFor={ccmaId}>
          <span className="text-sm font-medium text-slate-700">CCMA referral process</span>
          <span className="text-xs text-slate-500">
            Chapter II disputes — unfair discrimination (EEA ss.6–11): must be referred to the CCMA
            within 6 months of the act or omission (EEA s.10 / rule_eea_025).
          </span>
          <textarea
            aria-label="CCMA referral process"
            className="mt-1 min-h-[100px] rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid="eea13-ccma-referral"
            id={ccmaId}
            onChange={(e) => {
              update({ ccmaReferralProcess: e.target.value })
            }}
            placeholder="Describe the process for referring Chapter II disputes to the CCMA…"
            value={data.ccmaReferralProcess}
          />
        </label>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Labour Court Escalation                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="mb-5">
        <label className="grid gap-1" htmlFor={labourCourtId}>
          <span className="text-sm font-medium text-slate-700">Labour Court escalation</span>
          <span className="text-xs text-slate-500">
            Chapter III disputes — affirmative action (EEA ss.15–27): escalated directly to the
            Labour Court within 6 months (rule_eea_025). CCMA has no jurisdiction for Chapter III.
          </span>
          <textarea
            aria-label="Labour Court escalation process"
            className="mt-1 min-h-[100px] rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid="eea13-labour-court"
            id={labourCourtId}
            onChange={(e) => {
              update({ labourCourtEscalation: e.target.value })
            }}
            placeholder="Describe the process for escalating Chapter III disputes to the Labour Court…"
            value={data.labourCourtEscalation}
          />
        </label>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Monitoring Mechanism                                                */}
      {/* ------------------------------------------------------------------ */}

      <div className="mb-5">
        <label className="grid gap-1" htmlFor={monitoringId}>
          <span className="text-sm font-medium text-slate-700">Monitoring mechanism</span>
          <span className="text-xs text-slate-500">
            Describe how progress against numerical goals will be monitored throughout the plan
            period. EECF must review annually (rule_eea_015, rule_eea_004).
          </span>
          <textarea
            aria-label="Monitoring mechanism"
            className="mt-1 min-h-[100px] rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            data-testid="eea13-monitoring"
            id={monitoringId}
            onChange={(e) => {
              update({ monitoringMechanism: e.target.value })
            }}
            placeholder="Describe the mechanism for monitoring and reviewing EEP progress…"
            value={data.monitoringMechanism}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="eea13-dispute-monitoring-next"
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
