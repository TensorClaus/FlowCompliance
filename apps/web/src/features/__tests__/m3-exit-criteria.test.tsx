import {
  CROSS_FORM_RULES,
  TIMEFRAME_ONGOING_MESSAGE,
  evaluateRules,
  validateGoalAgainstMinimums,
  type BarrierEntry,
  type BarriersRemovalPlan,
  type MatrixRow,
  type OccupationalMatrix,
  type RemBreakdownMatrix,
  type RemBreakdownRow,
  type RemunerationMatrix,
  type RemunerationRow,
  type SectorCode,
} from '@simplifi/shared'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useMemo, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BarrierCategoryBlock } from '../eea/components/barrier-category-block'
import { WizardFormContext } from '../eea/wizard-form-context'
import type { StepId } from '../eea/wizard-types'
import { decomposeEEA2Workforce } from '../eea12/decompose-workforce'
import { seedRemovalPlan } from '../eea13/prefill-barriers'
import { EEA13StepBarriersRemoval } from '../eea13/sections/eea13-step-barriers-removal'
import type { EEA13PrefillSource } from '../eea13/sections/eea13-step-workforce-analysis'
import { EEA13StepYearlyPlans } from '../eea13/sections/eea13-step-yearly-plans'
import { DeclarationSection } from '../eea4/declaration/DeclarationSection'
import { BundleDashboard, type BundlePeriodRef } from '../submission-bundle/BundleDashboard'
import { deriveBundleBlockers, evaluateBundleGate } from '../submission-bundle/bundle-gate'
import { server } from '@/test/server'

const EEA2_ID = '11111111-1111-4111-8111-111111111111'
const EEA4_ID = '22222222-2222-4222-8222-222222222222'
const TENANT_ID = '33333333-3333-4333-8333-333333333333'
const FIXED_CLOCK = () => new Date('2026-07-16T00:00:00.000Z')

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

function occupationalMatrix(value = 0): OccupationalMatrix {
  const row = Object.fromEntries(COLS.map((col) => [col, { value }])) as MatrixRow
  return Object.fromEntries(ROWS.map((level) => [level, { ...row }])) as OccupationalMatrix
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
    COLS.map((col) => [col, { headcount, totalRemuneration: 0 }]),
  ) as RemunerationRow
  return Object.fromEntries(ROWS.map((level) => [level, { ...row }])) as RemunerationMatrix
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
      [colKey]: { ...matrix[rowKey][colKey], headcount },
    },
  }
}

function breakdownMatrix(): RemBreakdownMatrix {
  const row = Object.fromEntries(
    COLS.map((col) => [col, { fixed: 0, variable: 0, total: 0 }]),
  ) as RemBreakdownRow
  return Object.fromEntries(ROWS.map((level) => [level, { ...row }])) as RemBreakdownMatrix
}

function eea2Wrapper(
  opts: {
    status?: string
    signed?: boolean
    workforce?: OccupationalMatrix
    disability?: OccupationalMatrix
  } = {},
) {
  const status = opts.status ?? 'signed'
  const signed = opts.signed ?? status === 'signed'
  return {
    id: EEA2_ID,
    status,
    report: {
      status,
      // Sections A and C-G must be present (even as empty objects) so the engine's
      // meta.priorSectionsComplete projection is true. Without them a *signed* EEA2
      // fails xform:eea2-ceo-section-completeness and the bundle never reaches ready.
      employerProfile: {},
      sectionB: {
        workforceProfile: opts.workforce ?? occupationalMatrix(),
        disabilityProfile: opts.disability ?? occupationalMatrix(),
      },
      sectionC: {},
      sectionD: {},
      sectionE: {},
      sectionF: {},
      sectionG: {},
      sectionH: { signatureDataUrl: signed ? 'data:image/png;base64,AAAA' : '' },
    },
  }
}

function eea4Wrapper(
  opts: {
    status?: string
    signed?: boolean
    sectionC?: RemunerationMatrix
    linkedEEA2Id?: string
  } = {},
) {
  const status = opts.status ?? 'signed'
  const signed = opts.signed ?? status === 'signed'
  return {
    id: EEA4_ID,
    status,
    report: {
      tenantId: TENANT_ID,
      status,
      linkedEEA2Id: opts.linkedEEA2Id ?? EEA2_ID,
      sectionC: opts.sectionC ?? remunerationMatrix(),
      sectionD1: breakdownMatrix(),
      sectionD2: breakdownMatrix(),
      sectionE: {
        median: 0,
        top5pctRange: { lowest: 0, highest: 0 },
        bottom5pctRange: { lowest: 0, highest: 0 },
      },
      declaration: { signatureDataUrl: signed ? 'data:image/png;base64,AAAA' : '' },
    },
  }
}

const stepProps = {
  completedSteps: new Set<StepId>(),
  formId: EEA4_ID,
  goToStep: () => {},
  isLocked: false,
  onAdvance: () => {},
  updateWizardContext: () => {},
  wizardContext: {
    accommodationOverdueFlag: false,
    barrierTerminationFlag: false,
    disabilityFlagActive: false,
    sectionBTotals: null,
  },
} as const

function DeclarationDriftHarness({
  initialEEA2,
  eea4Form,
}: {
  initialEEA2: ReturnType<typeof eea2Wrapper>
  eea4Form: ReturnType<typeof eea4Wrapper>
}) {
  const [linkedEEA2Form, setLinkedEEA2Form] = useState(initialEEA2)

  const controller = useMemo(
    () => ({
      tenantId: TENANT_ID,
      reportingYear: 2026,
      prefillOptions: { autoLoad: false },
      formState: {},
      linkedEEA2Form,
      eea4Form,
      setStepData: () => {},
      setEEA4Form: () => {},
    }),
    [linkedEEA2Form, eea4Form],
  )

  return (
    <WizardFormContext.Provider value={controller}>
      <DeclarationSection {...stepProps} clock={FIXED_CLOCK} />
      <button
        data-testid="drift-eea2-workforce"
        onClick={() => {
          setLinkedEEA2Form((current) => ({
            ...current,
            report: {
              ...current.report,
              sectionB: {
                ...current.report.sectionB,
                workforceProfile: setWorkforceCell(
                  current.report.sectionB.workforceProfile,
                  'topManagement',
                  'africanMale',
                  9,
                ),
              },
            },
          }))
        }}
        type="button"
      >
        Drift workforce
      </button>
    </WizardFormContext.Provider>
  )
}

function makeBarrier(
  category: BarrierEntry['category'],
  severity: BarrierEntry['severity'],
  mitigationActions: string[],
): BarrierEntry {
  return {
    category,
    description: `Barrier for ${category}`,
    severity,
    affectedDesignatedGroups: [],
    mitigationActions,
    targetCompletionDate: '2027-10-31',
  }
}

const EEA12_BARRIERS: BarrierEntry[] = [
  makeBarrier('promotion', 'medium', ['Revise promotion criteria', 'Track promotion metrics']),
  makeBarrier('training_and_development', 'high', ['Fund training programmes']),
  makeBarrier('workplace_culture', 'low', ['Run culture workshops']),
  makeBarrier('promotion', 'low', ['Alternative promotion action']),
]

function renderBarriersRemoval(prefill: EEA13PrefillSource) {
  const onAdvance = vi.fn()

  function Harness() {
    const [formState, setFormState] = useState<Record<StepId, unknown>>({
      'eea13-prefill-source': prefill,
    })

    const setStepData = (stepId: StepId, updater: object | ((previous: unknown) => unknown)) => {
      setFormState((previous) => {
        const nextData =
          typeof updater === 'function'
            ? (updater as (previous: unknown) => unknown)(previous[stepId])
            : updater
        return { ...previous, [stepId]: nextData }
      })
    }

    return (
      <WizardFormContext.Provider
        value={{
          tenantId: TENANT_ID,
          reportingYear: 2026,
          prefillOptions: { autoLoad: false },
          formState,
          setStepData,
        }}
      >
        <EEA13StepBarriersRemoval {...stepProps} onAdvance={onAdvance} />
        <pre data-testid="barriers-state-json">{JSON.stringify(formState)}</pre>
      </WizardFormContext.Provider>
    )
  }

  return { ...render(<Harness />), onAdvance }
}

async function completeSeededRemovalRows(user: ReturnType<typeof userEvent.setup>) {
  const responsibleFields = screen.getAllByRole('textbox', { name: /responsible/i })
  const timelineFields = screen.getAllByRole('textbox', { name: /timeline/i })
  const outcomeFields = screen.getAllByRole('textbox', { name: /measurable outcome/i })

  for (const [index, responsibleField] of responsibleFields.entries()) {
    const timelineField = timelineFields[index]
    const outcomeField = outcomeFields[index]
    if (timelineField === undefined || outcomeField === undefined) {
      throw new TypeError('Missing removal-plan field for seeded row')
    }
    await user.type(responsibleField, `Owner ${String(index + 1)}`)
    await user.type(timelineField, `By 2027-0${String(index + 1)}-28`)
    await user.type(outcomeField, `Outcome ${String(index + 1)}`)
  }
}

function readBarrierState(): {
  'eea13-barriers'?: { entries?: BarriersRemovalPlan[] }
} {
  return JSON.parse(screen.getByTestId('barriers-state-json').textContent) as {
    'eea13-barriers'?: { entries?: BarriersRemovalPlan[] }
  }
}

const yearlyPlanSetup = {
  sectorCode: 'agriculture',
  planPeriod: { startDate: '2025-01-01', endDate: '2030-01-01' },
  consultation: {
    consultedWithEmployees: true,
    eecfEstablished: true,
    consultationDate: '2025-01-15',
  },
}

const yearlyPrefill: EEA13PrefillSource = {
  province: 'National',
  rows: [
    { occupationalLevel: 1, race: 'A', gender: 'M', disability: false, count: 20 },
    { occupationalLevel: 1, race: 'W', gender: 'M', disability: false, count: 80 },
  ],
  foreignNationals: [],
  periodLabel: '2025-01-01 - 2025-12-31',
}

function renderYearlyPlans(
  opts: {
    sectorCode?: string
    initialTimeline?: string
  } = {},
) {
  function Harness() {
    const [formState, setFormState] = useState<Record<StepId, unknown>>({
      'eea13-plan-setup': {
        ...yearlyPlanSetup,
        sectorCode: opts.sectorCode ?? yearlyPlanSetup.sectorCode,
      },
      'eea13-prefill-source': yearlyPrefill,
      ...(opts.initialTimeline === undefined
        ? {}
        : {
            'eea13-yearly-plans': {
              entries: [
                {
                  year: 2025,
                  reviewDate: '2025-12-31',
                  goals: [
                    {
                      occupationalLevel: 1,
                      designatedGroup: 'A',
                      currentRepresentation: 20,
                      target: 58,
                      eapBenchmark: 55,
                      timeframe: opts.initialTimeline,
                      targetDate: '2029-12-31',
                      measures: ['Review pipeline'],
                    },
                  ],
                },
                { year: 2026, reviewDate: '', goals: [] },
                { year: 2027, reviewDate: '', goals: [] },
              ],
            },
          }),
    })

    const setStepData = (stepId: StepId, updater: object | ((previous: unknown) => unknown)) => {
      setFormState((previous) => {
        const nextData =
          typeof updater === 'function'
            ? (updater as (previous: unknown) => unknown)(previous[stepId])
            : updater
        return { ...previous, [stepId]: nextData }
      })
    }

    return (
      <WizardFormContext.Provider
        value={{
          tenantId: TENANT_ID,
          reportingYear: 2026,
          prefillOptions: { autoLoad: false },
          formState,
          setStepData,
        }}
      >
        <EEA13StepYearlyPlans {...stepProps} onAdvance={vi.fn()} />
      </WizardFormContext.Provider>
    )
  }

  return render(<Harness />)
}

async function makeFirstGoalReady(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByTestId('eea13-goal-target-1'))
  await user.type(screen.getByTestId('eea13-goal-target-1'), '58')
  await user.type(screen.getByTestId('eea13-goal-timeframe-1'), 'By 31 December 2029')
  await user.type(screen.getByTestId('eea13-goal-target-date-1'), '2029-12-31')
  await user.type(screen.getByTestId('eea13-goal-measure-1-1'), 'Targeted recruitment')
}

function gate(eea2Form?: unknown, eea4Form?: unknown) {
  return evaluateBundleGate({
    eea2Form,
    eea4Form,
    clock: FIXED_CLOCK,
    reportId: 'report-fixed',
  })
}

function wrapperHandlers(eea2: Record<string, unknown>, eea4: Record<string, unknown>) {
  return [
    http.get('/api/eea2/:id', () => HttpResponse.json(eea2)),
    http.get('/api/eea4/:id', () => HttpResponse.json(eea4)),
  ]
}

function appendSpy() {
  const spy = { calls: [] as Array<Record<string, unknown>> }
  server.use(
    http.post('/api/event-store/append', async ({ request }) => {
      spy.calls.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json({ success: true, eventId: crypto.randomUUID() }, { status: 201 })
    }),
  )
  return spy
}

function period(overrides: Partial<BundlePeriodRef> = {}): BundlePeriodRef {
  return {
    periodId: '2026',
    label: '2026 reporting period',
    eea2FormId: EEA2_ID,
    eea4FormId: EEA4_ID,
    eea12Present: true,
    eea13Present: true,
    ...overrides,
  }
}

describe('HEADCOUNT LOCK', () => {
  it('re-evaluates declaration and bundle gate after linked workforce drift', async () => {
    const user = userEvent.setup()
    const workforce = setWorkforceCell(occupationalMatrix(), 'seniorManagement', 'whiteMale', 3)
    const sectionC = setHeadcountCell(remunerationMatrix(), 'seniorManagement', 'whiteMale', 3)
    const alignedEEA2 = eea2Wrapper({ workforce })
    // The declaration harness needs an UNSIGNED-but-passing EEA4 so DeclarationSection
    // renders the open form (a 'signed' status short-circuits to the signed state).
    // The bundle gate needs a SIGNED pair to be ready — mutually exclusive statuses,
    // so the two lenses take two fixtures over the same aligned Section C.
    const unsignedEEA4 = eea4Wrapper({ sectionC, status: 'draft' })
    const signedEEA4 = eea4Wrapper({ sectionC, status: 'signed' })

    render(<DeclarationDriftHarness initialEEA2={alignedEEA2} eea4Form={unsignedEEA4} />)

    expect(screen.getByTestId('eea4-declaration-form')).toBeInTheDocument()
    expect(gate(alignedEEA2, signedEEA4).ready).toBe(true)

    await user.click(screen.getByTestId('drift-eea2-workforce'))

    expect(await screen.findByTestId('eea4-declaration-blocked')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByTestId('eea4-declaration-banner')).toHaveTextContent(
      'EEA2/EEA4 Headcount Consistency',
    )

    const driftedEEA2 = eea2Wrapper({
      workforce: setWorkforceCell(workforce, 'topManagement', 'africanMale', 9),
    })
    const bundle = gate(driftedEEA2, signedEEA4)
    const blockers = deriveBundleBlockers(bundle)
    const engineReport = evaluateRules(
      CROSS_FORM_RULES,
      { EEA2: driftedEEA2, EEA4: signedEEA4 },
      { clock: FIXED_CLOCK, reportId: 'headcount-drift' },
    )

    expect(bundle.ready).toBe(false)
    expect(engineReport.allPassed).toBe(false)
    expect(blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'xform:eea2-eea4-headcount',
          label: 'EEA2/EEA4 Headcount Consistency',
          cellPaths: expect.arrayContaining([
            'sectionB.workforceProfile.topManagement.africanMale.value',
          ]) as string[],
        }),
      ]),
    )
  })
})

describe('BARRIER FLOW', () => {
  it('carries EEA12 barrier analysis into seeded EEA13 removal summaries', async () => {
    const user = userEvent.setup()
    const workforce = setWorkforceCell(occupationalMatrix(), 'topManagement', 'africanMale', 2)
    const decomposed = decomposeEEA2Workforce(workforce, occupationalMatrix())
    const seeded = seedRemovalPlan(EEA12_BARRIERS)

    expect(decomposed.rows).toEqual([
      expect.objectContaining({ occupationalLevel: 1, race: 'A', gender: 'M', count: 2 }),
    ])
    expect(seeded.plans.map((plan) => plan.barrierCategory)).toEqual([
      'training_and_development',
      'promotion',
      'workplace_culture',
    ])
    expect(seeded.duplicates).toEqual(['promotion'])

    renderBarriersRemoval({
      ...yearlyPrefill,
      rows: decomposed.rows,
      foreignNationals: decomposed.foreignNationals,
      periodLabel: '2025-01-01 - 2025-12-31',
      barrierEntries: EEA12_BARRIERS,
    })

    expect(await screen.findByTestId('eea13-barrier-row-1')).toHaveTextContent(
      'Training And Development',
    )
    expect(screen.getByTestId('eea13-barrier-row-1-high-marker')).toHaveTextContent('high severity')
    expect(screen.getByTestId('eea13-barrier-row-1-provenance')).toHaveTextContent('From EEA12')
    expect(screen.getByTestId('eea13-barrier-row-2')).toHaveTextContent('Promotion')
    expect(screen.queryByTestId('eea13-barrier-row-4')).not.toBeInTheDocument()

    await completeSeededRemovalRows(user)
    await user.click(screen.getByTestId('eea13-barriers-next'))

    const entries = readBarrierState()['eea13-barriers']?.entries ?? []
    expect(entries).toHaveLength(3)

    const { container } = render(
      <div data-testid="barrier-summary-list">
        {entries.map((entry) => (
          <BarrierCategoryBlock key={entry.barrierCategory} mode="summary" value={entry} />
        ))}
      </div>,
    )
    expect(container.querySelectorAll('button,input,select,textarea')).toHaveLength(0)
    expect(screen.getByTestId('barrier-summary-list')).toHaveTextContent('Outcome 1')
  })
})

describe('SECTORAL MINIMUM', () => {
  it('binds to sectoral floors in validation and the goal editor', async () => {
    const user = userEvent.setup()
    const below = validateGoalAgainstMinimums(
      {
        occupationalLevel: 1,
        designatedGroup: 'A',
        currentRepresentation: 20,
        target: 57,
        eapBenchmark: 55,
        timeframe: 'By 31 December 2029',
        targetDate: '2029-12-31',
        measures: ['Targeted recruitment'],
      },
      'agriculture',
    )
    expect(below.binding).toBe('sectoral')
    expect(below.violations[0]).toEqual(
      expect.objectContaining({ code: 'TARGET_BELOW_EFFECTIVE_MINIMUM', binding: 'sectoral' }),
    )

    renderYearlyPlans()
    await makeFirstGoalReady(user)
    await user.clear(screen.getByTestId('eea13-goal-target-1'))
    await user.type(screen.getByTestId('eea13-goal-target-1'), '57')

    expect(screen.getByTestId('eea13-goal-binding-sectoral-1')).toBeInTheDocument()
    expect(screen.getByTestId('eea13-goal-target-error-1')).toHaveTextContent('sectoral baseline')
    expect(screen.getByTestId('eea13-goal-save-1')).toBeDisabled()

    await user.clear(screen.getByTestId('eea13-goal-target-1'))
    await user.type(screen.getByTestId('eea13-goal-target-1'), '58')
    expect(screen.getByTestId('eea13-goal-save-1')).toBeEnabled()
  })

  it('falls back to EAP when no sectoral target exists for the selected combination', () => {
    const result = validateGoalAgainstMinimums(
      {
        occupationalLevel: 1,
        designatedGroup: 'A',
        currentRepresentation: 20,
        target: 55,
        eapBenchmark: 55,
        timeframe: 'By 31 December 2029',
        targetDate: '2029-12-31',
        measures: ['Targeted recruitment'],
      },
      'missing_sector' as SectorCode,
    )
    expect(result.binding).toBe('eap')
    expect(result.sectoralTarget).toBeUndefined()

    renderYearlyPlans({ sectorCode: 'missing_sector' })
    expect(screen.getByTestId('eea13-goal-no-sectoral-target-1')).toHaveTextContent(
      'No GN 6124 target for this combination',
    )
    expect(screen.getByTestId('eea13-goal-binding-eap-1')).toBeInTheDocument()
  })
})

describe('ONGOING BLOCKED', () => {
  it('blocks goal save when the goal timeframe remains open-ended', async () => {
    const user = userEvent.setup()
    renderYearlyPlans()

    await user.clear(screen.getByTestId('eea13-goal-target-1'))
    await user.type(screen.getByTestId('eea13-goal-target-1'), '58')
    await user.type(screen.getByTestId('eea13-goal-timeframe-1'), 'ONGOING')
    await user.type(screen.getByTestId('eea13-goal-target-date-1'), '2029-12-31')
    await user.type(screen.getByTestId('eea13-goal-measure-1-1'), 'Review pipeline')

    expect(screen.getByTestId('eea13-goal-timeframe-error-1')).toHaveTextContent(
      TIMEFRAME_ONGOING_MESSAGE,
    )
    expect(screen.getByTestId('eea13-goal-save-1')).toBeDisabled()
    expect(screen.getByTestId('eea13-yearly-plans-next')).toBeDisabled()
  })

  it('blocks removal-plan advance when the timeline remains open-ended', async () => {
    const user = userEvent.setup()
    const { onAdvance } = renderBarriersRemoval({
      ...yearlyPrefill,
      barrierEntries: [makeBarrier('promotion', 'high', ['Revise promotion criteria'])],
    })

    await user.type(screen.getByRole('textbox', { name: /responsible/i }), 'HR')
    await user.type(screen.getByRole('textbox', { name: /timeline/i }), 'ONGOING')
    await user.type(
      screen.getByRole('textbox', { name: /measurable outcome/i }),
      'Published promotion metrics',
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Timeline must be a concrete date or period — "ongoing" is not accepted',
    )
    await user.click(screen.getByTestId('eea13-barriers-next'))
    expect(onAdvance).not.toHaveBeenCalled()
  })
})

describe('BUNDLE JOINT GATE', () => {
  it('marks only a signed clean pair as ready in the truth table', () => {
    const mismatchedEEA2 = eea2Wrapper({
      status: 'signed',
      workforce: setWorkforceCell(occupationalMatrix(), 'topManagement', 'africanMale', 7),
    })
    const mismatchedEEA4 = eea4Wrapper({
      status: 'signed',
      sectionC: setHeadcountCell(remunerationMatrix(), 'topManagement', 'africanMale', 9),
    })

    const cases = [
      gate(eea2Wrapper({ status: 'draft' }), eea4Wrapper({ status: 'draft' })),
      gate(eea2Wrapper({ status: 'signed' }), eea4Wrapper({ status: 'draft' })),
      gate(eea2Wrapper({ status: 'draft' }), eea4Wrapper({ status: 'signed' })),
      gate(mismatchedEEA2, mismatchedEEA4),
      gate(eea2Wrapper({ status: 'signed' }), eea4Wrapper({ status: 'signed' })),
    ]

    expect(cases.map((result) => result.ready)).toEqual([false, false, false, false, true])
    expect(cases[3]?.reason).toBe('rules-failed')
    expect(cases[4]?.bothSigned).toBe(true)
    expect(cases[4]?.report.allPassed).toBe(true)
  })

  it('records a bundle audit event when preparation succeeds', async () => {
    const user = userEvent.setup()
    server.use(
      ...wrapperHandlers(eea2Wrapper({ status: 'signed' }), eea4Wrapper({ status: 'signed' })),
    )
    const spy = appendSpy()

    render(<BundleDashboard clock={FIXED_CLOCK} periods={[period()]} />)

    await waitFor(() => {
      expect(screen.getByTestId('bundle-prepare-btn')).toBeEnabled()
    })
    await user.click(screen.getByTestId('bundle-prepare-btn'))

    expect(await screen.findByTestId('bundle-confirmation')).toHaveTextContent('Bundle validated')
    expect(spy.calls).toHaveLength(1)
    expect(spy.calls[0]).toEqual(
      expect.objectContaining({
        eventType: 'SUBMISSION_BUNDLED',
        formId: EEA2_ID,
      }),
    )
    const payload = JSON.parse(spy.calls[0]?.['newValue'] as string) as Record<string, unknown>
    expect(payload).toEqual(
      expect.objectContaining({
        marker: 'bundle validated',
        eea2FormId: EEA2_ID,
        eea4FormId: EEA4_ID,
        validatedAt: '2026-07-16T00:00:00.000Z',
      }),
    )
    expect(
      within(screen.getByTestId('bundle-confirmation')).getByText(/report/),
    ).toBeInTheDocument()
  })
})
