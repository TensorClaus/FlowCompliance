// NationalitySection — EEA1 form section B: foreign national status + citizenship date.
//
// DOM STRUCTURE RULE (non-negotiable):
// The citizenshipDate input is rendered via a JSX ternary. When foreignNational
// is false the element is ABSENT from the DOM entirely — not hidden via CSS.
// Never add display:none, visibility:hidden, opacity:0, or a hidden class to
// substitute for conditional rendering.
//
// STATUTORY NOTE (EEA s.1):
// The note below the radio group is ALWAYS visible regardless of the
// foreignNational value. It is positioned outside the ternary.
//
// Log safety: only field names are referenced in any conditional or error path,
// never field values.

import { EEA1DeclarationBaseSchema, EEA1DeclarationSchema } from '@simplifi/shared'
import { useState, useCallback, type ReactElement, type ChangeEvent } from 'react'
import { useEEAAutosave } from '@/hooks/use-eea-autosave'
import { cn } from '@/lib/utils'

export interface NationalitySectionProps {
  /** EEA form instance identifier — passed through to useEEAAutosave. */
  formId: string
  /** Initial value for foreignNational. Defaults to false (SA citizen). */
  initialForeignNational?: boolean
  /** Initial ISO date string for citizenshipDate (yyyy-mm-dd). */
  initialCitizenshipDate?: string
}

const RADIO_LABEL = cn('flex items-center gap-3 cursor-pointer text-sm text-slate-800')

const RADIO_INPUT = cn(
  'h-4 w-4 border-slate-300 text-slate-900',
  'focus:ring-2 focus:ring-slate-500',
)

const DATE_INPUT = cn(
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
  'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
)

const DATE_INPUT_ERROR = 'border-red-400 focus:ring-red-400'

// EEA1DeclarationBaseSchema.shape is used here (not the superRefine-wrapped schema)
// because ZodEffects does not expose .shape.
const citizenshipDateSchema = EEA1DeclarationBaseSchema.shape.citizenshipDate

function validateCitizenshipDate(value: string): string | null {
  const result = citizenshipDateSchema.safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid date'
}

export function NationalitySection({
  formId,
  initialForeignNational = false,
  initialCitizenshipDate,
}: NationalitySectionProps): ReactElement {
  const [foreignNational, setForeignNational] = useState(initialForeignNational)
  const [citizenshipDate, setCitizenshipDate] = useState(initialCitizenshipDate ?? '')
  const [citizenshipDateError, setCitizenshipDateError] = useState<string | null>(null)

  const { save } = useEEAAutosave({
    formId,
    schema: EEA1DeclarationSchema,
    excludeFields: [],
  })

  // ---- foreignNational handlers ----

  const handleForeignNationalChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = event.target.value === 'true'
      setForeignNational(value)
      save('foreignNational', value)

      // Clear citizenshipDate state and any error when switching back to SA citizen
      // so stale date values don't linger in the form payload.
      if (!value) {
        setCitizenshipDate('')
        setCitizenshipDateError(null)
        save('citizenshipDate', null)
      }
    },
    [save],
  )

  // ---- citizenshipDate handlers ----

  const handleCitizenshipDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = event.target.value
      setCitizenshipDate(value)
      // Validate inline on change so the user gets immediate feedback
      // once they have picked a date.
      const error = validateCitizenshipDate(value)
      setCitizenshipDateError(error)
      if (error === null) {
        save('citizenshipDate', value)
      }
    },
    [save],
  )

  return (
    <section
      aria-labelledby="nationality-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="nationality-section"
    >
      <h2 className="mb-4 text-base font-semibold text-slate-900" id="nationality-heading">
        Nationality status
      </h2>

      {/* ---- foreignNational radio group ---- */}
      <fieldset className="mb-4 flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium text-slate-700">Nationality</legend>

        <label className={RADIO_LABEL} htmlFor="nationality-sa-citizen">
          <input
            checked={!foreignNational}
            className={RADIO_INPUT}
            data-testid="nationality-sa-citizen"
            id="nationality-sa-citizen"
            name="foreignNational"
            onChange={handleForeignNationalChange}
            type="radio"
            value="false"
          />
          South African citizen / permanent resident
        </label>

        <label className={RADIO_LABEL} htmlFor="nationality-foreign-national">
          <input
            checked={foreignNational}
            className={RADIO_INPUT}
            data-testid="nationality-foreign-national"
            id="nationality-foreign-national"
            name="foreignNational"
            onChange={handleForeignNationalChange}
            type="radio"
            value="true"
          />
          Foreign national
        </label>
      </fieldset>

      {/* ---- citizenshipDate — JSX ternary; absent from DOM when foreignNational is false ---- */}
      {foreignNational ? (
        <div className="mb-4 flex flex-col gap-1" data-testid="citizenship-date-wrapper">
          <label className="text-sm font-medium text-slate-700" htmlFor="citizenship-date">
            Date citizenship/permanent residence granted
          </label>
          <input
            aria-describedby={citizenshipDateError === null ? undefined : 'citizenship-date-error'}
            aria-invalid={citizenshipDateError !== null}
            aria-required="true"
            className={cn(DATE_INPUT, citizenshipDateError !== null && DATE_INPUT_ERROR)}
            data-testid="citizenship-date"
            id="citizenship-date"
            onChange={handleCitizenshipDateChange}
            required
            type="date"
            value={citizenshipDate}
          />
          {citizenshipDateError !== null && (
            <p
              className="text-xs text-red-600"
              data-testid="citizenship-date-error"
              id="citizenship-date-error"
              role="alert"
            >
              {citizenshipDateError}
            </p>
          )}
        </div>
      ) : null}

      {/* ---- Statutory note — always visible, never conditional (EEA s.1) ---- */}
      <aside
        aria-label="Foreign nationals statutory notice"
        className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        data-testid="nationality-statutory-note"
      >
        <p className="mb-1 font-medium">Note (EEA s.1)</p>
        <p>Foreign nationals are not members of designated groups for EEA purposes (EEA s.1).</p>
        <p className="mt-1">
          Foreign national employees will appear in a separate column in the EEA2 workforce profile.
        </p>
      </aside>
    </section>
  )
}
