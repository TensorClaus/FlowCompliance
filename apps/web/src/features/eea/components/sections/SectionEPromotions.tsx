import {
  OCCUPATIONAL_LEVELS,
  OccupationalMatrixSchema,
  type OccupationalMatrix,
} from '@simplifi/shared'
import { z } from 'zod'
import { useWizardFormController } from '../../wizard-form-context'
import {
  createEmptyOccupationalMatrix,
  getOccupationalMatrix,
} from '../../wizard-step-registry-helpers'
import type { StepProps } from '../../wizard-types'
import { OccupationalMatrix as OccupationalMatrixComponent } from '../occupational-matrix/OccupationalMatrix'

export interface SectionEPromotionsData {
  fromLevel: number
  toLevel: number
  matrix: OccupationalMatrix
  noPromotions: boolean
}

export const SECTION_E_PROMOTIONS_SCHEMA = z
  .object({
    fromLevel: z
      .number()
      .int()
      .min(0)
      .max(OCCUPATIONAL_LEVELS.length - 1),
    toLevel: z
      .number()
      .int()
      .min(0)
      .max(OCCUPATIONAL_LEVELS.length - 1),
    matrix: OccupationalMatrixSchema,
    noPromotions: z.boolean(),
  })
  .refine((d) => d.noPromotions || d.matrix.grandTotal.total.value > 0, {
    message: 'Record at least one promotion or confirm no promotions occurred',
  })
  .refine((d) => d.noPromotions || d.toLevel < d.fromLevel, {
    message: 'Promotion target level must be higher seniority than source level',
  })

const emptyPromotions: SectionEPromotionsData = {
  fromLevel: OCCUPATIONAL_LEVELS.length - 1,
  toLevel: 0,
  matrix: createEmptyOccupationalMatrix(),
  noPromotions: false,
}

function getPromotionsData(value: unknown): SectionEPromotionsData {
  const partial =
    typeof value === 'object' && value !== null ? (value as Partial<SectionEPromotionsData>) : {}
  return {
    fromLevel:
      typeof partial.fromLevel === 'number' ? partial.fromLevel : emptyPromotions.fromLevel,
    toLevel: typeof partial.toLevel === 'number' ? partial.toLevel : emptyPromotions.toLevel,
    matrix: getOccupationalMatrix(partial.matrix),
    noPromotions: partial.noPromotions === true,
  }
}

export function SectionEPromotionsStep(_props: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const stepKey = 'section-e-sector-targets'
  const data = getPromotionsData(formState[stepKey])

  const update = (patch: Partial<SectionEPromotionsData>): void => {
    setStepData(stepKey, { ...data, ...patch })
  }

  return (
    <section aria-label="Section E - Promotions" className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">From level</span>
          <select
            aria-label="Promotion from level"
            className="rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            disabled={data.noPromotions}
            onChange={(event): void => {
              update({ fromLevel: Number(event.target.value) })
            }}
            value={data.fromLevel}
          >
            {OCCUPATIONAL_LEVELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">To level</span>
          <select
            aria-label="Promotion to level"
            className="rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100"
            disabled={data.noPromotions}
            onChange={(event): void => {
              update({ toLevel: Number(event.target.value) })
            }}
            value={data.toLevel}
          >
            {OCCUPATIONAL_LEVELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          aria-label="No promotions in reporting period"
          checked={data.noPromotions}
          onChange={(event): void => {
            update({ noPromotions: event.target.checked })
          }}
          type="checkbox"
        />
        No promotions during this reporting period
      </label>
      <div
        aria-disabled={data.noPromotions}
        className={data.noPromotions ? 'pointer-events-none opacity-50' : ''}
      >
        <OccupationalMatrixComponent
          data={data.matrix}
          isDesignatedEmployer={false}
          mode={data.noPromotions ? 'locked' : 'edit'}
          onChange={(updated): void => {
            update({ matrix: updated })
          }}
        />
      </div>
    </section>
  )
}
