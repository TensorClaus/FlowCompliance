// PersonalDetailsSection — EEA1 form section A: employee ID, name, workplace number.
//
// employeeId is READ-ONLY. It is pre-filled from the JWT at the time the form
// is initialised and must never be editable by the employee. The readOnly HTML
// attribute (not disabled, not CSS) enforces this at the browser level.
//
// name and workplaceNumber are validated on blur against EEA1DeclarationSchema
// and errors are rendered in a <p> below each field. Both fields are wired to
// useEEAAutosave so changes are persisted automatically after the debounce
// interval without requiring a manual save action.
//
// Log safety: only field names are referenced in any error path, never values.

import { EEA1DeclarationBaseSchema, EEA1DeclarationSchema } from '@simplifi/shared'
import { useState, useCallback, type ReactElement, type ChangeEvent, type FocusEvent } from 'react'
import { useEEAAutosave } from '@/hooks/use-eea-autosave'
import { cn } from '@/lib/utils'

export interface PersonalDetailsSectionProps {
  /** EEA form instance identifier — passed through to useEEAAutosave. */
  formId: string
  /** Employee UUID pre-filled from the JWT. Rendered as a read-only field. */
  employeeId: string
}

// Field-level validation helpers — validate a single field in isolation by
// parsing a partial object. ZodObject.shape gives us per-field schemas.
// EEA1DeclarationBaseSchema (not the superRefine-wrapped schema) exposes .shape.
const nameSchema = EEA1DeclarationBaseSchema.shape.name
const workplaceNumberSchema = EEA1DeclarationBaseSchema.shape.workplaceNumber

function validateField(schema: typeof nameSchema, value: string): string | null {
  const result = schema.safeParse(value)
  if (result.success) return null
  return result.error.issues[0]?.message ?? 'Invalid value'
}

const INPUT_BASE = cn(
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
  'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
  'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
)

const READONLY_INPUT = cn(
  INPUT_BASE,
  'cursor-default bg-slate-50 text-slate-500 focus:ring-0 focus:ring-offset-0',
)

const ERROR_INPUT = 'border-red-400 focus:ring-red-400'

export function PersonalDetailsSection({
  formId,
  employeeId,
}: PersonalDetailsSectionProps): ReactElement {
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  const [workplaceNumber, setWorkplaceNumber] = useState('')
  const [workplaceNumberError, setWorkplaceNumberError] = useState<string | null>(null)

  const { save } = useEEAAutosave({
    formId,
    schema: EEA1DeclarationSchema,
    excludeFields: [],
  })

  // ---- name handlers ----

  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = event.target.value
      setName(value)
      save('name', value)
    },
    [save],
  )

  const handleNameBlur = useCallback((event: FocusEvent<HTMLInputElement>): void => {
    const error = validateField(nameSchema, event.target.value)
    setNameError(error)
  }, [])

  // ---- workplaceNumber handlers ----

  const handleWorkplaceNumberChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = event.target.value
      setWorkplaceNumber(value)
      save('workplaceNumber', value)
    },
    [save],
  )

  const handleWorkplaceNumberBlur = useCallback((event: FocusEvent<HTMLInputElement>): void => {
    const error = validateField(workplaceNumberSchema, event.target.value)
    setWorkplaceNumberError(error)
  }, [])

  return (
    <section
      aria-labelledby="personal-details-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="personal-details-section"
    >
      <h2 className="mb-4 text-base font-semibold text-slate-900" id="personal-details-heading">
        Personal details
      </h2>

      <div className="flex flex-col gap-5">
        {/* ---- Employee ID (read-only) ---- */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="personal-employee-id">
            Employee ID
          </label>
          <input
            className={READONLY_INPUT}
            data-testid="personal-employee-id"
            id="personal-employee-id"
            readOnly
            type="text"
            value={employeeId}
          />
          <p className="text-xs text-slate-400">
            Pre-filled from your account. Contact HR to correct this value.
          </p>
        </div>

        {/* ---- Name ---- */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="personal-name">
            Full name
          </label>
          <input
            aria-describedby={nameError === null ? undefined : 'personal-name-error'}
            aria-invalid={nameError !== null}
            className={cn(INPUT_BASE, nameError !== null && ERROR_INPUT)}
            data-testid="personal-name"
            id="personal-name"
            onBlur={handleNameBlur}
            onChange={handleNameChange}
            required
            type="text"
            value={name}
          />
          {nameError !== null && (
            <p
              className="text-xs text-red-600"
              data-testid="personal-name-error"
              id="personal-name-error"
              role="alert"
            >
              {nameError}
            </p>
          )}
        </div>

        {/* ---- Workplace number ---- */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="personal-workplace-number">
            Workplace number
          </label>
          <input
            aria-describedby={
              workplaceNumberError === null ? undefined : 'personal-workplace-number-error'
            }
            aria-invalid={workplaceNumberError !== null}
            className={cn(INPUT_BASE, workplaceNumberError !== null && ERROR_INPUT)}
            data-testid="personal-workplace-number"
            id="personal-workplace-number"
            onBlur={handleWorkplaceNumberBlur}
            onChange={handleWorkplaceNumberChange}
            required
            type="text"
            value={workplaceNumber}
          />
          {workplaceNumberError !== null && (
            <p
              className="text-xs text-red-600"
              data-testid="personal-workplace-number-error"
              id="personal-workplace-number-error"
              role="alert"
            >
              {workplaceNumberError}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
