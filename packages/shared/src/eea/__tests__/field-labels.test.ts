import { describe, expect, it } from 'vitest'
import { FIELD_LABELS } from '../field-labels.js'
import { PII_FIELD_PATHS } from '../pii-fields.js'

describe('FIELD_LABELS', () => {
  it('provides a human-readable label for every EEA2 section A-H fieldPath prefix', () => {
    const sections = [
      'sectionA',
      'sectionB',
      'sectionC',
      'sectionD',
      'sectionE',
      'sectionF',
      'sectionG',
      'sectionH',
    ]
    for (const section of sections) {
      const hasSectionKey = Object.keys(FIELD_LABELS).some((key) => key.startsWith(`${section}.`))
      expect(hasSectionKey).toBe(true)
    }
  })

  it('labels the workflow/lifecycle fields shown in audit history', () => {
    expect(FIELD_LABELS.formStatus).toBe('Form status')
    expect(FIELD_LABELS.submissionReference).toBe('DoL submission reference')
  })

  it('labels the demographic PII fields that TimelineEntry is guarded to display', () => {
    // TimelineEntry falls back to the raw fieldPath when no label exists, so
    // the demographic PII fields flagged for display (race, gender,
    // disability) must have a label rather than leaking a raw key name into
    // the audit UI.
    const topLevelPiiFields = PII_FIELD_PATHS.filter((path) => !path.includes('.'))
    const labelledPiiFields = topLevelPiiFields.filter((path) => path in FIELD_LABELS)

    expect(labelledPiiFields.sort()).toEqual(['disability', 'gender', 'race'])
  })

  it('has no empty-string label values', () => {
    for (const label of Object.values(FIELD_LABELS)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate label values across distinct fieldPaths', () => {
    const values = Object.values(FIELD_LABELS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})
