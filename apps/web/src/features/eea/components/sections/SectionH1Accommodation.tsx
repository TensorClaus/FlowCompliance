import { useEffect, useRef } from 'react'
import { z } from 'zod'
import { useWizardFormController } from '../../wizard-form-context'
import type { StepProps } from '../../wizard-types'
import { postFlagEvent } from './flag-events'

const ACCOMMODATION_CATEGORIES = [
  'physical',
  'sensory',
  'intellectual',
  'psychosocial',
  'neurological',
  'multiple',
] as const

type AccommodationCategory = (typeof ACCOMMODATION_CATEGORIES)[number]

const CATEGORY_LABELS: Record<AccommodationCategory, string> = {
  physical: 'Physical',
  sensory: 'Sensory',
  intellectual: 'Intellectual',
  psychosocial: 'Psychosocial',
  neurological: 'Neurological',
  multiple: 'Multiple',
}

export const AccommodationStatusSchema = z.enum(['Granted', 'Denied', 'Pending'])
export type AccommodationStatus = z.infer<typeof AccommodationStatusSchema>

const AccommodationEntrySchema = z.object({
  count: z.number().int().min(0),
  status: AccommodationStatusSchema,
  createdAt: z.string().min(1),
})

export const SECTION_H1_ACCOMMODATION_SCHEMA = z.object({
  physical: AccommodationEntrySchema,
  sensory: AccommodationEntrySchema,
  intellectual: AccommodationEntrySchema,
  psychosocial: AccommodationEntrySchema,
  neurological: AccommodationEntrySchema,
  multiple: AccommodationEntrySchema,
})

export type SectionH1AccommodationData = z.infer<typeof SECTION_H1_ACCOMMODATION_SCHEMA>

const TODAY_ISO = (): string => new Date().toISOString().slice(0, 10)

const emptyEntry = (): SectionH1AccommodationData['physical'] => ({
  count: 0,
  status: 'Granted',
  createdAt: TODAY_ISO(),
})

const emptyAccommodation = (): SectionH1AccommodationData => ({
  physical: emptyEntry(),
  sensory: emptyEntry(),
  intellectual: emptyEntry(),
  psychosocial: emptyEntry(),
  neurological: emptyEntry(),
  multiple: emptyEntry(),
})

function getAccommodationData(value: unknown): SectionH1AccommodationData {
  const parsed = SECTION_H1_ACCOMMODATION_SCHEMA.safeParse(value)
  if (parsed.success) return parsed.data
  const fallback = emptyAccommodation()
  if (typeof value !== 'object' || value === null) return fallback
  const partial = value as Partial<Record<AccommodationCategory, unknown>>
  for (const category of ACCOMMODATION_CATEGORIES) {
    const entryParsed = AccommodationEntrySchema.safeParse(partial[category])
    if (entryParsed.success) {
      fallback[category] = entryParsed.data
    }
  }
  return fallback
}

const TWENTY_ONE_DAYS_MS = 21 * 24 * 60 * 60 * 1000

function hasOverdueRequest(data: SectionH1AccommodationData): boolean {
  const cutoff = Date.now() - TWENTY_ONE_DAYS_MS
  for (const category of ACCOMMODATION_CATEGORIES) {
    const entry = data[category]
    if (entry.status !== 'Pending') continue
    if (entry.count <= 0) continue
    const created = Date.parse(entry.createdAt)
    if (Number.isFinite(created) && created < cutoff) {
      return true
    }
  }
  return false
}

export function SectionH1AccommodationStep({ wizardContext, updateWizardContext }: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const stepKey = 'section-h-declaration'
  const data = getAccommodationData(formState[stepKey])
  const flaggedRef = useRef(wizardContext.accommodationOverdueFlag)

  useEffect(() => {
    flaggedRef.current = wizardContext.accommodationOverdueFlag
  }, [wizardContext.accommodationOverdueFlag])

  const evaluateOverdue = (next: SectionH1AccommodationData): void => {
    if (flaggedRef.current) return
    if (!hasOverdueRequest(next)) return
    flaggedRef.current = true
    updateWizardContext({ accommodationOverdueFlag: true })
    void postFlagEvent({
      eventType: 'ACCOMMODATION_OVERDUE_FLAG',
      fieldPath: 'sectionH.accommodationOverdue',
    })
  }

  const updateEntry = (
    category: AccommodationCategory,
    patch: Partial<SectionH1AccommodationData[AccommodationCategory]>,
  ): void => {
    const next: SectionH1AccommodationData = {
      ...data,
      [category]: { ...data[category], ...patch },
    }
    setStepData(stepKey, next)
    evaluateOverdue(next)
  }

  return (
    <section aria-label="Section H1 - Accommodation requests" className="grid gap-4">
      {wizardContext.accommodationOverdueFlag ? (
        <div
          className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          data-testid="accommodation-overdue-banner"
          role="alert"
        >
          One or more reasonable-accommodation requests have been pending for more than 21 days,
          breaching rule_eea_013. This finding is recorded permanently in the audit log.
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-slate-300 px-3 py-2 text-left">Disability category</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Count</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Status</th>
              <th className="border border-slate-300 px-3 py-2 text-left">Created at</th>
            </tr>
          </thead>
          <tbody>
            {ACCOMMODATION_CATEGORIES.map((category) => {
              const entry = data[category]
              const label = CATEGORY_LABELS[category]
              return (
                <tr key={category}>
                  <th className="border border-slate-300 px-3 py-2 text-left">{label}</th>
                  <td className="border border-slate-300 px-3 py-2">
                    <input
                      aria-label={`${label} count`}
                      className="w-24 rounded border border-slate-300 px-2 py-1"
                      min={0}
                      onChange={(event): void => {
                        updateEntry(category, { count: Number(event.target.value) })
                      }}
                      type="number"
                      value={entry.count}
                    />
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <select
                      aria-label={`${label} status`}
                      className="rounded border border-slate-300 px-2 py-1"
                      onChange={(event): void => {
                        const status = AccommodationStatusSchema.parse(event.target.value)
                        updateEntry(category, { status })
                      }}
                      value={entry.status}
                    >
                      {AccommodationStatusSchema.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    <input
                      aria-label={`${label} created at`}
                      className="rounded border border-slate-300 px-2 py-1"
                      onChange={(event): void => {
                        updateEntry(category, { createdAt: event.target.value })
                      }}
                      type="date"
                      value={entry.createdAt}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
