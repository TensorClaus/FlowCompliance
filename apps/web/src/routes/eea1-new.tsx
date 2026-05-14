import { createRoute } from '@tanstack/react-router'
import { useState, useCallback, type ReactElement } from 'react'
import { Route as rootRoute } from './__root'
import { DemographicFieldsSection } from '@/components/eea1/DemographicFieldsSection'
import type { PIIValues } from '@/components/eea1/DemographicFieldsSection'
import { NationalitySection } from '@/components/eea1/NationalitySection'
import { PersonalDetailsSection } from '@/components/eea1/PersonalDetailsSection'
import { PopiaConsentGate } from '@/components/eea1/PopiaConsentGate'
import { SignatureStep } from '@/components/eea1/SignatureStep'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/eea1/new',
  validateSearch: (search: Record<string, unknown>) => ({
    employeeId: typeof search['employeeId'] === 'string' ? search['employeeId'] : '',
    formId:
      typeof search['formId'] === 'string' ? search['formId'] : globalThis.crypto.randomUUID(),
  }),
  component: EEA1NewPage,
})

const DEFAULT_PII: PIIValues = {
  race: null,
  gender: null,
  disability: null,
  disabilityNature: '',
  reasonableAccommodation: false,
}

function EEA1NewPage(): ReactElement {
  const { employeeId, formId } = Route.useSearch()
  const [hasConsent, setHasConsent] = useState(false)
  const [piiValues, setPIIValues] = useState(DEFAULT_PII)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [declarationId, setDeclarationId] = useState<string | null>(null)

  const handleConsent = useCallback((): void => {
    setHasConsent(true)
  }, [])

  const handlePIIValuesChange = useCallback((values: PIIValues): void => {
    setPIIValues(values)
  }, [])

  const handleSignatureSubmit = useCallback(
    async (signatureDataUrl: string): Promise<void> => {
      setSubmitStatus('submitting')
      setSubmitError(null)

      try {
        const response = await fetch('/eea1', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            employeeId,
            signatureDataUrl,
            race: piiValues.race,
            gender: piiValues.gender,
            disability: piiValues.disability,
            disabilityNature: piiValues.disabilityNature || undefined,
            reasonableAccommodation: piiValues.reasonableAccommodation,
          }),
        })

        if (!response.ok) {
          const body = (await response.json()) as { error?: string }
          throw new Error(body.error ?? `Submit failed (${response.status.toString()})`)
        }

        const created = (await response.json()) as { id: string }
        setDeclarationId(created.id)
        setSubmitStatus('success')
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Submission failed')
        setSubmitStatus('error')
      }
    },
    [employeeId, piiValues],
  )

  if (submitStatus === 'success' && declarationId !== null) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div
          className="mx-auto max-w-2xl rounded-xl border border-green-200 bg-white p-6 shadow-sm"
          data-testid="eea1-submit-success"
        >
          <h1 className="mb-2 text-lg font-semibold text-green-800">Declaration submitted</h1>
          <p className="text-sm text-slate-600" data-testid="eea1-declaration-id">
            {declarationId}
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">EEA1 Workforce Profile Declaration</h1>

        {hasConsent ? (
          <>
            <PersonalDetailsSection employeeId={employeeId} formId={formId} />
            <NationalitySection formId={formId} />
            <DemographicFieldsSection formId={formId} onValuesChange={handlePIIValuesChange} />

            {submitError !== null && (
              <div
                className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
                data-testid="eea1-submit-error"
                role="alert"
              >
                {submitError}
              </div>
            )}

            <SignatureStep
              formId={formId}
              onSubmit={(dataUrl) => {
                void handleSignatureSubmit(dataUrl)
              }}
            />
          </>
        ) : (
          <PopiaConsentGate employerName="Simplifi" formId={formId} onConsent={handleConsent} />
        )}
      </div>
    </main>
  )
}
