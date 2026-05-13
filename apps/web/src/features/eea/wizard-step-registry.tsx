import { useEffect } from 'react'
import { z } from 'zod'
import { EmployerDetailsForm } from './components/employer-details-form'
import { usePrefill } from './hooks/use-prefill'
import { useWizardFormController } from './wizard-form-context'
import type {
  SectionAData,
  SectionAReadOnlyFields,
  SectionBData,
  SectionBRowData,
  StepProps,
  StepRegistry,
  WizardContext,
} from './wizard-types'

export const SECTION_A_SCHEMA = z.object({
  registrationNumber: z.string(),
  sector: z.string(),
  province: z.string(),
  totalEmployeesPriorYear: z.number().int().min(0),
  primaryContactName: z.string().trim().min(1, 'Primary contact name is required'),
  primaryContactEmail: z
    .string()
    .trim()
    .min(1, 'Primary contact email is required')
    .email('Enter a valid primary contact email'),
  reportingYear: z.number().int().min(2000).max(2100),
})

const sectionBRowSchema = z.object({
  male: z.number().int().min(0),
  female: z.number().int().min(0),
})

export const SECTION_B_SCHEMA = z.object({
  permanent: sectionBRowSchema,
  nonPermanent: sectionBRowSchema,
  contract: sectionBRowSchema,
  totals: z
    .object({
      permanent: z.number().int().min(0),
      nonPermanent: z.number().int().min(0),
      contract: z.number().int().min(0),
      grandTotal: z.number().int().min(0),
    })
    .optional(),
})

const placeholderSchema = z.object({}).passthrough()

const emptySectionAReadOnly: SectionAReadOnlyFields = {
  registrationNumber: '',
  sector: '',
  province: '',
  totalEmployeesPriorYear: 0,
}

export const emptySectionBData: SectionBData = {
  permanent: { male: 0, female: 0 },
  nonPermanent: { male: 0, female: 0 },
  contract: { male: 0, female: 0 },
}

const getSectionAData = (value: unknown, reportingYear: number): SectionAData => {
  const partial =
    typeof value === 'object' && value !== null ? (value as Partial<SectionAData>) : {}
  return {
    ...emptySectionAReadOnly,
    primaryContactName: '',
    primaryContactEmail: '',
    reportingYear,
    ...partial,
  }
}

export const getSectionBData = (value: unknown): SectionBData => {
  const partial =
    typeof value === 'object' && value !== null ? (value as Partial<SectionBData>) : {}
  return {
    permanent: { ...emptySectionBData.permanent, ...partial.permanent },
    nonPermanent: { ...emptySectionBData.nonPermanent, ...partial.nonPermanent },
    contract: { ...emptySectionBData.contract, ...partial.contract },
    ...(partial.totals === undefined ? {} : { totals: partial.totals }),
  }
}

export const calculateSectionBTotals = (
  sectionB: SectionBData,
): NonNullable<WizardContext['sectionBTotals']> => {
  const permanent = sectionB.permanent.male + sectionB.permanent.female
  const nonPermanent = sectionB.nonPermanent.male + sectionB.nonPermanent.female
  const contract = sectionB.contract.male + sectionB.contract.female
  return {
    permanent,
    nonPermanent,
    contract,
    grandTotal: permanent + nonPermanent + contract,
  }
}

function SectionAEmployerDetailsComposition() {
  return (
    <div aria-hidden="true" className="hidden">
      <EmployerDetailsForm onSubmit={(): void => {}} />
    </div>
  )
}

export function SectionAStep(_props: StepProps) {
  const { tenantId, reportingYear, prefillOptions, formState, setStepData } =
    useWizardFormController()
  const { data } = usePrefill(tenantId, reportingYear, {
    ...prefillOptions,
    autoLoad: tenantId.length > 0 && (prefillOptions.autoLoad ?? true),
  })
  const sectionA = getSectionAData(formState['section-a'], reportingYear)
  const readOnly = data?.sectionAReadOnly ?? emptySectionAReadOnly

  useEffect(() => {
    setStepData('section-a', (previous: unknown) => {
      const current = getSectionAData(previous, reportingYear)
      const next: SectionAData = {
        ...current,
        ...readOnly,
        reportingYear: current.reportingYear || reportingYear,
      }

      if (
        current.registrationNumber === next.registrationNumber &&
        current.sector === next.sector &&
        current.province === next.province &&
        current.totalEmployeesPriorYear === next.totalEmployeesPriorYear &&
        current.reportingYear === next.reportingYear
      ) {
        return previous
      }

      return next
    })
  }, [
    readOnly.province,
    readOnly.registrationNumber,
    readOnly.sector,
    readOnly.totalEmployeesPriorYear,
    reportingYear,
    setStepData,
  ])

  const updateField = <Field extends keyof SectionAData>(
    field: Field,
    value: SectionAData[Field],
  ): void => {
    setStepData('section-a', {
      ...sectionA,
      [field]: value,
    })
  }

  return (
    <section aria-label="Section A" className="grid gap-4">
      <SectionAEmployerDetailsComposition />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Registration number</span>
          <input
            aria-label="Registration number"
            className="rounded border border-slate-300 bg-slate-50 px-3 py-2"
            readOnly
            value={sectionA.registrationNumber}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Sector</span>
          <input
            aria-label="Sector"
            className="rounded border border-slate-300 bg-slate-50 px-3 py-2"
            readOnly
            value={sectionA.sector}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Province</span>
          <input
            aria-label="Province"
            className="rounded border border-slate-300 bg-slate-50 px-3 py-2"
            readOnly
            value={sectionA.province}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Total employees prior year</span>
          <input
            aria-label="Total employees prior year"
            className="rounded border border-slate-300 bg-slate-50 px-3 py-2"
            readOnly
            type="number"
            value={sectionA.totalEmployeesPriorYear}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Primary contact name</span>
          <input
            aria-label="Primary contact name"
            className="rounded border border-slate-300 px-3 py-2"
            onChange={(event): void => {
              updateField('primaryContactName', event.target.value)
            }}
            value={sectionA.primaryContactName}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Primary contact email</span>
          <input
            aria-label="Primary contact email"
            className="rounded border border-slate-300 px-3 py-2"
            onChange={(event): void => {
              updateField('primaryContactEmail', event.target.value)
            }}
            type="email"
            value={sectionA.primaryContactEmail}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Reporting year</span>
          <input
            aria-label="Reporting year"
            className="rounded border border-slate-300 px-3 py-2"
            onChange={(event): void => {
              updateField('reportingYear', Number(event.target.value))
            }}
            type="number"
            value={sectionA.reportingYear}
          />
        </label>
      </div>
    </section>
  )
}

const sectionBRows = [
  ['permanent', 'Permanent'],
  ['nonPermanent', 'Non-Permanent'],
  ['contract', 'Contract workers'],
] as const

export function SectionBStep(_props: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const sectionB = getSectionBData(formState['section-b'])
  const totals = calculateSectionBTotals(sectionB)

  const updateRow = (
    rowKey: keyof SectionBData,
    field: keyof SectionBRowData,
    value: number,
  ): void => {
    if (rowKey === 'totals') {
      return
    }
    const next: SectionBData = {
      ...sectionB,
      [rowKey]: {
        ...sectionB[rowKey],
        [field]: value,
      },
    }
    setStepData('section-b', {
      ...next,
      totals: calculateSectionBTotals(next),
    })
  }

  return (
    <section aria-label="Section B" className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-slate-300 px-3 py-2 text-left">Worker type</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Male</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Female</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {sectionBRows.map(([rowKey, rowLabel]) => {
              const row = sectionB[rowKey]
              const rowTotal = row.male + row.female
              return (
                <tr key={rowKey}>
                  <th className="border border-slate-300 px-3 py-2 text-left">{rowLabel}</th>
                  <td className="border border-slate-300 px-3 py-2">
                    <input
                      aria-label={`${rowLabel} male`}
                      className="w-28 rounded border border-slate-300 px-2 py-1"
                      min={0}
                      onChange={(event): void => {
                        updateRow(rowKey, 'male', Number(event.target.value))
                      }}
                      type="number"
                      value={row.male}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <input
                      aria-label={`${rowLabel} female`}
                      className="w-28 rounded border border-slate-300 px-2 py-1"
                      min={0}
                      onChange={(event): void => {
                        updateRow(rowKey, 'female', Number(event.target.value))
                      }}
                      type="number"
                      value={row.female}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <input
                      aria-label={`${rowLabel} total`}
                      className="w-28 rounded border border-slate-300 bg-slate-50 px-2 py-1"
                      readOnly
                      type="number"
                      value={rowTotal}
                    />
                  </td>
                </tr>
              )
            })}
            <tr>
              <th className="border border-slate-300 px-3 py-2 text-left">Grand total</th>
              <td className="border border-slate-300 px-3 py-2">
                <input
                  aria-label="Grand total male"
                  className="w-28 rounded border border-slate-300 bg-slate-50 px-2 py-1"
                  readOnly
                  type="number"
                  value={
                    sectionB.permanent.male + sectionB.nonPermanent.male + sectionB.contract.male
                  }
                />
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <input
                  aria-label="Grand total female"
                  className="w-28 rounded border border-slate-300 bg-slate-50 px-2 py-1"
                  readOnly
                  type="number"
                  value={
                    sectionB.permanent.female +
                    sectionB.nonPermanent.female +
                    sectionB.contract.female
                  }
                />
              </td>
              <td className="border border-slate-300 px-3 py-2">
                <input
                  aria-label="Grand total"
                  className="w-28 rounded border border-slate-300 bg-slate-50 px-2 py-1"
                  readOnly
                  type="number"
                  value={totals.grandTotal}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PlaceholderStep(_props: StepProps) {
  return (
    <section aria-label="Pending section" className="grid gap-4">
      <p className="text-sm text-slate-700">
        This section will be completed in the next EEA2 tasks.
      </p>
    </section>
  )
}

function ReviewStep(_props: StepProps) {
  return (
    <section aria-label="Review and submit" className="grid gap-4">
      <p className="text-sm text-slate-700">Review placeholder for the completed EEA2 wizard.</p>
    </section>
  )
}

export const STEP_REGISTRY: StepRegistry = {
  'section-a': {
    sectionKey: 'sectionA',
    component: SectionAStep,
    validationSchema: SECTION_A_SCHEMA,
    requiresHITL: false,
  },
  'section-b': {
    sectionKey: 'sectionB',
    component: SectionBStep,
    validationSchema: SECTION_B_SCHEMA,
    requiresHITL: false,
  },
  'section-c-recruitment': {
    sectionKey: 'sectionC.recruitment',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-c-promotions': {
    sectionKey: 'sectionC.promotions',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-c-terminations': {
    sectionKey: 'sectionC.terminations',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-d-skills': {
    sectionKey: 'sectionD',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-e-sector-targets': {
    sectionKey: 'sectionE.sectorTargets5Year',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-e-next-year-targets': {
    sectionKey: 'sectionE.annualTargetsNextYear',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-f-consultation': {
    sectionKey: 'sectionF.consultation',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-f-barriers': {
    sectionKey: 'sectionF.barriers',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-g-monitoring': {
    sectionKey: 'sectionG',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-h-declaration': {
    sectionKey: 'sectionH.declaration',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: true,
  },
  'section-h-hitl': {
    sectionKey: 'sectionH.hitl',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: true,
  },
  review: {
    sectionKey: 'review',
    component: ReviewStep,
    validationSchema: placeholderSchema,
    requiresHITL: true,
  },
}

export const STEP_IDS = Object.keys(STEP_REGISTRY)
