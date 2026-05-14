import { EEA2_DECLARATION_TEXT } from '@simplifi/shared'
import { useMemo, useState } from 'react'

export interface EEA2SignRequestInput {
  formId: string
  totpCode: string
  typedName: string
  confirmationChecked: boolean
}

export interface EEA2SigningCeremonyPageProps {
  formId: string
  signRequest?: (input: EEA2SignRequestInput) => Promise<{ status: 'signed' }>
  navigateToLockedView?: (formId: string) => void
}

const defaultSignRequest = async ({
  formId,
  totpCode,
  typedName,
  confirmationChecked,
}: EEA2SignRequestInput): Promise<{ status: 'signed' }> => {
  const response = await fetch(`/api/eea2/${encodeURIComponent(formId)}/sign`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ totpCode, typedName, confirmationChecked }),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? `SIGN_${response.status.toString()}`)
  }

  return response.json() as Promise<{ status: 'signed' }>
}

const defaultNavigateToLockedView = (formId: string): void => {
  globalThis.location.assign(`/eea2/${encodeURIComponent(formId)}?locked=1`)
}

export function EEA2SigningCeremonyPage({
  formId,
  signRequest = defaultSignRequest,
  navigateToLockedView = defaultNavigateToLockedView,
}: EEA2SigningCeremonyPageProps) {
  const [totpCode, setTotpCode] = useState('')
  const [typedName, setTypedName] = useState('')
  const [confirmationChecked, setConfirmationChecked] = useState(false)
  const [totpError, setTotpError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit = useMemo(
    () => totpCode.length === 6 && typedName.length > 0 && confirmationChecked && !isSubmitting,
    [confirmationChecked, isSubmitting, totpCode.length, typedName.length],
  )

  const submit = async (): Promise<void> => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setTotpError(null)
    setNameError(null)
    setFormError(null)

    try {
      await signRequest({ formId, totpCode, typedName, confirmationChecked })
      navigateToLockedView(formId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign this form.'
      switch (message) {
        case 'Invalid TOTP code':
        case 'TOTP not configured': {
          setTotpError(message)

          break
        }
        case 'Name does not match': {
          setNameError(message)

          break
        }
        case 'Form is immutable': {
          setFormError('This form has already been signed.')

          break
        }
        default: {
          setFormError(message)
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto grid w-full max-w-xl gap-5 border border-slate-200 bg-white p-6">
        <header className="grid gap-1">
          <h1 className="text-2xl font-bold text-slate-900">EEA2 signing ceremony</h1>
          <p className="text-sm text-slate-600">CEO or designated senior manager authorisation</p>
        </header>

        {formError ? <p className="text-sm font-medium text-red-700">{formError}</p> : null}

        <label className="grid gap-1">
          <span className="text-sm font-medium">TOTP code</span>
          <input
            aria-describedby={totpError === null ? undefined : 'totp-error'}
            aria-label="TOTP code"
            className="rounded border border-slate-300 px-3 py-2 tracking-widest"
            inputMode="numeric"
            maxLength={6}
            onChange={(event): void => {
              setTotpCode(event.target.value.replaceAll(/\D/g, '').slice(0, 6))
              setTotpError(null)
            }}
            type="text"
            value={totpCode}
          />
          {totpError ? (
            <span className="text-sm text-red-700" id="totp-error">
              {totpError}
            </span>
          ) : null}
        </label>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Typed name</span>
          <input
            aria-describedby={nameError === null ? undefined : 'typed-name-error'}
            className="rounded border border-slate-300 px-3 py-2"
            onChange={(event): void => {
              setTypedName(event.target.value)
              setNameError(null)
            }}
            placeholder="Type your full registered name exactly"
            type="text"
            value={typedName}
          />
          {nameError ? (
            <span className="text-sm text-red-700" id="typed-name-error">
              {nameError}
            </span>
          ) : null}
        </label>

        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input
            checked={confirmationChecked}
            className="mt-1"
            onChange={(event): void => {
              setConfirmationChecked(event.target.checked)
            }}
            type="checkbox"
          />
          <span>{EEA2_DECLARATION_TEXT}</span>
        </label>

        <button
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canSubmit}
          onClick={(): void => {
            void submit()
          }}
          type="button"
        >
          Confirm and Sign
        </button>
      </section>
    </main>
  )
}
