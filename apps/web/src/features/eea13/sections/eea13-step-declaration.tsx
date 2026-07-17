import React from 'react'
import type { StepProps } from '../../eea/wizard-types'

/**
 * EEA13 Step 6 — CEO Declaration stub.
 *
 * Placeholder for the full CEO declaration and sign-off step (later task).
 * When implemented, this step will collect the CEODeclarationSchema fields
 * and trigger final submission.
 */
export function EEA13StepDeclaration({ onAdvance }: StepProps): React.ReactElement {
  return (
    <section aria-label="Declaration" data-testid="eea13-step-declaration">
      <h2 className="mb-1 text-base font-semibold text-slate-800">Step 6 — CEO Declaration</h2>
      <p className="mb-4 text-sm text-slate-600">
        The senior manager or CEO must declare that the Employment Equity Plan has been prepared in
        compliance with the EEA, that genuine consultation occurred, and that the numerical goals
        meet or exceed GN 6124 sector targets.
      </p>

      <div
        className="rounded border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center"
        data-testid="eea13-declaration-stub"
      >
        <p className="text-sm font-medium text-slate-500">
          [Declaration stub] CEO sign-off and submission — pending implementation (later task).
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Submission is gated on all prior steps being complete and valid.
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          data-testid="eea13-declaration-submit"
          onClick={onAdvance}
          type="button"
        >
          Submit (stub)
        </button>
      </div>
    </section>
  )
}
