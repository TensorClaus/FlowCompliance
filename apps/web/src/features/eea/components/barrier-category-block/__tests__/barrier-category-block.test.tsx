import { BarrierEntrySchema } from '@simplifi/shared'
import type { BarrierEntry, BarriersRemovalPlan } from '@simplifi/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { BarrierCategoryBlock, buildNilReturnEntry } from '../BarrierCategoryBlock'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseEntry: BarrierEntry = {
  category: 'recruitment_procedures',
  description: 'Recruitment processes disadvantage designated groups.',
  severity: 'medium',
  affectedDesignatedGroups: ['designated'],
  mitigationActions: ['Review job posting language'],
  targetCompletionDate: '2026-12-31',
}

const baseRemovalPlan: BarriersRemovalPlan = {
  barrierCategory: 'recruitment_procedures',
  action: 'Revise recruitment policy',
  responsible: 'HR Manager',
  timeline: 'By 2027-06-30',
  measurableOutcome: 'Increase designated group applications by 20%',
}

// ---------------------------------------------------------------------------
// Stateful wrappers
// ---------------------------------------------------------------------------

function AnalysisWrapper({ initial }: { initial: BarrierEntry }) {
  const [value, setValue] = useState(initial)
  return <BarrierCategoryBlock mode="analysis" value={value} onChange={setValue} />
}

function RemovalPlanWrapper({ initial }: { initial: BarriersRemovalPlan }) {
  const [value, setValue] = useState(initial)
  return <BarrierCategoryBlock mode="removal-plan" value={value} onChange={setValue} />
}

// ---------------------------------------------------------------------------
// analysis mode
// ---------------------------------------------------------------------------

describe('BarrierCategoryBlock — analysis mode', () => {
  it('renders all 23 categories in the category select', () => {
    render(<AnalysisWrapper initial={baseEntry} />)
    const select = screen.getByRole('combobox', { name: /barrier category/i })
    const options = within(select).getAllByRole('option')
    expect(options).toHaveLength(23)
  })

  it('includes a known category label in the select options', () => {
    render(<AnalysisWrapper initial={baseEntry} />)
    const select = screen.getByRole('combobox', { name: /barrier category/i })
    const options = within(select).getAllByRole('option')
    const labels = options.map((o) => o.textContent)
    expect(labels).toContain('Recruitment Procedures')
  })

  it('remove mitigation action button is disabled when only 1 action exists', () => {
    render(<AnalysisWrapper initial={baseEntry} />)
    const removeButtons = screen.getAllByRole('button', { name: /remove mitigation action/i })
    expect(removeButtons).toHaveLength(1)
    expect(removeButtons[0]).toBeDisabled()
  })

  it('remove mitigation action button is enabled after adding a second action', async () => {
    const user = userEvent.setup()
    render(<AnalysisWrapper initial={baseEntry} />)

    await user.click(screen.getByRole('button', { name: /add action/i }))

    const removeButtons = screen.getAllByRole('button', { name: /remove mitigation action/i })
    expect(removeButtons).toHaveLength(2)
    for (const btn of removeButtons) {
      expect(btn).not.toBeDisabled()
    }
  })

  it('removing the second action leaves exactly one action and disables remove again', async () => {
    const user = userEvent.setup()
    render(<AnalysisWrapper initial={baseEntry} />)

    await user.click(screen.getByRole('button', { name: /add action/i }))

    let removeButtons = screen.getAllByRole('button', { name: /remove mitigation action/i })
    expect(removeButtons).toHaveLength(2)

    await user.click(removeButtons[1] as HTMLElement)

    removeButtons = screen.getAllByRole('button', { name: /remove mitigation action/i })
    expect(removeButtons).toHaveLength(1)
    expect(removeButtons[0]).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// removal-plan mode
// ---------------------------------------------------------------------------

describe('BarrierCategoryBlock — removal-plan mode', () => {
  it('shows timeline error and aria-invalid when value contains "Ongoing basis"', async () => {
    const user = userEvent.setup()
    render(<RemovalPlanWrapper initial={baseRemovalPlan} />)

    const timelineInput = screen.getByRole('textbox', { name: /timeline/i })
    await user.clear(timelineInput)
    await user.type(timelineInput, 'Ongoing basis')

    expect(timelineInput).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByText('Timeline must be a concrete date or period — "ongoing" is not accepted'),
    ).toBeInTheDocument()
  })

  it('clears error when typing a concrete timeline after an "ongoing" value', async () => {
    const user = userEvent.setup()
    // Start with an invalid timeline
    render(<RemovalPlanWrapper initial={{ ...baseRemovalPlan, timeline: 'Ongoing basis' }} />)

    const timelineInput = screen.getByRole('textbox', { name: /timeline/i })
    expect(timelineInput).toHaveAttribute('aria-invalid', 'true')

    await user.clear(timelineInput)
    await user.type(timelineInput, 'By 2027-06-30')

    expect(timelineInput).toHaveAttribute('aria-invalid', 'false')
    expect(
      screen.queryByText('Timeline must be a concrete date or period — "ongoing" is not accepted'),
    ).not.toBeInTheDocument()
  })

  it('case-insensitive: "ONGOING" also triggers the error', async () => {
    const user = userEvent.setup()
    render(<RemovalPlanWrapper initial={baseRemovalPlan} />)

    const timelineInput = screen.getByRole('textbox', { name: /timeline/i })
    await user.clear(timelineInput)
    await user.type(timelineInput, 'ONGOING')

    expect(timelineInput).toHaveAttribute('aria-invalid', 'true')
    expect(
      screen.getByText('Timeline must be a concrete date or period — "ongoing" is not accepted'),
    ).toBeInTheDocument()
  })

  it('"By 2027-06-30" is clean — no error, aria-invalid false', () => {
    render(<RemovalPlanWrapper initial={baseRemovalPlan} />)
    const timelineInput = screen.getByRole('textbox', { name: /timeline/i })
    expect(timelineInput).toHaveAttribute('aria-invalid', 'false')
    expect(
      screen.queryByText('Timeline must be a concrete date or period — "ongoing" is not accepted'),
    ).not.toBeInTheDocument()
  })

  it('renders all 23 categories in the removal-plan category select', () => {
    render(<RemovalPlanWrapper initial={baseRemovalPlan} />)
    const select = screen.getByRole('combobox', { name: /barrier category/i })
    const options = within(select).getAllByRole('option')
    expect(options).toHaveLength(23)
  })
})

// ---------------------------------------------------------------------------
// summary mode — BarrierEntry
// ---------------------------------------------------------------------------

describe('BarrierCategoryBlock — summary mode (BarrierEntry)', () => {
  it('renders zero interactive elements', () => {
    render(<BarrierCategoryBlock mode="summary" value={baseEntry} />)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('renders the severity chip text', () => {
    render(<BarrierCategoryBlock mode="summary" value={baseEntry} />)
    expect(screen.getByText('medium')).toBeInTheDocument()
  })

  it('renders the category chip text', () => {
    render(<BarrierCategoryBlock mode="summary" value={baseEntry} />)
    expect(screen.getByText('Recruitment Procedures')).toBeInTheDocument()
  })

  it('renders the description', () => {
    render(<BarrierCategoryBlock mode="summary" value={baseEntry} />)
    expect(screen.getByText(baseEntry.description)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// summary mode — BarriersRemovalPlan
// ---------------------------------------------------------------------------

describe('BarrierCategoryBlock — summary mode (BarriersRemovalPlan)', () => {
  it('renders zero interactive elements', () => {
    render(<BarrierCategoryBlock mode="summary" value={baseRemovalPlan} />)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
  })

  it('renders the timeline text', () => {
    render(<BarrierCategoryBlock mode="summary" value={baseRemovalPlan} />)
    expect(screen.getByText('By 2027-06-30')).toBeInTheDocument()
  })

  it('renders the category chip text', () => {
    render(<BarrierCategoryBlock mode="summary" value={baseRemovalPlan} />)
    expect(screen.getByText('Recruitment Procedures')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// buildNilReturnEntry — pure data factory
// ---------------------------------------------------------------------------

describe('buildNilReturnEntry', () => {
  it('parses successfully under BarrierEntrySchema', () => {
    const entry = buildNilReturnEntry()
    const result = BarrierEntrySchema.safeParse(entry)
    expect(result.success).toBe(true)
  })

  it('has category "other"', () => {
    expect(buildNilReturnEntry().category).toBe('other')
  })

  it('has severity "low"', () => {
    expect(buildNilReturnEntry().severity).toBe('low')
  })

  it('has exactly one mitigation action', () => {
    const entry = buildNilReturnEntry()
    expect(entry.mitigationActions).toHaveLength(1)
    expect(entry.mitigationActions[0]).toBe('Continue annual barrier monitoring')
  })

  it('has empty affectedDesignatedGroups', () => {
    expect(buildNilReturnEntry().affectedDesignatedGroups).toHaveLength(0)
  })

  it('has a non-empty description', () => {
    expect(buildNilReturnEntry().description.length).toBeGreaterThan(0)
  })
})
