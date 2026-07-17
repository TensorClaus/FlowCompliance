import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import React from 'react'
import { describe, expect, it } from 'vitest'
import { EEA13Form } from '../eea13-form'
import {
  countDesignatedFromRows,
  sumForeignNationals,
} from '../sections/eea13-step-workforce-analysis'
import { server } from '@/test/server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FORM_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const TENANT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

function autosaveHandler() {
  return http.post('/api/event-store/append', () =>
    HttpResponse.json({
      success: true,
      eventId: crypto.randomUUID(),
      newVersion: 1,
      projectionSyncTriggered: false,
    }),
  )
}

function inputValue(element: HTMLElement): string {
  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError('Expected an input element')
  }
  return element.value
}

function renderForm(props: Partial<React.ComponentProps<typeof EEA13Form>> = {}) {
  return render(
    <EEA13Form
      autosaveEndpoint="/api/event-store/append"
      formId={FORM_ID}
      tenantId={TENANT_ID}
      {...props}
    />,
  )
}

async function navigateToYearlyPlans(user: ReturnType<typeof userEvent.setup>) {
  // Must select sector first to unlock step 3
  const select = screen.getByTestId('eea13-sector-select')
  await user.selectOptions(select, 'manufacturing')

  const step3 = screen.getByRole('button', { name: /step 3/i })
  await user.click(step3)
}

// ---------------------------------------------------------------------------
// Sector gate tests
// ---------------------------------------------------------------------------

describe('EEA13Form — sector gate', () => {
  it('renders the form shell', () => {
    renderForm()
    expect(screen.getByTestId('eea13-form-shell')).toBeInTheDocument()
  })

  it('shows sector-required error when no sector selected', () => {
    renderForm()
    expect(screen.getByTestId('eea13-sector-required-error')).toBeInTheDocument()
  })

  it('step 3 (Yearly Plans) nav button is disabled when no sector selected', () => {
    renderForm()
    // Step 3 is index 2, label "Step 3 — Yearly Plans"
    const stepButton = screen.getByRole('button', { name: /step 3/i })
    expect(stepButton).toBeDisabled()
  })

  it('step 3 nav button unlocks after selecting a sector', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    const select = screen.getByTestId('eea13-sector-select')
    await user.selectOptions(select, 'agriculture')

    const stepButton = screen.getByRole('button', { name: /step 3/i })
    expect(stepButton).not.toBeDisabled()
  })

  it('sector gate banner disappears after selecting a sector', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByTestId('eea13-sector-gate-banner')).toBeInTheDocument()

    const select = screen.getByTestId('eea13-sector-select')
    await user.selectOptions(select, 'manufacturing')

    expect(screen.queryByTestId('eea13-sector-gate-banner')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Plan period tests
// ---------------------------------------------------------------------------

describe('EEA13Form — plan period', () => {
  it('auto-suggests end date as start + 5 years when start date is set', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    const startInput = screen.getByTestId('eea13-period-start')
    await user.type(startInput, '2025-01-01')

    // End date should be auto-suggested as 2030-01-01
    const endInput = screen.getByTestId('eea13-period-end')
    expect(inputValue(endInput)).toBe('2030-01-01')
  })

  it('shows exact schema refine message for a 4-year span', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    const startInput = screen.getByTestId('eea13-period-start')
    const endInput = screen.getByTestId('eea13-period-end')

    await user.type(startInput, '2025-01-01')
    // Clear auto-suggested end date and set a 4-year span
    await user.clear(endInput)
    await user.type(endInput, '2029-01-01')

    const error = screen.getByTestId('eea13-period-error')
    expect(error).toBeInTheDocument()
    expect(error).toHaveTextContent('Plan period must span 5 years (EEA s.20(2)(b))')
  })

  it('shows no period error for a valid 5-year span', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    const startInput = screen.getByTestId('eea13-period-start')
    // auto-suggest fires; end date becomes 2030-01-01 (1826 days — within 1795–1857)
    await user.type(startInput, '2025-01-01')

    expect(screen.queryByTestId('eea13-period-error')).not.toBeInTheDocument()
  })

  it('shows live day count indicator when both dates are set', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    const startInput = screen.getByTestId('eea13-period-start')
    await user.type(startInput, '2025-01-01')

    expect(screen.getByTestId('eea13-period-day-count')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Consultation banner tests
// ---------------------------------------------------------------------------

describe('EEA13Form — consultation banner', () => {
  it('shows the blocking banner when consultedWithEmployees is false (initial state)', () => {
    renderForm()
    expect(screen.getByTestId('eea13-consultation-banner')).toBeInTheDocument()
  })

  it('banner has no dismiss control', () => {
    renderForm()
    const banner = screen.getByTestId('eea13-consultation-banner')
    // No button inside the banner
    const dismissButtons = banner.querySelectorAll('button')
    expect(dismissButtons).toHaveLength(0)
  })

  it('banner disappears when consultedWithEmployees is checked', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByTestId('eea13-consultation-banner')).toBeInTheDocument()

    const checkbox = screen.getByTestId('eea13-consulted-checkbox')
    await user.click(checkbox)

    expect(screen.queryByTestId('eea13-consultation-banner')).not.toBeInTheDocument()
  })

  it('banner reappears when consultedWithEmployees is unchecked again', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    const checkbox = screen.getByTestId('eea13-consulted-checkbox')
    await user.click(checkbox) // check
    expect(screen.queryByTestId('eea13-consultation-banner')).not.toBeInTheDocument()

    await user.click(checkbox) // uncheck
    expect(screen.getByTestId('eea13-consultation-banner')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Workforce prefill tests
// ---------------------------------------------------------------------------

describe('EEA13Form — workforce prefill math', () => {
  it('countDesignatedFromRows: African male counts as designated (race A)', () => {
    const rows = [{ race: 'A', gender: 'M', disability: false, count: 10 }]
    expect(countDesignatedFromRows(rows)).toBe(10)
  })

  it('countDesignatedFromRows: Coloured female counts once (not double-counted)', () => {
    const rows = [{ race: 'C', gender: 'F', disability: false, count: 5 }]
    expect(countDesignatedFromRows(rows)).toBe(5)
  })

  it('countDesignatedFromRows: White male without disability is NOT designated', () => {
    const rows = [{ race: 'W', gender: 'M', disability: false, count: 3 }]
    expect(countDesignatedFromRows(rows)).toBe(0)
  })

  it('countDesignatedFromRows: White male with disability IS designated', () => {
    const rows = [{ race: 'W', gender: 'M', disability: true, count: 2 }]
    expect(countDesignatedFromRows(rows)).toBe(2)
  })

  it('countDesignatedFromRows: White female is designated (gender F)', () => {
    const rows = [{ race: 'W', gender: 'F', disability: false, count: 4 }]
    expect(countDesignatedFromRows(rows)).toBe(4)
  })

  it('countDesignatedFromRows: Indian male without disability IS designated (race I)', () => {
    const rows = [{ race: 'I', gender: 'M', disability: false, count: 7 }]
    expect(countDesignatedFromRows(rows)).toBe(7)
  })

  it('countDesignatedFromRows: mixed rows — fixture matching EEA12 decompose shape', () => {
    // Simulates: 10 African Male (designated by race), 3 White Male (not designated),
    // 2 White Female (designated by gender), 1 White Male disability (designated by disability)
    const rows = [
      { race: 'A', gender: 'M', disability: false, count: 10 },
      { race: 'W', gender: 'M', disability: false, count: 3 },
      { race: 'W', gender: 'F', disability: false, count: 2 },
      { race: 'W', gender: 'M', disability: true, count: 1 },
    ]
    // Designated: 10 + 0 + 2 + 1 = 13
    expect(countDesignatedFromRows(rows)).toBe(13)
  })

  it('sumForeignNationals: sums all level counts', () => {
    const fn = [
      { level: 'topManagement', count: 2 },
      { level: 'semiSkilled', count: 3 },
    ]
    expect(sumForeignNationals(fn)).toBe(5)
  })

  it('sumForeignNationals: returns 0 for empty array', () => {
    expect(sumForeignNationals([])).toBe(0)
  })

  it('prefills workforce fields from EEA12 prefill source', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()

    const prefill = {
      rows: [
        { race: 'A', gender: 'M', disability: false, count: 10 },
        { race: 'W', gender: 'M', disability: false, count: 5 },
        { race: 'C', gender: 'F', disability: false, count: 3 },
      ],
      foreignNationals: [{ level: 'semiSkilled', count: 4 }],
      periodLabel: '2025-01-01 – 2025-12-31',
    }

    renderForm({ linkedEEA12Prefill: prefill })

    // Navigate to step 2 (Workforce Analysis)
    const step2 = screen.getByRole('button', { name: /step 2/i })
    await user.click(step2)

    // totalEmployees = 10 + 5 + 3 + 4 = 22
    const totalInput = screen.getByTestId('eea13-total-employees')
    expect(inputValue(totalInput)).toBe('22')

    // designatedEmployees = A/M (10, race A) + C/F (3, race C + gender F = 3) = 13
    // White male non-disabled = 0; foreignNationals not in rows
    const designatedInput = screen.getByTestId('eea13-designated-employees')
    expect(inputValue(designatedInput)).toBe('13')

    // foreignNationals = 4
    const fnInput = screen.getByTestId('eea13-foreign-nationals')
    expect(inputValue(fnInput)).toBe('4')
  })

  it('shows prefill provenance caption when EEA12 prefill is provided', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()

    const prefill = {
      rows: [{ race: 'A', gender: 'M', disability: false, count: 5 }],
      foreignNationals: [],
      periodLabel: '2025-01-01 – 2025-12-31',
    }

    renderForm({ linkedEEA12Prefill: prefill })

    const step2 = screen.getByRole('button', { name: /step 2/i })
    await user.click(step2)

    const notice = screen.getByTestId('eea13-workforce-prefill-notice')
    expect(notice).toBeInTheDocument()
    expect(notice).toHaveTextContent('2025-01-01 – 2025-12-31')
  })
})

// ---------------------------------------------------------------------------
// Yearly plans bounded 3–5 tests
// ---------------------------------------------------------------------------

describe('EEA13Form — yearly plans bounds', () => {
  it('starts with 3 plan year entries', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()
    await navigateToYearlyPlans(user)

    expect(screen.getByTestId('eea13-plan-year-1')).toBeInTheDocument()
    expect(screen.getByTestId('eea13-plan-year-2')).toBeInTheDocument()
    expect(screen.getByTestId('eea13-plan-year-3')).toBeInTheDocument()
    expect(screen.queryByTestId('eea13-plan-year-4')).not.toBeInTheDocument()
  })

  it('add button is enabled when fewer than 5 entries', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()
    await navigateToYearlyPlans(user)

    expect(screen.getByTestId('eea13-add-year')).not.toBeDisabled()
  })

  it('can add a year entry up to 5', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()
    await navigateToYearlyPlans(user)

    await user.click(screen.getByTestId('eea13-add-year'))
    expect(screen.getByTestId('eea13-plan-year-4')).toBeInTheDocument()

    await user.click(screen.getByTestId('eea13-add-year'))
    expect(screen.getByTestId('eea13-plan-year-5')).toBeInTheDocument()
  })

  it('add button is disabled at 5 entries', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()
    await navigateToYearlyPlans(user)

    await user.click(screen.getByTestId('eea13-add-year'))
    await user.click(screen.getByTestId('eea13-add-year'))

    expect(screen.getByTestId('eea13-add-year')).toBeDisabled()
    expect(screen.getByTestId('eea13-add-year-max-hint')).toBeInTheDocument()
  })

  it('remove buttons absent when at minimum 3 entries', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()
    await navigateToYearlyPlans(user)

    // At min (3), no remove buttons shown
    expect(screen.queryByTestId('eea13-remove-year-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('eea13-remove-year-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('eea13-remove-year-3')).not.toBeInTheDocument()
  })

  it('remove buttons appear when above minimum, and remove reduces count', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()
    await navigateToYearlyPlans(user)

    await user.click(screen.getByTestId('eea13-add-year'))
    // Now at 4 entries — remove buttons should appear
    expect(screen.getByTestId('eea13-remove-year-1')).toBeInTheDocument()

    await user.click(screen.getByTestId('eea13-remove-year-1'))
    // Back to 3 entries
    expect(screen.queryByTestId('eea13-plan-year-4')).not.toBeInTheDocument()
    expect(screen.queryByTestId('eea13-remove-year-1')).not.toBeInTheDocument()
  })

  it('prevents duplicate year selection (option is disabled when already used)', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()
    await navigateToYearlyPlans(user)

    // Year 1 select should have 2025 selected by default.
    // Year 2 select's 2025 option should be disabled.
    // Find year-select-2
    const yearSelect2 = screen.getByTestId('eea13-year-select-2')
    const option2025InSelect2 = yearSelect2.querySelector(
      'option[value="2025"]',
    ) as HTMLOptionElement
    expect(option2025InSelect2.disabled).toBe(true)
  })
})
