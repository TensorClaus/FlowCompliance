import type { MatrixRow, OccupationalMatrix, RemunerationMatrix } from '@simplifi/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WizardFormContext } from '../../eea/wizard-form-context'
import { SectionCRemuneration } from '../sections/SectionCRemuneration'
import {
  EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID,
  prefillSectionC,
} from '../sections/section-c-prefill'

function occupationalCell(value = 0) {
  return { value }
}

function occupationalRow(value = 0): MatrixRow {
  return {
    africanMale: occupationalCell(value),
    africanFemale: occupationalCell(value),
    colouredMale: occupationalCell(value),
    colouredFemale: occupationalCell(value),
    indianMale: occupationalCell(value),
    indianFemale: occupationalCell(value),
    whiteMale: occupationalCell(value),
    whiteFemale: occupationalCell(value),
    foreignNationalMale: occupationalCell(value),
    foreignNationalFemale: occupationalCell(value),
    total: occupationalCell(value),
  }
}

function occupationalMatrix(value = 0): OccupationalMatrix {
  return {
    topManagement: occupationalRow(value),
    seniorManagement: occupationalRow(value),
    professionallyQualified: occupationalRow(value),
    skilledTechnical: occupationalRow(value),
    semiSkilled: occupationalRow(value),
    unskilled: occupationalRow(value),
    totalPermanent: occupationalRow(value),
    temporaryEmployees: occupationalRow(value),
    grandTotal: occupationalRow(value),
  }
}

function setOccupationalValue(
  matrix: OccupationalMatrix,
  rowKey: keyof OccupationalMatrix,
  colKey: keyof MatrixRow,
  value: number,
): OccupationalMatrix {
  return {
    ...matrix,
    [rowKey]: {
      ...matrix[rowKey],
      [colKey]: occupationalCell(value),
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

function renderSectionC({
  eea2Matrix = occupationalMatrix(1),
  existing,
  mode = 'edit',
  onPasteWarnings,
}: {
  eea2Matrix?: OccupationalMatrix
  existing?: RemunerationMatrix
  mode?: 'view' | 'edit' | 'validate' | 'locked'
  onPasteWarnings?: (warnings: unknown[]) => void
} = {}) {
  const setStepData = vi.fn()

  function Wrapper() {
    const [formState, setFormState] = useState<Record<string, unknown>>({
      [EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID]: eea2Matrix,
      ...(existing === undefined ? {} : { 'eea4-section-c': existing }),
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
        <SectionCRemuneration
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

describe('prefillSectionC', () => {
  it('copies EEA2 headcount and preserves existing remuneration on re-prefill', () => {
    let source = setOccupationalValue(occupationalMatrix(), 'topManagement', 'africanMale', 1)
    const initial = prefillSectionC(source)
    const edited: RemunerationMatrix = {
      ...initial,
      topManagement: {
        ...initial.topManagement,
        africanMale: {
          ...initial.topManagement.africanMale,
          totalRemuneration: 50,
        },
      },
    }

    source = setOccupationalValue(source, 'topManagement', 'africanMale', 2)
    const next = prefillSectionC(source, edited)

    expect(next.topManagement.africanMale.headcount).toBe(2)
    expect(next.topManagement.africanMale.totalRemuneration).toBe(50)
  })
})

describe('SectionCRemuneration', () => {
  it('renders zero headcount inputs across all modes and snapshots edit mode', () => {
    const source = occupationalMatrix(1)
    const { container, rerender } = renderSectionC({ eea2Matrix: source, mode: 'edit' })

    for (const input of screen.getAllByRole('spinbutton')) {
      expect(input).toHaveAttribute('data-subfield', 'totalRemuneration')
    }
    expect(container.querySelectorAll('input[data-subfield="headcount"]')).toHaveLength(0)
    const editCell = matrixCell(container, 'topManagement.africanMale')
    expect(editCell.querySelector('span[data-subfield="headcount"]')).not.toBeNull()
    expect(editCell.querySelectorAll('input')).toHaveLength(1)
    expect(within(editCell).getByRole('spinbutton')).toHaveAttribute(
      'data-subfield',
      'totalRemuneration',
    )

    for (const mode of ['validate', 'view', 'locked'] as const) {
      rerender(
        <WizardFormContext.Provider
          value={{
            tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            reportingYear: 2026,
            prefillOptions: { autoLoad: false },
            formState: { [EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID]: source },
            setStepData: () => {},
          }}
        >
          <SectionCRemuneration
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
          />
        </WizardFormContext.Provider>,
      )
      expect(container.querySelectorAll('input[data-subfield="headcount"]')).toHaveLength(0)
    }
  })

  it('re-prefills after an EEA2 change while preserving entered remuneration', async () => {
    const user = userEvent.setup()
    const source = setOccupationalValue(occupationalMatrix(), 'topManagement', 'africanMale', 1)
    const nextSource = setOccupationalValue(source, 'topManagement', 'africanMale', 2)

    function Wrapper() {
      const [eea2Matrix, setEEA2Matrix] = useState(source)
      const [formState, setFormState] = useState<Record<string, unknown>>({
        [EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID]: eea2Matrix,
      })

      return (
        <WizardFormContext.Provider
          value={{
            tenantId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            reportingYear: 2026,
            prefillOptions: { autoLoad: false },
            formState: {
              ...formState,
              [EEA4_LINKED_EEA2_WORKFORCE_PROFILE_STEP_ID]: eea2Matrix,
            },
            setStepData: (stepId, updater) => {
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
          <button
            type="button"
            onClick={() => {
              setEEA2Matrix(nextSource)
            }}
          >
            change source
          </button>
          <SectionCRemuneration
            completedSteps={new Set()}
            formId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
            goToStep={() => {}}
            isLocked={false}
            mode="edit"
            onAdvance={() => {}}
            updateWizardContext={() => {}}
            wizardContext={{
              accommodationOverdueFlag: false,
              barrierTerminationFlag: false,
              disabilityFlagActive: false,
              sectionBTotals: null,
            }}
          />
        </WizardFormContext.Provider>
      )
    }

    const { container } = render(<Wrapper />)
    const cell = matrixCell(container, 'topManagement.africanMale')
    const input = within(cell).getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '50')
    await user.tab()

    await user.click(screen.getByRole('button', { name: /change source/i }))

    expect(matrixCell(container, 'topManagement.africanMale')).toHaveTextContent('2')
    expect(
      within(matrixCell(container, 'topManagement.africanMale')).getByRole('spinbutton'),
    ).toHaveValue(50)
  })

  it('locks zero-headcount remuneration at zero with title text', () => {
    const { container } = renderSectionC({
      eea2Matrix: setOccupationalValue(occupationalMatrix(1), 'topManagement', 'africanMale', 0),
    })

    const cell = matrixCell(container, 'topManagement.africanMale')
    expect(within(cell).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(cell.querySelector('[data-subfield="totalRemuneration"]')).toHaveAttribute(
      'title',
      'No employees in this cell EEA2.',
    )
    expect(cell.querySelector('[data-subfield="totalRemuneration"]')).toHaveTextContent('0')
  })

  it('truncates decimal paste with REM_DECIMAL_TRUNCATED and rejects text with PASTE_NON_NUMERIC', async () => {
    const user = userEvent.setup()
    const onPasteWarnings = vi.fn()
    const { container } = renderSectionC({ onPasteWarnings })
    const input = within(matrixCell(container, 'topManagement.africanMale')).getByRole('spinbutton')

    await user.click(input)
    await user.paste('1234.56')

    expect(input).toHaveValue(1234)
    expect(onPasteWarnings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          cellPath: 'topManagement.africanMale',
          code: 'REM_DECIMAL_TRUNCATED',
          severity: 'warning',
        }),
      ]),
    )

    await user.paste('abc')

    expect(input).toHaveValue(0)
    expect(onPasteWarnings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          cellPath: 'topManagement.africanMale',
          code: 'PASTE_NON_NUMERIC',
          severity: 'warning',
        }),
      ]),
    )
  })

  it('consumes one TSV token per cell because only remuneration is paste-editable', async () => {
    const user = userEvent.setup()
    const { container } = renderSectionC()
    const input = within(matrixCell(container, 'topManagement.africanMale')).getByRole('spinbutton')

    await user.click(input)
    await user.paste('10\t20\t30')

    expect(
      within(matrixCell(container, 'topManagement.africanMale')).getByRole('spinbutton'),
    ).toHaveValue(10)
    expect(
      within(matrixCell(container, 'topManagement.africanFemale')).getByRole('spinbutton'),
    ).toHaveValue(20)
    expect(
      within(matrixCell(container, 'topManagement.colouredMale')).getByRole('spinbutton'),
    ).toHaveValue(30)
  })
})
