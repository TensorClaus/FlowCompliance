import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { BundleDashboard, type BundlePeriodRef } from '../BundleDashboard'
import { deriveBundleBlockers, evaluateBundleGate } from '../bundle-gate'
import { server } from '@/test/server'

// ---------------------------------------------------------------------------
// Fixture builders — full 9×11 matrices matching the engine's path templates.
// ---------------------------------------------------------------------------

const EEA2_ID = '11111111-1111-4111-8111-111111111111'
const EEA4_ID = '22222222-2222-4222-8222-222222222222'

const LEVELS = [
  'topManagement',
  'seniorManagement',
  'professionallyQualified',
  'skilledTechnical',
  'semiSkilled',
  'unskilled',
  'totalPermanent',
  'temporaryEmployees',
  'grandTotal',
] as const

const CELLS = [
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
] as const

type Matrix = Record<string, Record<string, unknown>>

function buildMatrix(cell: () => unknown): Matrix {
  const matrix: Matrix = {}
  for (const level of LEVELS) {
    const row: Record<string, unknown> = {}
    for (const key of CELLS) row[key] = cell()
    matrix[level] = row
  }
  return matrix
}

const countCell = () => ({ value: 0, percent: 0 })
const headcountCell = () => ({ headcount: 0, totalRemuneration: 0 })
const breakdownCell = () => ({ fixed: 0, variable: 0, total: 0 })

interface EEA2Opts {
  status?: string
  signed?: boolean
  workforce?: Matrix
}

function eea2Wrapper(opts: EEA2Opts = {}): Record<string, unknown> {
  const status = opts.status ?? 'signed'
  const signed = opts.signed ?? status === 'signed'
  return {
    id: EEA2_ID,
    status,
    report: {
      status,
      employerProfile: {},
      sectionB: {
        workforceProfile: opts.workforce ?? buildMatrix(countCell),
        disabilityProfile: buildMatrix(countCell),
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

interface EEA4Opts {
  status?: string
  signed?: boolean
  sectionC?: Matrix
  linkedEEA2Id?: string
}

function eea4Wrapper(opts: EEA4Opts = {}): Record<string, unknown> {
  const status = opts.status ?? 'signed'
  const signed = opts.signed ?? status === 'signed'
  return {
    id: EEA4_ID,
    status,
    report: {
      status,
      linkedEEA2Id: opts.linkedEEA2Id ?? EEA2_ID,
      sectionC: opts.sectionC ?? buildMatrix(headcountCell),
      sectionD1: buildMatrix(breakdownCell),
      sectionD2: buildMatrix(breakdownCell),
      declaration: { signatureDataUrl: signed ? 'data:image/png;base64,AAAA' : '' },
    },
  }
}

function mismatchWorkforce(): Matrix {
  const matrix = buildMatrix(countCell)
  const row = matrix['topManagement']
  if (row) row['africanMale'] = { value: 7, percent: 0 }
  return matrix
}

function mismatchSectionC(): Matrix {
  const matrix = buildMatrix(headcountCell)
  const row = matrix['topManagement']
  if (row) row['africanMale'] = { headcount: 9, totalRemuneration: 0 }
  return matrix
}

const FIXED_CLOCK = () => new Date('2026-07-16T00:00:00.000Z')

function gate(eea2Form?: unknown, eea4Form?: unknown) {
  return evaluateBundleGate({ eea2Form, eea4Form, clock: FIXED_CLOCK, reportId: 'report-fixed' })
}

// ---------------------------------------------------------------------------
// MSW handler helpers
// ---------------------------------------------------------------------------

function wrapperHandlers(eea2: Record<string, unknown>, eea4: Record<string, unknown>) {
  return [
    http.get('/api/eea2/:id', () => HttpResponse.json(eea2)),
    http.get('/api/eea4/:id', () => HttpResponse.json(eea4)),
  ]
}

function appendSpy(): { calls: Array<Record<string, unknown>> } {
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
    periodId: '2025',
    label: '2025 reporting period',
    eea2FormId: EEA2_ID,
    eea4FormId: EEA4_ID,
    eea12Present: true,
    eea13Present: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Pure gate — truth table
// ---------------------------------------------------------------------------

describe('evaluateBundleGate — readiness truth table', () => {
  it('draft + draft is not ready', () => {
    const result = gate(eea2Wrapper({ status: 'draft' }), eea4Wrapper({ status: 'draft' }))
    expect(result.bothSigned).toBe(false)
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('not-signed')
  })

  it('signed + draft is not ready', () => {
    const result = gate(eea2Wrapper({ status: 'signed' }), eea4Wrapper({ status: 'draft' }))
    expect(result.bothSigned).toBe(false)
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('not-signed')
  })

  it('draft + signed is not ready', () => {
    const result = gate(eea2Wrapper({ status: 'draft' }), eea4Wrapper({ status: 'signed' }))
    expect(result.bothSigned).toBe(false)
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('not-signed')
  })

  it('signed + signed with a failing rule is not ready', () => {
    const result = gate(
      eea2Wrapper({ status: 'signed', signed: false, workforce: mismatchWorkforce() }),
      eea4Wrapper({ status: 'signed', signed: false, sectionC: mismatchSectionC() }),
    )
    expect(result.bothSigned).toBe(true)
    expect(result.report.allPassed).toBe(false)
    expect(result.ready).toBe(false)
    expect(result.reason).toBe('rules-failed')
  })

  it('signed + signed with every rule passing is the ONLY ready state', () => {
    const result = gate(
      eea2Wrapper({ status: 'signed', signed: true }),
      eea4Wrapper({ status: 'signed', signed: true }),
    )
    expect(result.bothSigned).toBe(true)
    expect(result.report.allPassed).toBe(true)
    expect(result.report.errorCount).toBe(0)
    expect(result.ready).toBe(true)
    expect(result.reason).toBe('ready')
  })
})

// ---------------------------------------------------------------------------
// Pure gate — missing form yields a typed reason, never a throw
// ---------------------------------------------------------------------------

describe('evaluateBundleGate — missing forms', () => {
  it('missing EEA4 returns not-ready with a typed reason and does not throw', () => {
    expect(() => gate(eea2Wrapper({ status: 'signed', signed: true }))).not.toThrow()
    const result = gate(eea2Wrapper({ status: 'signed', signed: true }))
    expect(result.ready).toBe(false)
    expect(result.eea4Present).toBe(false)
    expect(result.reason).toBe('eea4-missing')
  })

  it('missing EEA2 is typed eea2-missing; both missing is both-missing', () => {
    expect(gate(undefined, eea4Wrapper()).reason).toBe('eea2-missing')
    expect(gate().reason).toBe('both-missing')
  })
})

// ---------------------------------------------------------------------------
// Pure blockers — headcount mismatch names the rule + cellPath, no values
// ---------------------------------------------------------------------------

describe('deriveBundleBlockers — headcount mismatch', () => {
  it('produces one error blocker naming the rule and the cell path only', () => {
    const result = gate(
      eea2Wrapper({ status: 'signed', signed: false, workforce: mismatchWorkforce() }),
      eea4Wrapper({ status: 'signed', signed: false, sectionC: mismatchSectionC() }),
    )
    const blockers = deriveBundleBlockers(result)
    const headcount = blockers.find((b) => b.key === 'xform:eea2-eea4-headcount')
    expect(headcount).toBeDefined()
    expect(headcount?.label).toBe('EEA2/EEA4 Headcount Consistency')
    expect(headcount?.cellPaths).toContain(
      'sectionB.workforceProfile.topManagement.africanMale.value',
    )
    // The mismatch magnitudes (7 / 9) must never appear in blocker metadata.
    const serialised = JSON.stringify(blockers)
    expect(serialised).not.toMatch(/[79]/)
  })
})

// ---------------------------------------------------------------------------
// Dashboard — headcount mismatch renders a blocker with no values in its text
// ---------------------------------------------------------------------------

describe('BundleDashboard — headcount mismatch rendering', () => {
  it('names the failing rule + cell path in the blocker, values stay in the report panel', async () => {
    server.use(
      ...wrapperHandlers(
        eea2Wrapper({ status: 'signed', signed: false, workforce: mismatchWorkforce() }),
        eea4Wrapper({ status: 'signed', signed: false, sectionC: mismatchSectionC() }),
      ),
    )
    render(<BundleDashboard clock={FIXED_CLOCK} periods={[period()]} />)

    const blockers = await screen.findByTestId('bundle-blockers')
    expect(within(blockers).getByText('EEA2/EEA4 Headcount Consistency')).toBeInTheDocument()
    expect(
      within(blockers).getByText('sectionB.workforceProfile.topManagement.africanMale.value'),
    ).toBeInTheDocument()

    // No remuneration/headcount magnitudes leak into the blocker text.
    expect(blockers.textContent).not.toMatch(/[79]/)

    // The figures ARE present in the report panel diff cells (allowed).
    const panel = screen.getByTestId('eea4-validation-report-panel')
    expect(panel.textContent).toMatch(/7/)
    expect(panel.textContent).toMatch(/9/)

    expect(screen.getByTestId('bundle-prepare-btn')).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Dashboard — missing EEA4 renders the typed reason
// ---------------------------------------------------------------------------

describe('BundleDashboard — missing EEA4', () => {
  it('renders the typed reason and keeps Prepare disabled', async () => {
    server.use(http.get('/api/eea2/:id', () => HttpResponse.json(eea2Wrapper({ signed: true }))))
    render(<BundleDashboard clock={FIXED_CLOCK} periods={[period({ eea4FormId: null })]} />)

    const reason = await screen.findByTestId('bundle-gate-reason')
    expect(reason).toHaveTextContent(/EEA4 form is missing/i)
    expect(screen.getByTestId('bundle-prepare-btn')).toBeDisabled()
    expect(screen.getByTestId('bundle-eea4-status')).toHaveTextContent(/missing/i)
  })
})

// ---------------------------------------------------------------------------
// Dashboard — EEA12/EEA13 cards are informational only
// ---------------------------------------------------------------------------

describe('BundleDashboard — EEA12/EEA13 are informational', () => {
  it('toggling EEA12/EEA13 presence has no effect on readiness', async () => {
    server.use(
      ...wrapperHandlers(
        eea2Wrapper({ status: 'signed', signed: true }),
        eea4Wrapper({ status: 'signed', signed: true }),
      ),
    )

    const { rerender } = render(
      <BundleDashboard
        clock={FIXED_CLOCK}
        periods={[period({ eea12Present: true, eea13Present: true })]}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('bundle-prepare-btn')).toBeEnabled()
    })
    expect(screen.getByTestId('bundle-card-eea12')).toHaveTextContent(
      /not part of the DoEL bundle rule/i,
    )
    expect(screen.getByTestId('bundle-card-eea12-presence')).toHaveTextContent(/present/i)

    rerender(
      <BundleDashboard
        clock={FIXED_CLOCK}
        periods={[period({ eea12Present: false, eea13Present: false })]}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('bundle-card-eea12-presence')).toHaveTextContent(/absent/i)
    })
    // Presence flipped, readiness unaffected.
    expect(screen.getByTestId('bundle-prepare-btn')).toBeEnabled()
  })
})

// ---------------------------------------------------------------------------
// Dashboard — Prepare appends the audit event + shows confirmation
// ---------------------------------------------------------------------------

describe('BundleDashboard — prepare submission', () => {
  it('appends one bundle-validated audit event and renders the confirmation state', async () => {
    server.use(
      ...wrapperHandlers(
        eea2Wrapper({ status: 'signed', signed: true }),
        eea4Wrapper({ status: 'signed', signed: true }),
      ),
    )
    const spy = appendSpy()
    const user = userEvent.setup()

    render(<BundleDashboard clock={FIXED_CLOCK} periods={[period()]} />)

    await waitFor(() => {
      expect(screen.getByTestId('bundle-prepare-btn')).toBeEnabled()
    })
    await user.click(screen.getByTestId('bundle-prepare-btn'))

    await screen.findByTestId('bundle-confirmation')
    expect(screen.getByTestId('bundle-confirmation')).toHaveTextContent(
      /Bundle validated — ready for DoEL submission \(dispatch not part of M3\)/,
    )

    expect(spy.calls).toHaveLength(1)
    const call = spy.calls[0]
    if (call === undefined) throw new Error('expected one append call')
    expect(call['eventType']).toBe('SUBMISSION_BUNDLED')
    expect(call['formId']).toBe(EEA2_ID)
    const payload = JSON.parse(call['newValue'] as string) as Record<string, unknown>
    expect(payload['marker']).toBe('bundle validated')
    expect(payload['eea2FormId']).toBe(EEA2_ID)
    expect(payload['eea4FormId']).toBe(EEA4_ID)
    expect(typeof payload['reportId']).toBe('string')
    expect(payload['validatedAt']).toBe('2026-07-16T00:00:00.000Z')
  })
})

// ---------------------------------------------------------------------------
// Dashboard — re-evaluation flips ready to false on status regression
// ---------------------------------------------------------------------------

describe('BundleDashboard — focus re-evaluation', () => {
  it('a signed pair that regresses to draft flips ready to false on focus', async () => {
    server.use(
      ...wrapperHandlers(
        eea2Wrapper({ status: 'signed', signed: true }),
        eea4Wrapper({ status: 'signed', signed: true }),
      ),
    )
    render(<BundleDashboard clock={FIXED_CLOCK} periods={[period()]} />)

    await waitFor(() => {
      expect(screen.getByTestId('bundle-prepare-btn')).toBeEnabled()
    })

    // The EEA2 is edited after signing — status regresses to draft.
    server.use(http.get('/api/eea2/:id', () => HttpResponse.json(eea2Wrapper({ status: 'draft' }))))
    await act(async () => {
      globalThis.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId('bundle-prepare-btn')).toBeDisabled()
    })
    expect(screen.getByTestId('bundle-gate-reason')).toHaveTextContent(/not yet signed/i)
    expect(screen.getByTestId('bundle-blocker-unsigned:EEA2')).toHaveTextContent(/status: draft/i)
  })
})
