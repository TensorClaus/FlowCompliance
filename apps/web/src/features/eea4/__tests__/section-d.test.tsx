import type {
  MatrixRow,
  OccupationalMatrix,
  RemBreakdownMatrix,
  RemBreakdownRow,
} from '@simplifi/shared'
import { PII_FIELD_PATHS } from '@simplifi/shared'
import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WizardFormContext } from '../../eea/wizard-form-context'
import { SectionD1HighestPaid } from '../sections/SectionD1HighestPaid'
import { SectionD2LowestPaid } from '../sections/SectionD2LowestPaid'
import { EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID } from '../sections/section-c-prefill'

const ROWS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'totalPermanent',
  'temporaryEmployees',
  'grandTotal',
] as const satisfies ReadonlyArray<keyof OccupationalMatrix>

const COLS = [
  'africanMale',
  'africanFemale',
  'colouredMale',
  'colouredFemale',
  'indianMale',
  'indianFemale',
  'whiteMale',
  'whiteFemale',
  'foreignNationalMale',
  'foreignNationalFemale',
  'total',
] as const satisfies ReadonlyArray<keyof MatrixRow>

const SINGLE_EMPLOYEE_TITLE = 'Single employee at this level captured in D1 only.'

function occupationalCell(value = 0) {
  return { value }
}

function occupationalRow(total = 0): MatrixRow {
  return Object.fromEntries(
    COLS.map((colKey) => [colKey, occupationalCell(colKey === 'total' ? total : 0)]),
  ) as MatrixRow
}

function occupationalMatrix(total = 0): OccupationalMatrix {
  return Object.fromEntries(
    ROWS.map((rowKey) => [rowKey, occupationalRow(total)]),
  ) as OccupationalMatrix
}

function setOccupationalLevelTotal(
  matrix: OccupationalMatrix,
  rowKey: keyof OccupationalMatrix,
  total: number,
): OccupationalMatrix {
  return { ...matrix, [rowKey]: occupationalRow(total) }
}

function breakdownCell(fixed = 0, variable = 0) {
  return { fixed, variable, total: fixed + variable }
}

function breakdownRow(fixed = 0, variable = 0): RemBreakdownRow {
  return Object.fromEntries(
    COLS.map((colKey) => [colKey, breakdownCell(fixed, variable)]),
  ) as RemBreakdownRow
}

function breakdownMatrix(fixed = 0, variable = 0): RemBreakdownMatrix {
  return Object.fromEntries(
    ROWS.map((rowKey) => [rowKey, breakdownRow(fixed, variable)]),
  ) as RemBreakdownMatrix
}

function setBreakdownCell(
  matrix: RemBreakdownMatrix,
  rowKey: keyof RemBreakdownMatrix,
  colKey: keyof RemBreakdownRow,
  fixed: number,
  variable: number,
): RemBreakdownMatrix {
  return {
    ...matrix,
    [rowKey]: {
      ...matrix[rowKey],
      [colKey]: breakdownCell(fixed, variable),
    },
  }
}

function matrixCell(container: HTMLElement, cellPath: string) {
  const cell = container.querySelector(`[data-cell="${cellPath}"]`)
  if (!(cell instanceof HTMLElement)) {
    throw new TypeError(`Missing matrix cell ${cellPath}`)
  }
  return cell
}

function renderSectionD({
  section,
  eea2Matrix = occupationalMatrix(2),
  d1 = breakdownMatrix(),
  d2 = breakdownMatrix(),
  mode = 'edit',
  onPasteWarnings,
}: {
  section: 'd1' | 'd2'
  eea2Matrix?: OccupationalMatrix
  d1?: RemBreakdownMatrix
  d2?: RemBreakdownMatrix
  mode?: 'view' | 'edit' | 'validate' | 'locked'
  onPasteWarnings?: (warnings: unknown[]) => void
}) {
  const setStepData = vi.fn()
  const Component = section === 'd1' ? SectionD1HighestPaid : SectionD2LowestPaid

  function Wrapper() {
    const [formState, setFormState] = useState<Record<string, unknown>>({
      [EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID]: eea2Matrix,
      'eea4-section-d1': d1,
      'eea4-section-d2': d2,
    })

    return (
      <WizardFormContext.Provider
        value={{
          tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          reportingYear: 2026,
          prefillOptions: { autoLoad: false },
          formState,
          setStepData: (stepId, updater) => {
            setStepData(stepId, updater)
            setFormState((previous) => {
              const previousData = previous[stepId]
              return {
                ...previous,
                [stepId]:
                  typeof updater === 'function'
                    ? (updater as (previous: unknown) => unknown)(previousData)
                    : updater,
              }
            })
          },
        }}
      >
        <Component
          completedSteps={new Set()}
          formId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
          goToStep={() => {}}
          isLocked={mode === 'locked'}
          mode={mode}
          onAdvance={() => {}}
          updateWizardContext={() => {}}
          wizardContext={{
            accommodationOverdueFlag: false,
            barrierTerminationFlag: false,
            disabilityFlagActive: false,
            sectionBTotals: null,
          }}
          {...(onPasteWarnings === undefined ? {} : { onPasteWarnings })}
        />
      </WizardFormContext.Provider>
    )
  }

  return { ...render(<Wrapper />), setStepData }
}

describe('Section D remuneration breakdown', () => {
  it('renders total sub-cells as spans in both sections and modes', () => {
    for (const section of ['d1', 'd2'] as const) {
      for (const mode of ['edit', 'validate', 'view', 'locked'] as const) {
        const { container, unmount } = renderSectionD({ section, mode })
        const cell = matrixCell(container, 'topManagement.africanMale')

        expect(cell.querySelector('span[data-subfield="total"]')).toBeInTheDocument()
        expect(cell.querySelector('input[data-subfield="total"]')).not.toBeInTheDocument()

        unmount()
      }
    }
  })

  it('locks only single-employee lowest-paid rows while highest-paid stays editable', () => {
    const eea2Matrix = setOccupationalLevelTotal(
      setOccupationalLevelTotal(occupationalMatrix(2), 'topManagement', 1),
      'seniorManagement',
      2,
    )

    const d2 = renderSectionD({ section: 'd2', eea2Matrix })
    const lockedCell = matrixCell(d2.container, 'topManagement.africanMale')
    expect(within(lockedCell).queryByRole('spinbutton')).not.toBeInTheDocument()
    for (const subField of ['fixed', 'variable'] as const) {
      expect(lockedCell.querySelector(`[data-subfield="${subField}"]`)).toHaveTextContent('0')
      expect(lockedCell.querySelector(`[data-subfield="${subField}"]`)).toHaveAttribute(
        'title',
        SINGLE_EMPLOYEE_TITLE,
      )
    }

    expect(
      within(matrixCell(d2.container, 'seniorManagement.africanMale')).getAllByRole('spinbutton'),
    ).toHaveLength(2)
    d2.unmount()

    const d1 = renderSectionD({ section: 'd1', eea2Matrix })
    expect(
      within(matrixCell(d1.container, 'topManagement.africanMale')).getAllByRole('spinbutton'),
    ).toHaveLength(2)
  })

  it('marks failing validate-mode cells through the grid error mechanism', () => {
    const d1 = setBreakdownCell(breakdownMatrix(2, 0), 'topManagement', 'africanMale', 0, 0)
    const d2 = setBreakdownCell(breakdownMatrix(0, 0), 'topManagement', 'africanMale', 2, 0)

    const { container } = renderSectionD({ section: 'd1', d1, d2, mode: 'validate' })
    const cell = matrixCell(container, 'topManagement.africanMale')
    const inputs = within(cell).getAllByRole('spinbutton')
    const firstInput = inputs[0]
    if (!(firstInput instanceof HTMLElement)) {
      throw new TypeError('Missing editable breakdown input')
    }

    expect(cell).toHaveClass('cell--error')
    expect(inputs).toHaveLength(2)
    expect(firstInput).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not mark validate-mode cells when the shared rule passes', () => {
    const d1 = setBreakdownCell(breakdownMatrix(2, 0), 'topManagement', 'africanMale', 2, 0)
    const d2 = setBreakdownCell(breakdownMatrix(0, 0), 'topManagement', 'africanMale', 0, 0)

    const { container } = renderSectionD({ section: 'd1', d1, d2, mode: 'validate' })

    expect(matrixCell(container, 'topManagement.africanMale')).not.toHaveClass('cell--error')
  })

  it('emits only truncation code and cell path for decimal paste warnings', async () => {
    const user = userEvent.setup()
    const onPasteWarnings = vi.fn()
    const { container } = renderSectionD({ section: 'd1', onPasteWarnings })
    const input = within(matrixCell(container, 'topManagement.africanMale')).getAllByRole(
      'spinbutton',
    )[0]
    if (!(input instanceof HTMLElement)) {
      throw new TypeError('Missing editable breakdown input')
    }

    await user.click(input)
    await user.paste('1.5')

    expect(onPasteWarnings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          cellPath: 'topManagement.africanMale',
          code: 'REM_DECIMAL_TRUNCATED',
          severity: 'warning',
        }),
      ]),
    )
  })

  it('registers D-section remuneration paths as PII', () => {
    expect(PII_FIELD_PATHS).toEqual(
      expect.arrayContaining(['report.sectionD1.*', 'report.sectionD2.*']),
    )
  })
})
