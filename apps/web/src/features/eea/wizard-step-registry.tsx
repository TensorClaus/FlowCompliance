import { OccupationalMatrixSchema, type OccupationalMatrix } from '@simplifi/shared'
import { useEffect } from 'react'
import { z } from 'zod'
import { PercentageSliders } from './components/PercentageSliders'
import { EmployerDetailsForm } from './components/employer-details-form'
import { DisabilityFlagBanner } from './components/occupational-matrix/DisabilityFlagBanner'
import { OccupationalMatrix as OccupationalMatrixComponent } from './components/occupational-matrix/OccupationalMatrix'
import {
  SECTION_E_PROMOTIONS_SCHEMA,
  SectionEPromotionsStep,
} from './components/sections/SectionEPromotions'
import {
  SECTION_F_TERMINATIONS_SCHEMA,
  SectionFTerminationsStep,
} from './components/sections/SectionFTerminations'
import {
  SECTION_G_SKILLS_SCHEMA,
  SectionGSkillsDevStep,
} from './components/sections/SectionGSkillsDev'
import {
  SECTION_H1_ACCOMMODATION_SCHEMA,
  SectionH1AccommodationStep,
} from './components/sections/SectionH1Accommodation'
import {
  SECTION_H2_ACCESSIBILITY_SCHEMA,
  SectionH2AccessibilityStep,
} from './components/sections/SectionH2Accessibility'
import { usePrefill } from './hooks/use-prefill'
import { useWizardFormController } from './wizard-form-context'
import {
  createEmptyOccupationalMatrix as createEmptyOccupationalMatrixHelper,
  getOccupationalMatrix as getOccupationalMatrixHelper,
} from './wizard-step-registry-helpers'
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

export const SECTION_C_MATRIX_SCHEMA = OccupationalMatrixSchema

export const SECTION_D_TRAINING_SPEND_SCHEMA = z.object({
  totalBudget: z.number().min(0),
  percentages: z
    .number()
    .int()
    .min(0)
    .array()
    .length(5)
    .refine(
      (values) => values.reduce((sum, value) => sum + value, 0) === 100,
      'Percentages must sum to 100%',
    ),
  narrative: z.string().max(500).optional(),
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

export const createEmptyOccupationalMatrix = createEmptyOccupationalMatrixHelper
export const getOccupationalMatrix = getOccupationalMatrixHelper

const getNestedValue = (value: unknown, path: string[]): unknown => {
  let current = value
  for (const key of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

const extractGoalsMatrix = (payload: unknown): OccupationalMatrix | null => {
  const candidates = [
    getNestedValue(payload, ['sectionC', 'goals']),
    getNestedValue(payload, ['goals']),
    getNestedValue(payload, ['numericalGoals']),
    getNestedValue(payload, ['report', 'sectionC', 'goals']),
  ]

  for (const candidate of candidates) {
    const parsed = OccupationalMatrixSchema.safeParse(candidate)
    if (parsed.success) {
      return parsed.data
    }
  }

  return null
}

interface TrainingSpendData {
  totalBudget: number
  percentages: number[]
  narrative: string
}

const trainingSpendGroups = ['African', 'Coloured', 'Indian or Asian', 'White', 'Non-designated']

const emptyTrainingSpendData: TrainingSpendData = {
  totalBudget: 0,
  percentages: [0, 0, 0, 0, 0],
  narrative: '',
}

const getTrainingSpendData = (value: unknown): TrainingSpendData => {
  const partial =
    typeof value === 'object' && value !== null ? (value as Partial<TrainingSpendData>) : {}
  return {
    totalBudget: typeof partial.totalBudget === 'number' ? partial.totalBudget : 0,
    percentages: Array.isArray(partial.percentages)
      ? [...emptyTrainingSpendData.percentages].map((fallback, index) =>
          typeof partial.percentages?.[index] === 'number' ? partial.percentages[index] : fallback,
        )
      : emptyTrainingSpendData.percentages,
    narrative: typeof partial.narrative === 'string' ? partial.narrative : '',
  }
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

export function SectionC1Step({ wizardContext, updateWizardContext }: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const matrix = getOccupationalMatrix(formState['section-c1'])
  const actual = matrix.grandTotal.total.value
  const expected = wizardContext.sectionBTotals?.grandTotal ?? null
  const hasMismatch = expected !== null && actual !== expected

  useEffect(() => {
    if (actual > 0 && 0 / actual < 0.03) {
      updateWizardContext({ disabilityFlagActive: true })
    }
  }, [actual, updateWizardContext])

  return (
    <section aria-label="Section C current workforce" className="grid gap-4">
      {hasMismatch ? (
        <div
          className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          Workforce profile total ({actual}) does not match total workforce count ({expected})
          entered in Section B.
        </div>
      ) : null}
      {wizardContext.disabilityFlagActive ? (
        <DisabilityFlagBanner headcount={0} percentage={0} total={Math.max(actual, 1)} />
      ) : null}
      <OccupationalMatrixComponent
        data={matrix}
        disabilityHeadcount={0}
        isDesignatedEmployer={false}
        mode="edit"
        onChange={(updated): void => {
          setStepData('section-c1', updated)
          const grandTotal = updated.grandTotal.total.value
          if (grandTotal > 0 && 0 / grandTotal < 0.03) {
            updateWizardContext({ disabilityFlagActive: true })
          }
        }}
      />
    </section>
  )
}

export function SectionC2Step(_props: StepProps) {
  const { tenantId, formState, setStepData } = useWizardFormController()
  const matrix = getOccupationalMatrix(formState['section-c2'])

  useEffect(() => {
    if (tenantId.length === 0) {
      return
    }

    let cancelled = false
    const loadGoals = async (): Promise<void> => {
      try {
        const url = new URL('/api/eea13/latest', globalThis.location.origin)
        url.searchParams.set('tenantId', tenantId)
        const response = await fetch(url.toString(), { headers: { accept: 'application/json' } })
        if (cancelled) {
          return
        }

        if (response.status === 404) {
          setStepData('section-c2', createEmptyOccupationalMatrix())
          return
        }

        if (!response.ok) {
          return
        }

        const payload: unknown = await response.json()
        const goals = extractGoalsMatrix(payload)
        setStepData('section-c2', goals ?? createEmptyOccupationalMatrix())
      } catch {
        if (!cancelled) {
          setStepData('section-c2', createEmptyOccupationalMatrix())
        }
      }
    }

    void loadGoals()
    return () => {
      cancelled = true
    }
  }, [setStepData, tenantId])

  return (
    <section aria-label="Section C numerical goals" className="grid gap-4">
      <OccupationalMatrixComponent
        data={matrix}
        isDesignatedEmployer={false}
        mode="edit"
        onChange={(updated): void => {
          setStepData('section-c2', updated)
        }}
      />
    </section>
  )
}

export function SectionD1Step(_props: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const matrix = getOccupationalMatrix(formState['section-d1'])

  return (
    <section aria-label="Section D trained employees" className="grid gap-4">
      <OccupationalMatrixComponent
        data={matrix}
        isDesignatedEmployer={false}
        mode="edit"
        onChange={(updated): void => {
          setStepData('section-d1', updated)
        }}
      />
    </section>
  )
}

export function SectionD2Step(_props: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const trainingSpend = getTrainingSpendData(formState['section-d2'])
  const percentageTotal = trainingSpend.percentages.reduce((sum, value) => sum + value, 0)

  const updateTrainingSpend = (patch: Partial<TrainingSpendData>): void => {
    setStepData('section-d2', {
      ...trainingSpend,
      ...patch,
    })
  }

  return (
    <section aria-label="Section D training spend" className="grid gap-4">
      <label className="grid gap-1">
        <span className="text-sm font-medium">Total training budget (ZAR)</span>
        <input
          aria-label="Total training budget (ZAR)"
          className="rounded border border-slate-300 px-3 py-2"
          min={0}
          onChange={(event): void => {
            updateTrainingSpend({ totalBudget: Number(event.target.value) })
          }}
          type="number"
          value={trainingSpend.totalBudget}
        />
      </label>
      <PercentageSliders
        groups={trainingSpendGroups}
        onChange={(values): void => {
          updateTrainingSpend({ percentages: values })
        }}
        values={trainingSpend.percentages}
      />
      {percentageTotal === 100 ? null : (
        <p className="text-sm text-red-700">Percentages must sum to 100%</p>
      )}
      <label className="grid gap-1">
        <span className="text-sm font-medium">Training spend narrative</span>
        <textarea
          aria-label="Training spend narrative"
          className="min-h-28 rounded border border-slate-300 px-3 py-2"
          maxLength={500}
          onChange={(event): void => {
            updateTrainingSpend({ narrative: event.target.value })
          }}
          value={trainingSpend.narrative}
        />
        <span className="text-xs text-slate-600">{trainingSpend.narrative.length} / 500</span>
      </label>
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
  'section-c1': {
    sectionKey: 'sectionC.current',
    component: SectionC1Step,
    validationSchema: SECTION_C_MATRIX_SCHEMA,
    requiresHITL: false,
  },
  'section-c2': {
    sectionKey: 'sectionC.goals',
    component: SectionC2Step,
    validationSchema: SECTION_C_MATRIX_SCHEMA,
    requiresHITL: false,
  },
  'section-d1': {
    sectionKey: 'sectionD.trained',
    component: SectionD1Step,
    validationSchema: SECTION_C_MATRIX_SCHEMA,
    requiresHITL: false,
  },
  'section-d2': {
    sectionKey: 'sectionD.trainingSpend',
    component: SectionD2Step,
    validationSchema: SECTION_D_TRAINING_SPEND_SCHEMA,
    requiresHITL: false,
  },
  'section-e-sector-targets': {
    sectionKey: 'sectionE.promotions',
    component: SectionEPromotionsStep,
    validationSchema: SECTION_E_PROMOTIONS_SCHEMA,
    requiresHITL: false,
  },
  'section-e-next-year-targets': {
    sectionKey: 'sectionE.annualTargetsNextYear',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-f-consultation': {
    sectionKey: 'sectionF.terminations',
    component: SectionFTerminationsStep,
    validationSchema: SECTION_F_TERMINATIONS_SCHEMA,
    requiresHITL: false,
  },
  'section-f-barriers': {
    sectionKey: 'sectionF.barriers',
    component: PlaceholderStep,
    validationSchema: placeholderSchema,
    requiresHITL: false,
  },
  'section-g-monitoring': {
    sectionKey: 'sectionG.skillsDevelopment',
    component: SectionGSkillsDevStep,
    validationSchema: SECTION_G_SKILLS_SCHEMA,
    requiresHITL: false,
  },
  'section-h-declaration': {
    sectionKey: 'sectionH.accommodationRequests',
    component: SectionH1AccommodationStep,
    validationSchema: SECTION_H1_ACCOMMODATION_SCHEMA,
    requiresHITL: true,
  },
  'section-h-hitl': {
    sectionKey: 'sectionH.accessibilityAssessment',
    component: SectionH2AccessibilityStep,
    validationSchema: SECTION_H2_ACCESSIBILITY_SCHEMA,
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

export { getOccupationalMatrixTotal } from './wizard-step-registry-helpers'
