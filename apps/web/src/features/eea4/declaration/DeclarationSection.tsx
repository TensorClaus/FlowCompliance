import {
  CEODeclarationSchema,
  type CEODeclaration,
  type EEAFormStatus,
  type ValidationReport,
} from '@simplifi/shared'
import { useCallback, useMemo, useState } from 'react'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'
import { ValidationReportPanel } from './ValidationReportPanel'
import { EEA4_DECLARATION_RULE_NAMES, evaluateDeclarationGate } from './declaration-rules'

// ---------------------------------------------------------------------------
// DeclarationSection — the EEA4 CEO signing gate
// ---------------------------------------------------------------------------

/**
 * The EEA4 declaration step. The CEO declaration is UNREACHABLE while any
 * error-severity cross-form result fails. There is no override path.
 *
 * Validation lifecycle:
 *   evaluateDeclarationGate runs on EVERY render of this step. Because the step
 *   re-renders whenever the EEA4 form or the linked EEA2 changes (both flow
 *   through the wizard context / shell state), this covers the required
 *   triggers: every render AND every form save AND EEA2 drift. The engine is
 *   pure; the component owns wall-clock time via the injected clock.
 *
 * On completed signature the step writes report.status AND form.status together
 * in ONE setEEA4Form call — the shell's status-mirror useEffect is a guard, not
 * the mechanism.
 */

const EMPTY_DECLARATION = {
  fullName: '',
  organisationName: '',
  signatureDataUrl: '',
  place: '',
}

function failingErrorRuleNames(report: ValidationReport): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const result of report.rules) {
    if (result.passed || result.severity !== 'error') continue
    if (seen.has(result.ruleId)) continue
    seen.add(result.ruleId)
    names.push(EEA4_DECLARATION_RULE_NAMES[result.ruleId] ?? result.ruleId)
  }
  return names
}

interface DeclarationDraft {
  fullName: string
  organisationName: string
  signatureDataUrl: string
  place: string
}

export interface DeclarationSectionProps extends StepProps {
  /** Injected clock — defaults to new Date(); overridable in tests for determinism. */
  clock?: () => Date
}

export function DeclarationSection({
  isLocked = false,
  clock = () => new Date(),
}: DeclarationSectionProps) {
  const { linkedEEA2Form, eea4Form, setEEA4Form } = useWizardFormController()
  const [draft, setDraft] = useState(EMPTY_DECLARATION)
  const [signError, setSignError] = useState<string | null>(null)

  // Runs on every render — engine is the sole cross-form authority.
  const report = useMemo(
    () => evaluateDeclarationGate({ linkedEEA2Form, eea4Form, clock }),
    [linkedEEA2Form, eea4Form, clock],
  )

  const blockingRuleNames = useMemo(() => failingErrorRuleNames(report), [report])
  const blocked = !report.allPassed

  const currentStatus = useMemo<EEAFormStatus | undefined>(() => {
    if (typeof eea4Form === 'object' && eea4Form !== null && 'status' in eea4Form) {
      const status = (eea4Form as { status?: unknown }).status
      return typeof status === 'string' ? (status as EEAFormStatus) : undefined
    }
    return
  }, [eea4Form])

  const alreadySigned = currentStatus === 'pending_ceo' || currentStatus === 'signed'

  const handleSign = useCallback(() => {
    const declaration: CEODeclaration = {
      fullName: draft.fullName,
      organisationName: draft.organisationName,
      signatureDataUrl: draft.signatureDataUrl,
      place: draft.place,
      date: clock(),
    }
    const parsed = CEODeclarationSchema.safeParse(declaration)
    if (!parsed.success) {
      setSignError('Complete all declaration fields before signing.')
      return
    }
    setSignError(null)

    // Write report.status AND form.status together in one setForm call.
    setEEA4Form?.((previous) => {
      if (typeof previous !== 'object' || previous === null) return previous
      const prev = previous as {
        report?: Record<string, unknown>
        status?: unknown
      }
      const nextStatus: EEAFormStatus = 'pending_ceo'
      return {
        ...prev,
        status: nextStatus,
        report: {
          ...prev.report,
          declaration: parsed.data,
          status: nextStatus,
        },
      }
    })
  }, [clock, draft, setEEA4Form])

  const updateField = useCallback(
    (field: keyof DeclarationDraft) => (event: { target: { value: string } }) => {
      const { value } = event.target
      setDraft((current) => ({ ...current, [field]: value }))
    },
    [],
  )

  return (
    <section
      aria-label="Declaration - CEO sign-off"
      className="grid gap-4"
      data-testid="eea4-declaration"
    >
      {blocked ? (
        <div aria-disabled="true" className="grid gap-4" data-testid="eea4-declaration-blocked">
          <div
            className="rounded border border-red-300 bg-red-50 px-4 py-3"
            data-testid="eea4-declaration-banner"
            role="alert"
          >
            <p className="text-sm font-semibold text-red-800">
              The CEO declaration is locked until the following cross-form checks pass:
            </p>
            <ul className="mt-2 grid gap-1">
              {blockingRuleNames.map((name) => (
                <li
                  className="text-sm text-red-700"
                  data-testid="eea4-declaration-failing-rule"
                  key={name}
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
          <ValidationReportPanel report={report} ruleNames={EEA4_DECLARATION_RULE_NAMES} />
        </div>
      ) : alreadySigned ? (
        <div
          className="rounded border border-emerald-300 bg-emerald-50 px-4 py-3"
          data-testid="eea4-declaration-signed"
        >
          <p className="text-sm font-semibold text-emerald-800">
            Declaration captured. Status: {currentStatus}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4" data-testid="eea4-declaration-form">
          <p className="text-sm text-slate-700">
            All cross-form checks have passed. Complete the declaration to advance the form to CEO
            sign-off.
          </p>
          {signError === null ? null : (
            <p
              className="text-sm font-medium text-red-700"
              data-testid="eea4-declaration-sign-error"
            >
              {signError}
            </p>
          )}
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Full legal name</span>
            <input
              aria-label="Full legal name"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              data-testid="eea4-declaration-fullname"
              disabled={isLocked}
              onChange={updateField('fullName')}
              type="text"
              value={draft.fullName}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Registered organisation name</span>
            <input
              aria-label="Registered organisation name"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              data-testid="eea4-declaration-organisation"
              disabled={isLocked}
              onChange={updateField('organisationName')}
              type="text"
              value={draft.organisationName}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Place of signature</span>
            <input
              aria-label="Place of signature"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              data-testid="eea4-declaration-place"
              disabled={isLocked}
              onChange={updateField('place')}
              type="text"
              value={draft.place}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Signature (data URL)</span>
            <input
              aria-label="Signature"
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              data-testid="eea4-declaration-signature"
              disabled={isLocked}
              onChange={updateField('signatureDataUrl')}
              type="text"
              value={draft.signatureDataUrl}
            />
          </label>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            data-testid="eea4-declaration-submit"
            disabled={isLocked}
            onClick={handleSign}
            type="button"
          >
            Confirm and sign
          </button>
        </div>
      )}
    </section>
  )
}
