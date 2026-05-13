import {
  OccupationalMatrixSchema,
  TerminationReasonSchema,
  type MatrixRow,
  type OccupationalMatrix,
  type TerminationReason,
} from '@simplifi/shared'
import { useEffect, useRef } from 'react'
import { z } from 'zod'
import { useWizardFormController } from '../../wizard-form-context'
import {
  createEmptyOccupationalMatrix,
  getOccupationalMatrix,
} from '../../wizard-step-registry-helpers'
import type { StepProps } from '../../wizard-types'
import { OccupationalMatrix as OccupationalMatrixComponent } from '../occupational-matrix/OccupationalMatrix'
import { postFlagEvent } from './flag-events'

const TERMINATION_ROW_ORDER = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'temporaryEmployees',
] as const

type TerminationRowKey = (typeof TERMINATION_ROW_ORDER)[number]

const ROW_LABELS: Record<TerminationRowKey, string> = {
  topManagement: 'Top management',
  seniorManagement: 'Senior management',
  professionallyQualified: 'Professionally qualified',
  skilledTechnical: 'Skilled technical',
  semiSkilled: 'Semi-skilled',
  unskilled: 'Unskilled',
  temporaryEmployees: 'Temporary employees',
}

const INVOLUNTARY_REASONS = new Set<TerminationReason>([
  'dismissal_misconduct',
  'dismissal_incapacity',
  'retrenchment',
])

const DESIGNATED_COLUMNS: Array<keyof MatrixRow> = [
  'africanMale',
  'africanFemale',
  'colouredMale',
  'colouredFemale',
  'indianMale',
  'indianFemale',
  'whiteFemale',
]

const NON_DESIGNATED_COLUMNS: Array<keyof MatrixRow> = [
  'whiteMale',
  'foreignNationalMale',
  'foreignNationalFemale',
]

export interface SectionFTerminationsData {
  matrix: OccupationalMatrix
  reasonsByRow: Partial<Record<TerminationRowKey, TerminationReason>>
}

export const SECTION_F_TERMINATIONS_SCHEMA = z.object({
  matrix: OccupationalMatrixSchema,
  reasonsByRow: z.record(z.string(), TerminationReasonSchema),
})

const defaultReasons = (): Record<TerminationRowKey, TerminationReason> => ({
  topManagement: 'resignation',
  seniorManagement: 'resignation',
  professionallyQualified: 'resignation',
  skilledTechnical: 'resignation',
  semiSkilled: 'resignation',
  unskilled: 'resignation',
  temporaryEmployees: 'end_of_contract',
})

function getTerminationsData(value: unknown): SectionFTerminationsData {
  const partial =
    typeof value === 'object' && value !== null ? (value as Partial<SectionFTerminationsData>) : {}
  return {
    matrix: getOccupationalMatrix(partial.matrix),
    reasonsByRow: { ...defaultReasons(), ...partial.reasonsByRow },
  }
}

interface BarrierTrigger {
  level: TerminationRowKey
  group: keyof MatrixRow
  designatedRate: number
  nonDesignatedRate: number
}

function detectBarrierTrigger(data: SectionFTerminationsData): BarrierTrigger | null {
  for (const rowKey of TERMINATION_ROW_ORDER) {
    const reason = data.reasonsByRow[rowKey]
    if (reason === undefined || !INVOLUNTARY_REASONS.has(reason)) continue
    const row = data.matrix[rowKey]
    const rowTotal = row.total.value
    if (rowTotal <= 0) continue

    const nonDesignatedInvoluntary = NON_DESIGNATED_COLUMNS.reduce(
      (sum, col) => sum + row[col].value,
      0,
    )
    const nonDesignatedRate = (nonDesignatedInvoluntary / rowTotal) * 100

    for (const group of DESIGNATED_COLUMNS) {
      const designatedRate = (row[group].value / rowTotal) * 100
      if (designatedRate > nonDesignatedRate + 15) {
        return { level: rowKey, group, designatedRate, nonDesignatedRate }
      }
    }
  }
  return null
}

export function SectionFTerminationsStep({ wizardContext, updateWizardContext }: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const stepKey = 'section-f-consultation'
  const data = getTerminationsData(formState[stepKey])
  const flaggedRef = useRef(wizardContext.barrierTerminationFlag)

  useEffect(() => {
    flaggedRef.current = wizardContext.barrierTerminationFlag
  }, [wizardContext.barrierTerminationFlag])

  const evaluateBarrier = (next: SectionFTerminationsData): void => {
    if (flaggedRef.current) return
    const trigger = detectBarrierTrigger(next)
    if (trigger === null) return
    flaggedRef.current = true
    updateWizardContext({ barrierTerminationFlag: true })
    void postFlagEvent({
      eventType: 'BARRIER_TERMINATION_FLAG',
      fieldPath: 'sectionF.terminationBarrier',
      newValue: JSON.stringify({
        level: trigger.level,
        group: trigger.group,
        designatedRate: trigger.designatedRate,
        nonDesignatedRate: trigger.nonDesignatedRate,
      }),
    })
  }

  const update = (patch: Partial<SectionFTerminationsData>): void => {
    const next: SectionFTerminationsData = { ...data, ...patch }
    setStepData(stepKey, next)
    evaluateBarrier(next)
  }

  return (
    <section aria-label="Section F - Terminations" className="grid gap-4">
      {wizardContext.barrierTerminationFlag ? (
        <div
          className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="barrier-termination-banner"
          role="alert"
        >
          Termination patterns indicate a possible affirmative-action barrier. This finding is
          locked into the audit log and must be reviewed by the EE Committee.
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-slate-300 px-3 py-2 text-left">Occupational level</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Termination reason</th>
            </tr>
          </thead>
          <tbody>
            {TERMINATION_ROW_ORDER.map((rowKey) => (
              <tr key={rowKey}>
                <th className="border border-slate-300 px-3 py-2 text-left">
                  {ROW_LABELS[rowKey]}
                </th>
                <td className="border border-slate-300 px-3 py-2">
                  <select
                    aria-label={`${ROW_LABELS[rowKey]} termination reason`}
                    className="rounded border border-slate-300 px-2 py-1"
                    onChange={(event): void => {
                      const value = TerminationReasonSchema.parse(event.target.value)
                      update({
                        reasonsByRow: { ...data.reasonsByRow, [rowKey]: value },
                      })
                    }}
                    value={data.reasonsByRow[rowKey] ?? 'resignation'}
                  >
                    {TerminationReasonSchema.options.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OccupationalMatrixComponent
        data={data.matrix}
        isDesignatedEmployer={false}
        mode="edit"
        onChange={(updated): void => {
          update({ matrix: updated })
        }}
      />
    </section>
  )
}

export const createEmptySectionFTerminationsData = (): SectionFTerminationsData => ({
  matrix: createEmptyOccupationalMatrix(),
  reasonsByRow: defaultReasons(),
})
