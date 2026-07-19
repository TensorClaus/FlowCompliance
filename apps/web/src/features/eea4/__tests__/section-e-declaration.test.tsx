import type {
  MatrixRow,
  OccupationalMatrix,
  RemBreakdownMatrix,
  RemBreakdownRow,
  RemunerationMatrix,
  RemunerationRow,
} from '@simplifi/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { WizardFormContext } from '../../eea/wizard-form-context'
import { DeclarationSection } from '../declaration/DeclarationSection'
import { SectionEMedianGap, validateSectionE } from '../sections/SectionEMedianGap'

// ---------------------------------------------------------------------------
// Matrix fixture builders
// ---------------------------------------------------------------------------

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

const FIXED_CLOCK = () => new Date('2026-07-15T00:00:00.000Z')

const EEA2_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const EEA4_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TENANT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function occupationalMatrix(value = 0): OccupationalMatrix {
  const row = Object.fromEntries(COLS.map((colKey) => [colKey, { value }])) as MatrixRow
  return Object.fromEntries(ROWS.map((rowKey) => [rowKey, { ...row }])) as OccupationalMatrix
}

function setWorkforceCell(
  matrix: OccupationalMatrix,
  rowKey: keyof OccupationalMatrix,
  colKey: keyof MatrixRow,
  value: number,
): OccupationalMatrix {
  return {
    ...matrix,
    [rowKey]: { ...matrix[rowKey], [colKey]: { value } },
  }
}

function remunerationMatrix(headcount = 0): RemunerationMatrix {
  const row = Object.fromEntries(
    COLS.map((colKey) => [colKey, { headcount, totalRemuneration: 0 }]),
  ) as RemunerationRow
  return Object.fromEntries(ROWS.map((rowKey) => [rowKey, { ...row }])) as RemunerationMatrix
}

function setHeadcountCell(
  matrix: RemunerationMatrix,
  rowKey: keyof RemunerationMatrix,
  colKey: keyof MatrixRow,
  headcount: number,
): RemunerationMatrix {
  return {
    ...matrix,
    [rowKey]: {
      ...matrix[rowKey],
      [colKey]: { headcount, totalRemuneration: matrix[rowKey][colKey].totalRemuneration },
    },
  }
}

function breakdownMatrix(): RemBreakdownMatrix {
  const row = Object.fromEntries(
    COLS.map((colKey) => [colKey, { fixed: 0, variable: 0, total: 0 }]),
  ) as RemBreakdownRow
  return Object.fromEntries(ROWS.map((rowKey) => [rowKey, { ...row }])) as RemBreakdownMatrix
}

// ---------------------------------------------------------------------------
// Form wrapper builders
// ---------------------------------------------------------------------------

function buildEEA2Form(workforceProfile: OccupationalMatrix): unknown {
  return {
    id: EEA2_ID,
    status: 'signed',
    report: {
      sectionB: { workforceProfile },
      status: 'signed',
    },
  }
}

function buildEEA4Form(sectionC: RemunerationMatrix): {
  id: string
  status: string
  report: Record<string, unknown>
} {
  return {
    id: EEA4_ID,
    status: 'draft',
    report: {
      tenantId: TENANT_ID,
      linkedEEA2Id: EEA2_ID,
      sectionC,
      sectionD1: breakdownMatrix(),
      sectionD2: breakdownMatrix(),
      sectionE: {
        median: 0,
        top5pctRange: { lowest: 0, highest: 0 },
        bottom5pctRange: { lowest: 0, highest: 0 },
      },
      status: 'draft',
    },
  }
}

// ---------------------------------------------------------------------------
// Harnesses
// ---------------------------------------------------------------------------

function baseController(overrides: Record<string, unknown>) {
  return {
    tenantId: TENANT_ID,
    reportingYear: 2026,
    prefillOptions: { autoLoad: false },
    formState: {},
    setStepData: () => {},
    ...overrides,
  }
}

const stepProps = {
  completedSteps: new Set<string>(),
  formId: EEA4_ID,
  goToStep: () => {},
  onAdvance: () => {},
  updateWizardContext: () => {},
  wizardContext: {
    accommodationOverdueFlag: false,
    barrierTerminationFlag: false,
    disabilityFlagActive: false,
    sectionBTotals: null,
  },
} as const

/** Declaration harness with live EEA4 form state so status writes + drift work. */
function DeclarationHarness({
  eea2WorkforceProfile,
  eea4SectionC,
}: {
  eea2WorkforceProfile: OccupationalMatrix
  eea4SectionC: RemunerationMatrix
}) {
  const [eea2Profile, setEEA2Profile] = useState(eea2WorkforceProfile)
  const [eea4Form, setEEA4Form] = useState<unknown>(() => buildEEA4Form(eea4SectionC))

  const linkedEEA2Form = useMemo(() => buildEEA2Form(eea2Profile), [eea2Profile])

  const controller = useMemo(
    () =>
      baseController({
        linkedEEA2Form,
        eea4Form,
        setEEA4Form: (updater: (previous: unknown) => unknown) => {
          setEEA4Form((previous: unknown) => updater(previous))
        },
      }),
    [linkedEEA2Form, eea4Form],
  )

  return (
    <WizardFormContext.Provider value={controller}>
      <DeclarationSection {...stepProps} clock={FIXED_CLOCK} />
      <button
        data-testid="drift-eea2"
        onClick={() => {
          // Mutate one EEA2 workforce cell to introduce a headcount mismatch.
          setEEA2Profile((current) => setWorkforceCell(current, 'topManagement', 'africanMale', 99))
        }}
        type="button"
      >
        drift
      </button>
    </WizardFormContext.Provider>
  )
}

function SectionEHarness() {
  const [state, setState] = useState<Record<string, unknown>>({})
  const controller = baseController({
    formState: state,
    setStepData: (stepId: string, updater: object | ((previous: unknown) => unknown)) => {
      setState((previous) => {
        const nextValue: unknown =
          typeof updater === 'function' ? updater(previous[stepId]) : updater
        return { ...previous, [stepId]: nextValue }
      })
    },
  })
  return (
    <WizardFormContext.Provider value={controller}>
      <SectionEMedianGap {...stepProps} />
    </WizardFormContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Section E
// ---------------------------------------------------------------------------

describe('SectionEMedianGap', () => {
  it('flags a range-cross fixture with inline errors', () => {
    // bottom5.highest (500) crosses into top5.lowest (400); median (100) below bottom5.lowest (200)
    const errors = validateSectionE({
      median: 100,
      top5pctRange: { lowest: 400, highest: 900 },
      bottom5pctRange: { lowest: 200, highest: 500 },
    })
    expect(errors['bottom5.highest']).toBeDefined()
    expect(errors['median']).toBeDefined()
  })

  it('passes a valid ordered fixture with no errors', () => {
    const errors = validateSectionE({
      median: 500,
      top5pctRange: { lowest: 800, highest: 2000 },
      bottom5pctRange: { lowest: 100, highest: 400 },
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it('renders an inline error when the entered bands overlap', async () => {
    const user = userEvent.setup()
    render(<SectionEHarness />)

    const top5Lowest = screen.getByTestId('eea4-section-e-input-top5.lowest')
    const bottom5Highest = screen.getByTestId('eea4-section-e-input-bottom5.highest')

    await user.clear(top5Lowest)
    await user.type(top5Lowest, '300')
    await user.clear(bottom5Highest)
    await user.type(bottom5Highest, '500')

    expect(screen.getByTestId('eea4-section-e-error-bottom5.highest')).toBeInTheDocument()
    expect(screen.getByTestId('eea4-section-e-fields')).toHaveAttribute(
      'data-section-complete',
      'false',
    )
  })
})

// ---------------------------------------------------------------------------
// Declaration gate
// ---------------------------------------------------------------------------

describe('DeclarationSection gate', () => {
  it('blocks the declaration on a headcount mismatch and names the failing rule', () => {
    // EEA2 has a headcount in topManagement.africanMale that EEA4 sectionC lacks.
    const eea2Profile = setWorkforceCell(occupationalMatrix(0), 'topManagement', 'africanMale', 5)
    const eea4SectionC = remunerationMatrix(0) // all headcounts 0 → mismatch at that cell

    render(<DeclarationHarness eea2WorkforceProfile={eea2Profile} eea4SectionC={eea4SectionC} />)

    // Banner lists the headcount-consistency rule
    const banner = screen.getByTestId('eea4-declaration-banner')
    expect(banner).toHaveTextContent('EEA2/EEA4 Headcount Consistency')

    // The blocked container is aria-disabled and mounts zero signature inputs
    const blocked = screen.getByTestId('eea4-declaration-blocked')
    expect(blocked).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByTestId('eea4-declaration-signature')).not.toBeInTheDocument()
    expect(screen.queryByTestId('eea4-declaration-fullname')).not.toBeInTheDocument()

    // The panel surfaces the exact failing cellPath
    const panel = screen.getByTestId('eea4-validation-report-panel')
    expect(
      within(panel).getByText('sectionB.workforceProfile.topManagement.africanMale.value'),
    ).toBeInTheDocument()
  })

  it('confines remuneration/headcount numbers to the panel diff cells', () => {
    const eea2Profile = setWorkforceCell(occupationalMatrix(0), 'topManagement', 'africanMale', 5)
    const eea4SectionC = remunerationMatrix(0)

    const { container } = render(
      <DeclarationHarness eea2WorkforceProfile={eea2Profile} eea4SectionC={eea4SectionC} />,
    )

    // The mismatch value 5 appears only inside a diff cell within the panel.
    const panel = screen.getByTestId('eea4-validation-report-panel')
    const diffSources = within(panel).getAllByTestId('eea4-validation-diff-source')
    expect(diffSources.some((node) => node.textContent.includes('5'))).toBe(true)

    // Nowhere OUTSIDE the panel is the number 5 rendered.
    const outside = [...container.querySelectorAll('*')].filter(
      (node) => !panel.contains(node) && node.children.length === 0,
    )
    for (const node of outside) {
      expect(node.textContent).not.toMatch(/\b5\b/)
    }
  })

  it('unblocks with an aligned fixture and sets both statuses to pending_ceo on sign', async () => {
    const user = userEvent.setup()
    // Aligned: single non-zero cell present in BOTH EEA2 and EEA4 at same coords.
    const eea2Profile = setWorkforceCell(occupationalMatrix(0), 'seniorManagement', 'whiteMale', 3)
    const eea4SectionC = setHeadcountCell(remunerationMatrix(0), 'seniorManagement', 'whiteMale', 3)

    render(<DeclarationHarness eea2WorkforceProfile={eea2Profile} eea4SectionC={eea4SectionC} />)

    // No blocked banner; the signature form mounts.
    expect(screen.queryByTestId('eea4-declaration-blocked')).not.toBeInTheDocument()
    expect(screen.getByTestId('eea4-declaration-form')).toBeInTheDocument()

    await user.type(screen.getByTestId('eea4-declaration-fullname'), 'Jane Smith')
    await user.type(screen.getByTestId('eea4-declaration-organisation'), 'Acme Corp')
    await user.type(screen.getByTestId('eea4-declaration-place'), 'Johannesburg')
    await user.type(screen.getByTestId('eea4-declaration-signature'), 'data:image/png;base64,AAA')
    await user.click(screen.getByTestId('eea4-declaration-submit'))

    // After signing, the signed confirmation shows pending_ceo (both statuses set).
    const signed = await screen.findByTestId('eea4-declaration-signed')
    expect(signed).toHaveTextContent('pending_ceo')
  })

  it('re-blocks an unblocked declaration when the linked EEA2 drifts', async () => {
    const user = userEvent.setup()
    const eea2Profile = setWorkforceCell(occupationalMatrix(0), 'seniorManagement', 'whiteMale', 3)
    const eea4SectionC = setHeadcountCell(remunerationMatrix(0), 'seniorManagement', 'whiteMale', 3)

    render(<DeclarationHarness eea2WorkforceProfile={eea2Profile} eea4SectionC={eea4SectionC} />)

    // Initially unblocked.
    expect(screen.getByTestId('eea4-declaration-form')).toBeInTheDocument()

    // Introduce EEA2 drift — a new mismatched cell appears.
    await user.click(screen.getByTestId('drift-eea2'))

    // Declaration collapses back to blocked.
    expect(await screen.findByTestId('eea4-declaration-blocked')).toBeInTheDocument()
    expect(screen.getByTestId('eea4-declaration-blocked')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByTestId('eea4-declaration-signature')).not.toBeInTheDocument()
  })
})
