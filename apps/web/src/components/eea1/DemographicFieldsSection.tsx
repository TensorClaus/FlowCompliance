// DemographicFieldsSection — EEA1 form section C: race, gender, disability.
//
// PII RULES (non-negotiable):
//
//   1. The five PII fields race, gender, disability, disabilityNature, and
//      signatureDataUrl are listed in `excludeFields` on useEEAAutosave so
//      they are NEVER transmitted via the PATCH autosave endpoint. They
//      reach the server only via the explicit consent-gated submit path.
//
//   2. "Prefer not to disclose" maps to a literal `null` value in component
//      state. The radio input for that option carries no `value` attribute
//      tied to a string — the change handler explicitly assigns `null`.
//
//   3. The disabilityNature textarea and reasonableAccommodation checkbox
//      are rendered via a JSX ternary. When disability !== 'Yes' the
//      elements are ABSENT from the DOM entirely — never hidden via CSS.
//
//   4. No PII value is written to localStorage, sessionStorage, or any
//      other browser-side persistence layer.
//
// Log safety: only field names are referenced in any conditional or error
// path, never field values.

import { EEA1DeclarationBaseSchema } from '@simplifi/shared'
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactElement,
  type ChangeEvent,
} from 'react'
import { useEEAAutosave } from '@/hooks/use-eea-autosave'
import { cn } from '@/lib/utils'

/** PII values surfaced to a parent page via the optional onValuesChange callback. */
export interface PIIValues {
  race: Race
  gender: Gender
  disability: Disability
  disabilityNature: string
  reasonableAccommodation: boolean
}

export interface DemographicFieldsSectionProps {
  /** EEA form instance identifier — passed through to useEEAAutosave. */
  formId: string
  /**
   * Optional callback invoked whenever a PII field value changes.
   * Used by the /eea1/new page to collect PII for the final POST body
   * without violating the component's internal-state-only PII contract.
   * Values are never autosaved; they travel to the server only via submit.
   */
  onValuesChange?: (values: PIIValues) => void
}

type Race = 'African' | 'Coloured' | 'Indian or Asian' | 'White' | null
type Gender = 'Male' | 'Female' | null
type Disability = 'Yes' | 'No' | null

const RACE_OPTIONS: ReadonlyArray<{ label: string; value: Exclude<Race, null> }> = [
  { label: 'African', value: 'African' },
  { label: 'Coloured', value: 'Coloured' },
  { label: 'Indian or Asian', value: 'Indian or Asian' },
  { label: 'White', value: 'White' },
]

const GENDER_OPTIONS: ReadonlyArray<{ label: string; value: Exclude<Gender, null> }> = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
]

const DISABILITY_OPTIONS: ReadonlyArray<{
  label: string
  value: Exclude<Disability, null>
}> = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
]

const NON_DISCLOSURE_LABEL = 'Prefer not to disclose'

const RADIO_LABEL = cn('flex items-center gap-3 cursor-pointer text-sm text-slate-800')

const RADIO_INPUT = cn(
  'h-4 w-4 border-slate-300 text-slate-900',
  'focus:ring-2 focus:ring-slate-500',
)

const TEXTAREA = cn(
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
  'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
)

const DISABILITY_NATURE_MAX_LENGTH = 200

export function DemographicFieldsSection({
  formId,
  onValuesChange,
}: DemographicFieldsSectionProps): ReactElement {
  const [race, setRace] = useState<Race>(null)
  const [gender, setGender] = useState<Gender>(null)
  const [disability, setDisability] = useState<Disability>(null)
  const [disabilityNature, setDisabilityNature] = useState('')
  const [reasonableAccommodation, setReasonableAccommodation] = useState(false)

  // Notify parent of PII value changes for the consent-gated submit path.
  // onValuesChange is optional: absent in unit tests and standalone use.
  useEffect(() => {
    onValuesChange?.({ race, gender, disability, disabilityNature, reasonableAccommodation })
  }, [race, gender, disability, disabilityNature, reasonableAccommodation, onValuesChange])

  // PII fields are excluded from the autosave PATCH path. They are persisted
  // only via the explicit consent-gated submit endpoint.
  const excludeFields = useMemo(
    () => ['race', 'gender', 'disability', 'disabilityNature', 'signatureDataUrl'] as const,
    [],
  )

  // The hook contract still requires a schema for non-PII autosave fields;
  // we pass the EEA1 base schema (which omits the signature/demographic
  // fields). PII values are dropped silently by the hook's excludeFields
  // guard if any handler accidentally calls save() on them.
  useEEAAutosave({
    formId,
    schema: EEA1DeclarationBaseSchema,
    excludeFields,
  })

  // ---- race ----

  const handleRaceChange = useCallback((next: Race): void => {
    setRace(next)
  }, [])

  // ---- gender ----

  const handleGenderChange = useCallback((next: Gender): void => {
    setGender(next)
  }, [])

  // ---- disability ----

  const handleDisabilityChange = useCallback((next: Disability): void => {
    setDisability(next)
    // Clear disability-detail fields when the answer is not 'Yes' so stale
    // values don't persist in state behind a hidden ternary.
    if (next !== 'Yes') {
      setDisabilityNature('')
      setReasonableAccommodation(false)
    }
  }, [])

  // ---- disabilityNature ----

  const handleDisabilityNatureChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>): void => {
      const value = event.target.value.slice(0, DISABILITY_NATURE_MAX_LENGTH)
      setDisabilityNature(value)
    },
    [],
  )

  // ---- reasonableAccommodation ----

  const handleReasonableAccommodationChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      setReasonableAccommodation(event.target.checked)
    },
    [],
  )

  const charCount = disabilityNature.length

  return (
    <section
      aria-labelledby="demographic-fields-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="demographic-fields-section"
    >
      <h2 className="mb-4 text-base font-semibold text-slate-900" id="demographic-fields-heading">
        Demographic information
      </h2>

      {/* ---- race ---- */}
      <fieldset className="mb-5 flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Race</legend>
        {RACE_OPTIONS.map((opt) => (
          <label className={RADIO_LABEL} htmlFor={`race-${opt.value}`} key={opt.value}>
            <input
              checked={race === opt.value}
              className={RADIO_INPUT}
              data-testid={`race-${opt.value}`}
              id={`race-${opt.value}`}
              name="race"
              onChange={() => {
                handleRaceChange(opt.value)
              }}
              type="radio"
            />
            {opt.label}
          </label>
        ))}
        <label className={RADIO_LABEL} htmlFor="race-null">
          <input
            checked={race === null}
            className={RADIO_INPUT}
            data-testid="race-null"
            id="race-null"
            name="race"
            onChange={() => {
              handleRaceChange(null)
            }}
            type="radio"
          />
          {NON_DISCLOSURE_LABEL}
        </label>
      </fieldset>

      {/* ---- gender ---- */}
      <fieldset className="mb-5 flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Gender</legend>
        {GENDER_OPTIONS.map((opt) => (
          <label className={RADIO_LABEL} htmlFor={`gender-${opt.value}`} key={opt.value}>
            <input
              checked={gender === opt.value}
              className={RADIO_INPUT}
              data-testid={`gender-${opt.value}`}
              id={`gender-${opt.value}`}
              name="gender"
              onChange={() => {
                handleGenderChange(opt.value)
              }}
              type="radio"
            />
            {opt.label}
          </label>
        ))}
        <label className={RADIO_LABEL} htmlFor="gender-null">
          <input
            checked={gender === null}
            className={RADIO_INPUT}
            data-testid="gender-null"
            id="gender-null"
            name="gender"
            onChange={() => {
              handleGenderChange(null)
            }}
            type="radio"
          />
          {NON_DISCLOSURE_LABEL}
        </label>
      </fieldset>

      {/* ---- disability ---- */}
      <fieldset className="mb-5 flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">
          Person with a disability
        </legend>
        {DISABILITY_OPTIONS.map((opt) => (
          <label className={RADIO_LABEL} htmlFor={`disability-${opt.value}`} key={opt.value}>
            <input
              checked={disability === opt.value}
              className={RADIO_INPUT}
              data-testid={`disability-${opt.value}`}
              id={`disability-${opt.value}`}
              name="disability"
              onChange={() => {
                handleDisabilityChange(opt.value)
              }}
              type="radio"
            />
            {opt.label}
          </label>
        ))}
        <label className={RADIO_LABEL} htmlFor="disability-null">
          <input
            checked={disability === null}
            className={RADIO_INPUT}
            data-testid="disability-null"
            id="disability-null"
            name="disability"
            onChange={() => {
              handleDisabilityChange(null)
            }}
            type="radio"
          />
          {NON_DISCLOSURE_LABEL}
        </label>
      </fieldset>

      {/* ---- Conditional disability detail block ----
          JSX ternary: absent from DOM when disability !== 'Yes'.
          Never replace this with display:none / hidden / opacity-0. */}
      {disability === 'Yes' ? (
        <div
          className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-4"
          data-testid="disability-detail-block"
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700" htmlFor="disability-nature">
              Nature of disability
            </label>
            <textarea
              className={TEXTAREA}
              data-testid="disability-nature"
              id="disability-nature"
              maxLength={DISABILITY_NATURE_MAX_LENGTH}
              onChange={handleDisabilityNatureChange}
              rows={3}
              value={disabilityNature}
            />
            <span
              aria-live="polite"
              className="self-end text-xs text-slate-500"
              data-testid="disability-nature-counter"
            >
              {charCount}/{DISABILITY_NATURE_MAX_LENGTH}
            </span>
          </div>

          <label className={cn(RADIO_LABEL, 'mt-1')} htmlFor="reasonable-accommodation">
            <input
              checked={reasonableAccommodation}
              className={cn(RADIO_INPUT, 'rounded')}
              data-testid="reasonable-accommodation"
              id="reasonable-accommodation"
              onChange={handleReasonableAccommodationChange}
              type="checkbox"
            />
            I require reasonable accommodation
          </label>
        </div>
      ) : null}
    </section>
  )
}
