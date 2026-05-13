// @non-suppressible — POPIA s.18 statutory notice + EEA s.14 voluntary disclosure
//
// This component is an UNCONDITIONAL gate. It MUST render the five POPIA s.18
// notice elements verbatim before any demographic data is collected. There is
// no prop, URL parameter, environment flag, or conditional render path that
// bypasses the notice or short-circuits the event-write step.
//
// The only path to calling `onConsent()` is:
//   1. The user checks the acknowledgement checkbox.
//   2. The user clicks the consent button (HTML `disabled` until checked).
//   3. `await useEEAEventWriter(...)` resolves successfully.
//   4. `onConsent()` fires.
//
// If the event write throws, the error is surfaced inline and `onConsent()`
// is NOT called. Removing or weakening this gate will compromise POPIA s.18
// compliance and EEA s.14 voluntary-disclosure protections.

import { useState, type FormEvent, type ReactElement } from 'react'
import { useEEAEventWriter } from '@/hooks/use-eea-event-writer'
import { cn } from '@/lib/utils'

export interface PopiaConsentGateProps {
  /** Legal name of the responsible party (employer). Interpolated into the statutory notice. */
  employerName: string
  /** Form instance identifier recorded against the consent event in the audit log. */
  formId: string
  /** Invoked exactly once, after the EEA1_POPIA_CONSENT event is successfully appended. */
  onConsent: () => void
}

interface NoticeElement {
  readonly key: string
  readonly heading: string
  readonly body: string
}

/**
 * The five statutory notice elements required by POPIA s.18.
 * Wording is fixed by law. DO NOT paraphrase, shorten, reorder, or summarise.
 */
const buildNoticeElements = (employerName: string): readonly NoticeElement[] => [
  {
    key: 'purpose',
    heading: '(a) Purpose',
    body: 'Your personal information is collected to compile the EEA1 workforce profile required by the Employment Equity Act 55 of 1998 for submission to the Department of Employment and Labour.',
  },
  {
    key: 'lawful-basis',
    heading: '(b) Lawful basis',
    body: `Processing of your personal information is authorised under section 11(1)(c) of the Protection of Personal Information Act 4 of 2013 (POPIA) as it is necessary for ${employerName} to comply with a legal obligation imposed by the Employment Equity Act 55 of 1998.`,
  },
  {
    key: 'data-subject-rights',
    heading: '(c) Data subject rights',
    body: 'You have the right to request access to your personal information (POPIA s.23); to request correction or deletion of inaccurate, irrelevant, excessive, out of date, incomplete, misleading or unlawfully obtained information (POPIA s.24); to object on reasonable grounds to the processing of your personal information (POPIA s.11(3)); and to lodge a complaint with the Information Regulator of South Africa (enquiries@inforegulator.org.za; 010 023 5207).',
  },
  {
    key: 'controller-identity',
    heading: '(d) Controller identity',
    body: `The responsible party (controller) for your information is ${employerName}.`,
  },
  {
    key: 'non-disclosure',
    heading: '(e) Non-disclosure (EEA s.14)',
    body: 'In terms of section 14(1) of the Employment Equity Act 55 of 1998, no person may disclose information about the employment profile of a designated employer to any other person, except— (a) in the form of statistics that do not reveal the identities of individual employees; (b) if that employee has consented in writing to the disclosure of that information; or (c) if the disclosure is consistent with the purpose of this Act.',
  },
]

const GENERIC_ERROR_MESSAGE = 'Consent could not be recorded. Please try again.'

export function PopiaConsentGate({
  employerName,
  formId,
  onConsent,
}: PopiaConsentGateProps): ReactElement {
  const [acknowledged, setAcknowledged] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const noticeElements = buildNoticeElements(employerName)
  const buttonDisabled = !acknowledged || isSubmitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!acknowledged || isSubmitting) {
      return
    }

    setError(null)
    setIsSubmitting(true)
    try {
      await useEEAEventWriter({
        eventType: 'EEA1_POPIA_CONSENT',
        formId,
        newValue: new Date().toISOString(),
      })
      onConsent()
    } catch {
      setError(GENERIC_ERROR_MESSAGE)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      aria-labelledby="popia-consent-title"
      className="mx-auto max-w-2xl space-y-4"
      data-testid="popia-consent-gate"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
    >
      <section
        aria-labelledby="popia-consent-title"
        className="rounded-md border border-slate-300 bg-white p-6 shadow-sm"
        data-testid="popia-consent-notice"
      >
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900" id="popia-consent-title">
            POPIA section 18 notice
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Please read the following information before any demographic information is captured.
          </p>
        </header>

        <dl className="space-y-4">
          {noticeElements.map((element) => (
            <div key={element.key} data-testid={`popia-notice-${element.key}`}>
              <dt className="text-sm font-semibold text-slate-900">{element.heading}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-700">{element.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="rounded-md border border-slate-300 bg-slate-50 p-4">
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input
            checked={acknowledged}
            className="mt-0.5 h-4 w-4 rounded border-slate-400 text-slate-900 focus:ring-2 focus:ring-slate-500"
            data-testid="popia-consent-checkbox"
            onChange={(event) => {
              setAcknowledged(event.target.checked)
            }}
            type="checkbox"
          />
          <span>I have read and understand the information above</span>
        </label>
      </div>

      {error !== null && (
        <div
          aria-live="assertive"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          data-testid="popia-consent-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          className={cn(
            'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow-sm transition-colors',
            'bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500',
          )}
          data-testid="popia-consent-submit"
          disabled={buttonDisabled}
          type="submit"
        >
          {isSubmitting ? 'Recording consent…' : 'I understand and consent'}
        </button>
      </div>
    </form>
  )
}
