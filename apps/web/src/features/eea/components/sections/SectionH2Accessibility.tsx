import { z } from 'zod'
import { useWizardFormController } from '../../wizard-form-context'
import type { StepProps } from '../../wizard-types'

const THREE_YEARS_MS = 3 * 365.25 * 24 * 60 * 60 * 1000

export const SECTION_H2_ACCESSIBILITY_SCHEMA = z.object({
  lastAssessmentDate: z.string().min(1, 'Last assessment date is required'),
  nextScheduledDate: z.string().min(1, 'Next scheduled date is required'),
})

export type SectionH2AccessibilityData = z.infer<typeof SECTION_H2_ACCESSIBILITY_SCHEMA>

function getAccessibilityData(value: unknown): SectionH2AccessibilityData {
  const partial =
    typeof value === 'object' && value !== null
      ? (value as Partial<SectionH2AccessibilityData>)
      : {}
  return {
    lastAssessmentDate:
      typeof partial.lastAssessmentDate === 'string' ? partial.lastAssessmentDate : '',
    nextScheduledDate:
      typeof partial.nextScheduledDate === 'string' ? partial.nextScheduledDate : '',
  }
}

function isLastAssessmentStale(isoDate: string): boolean {
  if (isoDate.length === 0) return false
  const parsed = Date.parse(isoDate)
  if (!Number.isFinite(parsed)) return false
  return Date.now() - parsed > THREE_YEARS_MS
}

export function SectionH2AccessibilityStep(_props: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const stepKey = 'section-h-hitl'
  const data = getAccessibilityData(formState[stepKey])
  const showStaleWarning = isLastAssessmentStale(data.lastAssessmentDate)

  const update = (patch: Partial<SectionH2AccessibilityData>): void => {
    setStepData(stepKey, { ...data, ...patch })
  }

  return (
    <section aria-label="Section H2 - Accessibility assessment" className="grid gap-4">
      {showStaleWarning ? (
        <div
          className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          data-testid="accessibility-stale-banner"
          role="status"
        >
          The last accessibility assessment is more than three years old. Schedule a fresh
          assessment under rule_eea_013 before this report cycle closes.
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Last assessment date</span>
          <input
            aria-label="Last assessment date"
            className="rounded border border-slate-300 px-3 py-2"
            onChange={(event): void => {
              update({ lastAssessmentDate: event.target.value })
            }}
            required
            type="date"
            value={data.lastAssessmentDate}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-medium">Next scheduled date</span>
          <input
            aria-label="Next scheduled date"
            className="rounded border border-slate-300 px-3 py-2"
            onChange={(event): void => {
              update({ nextScheduledDate: event.target.value })
            }}
            required
            type="date"
            value={data.nextScheduledDate}
          />
        </label>
      </div>
    </section>
  )
}
