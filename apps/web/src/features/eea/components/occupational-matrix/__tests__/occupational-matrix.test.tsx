import type { MatrixCell, MatrixRow, OccupationalMatrix } from '@simplifi/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OccupationalMatrix as OccupationalMatrixComponent } from '../OccupationalMatrix'
import { computeMatrixTotals } from '../totals'
import { validateOccupationalMatrix } from '../validate'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cell = (value: number): MatrixCell => ({ value })

const zeroRow = (): MatrixRow => ({
  africanMale: cell(0),
  africanFemale: cell(0),
  colouredMale: cell(0),
  colouredFemale: cell(0),
  indianMale: cell(0),
  indianFemale: cell(0),
  whiteMale: cell(0),
  whiteFemale: cell(0),
  foreignNationalMale: cell(0),
  foreignNationalFemale: cell(0),
  total: cell(0),
})

const zeroMatrix = (): OccupationalMatrix => ({
  topManagement: zeroRow(),
  seniorManagement: zeroRow(),
  professionallyQualified: zeroRow(),
  skilledTechnical: zeroRow(),
  semiSkilled: zeroRow(),
  unskilled: zeroRow(),
  totalPermanent: zeroRow(),
  temporaryEmployees: zeroRow(),
  grandTotal: zeroRow(),
})

function withCell(
  matrix: OccupationalMatrix,
  rowKey: keyof OccupationalMatrix,
  colKey: keyof MatrixRow,
  value: number,
): OccupationalMatrix {
  return {
    ...matrix,
    [rowKey]: { ...matrix[rowKey], [colKey]: cell(value) },
  }
}

// Wrapper to render with controlled state
interface WrapperProps {
  initialData?: OccupationalMatrix
  mode?: 'view' | 'edit' | 'validate' | 'locked'
  isDesignatedEmployer?: boolean
  disabilityHeadcount?: number
  onValidationError?: (errs: ReturnType<typeof validateOccupationalMatrix>) => void
}

function Wrapper({
  initialData = zeroMatrix(),
  mode = 'edit',
  isDesignatedEmployer = false,
  disabilityHeadcount = 0,
  onValidationError,
}: WrapperProps) {
  const [data, setData] = useState(initialData)
  return (
    <OccupationalMatrixComponent
      data={data}
      disabilityHeadcount={disabilityHeadcount}
      isDesignatedEmployer={isDesignatedEmployer}
      mode={mode}
      onChange={setData}
      {...(onValidationError ? { onValidationError } : {})}
    />
  )
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useRealTimers()
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
})

// ---------------------------------------------------------------------------
// computeMatrixTotals — pure function unit tests
// ---------------------------------------------------------------------------

describe('computeMatrixTotals', () => {
  it('returns all zeros for a zero matrix', () => {
    const result = computeMatrixTotals(zeroMatrix())
    expect(result.totalPermanent.total.value).toBe(0)
    expect(result.grandTotal.total.value).toBe(0)
    expect(result.grandTotal.africanMale.value).toBe(0)
  })

  it('propagates a single cell into totalPermanent and grandTotal', () => {
    const m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 5)
    const result = computeMatrixTotals(m)
    expect(result.topManagement.total.value).toBe(5)
    expect(result.totalPermanent.africanMale.value).toBe(5)
    expect(result.totalPermanent.total.value).toBe(5)
    expect(result.grandTotal.africanMale.value).toBe(5)
    expect(result.grandTotal.total.value).toBe(5)
  })

  it('full diagonal: each permanent level gets 1 in africanMale → totalPermanent = 6', () => {
    let m = zeroMatrix()
    const permRows = [
      'topManagement',
      'seniorManagement',
      'professionallyQualified',
      'skilledTechnical',
      'semiSkilled',
      'unskilled',
    ] as const
    for (const r of permRows) m = withCell(m, r, 'africanMale', 1)
    const result = computeMatrixTotals(m)
    expect(result.totalPermanent.africanMale.value).toBe(6)
    expect(result.grandTotal.africanMale.value).toBe(6)
  })

  it('temporaryEmployees adds to grandTotal but not totalPermanent', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 4)
    m = withCell(m, 'temporaryEmployees', 'africanMale', 3)
    const result = computeMatrixTotals(m)
    expect(result.totalPermanent.africanMale.value).toBe(4)
    expect(result.grandTotal.africanMale.value).toBe(7)
  })

  it('realistic SME: multiple levels across demographics compute correctly', () => {
    let m = zeroMatrix()
    m = withCell(m, 'topManagement', 'africanMale', 2)
    m = withCell(m, 'topManagement', 'whiteFemale', 1)
    m = withCell(m, 'seniorManagement', 'africanFemale', 3)
    m = withCell(m, 'skilledTechnical', 'colouredMale', 5)
    m = withCell(m, 'temporaryEmployees', 'indianMale', 4)
    const result = computeMatrixTotals(m)
    expect(result.totalPermanent.africanMale.value).toBe(2)
    expect(result.totalPermanent.africanFemale.value).toBe(3)
    expect(result.totalPermanent.colouredMale.value).toBe(5)
    expect(result.totalPermanent.total.value).toBe(11)
    expect(result.grandTotal.indianMale.value).toBe(4)
    expect(result.grandTotal.total.value).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// validateOccupationalMatrix — 8 rules, pass + fail each
// ---------------------------------------------------------------------------

describe('validateOccupationalMatrix', () => {
  const defaultOpts = { isDesignatedEmployer: false, disabilityHeadcount: 0 }

  it('NEGATIVE: passes when all cells are zero', () => {
    const errors = validateOccupationalMatrix(zeroMatrix(), defaultOpts)
    expect(errors.some((e) => e.code === 'NEGATIVE')).toBe(false)
  })

  it('NEGATIVE: fails when a cell has negative value', () => {
    const m = withCell(zeroMatrix(), 'topManagement', 'africanMale', -1)
    const errors = validateOccupationalMatrix(m, defaultOpts)
    expect(errors.some((e) => e.code === 'NEGATIVE')).toBe(true)
  })

  it('NON_INTEGER: passes when all cells are whole numbers', () => {
    const errors = validateOccupationalMatrix(computeMatrixTotals(zeroMatrix()), defaultOpts)
    expect(errors.some((e) => e.code === 'NON_INTEGER')).toBe(false)
  })

  it('NON_INTEGER: fails when a cell has a fractional value', () => {
    const m = withCell(zeroMatrix(), 'semiSkilled', 'whiteFemale', 1.5)
    const errors = validateOccupationalMatrix(m, defaultOpts)
    expect(errors.some((e) => e.code === 'NON_INTEGER')).toBe(true)
  })

  it('FOREIGN_NATIONAL_IN_DESIGNATED: passes when no foreign nationals', () => {
    const errors = validateOccupationalMatrix(computeMatrixTotals(zeroMatrix()), defaultOpts)
    expect(errors.some((e) => e.code === 'FOREIGN_NATIONAL_IN_DESIGNATED')).toBe(false)
  })

  it('FOREIGN_NATIONAL_IN_DESIGNATED: warns when foreign national headcount > 0', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'foreignNationalMale', 2)
    m = computeMatrixTotals(m)
    const errors = validateOccupationalMatrix(m, defaultOpts)
    const fniErr = errors.find((e) => e.code === 'FOREIGN_NATIONAL_IN_DESIGNATED')
    expect(fniErr).toBeDefined()
    expect(fniErr?.severity).toBe('warning')
  })

  it('COLUMN_TOTAL_MISMATCH: passes when totals are correctly computed', () => {
    const m = computeMatrixTotals(withCell(zeroMatrix(), 'skilledTechnical', 'africanMale', 10))
    const errors = validateOccupationalMatrix(m, defaultOpts)
    expect(errors.some((e) => e.code === 'COLUMN_TOTAL_MISMATCH')).toBe(false)
  })

  it('COLUMN_TOTAL_MISMATCH: fails when grandTotal is manually set to wrong value', () => {
    let m = computeMatrixTotals(withCell(zeroMatrix(), 'topManagement', 'africanMale', 5))
    m = withCell(m, 'grandTotal', 'africanMale', 99)
    const errors = validateOccupationalMatrix(m, defaultOpts)
    expect(errors.some((e) => e.code === 'COLUMN_TOTAL_MISMATCH')).toBe(true)
  })

  it('DISABILITY_BELOW_3PCT: passes when disability is exactly 3% of grand total', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 100)
    m = computeMatrixTotals(m)
    const errors = validateOccupationalMatrix(m, {
      isDesignatedEmployer: true,
      disabilityHeadcount: 3,
    })
    expect(errors.some((e) => e.code === 'DISABILITY_BELOW_3PCT')).toBe(false)
  })

  it('DISABILITY_BELOW_3PCT: fails when disability is 1.5% (below 3%)', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 100)
    m = computeMatrixTotals(m)
    const errors = validateOccupationalMatrix(m, {
      isDesignatedEmployer: true,
      disabilityHeadcount: 1,
    })
    expect(errors.some((e) => e.code === 'DISABILITY_BELOW_3PCT')).toBe(true)
  })

  it('DESIGNATED_GROUP_MISSING_TOP4: passes when all top 4 levels have designated employees', () => {
    let m = zeroMatrix()
    for (const r of [
      'topManagement',
      'seniorManagement',
      'professionallyQualified',
      'skilledTechnical',
    ] as const) {
      m = withCell(m, r, 'africanMale', 1)
    }
    m = computeMatrixTotals(m)
    const errors = validateOccupationalMatrix(m, {
      isDesignatedEmployer: true,
      disabilityHeadcount: 0,
    })
    expect(errors.some((e) => e.code === 'DESIGNATED_GROUP_MISSING_TOP4')).toBe(false)
  })

  it('DESIGNATED_GROUP_MISSING_TOP4: warns when top management has zero designated employees', () => {
    const m = computeMatrixTotals(zeroMatrix())
    const errors = validateOccupationalMatrix(m, {
      isDesignatedEmployer: true,
      disabilityHeadcount: 0,
    })
    expect(errors.some((e) => e.code === 'DESIGNATED_GROUP_MISSING_TOP4')).toBe(true)
  })

  it('CELL_EXCEEDS_GRAND_TOTAL: passes when cells are within grand total', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 5)
    m = computeMatrixTotals(m)
    const errors = validateOccupationalMatrix(m, defaultOpts)
    expect(errors.some((e) => e.code === 'CELL_EXCEEDS_GRAND_TOTAL')).toBe(false)
  })

  it('CELL_EXCEEDS_GRAND_TOTAL: fails when a cell value exceeds grand total', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 5)
    m = computeMatrixTotals(m)
    // Manually inject a cell value larger than grand total (simulates import error)
    m = withCell(m, 'seniorManagement', 'whiteMale', 999)
    const errors = validateOccupationalMatrix(m, defaultOpts)
    expect(errors.some((e) => e.code === 'CELL_EXCEEDS_GRAND_TOTAL')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// OccupationalMatrix component — mode rendering
// ---------------------------------------------------------------------------

describe('OccupationalMatrix rendering', () => {
  it('view mode: renders zero inputs (all cells are spans)', () => {
    render(<Wrapper mode="view" />)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('edit mode: renders exactly 70 inputs (7 editable rows × 10 demo cols)', () => {
    render(<Wrapper mode="edit" />)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(70)
  })

  it('validate mode: renders 70 inputs and applies error class to negative cell', () => {
    const m = computeMatrixTotals(withCell(zeroMatrix(), 'topManagement', 'africanMale', -1))
    render(<Wrapper initialData={m} mode="validate" />)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(70)
    const errorCell = document.querySelector('[data-cell="topManagement.africanMale"]')
    expect(errorCell?.classList.contains('cell--error')).toBe(true)
  })

  it('locked mode: renders zero inputs and aria-disabled on wrapper', () => {
    render(<Wrapper mode="locked" />)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
    const wrapper = screen.getByTestId('occupational-matrix')
    expect(wrapper).toHaveAttribute('aria-disabled', 'true')
  })

  it('typing a value in edit mode updates totals in DOM (stateful Wrapper)', async () => {
    const user = userEvent.setup()
    // Wrapper uses useState internally so onChange triggers re-render
    render(<Wrapper mode="edit" />)
    const inputs = screen.getAllByRole('spinbutton')
    await user.clear(inputs[0] as HTMLElement)
    await user.type(inputs[0] as HTMLElement, '7')
    // Row total span (topManagement.total) and grandTotal.africanMale span update
    const rowTotal = document.querySelector('[data-cell="topManagement.total"]')
    expect(rowTotal?.textContent).toBe('7')
    const grandTotalAfrMale = document.querySelector('[data-cell="grandTotal.africanMale"]')
    expect(grandTotalAfrMale?.textContent).toBe('7')
  })

  it('onBlur with eventContext fires autosave when value changes', async () => {
    const user = userEvent.setup()
    const autosaveRequest = vi.fn(() =>
      Promise.resolve({
        ok: true,
        value: { success: true, eventId: 'x', newVersion: 1, projectionSyncTriggered: false },
      } as never),
    )

    // Stateful wrapper so data updates on onChange, making newVal !== prevVal on blur
    function AutosaveWrapper() {
      const [data, setData] = useState(zeroMatrix())
      return (
        <OccupationalMatrixComponent
          data={data}
          isDesignatedEmployer={false}
          mode="edit"
          onChange={setData}
          autosaveOptions={{ request: autosaveRequest, debounceMs: 1 }}
          eventContext={{ tenantId: 't1', formId: 'f1', triggeredBy: 'u1', sessionId: 's1' }}
        />
      )
    }

    render(<AutosaveWrapper />)
    const inputs = screen.getAllByRole('spinbutton')
    await user.click(inputs[0] as HTMLElement) // focus → stores prevVal = 0
    await user.type(inputs[0] as HTMLElement, '3') // onChange fires, state updates to value=3
    await user.tab() // blur → handleCellBlur: prevVal=0 ≠ newVal=3 → autosave queued
    // Wait for 1ms debounce + microtask queue to flush
    await new Promise((r) => setTimeout(r, 50))
    expect(autosaveRequest).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Disability flag banner
// ---------------------------------------------------------------------------

describe('DisabilityFlagBanner', () => {
  it('renders banner when disability is 1.5% (< 3%)', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 100)
    m = computeMatrixTotals(m)
    render(
      <Wrapper initialData={m} isDesignatedEmployer={true} disabilityHeadcount={1} mode="edit" />,
    )
    expect(screen.getByTestId('disability-flag-banner')).toBeInTheDocument()
  })

  it('renders banner when disability is 2.9% (< 3%)', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 100)
    m = computeMatrixTotals(m)
    render(
      <Wrapper initialData={m} isDesignatedEmployer={true} disabilityHeadcount={2} mode="edit" />,
    )
    expect(screen.getByTestId('disability-flag-banner')).toBeInTheDocument()
  })

  it('does NOT render banner when disability is exactly 3%', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 100)
    m = computeMatrixTotals(m)
    render(
      <Wrapper initialData={m} isDesignatedEmployer={true} disabilityHeadcount={3} mode="edit" />,
    )
    expect(screen.queryByTestId('disability-flag-banner')).not.toBeInTheDocument()
  })

  it('does NOT render banner when disability is 4.5% (above 3%)', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 100)
    m = computeMatrixTotals(m)
    render(
      <Wrapper initialData={m} isDesignatedEmployer={true} disabilityHeadcount={5} mode="edit" />,
    )
    expect(screen.queryByTestId('disability-flag-banner')).not.toBeInTheDocument()
  })

  it('banner has NO dismiss affordance (no dismiss testid or data-dismiss attribute)', () => {
    let m = withCell(zeroMatrix(), 'topManagement', 'africanMale', 100)
    m = computeMatrixTotals(m)
    render(
      <Wrapper initialData={m} isDesignatedEmployer={true} disabilityHeadcount={1} mode="edit" />,
    )
    expect(screen.queryByTestId('dismiss-disability-flag')).toBeNull()
    expect(document.querySelector('[data-dismiss-disability-flag]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Keyboard navigation
// ---------------------------------------------------------------------------

describe('keyboard navigation', () => {
  it('Tab moves focus to the next editable cell in row-major order', async () => {
    const user = userEvent.setup()
    render(<Wrapper mode="edit" />)
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs).toHaveLength(70)

    await user.click(inputs[0] as HTMLElement)
    expect(inputs[0]).toHaveFocus()

    await user.tab()
    expect(inputs[1]).toHaveFocus()
  })

  it('Shift+Tab moves focus to the previous editable cell', async () => {
    const user = userEvent.setup()
    render(<Wrapper mode="edit" />)
    const inputs = screen.getAllByRole('spinbutton')

    await user.click(inputs[1] as HTMLElement)
    expect(inputs[1]).toHaveFocus()

    await user.tab({ shift: true })
    expect(inputs[0]).toHaveFocus()
  })
})

// ---------------------------------------------------------------------------
// Paste handler — use userEvent.paste() to avoid DataTransfer unavailability in jsdom
// ---------------------------------------------------------------------------

describe('paste handler', () => {
  it('valid TSV paste fills cells from focused position row-major', async () => {
    const user = userEvent.setup()
    render(<Wrapper mode="edit" />)
    const inputs = screen.getAllByRole('spinbutton')

    await user.click(inputs[0] as HTMLElement)
    await user.paste('10\t20')

    // The first input should now show 10, second 20
    await screen.findByDisplayValue('10')
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
  })

  it('non-numeric paste replaces value with 0 and emits PASTE_NON_NUMERIC warning', async () => {
    const user = userEvent.setup()
    const onValidationError = vi.fn()
    render(<Wrapper mode="edit" onValidationError={onValidationError} />)
    const inputs = screen.getAllByRole('spinbutton')

    await user.click(inputs[0] as HTMLElement)
    await user.paste('abc')

    expect(onValidationError).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PASTE_NON_NUMERIC',
          severity: 'warning',
        }),
      ]),
    )
  })
})
