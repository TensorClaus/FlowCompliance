import { EmployerProfileSchema } from '@simplifi/shared'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

export const EmployerDetailsFormSchema = EmployerProfileSchema.pick({
  tradeName: true,
  dtiRegistrationName: true,
  dtiRegistrationNumber: true,
  payeSarsNumber: true,
  ceoName: true,
  ceoEmail: true,
  eapType: true,
}).extend({
  tradeName: EmployerProfileSchema.shape.tradeName.min(1, 'Trade name is required'),
  dtiRegistrationName: EmployerProfileSchema.shape.dtiRegistrationName.min(
    1,
    'DTI registration name is required',
  ),
  dtiRegistrationNumber: EmployerProfileSchema.shape.dtiRegistrationNumber.min(
    1,
    'DTI registration number is required',
  ),
  payeSarsNumber: EmployerProfileSchema.shape.payeSarsNumber.min(1, 'PAYE SARS number is required'),
  ceoName: EmployerProfileSchema.shape.ceoName.min(1, 'CEO name is required'),
  ceoEmail: EmployerProfileSchema.shape.ceoEmail,
})

export type EmployerDetailsValues = z.infer<typeof EmployerDetailsFormSchema>

const defaultValues: EmployerDetailsValues = {
  tradeName: '',
  dtiRegistrationName: '',
  dtiRegistrationNumber: '',
  payeSarsNumber: '',
  ceoName: '',
  ceoEmail: '',
  eapType: 'national',
}

export interface EmployerDetailsFormProps {
  defaultData?: Partial<EmployerDetailsValues>
  submitLabel?: string
  onDirtyChange?: (isDirty: boolean) => void
  onSubmit: (values: EmployerDetailsValues) => void
}

export function EmployerDetailsForm({
  defaultData,
  submitLabel = 'Save and continue',
  onDirtyChange,
  onSubmit,
}: EmployerDetailsFormProps) {
  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isDirty },
  } = useForm<EmployerDetailsValues>({
    defaultValues: {
      ...defaultValues,
      ...defaultData,
    },
  })

  useEffect(() => {
    if (onDirtyChange) {
      onDirtyChange(isDirty)
    }
  }, [isDirty, onDirtyChange])

  const submit = handleSubmit((values): void => {
    clearErrors()
    const parsed = EmployerDetailsFormSchema.safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const issuePath = issue.path.at(0)
        if (typeof issuePath === 'string') {
          setError(issuePath as keyof EmployerDetailsValues, {
            type: 'validate',
            message: issue.message,
          })
        }
      }
      return
    }
    onSubmit(parsed.data)
  })

  return (
    <form
      className="grid gap-4"
      onSubmit={(event): void => {
        void submit(event)
      }}
      noValidate
    >
      <label className="grid gap-1">
        <span className="text-sm font-medium">Trade name</span>
        <input
          {...register('tradeName')}
          className="rounded border border-slate-300 px-3 py-2"
          aria-label="Trade name"
        />
        {errors.tradeName?.message ? (
          <span className="text-sm text-red-700">{errors.tradeName.message}</span>
        ) : null}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">DTI registration name</span>
        <input
          {...register('dtiRegistrationName')}
          className="rounded border border-slate-300 px-3 py-2"
          aria-label="DTI registration name"
        />
        {errors.dtiRegistrationName?.message ? (
          <span className="text-sm text-red-700">{errors.dtiRegistrationName.message}</span>
        ) : null}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">DTI registration number</span>
        <input
          {...register('dtiRegistrationNumber')}
          className="rounded border border-slate-300 px-3 py-2"
          aria-label="DTI registration number"
        />
        {errors.dtiRegistrationNumber?.message ? (
          <span className="text-sm text-red-700">{errors.dtiRegistrationNumber.message}</span>
        ) : null}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">PAYE SARS number</span>
        <input
          {...register('payeSarsNumber')}
          className="rounded border border-slate-300 px-3 py-2"
          aria-label="PAYE SARS number"
        />
        {errors.payeSarsNumber?.message ? (
          <span className="text-sm text-red-700">{errors.payeSarsNumber.message}</span>
        ) : null}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">CEO name</span>
        <input
          {...register('ceoName')}
          className="rounded border border-slate-300 px-3 py-2"
          aria-label="CEO name"
        />
        {errors.ceoName?.message ? (
          <span className="text-sm text-red-700">{errors.ceoName.message}</span>
        ) : null}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">CEO email</span>
        <input
          {...register('ceoEmail')}
          className="rounded border border-slate-300 px-3 py-2"
          aria-label="CEO email"
          type="email"
        />
        {errors.ceoEmail?.message ? (
          <span className="text-sm text-red-700">{errors.ceoEmail.message}</span>
        ) : null}
      </label>

      <label className="grid gap-1">
        <span className="text-sm font-medium">EAP type</span>
        <select
          {...register('eapType')}
          className="rounded border border-slate-300 px-3 py-2"
          aria-label="EAP type"
        >
          <option value="national">National</option>
          <option value="provincial">Provincial</option>
        </select>
      </label>

      <button
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        type="submit"
      >
        {submitLabel}
      </button>
    </form>
  )
}
