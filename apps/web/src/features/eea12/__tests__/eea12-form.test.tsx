import type { OccupationalMatrix } from '@simplifi/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import React from 'react'
import { describe, expect, it } from 'vitest'
import { EEA12Form } from '../eea12-form'
import { server } from '@/test/server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mustFind<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new TypeError('Expected value to be defined')
  }
  return value
}

function makeCell(value: number) {
  return { value, percent: 0 }
}

function makeEmptyRow() {
  return {
    africanMale: makeCell(0),
    africanFemale: makeCell(0),
    colouredMale: makeCell(0),
    colouredFemale: makeCell(0),
    indianMale: makeCell(0),
    indianFemale: makeCell(0),
    whiteMale: makeCell(0),
    whiteFemale: makeCell(0),
    foreignNationalMale: makeCell(0),
    foreignNationalFemale: makeCell(0),
    total: makeCell(0),
  }
}

function makeMatrix(overrides: Partial<OccupationalMatrix> = {}): OccupationalMatrix {
  return {
    topManagement: makeEmptyRow(),
    seniorManagement: makeEmptyRow(),
    professionallyQualified: makeEmptyRow(),
    skilledTechnical: makeEmptyRow(),
    semiSkilled: makeEmptyRow(),
    unskilled: makeEmptyRow(),
    totalPermanent: makeEmptyRow(),
    temporaryEmployees: makeEmptyRow(),
    grandTotal: makeEmptyRow(),
    ...overrides,
  }
}

const FORM_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

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

function renderForm(props: Partial<React.ComponentProps<typeof EEA12Form>> = {}) {
  return render(
    <EEA12Form
      formId={FORM_ID}
      tenantId={TENANT_ID}
      autosaveEndpoint="/api/event-store/append"
      {...props}
    />,
  )
}

// ---------------------------------------------------------------------------
// Reporting period tests
// ---------------------------------------------------------------------------

describe('EEA12Form — reporting period', () => {
  it('renders the reporting period picker', () => {
    renderForm()
    expect(screen.getByTestId('eea12-reporting-period')).toBeInTheDocument()
    expect(screen.getByLabelText(/reporting period start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reporting period end date/i)).toBeInTheDocument()
  })

  it('shows a period error when end date is before start date', async () => {
    const user = userEvent.setup()
    renderForm()

    const startInput = screen.getByLabelText(/reporting period start date/i)
    const endInput = screen.getByLabelText(/reporting period end date/i)

    await user.type(startInput, '2025-10-01')
    await user.type(endInput, '2025-09-30')

    expect(screen.getByTestId('eea12-period-error')).toBeInTheDocument()
    expect(screen.getByTestId('eea12-period-error')).toHaveTextContent(/endDate must be after/i)
  })

  it('clears the period error when end date is corrected to be after start date', async () => {
    const user = userEvent.setup()
    renderForm()

    const startInput = screen.getByLabelText(/reporting period start date/i)
    const endInput = screen.getByLabelText(/reporting period end date/i)

    // Set invalid period first
    await user.type(startInput, '2025-10-01')
    await user.type(endInput, '2025-09-30')
    expect(screen.getByTestId('eea12-period-error')).toBeInTheDocument()

    // Fix end date
    await user.clear(endInput)
    await user.type(endInput, '2026-09-30')
    expect(screen.queryByTestId('eea12-period-error')).not.toBeInTheDocument()
  })

  it('disables the footer Next button when the period is invalid', async () => {
    const user = userEvent.setup()
    renderForm()

    const startInput = screen.getByLabelText(/reporting period start date/i)
    const endInput = screen.getByLabelText(/reporting period end date/i)

    await user.type(startInput, '2025-10-01')
    await user.type(endInput, '2025-09-01')

    // The footer Next button is disabled when periodValid is false
    const footerNextButtons = screen
      .getAllByRole('button', { name: /^next$/i })
      .filter((btn) => btn.closest('footer') !== null)
    expect(footerNextButtons.length).toBeGreaterThan(0)
    for (const btn of footerNextButtons) {
      expect(btn).toBeDisabled()
    }
  })
})

// ---------------------------------------------------------------------------
// Section A — Barriers analysis tests
// ---------------------------------------------------------------------------

describe('EEA12Form — Section A barriers', () => {
  it('renders the Section A panel on initial load', () => {
    renderForm()
    expect(screen.getByTestId('eea12-section-a')).toBeInTheDocument()
  })

  it('shows the nil-return button only when the entry list is empty', () => {
    renderForm()
    expect(screen.getByTestId('eea12-nil-return-btn')).toBeInTheDocument()
  })

  it('inserts a nil-return entry when the nil-return button is clicked on an empty list', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('eea12-nil-return-btn'))

    // Entry appeared
    const entries = screen.getByTestId('eea12-section-a-entries')
    expect(entries.children).toHaveLength(1)

    // Nil-return button disappears (list is no longer empty)
    expect(screen.queryByTestId('eea12-nil-return-btn')).not.toBeInTheDocument()
  })

  it('does NOT show the nil-return button when entries already exist', async () => {
    const user = userEvent.setup()
    renderForm()

    // Add a barrier to make the list non-empty
    await user.click(screen.getByTestId('eea12-add-barrier-btn'))

    expect(screen.queryByTestId('eea12-nil-return-btn')).not.toBeInTheDocument()
  })

  it('shows min-1 error when list is empty', () => {
    renderForm()
    expect(screen.getByTestId('eea12-section-a-min1-error')).toBeInTheDocument()
  })

  it('hides min-1 error once an entry is added', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('eea12-add-barrier-btn'))

    expect(screen.queryByTestId('eea12-section-a-min1-error')).not.toBeInTheDocument()
  })

  it('can add multiple barrier entries', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('eea12-add-barrier-btn'))
    await user.click(screen.getByTestId('eea12-add-barrier-btn'))

    const entries = screen.getByTestId('eea12-section-a-entries')
    expect(entries.children).toHaveLength(2)
  })

  it('remove button is absent when only one entry exists', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('eea12-add-barrier-btn'))

    // Only one entry — no remove button
    expect(screen.queryByRole('button', { name: /remove barrier entry/i })).not.toBeInTheDocument()
  })

  it('remove button appears and removes entry when more than one entry exists', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('eea12-add-barrier-btn'))
    await user.click(screen.getByTestId('eea12-add-barrier-btn'))

    const removeButtons = screen.getAllByRole('button', { name: /remove barrier entry/i })
    expect(removeButtons).toHaveLength(2)

    await user.click(mustFind(removeButtons[0]))

    const entries = screen.getByTestId('eea12-section-a-entries')
    expect(entries.children).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Section B — Workforce profile tests
// ---------------------------------------------------------------------------

describe('EEA12Form — Section B workforce profile', () => {
  it('navigates to Section B via step nav', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()

    // Set valid period first so navigation works
    renderForm()

    // Set valid dates so navigation is enabled
    await user.type(screen.getByLabelText(/reporting period start date/i), '2025-01-01')
    await user.type(screen.getByLabelText(/reporting period end date/i), '2025-12-31')

    // Click step button 2
    const stepButtons = screen.getAllByRole('button', { name: /section b/i })
    await user.click(mustFind(stepButtons[0]))

    expect(screen.getByTestId('eea12-section-b')).toBeInTheDocument()
  })

  it('prefills workforce rows from linked EEA2 matrices', async () => {
    server.use(autosaveHandler())

    const workforce = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanMale: makeCell(4),
        total: makeCell(4),
      },
    })
    const disability = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanMale: makeCell(1),
        total: makeCell(1),
      },
    })

    const user = userEvent.setup()
    renderForm({ linkedEEA2Workforce: workforce, linkedEEA2Disability: disability })

    // Set valid period
    await user.type(screen.getByLabelText(/reporting period start date/i), '2025-01-01')
    await user.type(screen.getByLabelText(/reporting period end date/i), '2025-12-31')

    // Navigate to Section B
    const stepButton2 = mustFind(screen.getAllByRole('button', { name: /section b/i })[0])
    await user.click(stepButton2)

    // Rows should be prefilled from decomposition
    const rowsContainer = screen.getByTestId('eea12-section-b-rows')
    // Should have 2 rows: disability:true (count 1) and disability:false (count 3)
    expect(rowsContainer.children.length).toBeGreaterThanOrEqual(2)
  })

  it('shows divergence warning when row counts differ from EEA2 source', async () => {
    server.use(autosaveHandler())

    const workforce = makeMatrix({
      topManagement: {
        ...makeEmptyRow(),
        africanMale: makeCell(5),
        total: makeCell(5),
      },
    })

    const user = userEvent.setup()
    renderForm({ linkedEEA2Workforce: workforce, linkedEEA2Disability: makeMatrix() })

    // Set valid period
    await user.type(screen.getByLabelText(/reporting period start date/i), '2025-01-01')
    await user.type(screen.getByLabelText(/reporting period end date/i), '2025-12-31')

    // Navigate to Section B
    const stepButton2 = mustFind(screen.getAllByRole('button', { name: /section b/i })[0])
    await user.click(stepButton2)

    // Edit a count spinbutton to diverge from source
    const countInputs = screen.getAllByRole('spinbutton')
    expect(countInputs.length).toBeGreaterThan(0)

    // Change first count from 5 to 3 (diverges from EEA2 source total of 5)
    const firstCountInput = mustFind(countInputs[0])
    await user.clear(firstCountInput)
    await user.type(firstCountInput, '3')

    // Divergence warning should appear
    const warning = await screen.findByTestId('eea12-divergence-warning')
    expect(warning).toBeInTheDocument()

    // Warning names the level
    const levelText = within(warning).getByTestId('eea12-divergence-levels')
    expect(levelText.textContent).toMatch(/Top Management/i)
  })

  it('shows foreign national info note when source matrix has foreign nationals', async () => {
    server.use(autosaveHandler())

    const workforce = makeMatrix({
      semiSkilled: {
        ...makeEmptyRow(),
        foreignNationalMale: makeCell(3),
        foreignNationalFemale: makeCell(2),
        total: makeCell(5),
      },
    })

    const user = userEvent.setup()
    renderForm({ linkedEEA2Workforce: workforce, linkedEEA2Disability: makeMatrix() })

    // Set valid period
    await user.type(screen.getByLabelText(/reporting period start date/i), '2025-01-01')
    await user.type(screen.getByLabelText(/reporting period end date/i), '2025-12-31')

    // Navigate to Section B
    const stepButton2 = mustFind(screen.getAllByRole('button', { name: /section b/i })[0])
    await user.click(stepButton2)

    const note = screen.getByTestId('eea12-foreign-nationals-note')
    expect(note).toBeInTheDocument()
    expect(note).toHaveTextContent('5')
    expect(note).toHaveTextContent('rule_eea_006')
  })

  it('does not show foreign national info note when no foreign nationals in source', async () => {
    server.use(autosaveHandler())

    const workforce = makeMatrix({
      unskilled: {
        ...makeEmptyRow(),
        whiteMale: makeCell(2),
        total: makeCell(2),
      },
    })

    const user = userEvent.setup()
    renderForm({ linkedEEA2Workforce: workforce, linkedEEA2Disability: makeMatrix() })

    await user.type(screen.getByLabelText(/reporting period start date/i), '2025-01-01')
    await user.type(screen.getByLabelText(/reporting period end date/i), '2025-12-31')

    const stepButton2 = mustFind(screen.getAllByRole('button', { name: /section b/i })[0])
    await user.click(stepButton2)

    expect(screen.queryByTestId('eea12-foreign-nationals-note')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Section C stub
// ---------------------------------------------------------------------------

describe('EEA12Form — Section C EAP comparison', () => {
  it('renders the Section C EAP comparison when navigated to step 3', async () => {
    server.use(autosaveHandler())
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/reporting period start date/i), '2025-01-01')
    await user.type(screen.getByLabelText(/reporting period end date/i), '2025-12-31')

    const step3Button = mustFind(screen.getAllByRole('button', { name: /section c/i })[0])
    await user.click(step3Button)

    expect(screen.getByTestId('eea12-section-c')).toBeInTheDocument()
    expect(screen.getByTestId('eea12-section-c-table')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

describe('EEA12Form — shell', () => {
  it('renders the form shell with the form ID', () => {
    renderForm()
    expect(screen.getByTestId('eea12-form-shell')).toBeInTheDocument()
    expect(screen.getByText(FORM_ID)).toBeInTheDocument()
  })
})
