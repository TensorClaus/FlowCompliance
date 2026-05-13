import { OccupationalMatrixSchema, type OccupationalMatrix } from '@simplifi/shared'
import { z } from 'zod'
import { useWizardFormController } from '../../wizard-form-context'
import { getOccupationalMatrix } from '../../wizard-step-registry-helpers'
import type { StepProps } from '../../wizard-types'
import { OccupationalMatrix as OccupationalMatrixComponent } from '../occupational-matrix/OccupationalMatrix'

const NARRATIVE_MAX = 500

export interface SectionGSkillsData {
  matrix: OccupationalMatrix
  wspSubmitted: boolean
  narrative: string
}

export const SECTION_G_SKILLS_SCHEMA = z.object({
  matrix: OccupationalMatrixSchema,
  wspSubmitted: z.boolean(),
  narrative: z.string().max(NARRATIVE_MAX).optional(),
})

function getSkillsData(value: unknown): SectionGSkillsData {
  const partial =
    typeof value === 'object' && value !== null ? (value as Partial<SectionGSkillsData>) : {}
  return {
    matrix: getOccupationalMatrix(partial.matrix),
    wspSubmitted: partial.wspSubmitted === true,
    narrative: typeof partial.narrative === 'string' ? partial.narrative : '',
  }
}

export function SectionGSkillsDevStep(_props: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const stepKey = 'section-g-monitoring'
  const data = getSkillsData(formState[stepKey])

  const update = (patch: Partial<SectionGSkillsData>): void => {
    setStepData(stepKey, { ...data, ...patch })
  }

  return (
    <section aria-label="Section G - Skills development" className="grid gap-4">
      {data.wspSubmitted ? null : (
        <div
          className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="wsp-warning-banner"
          role="status"
        >
          A submitted Workplace Skills Plan (WSP) is expected. You can continue without it, but the
          omission will be recorded in this report.
        </div>
      )}
      <OccupationalMatrixComponent
        data={data.matrix}
        isDesignatedEmployer={false}
        mode="edit"
        onChange={(updated): void => {
          update({ matrix: updated })
        }}
      />
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          aria-label="WSP submitted to the SETA"
          checked={data.wspSubmitted}
          onChange={(event): void => {
            update({ wspSubmitted: event.target.checked })
          }}
          type="checkbox"
        />
        Workplace Skills Plan (WSP) submitted to the SETA
      </label>
      <label className="grid gap-1">
        <span className="text-sm font-medium">Skills development narrative (optional)</span>
        <textarea
          aria-label="Skills development narrative"
          className="min-h-28 rounded border border-slate-300 px-3 py-2"
          maxLength={NARRATIVE_MAX}
          onChange={(event): void => {
            update({ narrative: event.target.value })
          }}
          value={data.narrative}
        />
        <span className="text-xs text-slate-600">
          {data.narrative.length} / {NARRATIVE_MAX}
        </span>
      </label>
    </section>
  )
}
