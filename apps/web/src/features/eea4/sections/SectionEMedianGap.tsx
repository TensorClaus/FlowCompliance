import { SectionESchema, type SectionE } from '@simplifi/shared'
import { useCallback, useMemo, useState } from 'react'
import { useWizardFormController } from '../../eea/wizard-form-context'
import type { StepProps } from '../../eea/wizard-types'

// ---------------------------------------------------------------------------
// Section E — Median remuneration and income gap ranges
// ---------------------------------------------------------------------------

const STEP_ID = 'eea4-section-e'

const ZERO_SECTION_E: SectionE = {
  median: 0,
  top5pctRange: { lowest: 0, highest: 0 },
  bottom5pctRange: { lowest: 0, highest: 0 },
}

/**
 * Section E is fully section-local: Zod validates ZAR-integer non-negativity,
 * and simple ordering checks enforce band coherence. Cross-form rules stay in
 * the engine — nothing here touches EEA2. All four figures are total annual
 * remuneration in ZAR with no decimals (DC-004).
 */
export type SectionEField =
  | 'median'
  | 'top5.lowest'
  | 'top5.highest'
  | 'bottom5.lowest'
  | 'bottom5.highest'

const FIELD_LABELS: Record<SectionEField, string> = {
  median: 'Median total annual remuneration',
  'top5.lowest': 'Top 5% band — lowest',
  'top5.highest': 'Top 5% band — highest',
  'bottom5.lowest': 'Bottom 5% band — lowest',
  'bottom5.highest': 'Bottom 5% band — highest',
}

const FIELD_ORDER: SectionEField[] = [
  'median',
  'top5.lowest',
  'top5.highest',
  'bottom5.lowest',
  'bottom5.highest',
]

function parseSectionE(value: unknown): SectionE {
  const parsed = SectionESchema.safeParse(value)
  return parsed.success ? parsed.data : ZERO_SECTION_E
}

function readField(section: SectionE, field: SectionEField): number {
  switch (field) {
    case 'median': {
      return section.median
    }
    case 'top5.lowest': {
      return section.top5pctRange.lowest
    }
    case 'top5.highest': {
      return section.top5pctRange.highest
    }
    case 'bottom5.lowest': {
      return section.bottom5pctRange.lowest
    }
    case 'bottom5.highest': {
      return section.bottom5pctRange.highest
    }
  }
}

function writeField(section: SectionE, field: SectionEField, next: number): SectionE {
  switch (field) {
    case 'median': {
      return { ...section, median: next }
    }
    case 'top5.lowest': {
      return { ...section, top5pctRange: { ...section.top5pctRange, lowest: next } }
    }
    case 'top5.highest': {
      return { ...section, top5pctRange: { ...section.top5pctRange, highest: next } }
    }
    case 'bottom5.lowest': {
      return { ...section, bottom5pctRange: { ...section.bottom5pctRange, lowest: next } }
    }
    case 'bottom5.highest': {
      return { ...section, bottom5pctRange: { ...section.bottom5pctRange, highest: next } }
    }
  }
}

/**
 * Section-local validation. Returns a message per offending field. These block
 * section completion but never reach the cross-form engine.
 *
 * Rules:
 *   - Zod: every value is a non-negative integer.
 *   - Within each band: lowest <= highest.
 *   - Bands must not cross: bottom5.highest <= top5.lowest.
 *   - Median must sit between the bands: bottom5.lowest <= median <= top5.highest.
 */
export function validateSectionE(section: SectionE): Partial<Record<SectionEField, string>> {
  const errors: Partial<Record<SectionEField, string>> = {}

  for (const field of FIELD_ORDER) {
    const value = readField(section, field)
    if (!Number.isInteger(value) || value < 0) {
      errors[field] = 'Enter a whole ZAR amount (0 or greater).'
    }
  }

  if (section.top5pctRange.lowest > section.top5pctRange.highest) {
    errors['top5.highest'] = 'Top 5% highest must be at least the lowest.'
  }
  if (section.bottom5pctRange.lowest > section.bottom5pctRange.highest) {
    errors['bottom5.highest'] = 'Bottom 5% highest must be at least the lowest.'
  }
  if (section.bottom5pctRange.highest > section.top5pctRange.lowest) {
    errors['bottom5.highest'] = 'Bottom 5% band must not overlap the top 5% band.'
  }
  if (section.median < section.bottom5pctRange.lowest) {
    errors['median'] = 'Median cannot be below the bottom 5% floor.'
  }
  if (section.median > section.top5pctRange.highest) {
    errors['median'] = 'Median cannot exceed the top 5% ceiling.'
  }

  return errors
}

function toZarInteger(raw: number): number {
  return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : 0
}

export function SectionEMedianGap({ isLocked = false }: StepProps) {
  const { formState, setStepData } = useWizardFormController()
  const [section, setSection] = useState<SectionE>(() => parseSectionE(formState[STEP_ID]))

  const errors = useMemo(() => validateSectionE(section), [section])
  const hasErrors = Object.keys(errors).length > 0

  const handleChange = useCallback((field: SectionEField, raw: number) => {
    setSection((current) => writeField(current, field, toZarInteger(raw)))
  }, [])

  const handleBlur = useCallback(() => {
    setStepData(STEP_ID, section)
  }, [section, setStepData])

  return (
    <section
      aria-label="Section E - Median and income gap"
      className="grid gap-4"
      data-testid="eea4-section-e"
    >
      <span className="sr-only" data-testid="eea4-section-e-stub">
        Section E median and income gap
      </span>
      <p className="text-sm text-slate-600">
        Enter total annual remuneration figures in ZAR (whole rand, no cents). Bands must not
        overlap and the median must sit between them.
      </p>
      <div
        aria-invalid={hasErrors || undefined}
        className="grid gap-3 md:grid-cols-2"
        data-section-complete={hasErrors ? 'false' : 'true'}
        data-testid="eea4-section-e-fields"
      >
        {FIELD_ORDER.map((field) => {
          const errorId = `eea4-section-e-error-${field}`
          const message = errors[field]
          return (
            <label className="grid gap-1" key={field}>
              <span className="text-xs font-medium text-slate-700">{FIELD_LABELS[field]}</span>
              <input
                aria-describedby={message === undefined ? undefined : errorId}
                aria-invalid={message === undefined ? undefined : true}
                aria-label={FIELD_LABELS[field]}
                className="rounded border border-slate-300 px-3 py-2 text-sm aria-[invalid=true]:border-red-400 aria-[invalid=true]:bg-red-50"
                data-field={field}
                data-testid={`eea4-section-e-input-${field}`}
                disabled={isLocked}
                min={0}
                onBlur={handleBlur}
                onChange={(event) => {
                  handleChange(field, event.target.valueAsNumber)
                }}
                step={1}
                type="number"
                value={readField(section, field)}
              />
              {message === undefined ? null : (
                <span className="text-xs text-red-700" data-testid={errorId} id={errorId}>
                  {message}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </section>
  )
}
