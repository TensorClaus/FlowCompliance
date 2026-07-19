import {
  AppError,
  EEAEventSchema,
  ok,
  type AppendResult,
  type EEAEvent,
  type MatrixCell,
  type MatrixRow,
  type OccupationalMatrix,
  type Result,
} from '@simplifi/shared'
import { EEA2_DECLARATION_TEXT } from '@simplifi/shared'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EEAWizard,
  EEA2SigningCeremonyPage,
  EmployerDetailsForm,
  EVENT_EMITTER_ENDPOINT,
  PREFILL_ENDPOINT,
  PercentageSliders,
  STEP_REGISTRY,
  UNSAVED_CHANGES_WARNING,
  extractPrefillData,
  useEEAAutosave,
  useEEAWizard,
  usePrefill,
  type PatchDraftStateInput,
  type UseEEAAutosaveOptions,
  type WizardContext,
} from '..'
import { WizardFormContext } from '../wizard-form-context'
import { server } from '@/test/server'

const buildEvent = (value: string): EEAEvent => ({
  eventId: crypto.randomUUID(),
  tenantId: 'tenant-123',
  formType: 'EEA2',
  formId: 'form-123',
  eventType: 'FIELD_UPDATED',
  fieldPath: 'employerProfile.tradeName',
  previousValue: null,
  newValue: value,
  metadata: {
    triggeredBy: 'user-1',
    ip: '127.0.0.1',
    userAgent: 'vitest',
    sessionId: 'session-1',
    reason: 'manual_edit',
  },
  timestamp: new Date('2026-01-15T10:00:00.000Z'),
})

const appendResponse = (eventId: string) => ({
  success: true,
  eventId,
  newVersion: 3,
  projectionSyncTriggered: true,
})

const matrixCell = (value: number): MatrixCell => ({ value })

const zeroMatrixRow = (): MatrixRow => ({
  africanMale: matrixCell(0),
  africanFemale: matrixCell(0),
  colouredMale: matrixCell(0),
  colouredFemale: matrixCell(0),
  indianMale: matrixCell(0),
  indianFemale: matrixCell(0),
  whiteMale: matrixCell(0),
  whiteFemale: matrixCell(0),
  foreignNationalMale: matrixCell(0),
  foreignNationalFemale: matrixCell(0),
  total: matrixCell(0),
})

const zeroOccupationalMatrix = (): OccupationalMatrix => ({
  topManagement: zeroMatrixRow(),
  seniorManagement: zeroMatrixRow(),
  professionallyQualified: zeroMatrixRow(),
  skilledTechnical: zeroMatrixRow(),
  semiSkilled: zeroMatrixRow(),
  unskilled: zeroMatrixRow(),
  temporaryEmployees: zeroMatrixRow(),
  totalPermanent: zeroMatrixRow(),
  grandTotal: zeroMatrixRow(),
})

const matrixWithHeadcount = (headcount: number): OccupationalMatrix => ({
  ...zeroOccupationalMatrix(),
  topManagement: {
    ...zeroMatrixRow(),
    africanMale: matrixCell(headcount),
    total: matrixCell(headcount),
  },
  totalPermanent: {
    ...zeroMatrixRow(),
    africanMale: matrixCell(headcount),
    total: matrixCell(headcount),
  },
  grandTotal: {
    ...zeroMatrixRow(),
    africanMale: matrixCell(headcount),
    total: matrixCell(headcount),
  },
})

const createPatchDraftState = () =>
  vi.fn((_input: PatchDraftStateInput): Promise<void> => Promise.resolve())

const getPatchDraftStateCall = (
  patchDraftState: ReturnType<typeof createPatchDraftState>,
  index: number,
): PatchDraftStateInput => {
  const call = patchDraftState.mock.calls[index]?.[0]
  if (call === undefined) {
    throw new Error(`Expected patchDraftState call ${String(index)} to exist`)
  }
  return call
}

const defaultWizardContext: WizardContext = {
  disabilityFlagActive: false,
  barrierTerminationFlag: false,
  accommodationOverdueFlag: false,
  sectionBTotals: null,
}

const renderRegistryStep = (
  stepId: string,
  options: {
    completedSteps?: Set<string>
    formState?: Record<string, unknown>
    isLocked?: boolean
    setStepData?: (stepId: string, updater: object | ((previous: unknown) => unknown)) => void
    wizardContext?: typeof defaultWizardContext
  } = {},
) => {
  const Step = STEP_REGISTRY[stepId]?.component
  if (Step === undefined) {
    throw new Error(`Missing registry step ${stepId}`)
  }

  return render(
    <WizardFormContext.Provider
      value={{
        tenantId: '',
        reportingYear: 2026,
        prefillOptions: { autoLoad: false },
        formState: options.formState ?? {},
        setStepData: options.setStepData ?? vi.fn(),
      }}
    >
      <Step
        completedSteps={options.completedSteps ?? new Set()}
        formId="form-123"
        goToStep={vi.fn()}
        onAdvance={vi.fn()}
        updateWizardContext={vi.fn()}
        wizardContext={options.wizardContext ?? defaultWizardContext}
        {...(options.isLocked === undefined ? {} : { isLocked: options.isLocked })}
      />
    </WizardFormContext.Provider>,
  )
}

describe('EEA hooks and wizard', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('useEEAAutosave debounces for 800ms and does not double-submit rapid edits', async () => {
    vi.useFakeTimers()
    const requestBodies: EEAEvent[] = []

    server.use(
      http.post(`*${EVENT_EMITTER_ENDPOINT}`, async ({ request }: { request: Request }) => {
        const rawBody: unknown = await request.json()
        const parsedBody = EEAEventSchema.parse(rawBody)
        requestBodies.push(parsedBody)
        return HttpResponse.json(appendResponse(parsedBody.eventId))
      }),
    )

    const { result } = renderHook(() => useEEAAutosave())
    const firstEdit = buildEvent('Draft 1')
    const secondEdit = buildEvent('Draft 2')

    let firstPromise!: Promise<Result<AppendResult, AppError>>
    let secondPromise!: Promise<Result<AppendResult, AppError>>

    await act(async () => {
      firstPromise = result.current.autosave(firstEdit)
      secondPromise = result.current.autosave(secondEdit)
      await vi.advanceTimersByTimeAsync(799)
    })

    expect(requestBodies).toHaveLength(0)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    expect(requestBodies).toHaveLength(1)
    expect(requestBodies[0]?.newValue).toBe('Draft 2')
    await expect(secondPromise).resolves.toMatchObject({ ok: true })
    await expect(firstPromise).resolves.toMatchObject({ ok: true })

    const dedupedResult = await result.current.autosave(secondEdit)
    expect(dedupedResult.ok).toBe(true)
    expect(requestBodies).toHaveLength(1)
  })

  it('useEEAAutosave reports validation, request, HTTP, and invalid response failures', async () => {
    vi.useFakeTimers()
    const throwingRequest: UseEEAAutosaveOptions['request'] = vi.fn(() =>
      Promise.reject(new Error('request failed')),
    )
    const { result } = renderHook(() => useEEAAutosave({ debounceMs: 1, request: throwingRequest }))

    const invalidResult = await result.current.autosave({
      ...buildEvent('Invalid'),
      eventId: 'not-a-uuid',
    } as EEAEvent)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.error.code).toBe('AUTOSAVE_VALIDATION_ERROR')
    }

    const rejectedPromise = result.current.autosave(buildEvent('Rejected request'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await expect(rejectedPromise).resolves.toMatchObject({
      ok: false,
      error: { code: 'AUTOSAVE_UNHANDLED_REQUEST_ERROR' },
    })

    server.use(
      http.post(`*${EVENT_EMITTER_ENDPOINT}`, () =>
        HttpResponse.json({ message: 'No stream version' }, { status: 409 }),
      ),
    )
    const defaultAutosave = renderHook(() => useEEAAutosave({ debounceMs: 1 }))
    const httpFailurePromise = defaultAutosave.result.current.autosave(buildEvent('HTTP failure'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await expect(httpFailurePromise).resolves.toMatchObject({
      ok: false,
      error: { code: 'AUTOSAVE_REQUEST_FAILED', message: 'No stream version' },
    })

    server.use(
      http.post(`*${EVENT_EMITTER_ENDPOINT}`, () =>
        HttpResponse.json({ error: 'Stream locked' }, { status: 423 }),
      ),
    )
    const errorBodyPromise = defaultAutosave.result.current.autosave(buildEvent('Error body'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await expect(errorBodyPromise).resolves.toMatchObject({
      ok: false,
      error: { code: 'AUTOSAVE_REQUEST_FAILED', message: 'Stream locked' },
    })

    server.use(
      http.post(
        `*${EVENT_EMITTER_ENDPOINT}`,
        () => new HttpResponse('plain failure', { status: 500 }),
      ),
    )
    const textFailurePromise = defaultAutosave.result.current.autosave(buildEvent('Text failure'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await expect(textFailurePromise).resolves.toMatchObject({
      ok: false,
      error: { code: 'AUTOSAVE_REQUEST_FAILED', message: 'plain failure' },
    })

    server.use(http.post(`*${EVENT_EMITTER_ENDPOINT}`, () => HttpResponse.json({})))
    const invalidResponsePromise = defaultAutosave.result.current.autosave(
      buildEvent('Invalid response'),
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await expect(invalidResponsePromise).resolves.toMatchObject({
      ok: false,
      error: { code: 'AUTOSAVE_INVALID_RESPONSE' },
    })
  })

  it('useEEAAutosave flushes and cancels pending work without submitting', async () => {
    vi.useFakeTimers()
    const request = vi.fn(
      (event: EEAEvent): Promise<Result<AppendResult, AppError>> =>
        Promise.resolve(ok(appendResponse(event.eventId))),
    )
    const { result } = renderHook(() => useEEAAutosave({ request }))

    await expect(result.current.flush()).resolves.toBeNull()

    const pendingPromise = result.current.autosave(buildEvent('Cancelled'))
    act(() => {
      result.current.cancel()
    })

    await expect(pendingPromise).resolves.toMatchObject({
      ok: false,
      error: { code: 'AUTOSAVE_CANCELLED' },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(request).not.toHaveBeenCalled()
  })

  it('useEEAAutosave flushes queued work and shares in-flight duplicate saves', async () => {
    vi.useFakeTimers()
    let resolveRequest: ((result: Result<AppendResult, AppError>) => void) | null = null
    const observedSignals: AbortSignal[] = []
    const request = vi.fn(
      async (event: EEAEvent, signal: AbortSignal): Promise<Result<AppendResult, AppError>> => {
        observedSignals.push(signal)
        return new Promise((resolve) => {
          resolveRequest = resolve
        })
      },
    )
    const { result } = renderHook(() => useEEAAutosave({ request }))
    const event = buildEvent('In flight')

    let queuedPromise!: Promise<Result<AppendResult, AppError>>
    let flushedPromise!: Promise<Result<AppendResult, AppError> | null>
    await act(async () => {
      queuedPromise = result.current.autosave(event)
      flushedPromise = result.current.flush()
      await Promise.resolve()
    })
    expect(request).toHaveBeenCalledTimes(1)

    const duplicatePromise = result.current.autosave(event)
    expect(request).toHaveBeenCalledTimes(1)
    expect(observedSignals[0]?.aborted).toBe(false)

    await act(async () => {
      resolveRequest?.(ok(appendResponse(event.eventId)))
      await Promise.resolve()
    })

    await expect(queuedPromise).resolves.toMatchObject({ ok: true })
    await expect(flushedPromise).resolves.toMatchObject({ ok: true })
    await expect(duplicatePromise).resolves.toMatchObject({ ok: true })
    await expect(result.current.flush()).resolves.toMatchObject({ ok: true })
  })

  it('useEEAAutosave aborts an active request when cancelled', async () => {
    vi.useFakeTimers()
    const observedSignals: AbortSignal[] = []
    const request = vi.fn(
      async (_event: EEAEvent, signal: AbortSignal): Promise<Result<AppendResult, AppError>> => {
        observedSignals.push(signal)
        return new Promise(() => {})
      },
    )
    const { result } = renderHook(() => useEEAAutosave({ request }))

    const pendingPromise = result.current.autosave(buildEvent('Abort active'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(request).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.cancel()
    })

    expect(observedSignals[0]?.aborted).toBe(true)
    await expect(pendingPromise).resolves.toMatchObject({
      ok: false,
      error: { code: 'AUTOSAVE_CANCELLED' },
    })
  })

  it('usePrefill returns employer profile + barrier categories and strips workforce/remuneration fields', async () => {
    server.use(
      http.get(`*${PREFILL_ENDPOINT}`, ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('tenantId') !== 'tenant-123') {
          return HttpResponse.json({ error: 'invalid tenant' }, { status: 400 })
        }
        return HttpResponse.json({
          report: {
            employerProfile: {
              tradeName: 'Simplifi SA',
              dtiRegistrationName: 'Simplifi Holdings',
              dtiRegistrationNumber: 'DTI-55',
              payeSarsNumber: 'PAYE-55',
              uifReferenceNumber: 'UIF-55',
              eapType: 'national',
              industrySector: 'Software',
              setaClassification: 'IT',
              telephone: '010-000-0000',
              postalAddress: {
                line1: '1 Main Road',
                city: 'Johannesburg',
                province: 'gauteng',
                postalCode: '2000',
              },
              physicalAddress: {
                line1: '1 Main Road',
                city: 'Johannesburg',
                province: 'gauteng',
                postalCode: '2000',
              },
              ceoName: 'Rivaan',
              ceoTelephone: '010-000-0001',
              ceoEmail: 'ceo@simplifi.co.za',
              seniorManagerName: 'Senior Manager',
              seniorManagerTelephone: '010-000-0002',
              seniorManagerEmail: 'hr@simplifi.co.za',
              businessType: 'private_company',
              organOfState: false,
              employeeCountBand: '50-149',
              partOfGroup: false,
            },
            sectionB: {
              workforceProfile: { shouldNotLeak: true },
              remuneration: { shouldNotLeak: true },
            },
            sectionF: {
              barriers: [
                {
                  categoryId: 1,
                  label: 'Recruitment bias',
                  barrierExists: true,
                  aaMeasuresDeveloped: true,
                },
              ],
            },
          },
          remuneration: { shouldNotLeak: true },
        })
      }),
    )

    const { result } = renderHook(() => usePrefill('tenant-123', 2025))

    await waitFor(() => {
      expect(result.current.result?.ok).toBe(true)
    })

    const prefillData = result.current.data
    expect(prefillData?.employerProfile?.tradeName).toBe('Simplifi SA')
    expect(prefillData?.sectionAReadOnly).toMatchObject({
      registrationNumber: 'DTI-55',
      sector: 'Software',
      province: 'gauteng',
    })
    expect(prefillData?.barrierCategories).toHaveLength(1)
    expect(prefillData).not.toHaveProperty('workforceProfile')
    expect(JSON.stringify(prefillData)).not.toContain('workforceProfile')
    expect(JSON.stringify(prefillData)).not.toContain('remuneration')
  })

  it('usePrefill handles input validation, request failures, manual reload, and top-level barriers', async () => {
    const emptyTenant = renderHook(() => usePrefill('', 2025, { autoLoad: false }))
    await act(async () => {
      const reloadResult = await emptyTenant.result.current.reload()
      expect(reloadResult).toMatchObject({
        ok: false,
        error: { code: 'PREFILL_INPUT_ERROR' },
      })
    })

    const invalidYear = renderHook(() => usePrefill('tenant-123', 1999, { autoLoad: false }))
    await act(async () => {
      const reloadResult = await invalidYear.result.current.reload()
      expect(reloadResult).toMatchObject({
        ok: false,
        error: { code: 'PREFILL_INPUT_ERROR' },
      })
    })

    const request = vi.fn(
      (): Promise<Result<unknown, AppError>> =>
        Promise.resolve({
          ok: false,
          error: new AppError('PREFILL_UPSTREAM_DOWN', 'upstream unavailable'),
        }),
    )
    const manual = renderHook(() => usePrefill('tenant-123', 2025, { autoLoad: false, request }))
    await act(async () => {
      const reloadResult = await manual.result.current.reload()
      expect(reloadResult).toMatchObject({
        ok: false,
        error: { code: 'PREFILL_UPSTREAM_DOWN' },
      })
    })
    expect(request).toHaveBeenCalledTimes(1)

    const extracted = extractPrefillData({
      barrierCategories: [
        {
          categoryId: 2,
          label: 'Promotion criteria',
          barrierExists: false,
          aaMeasuresDeveloped: false,
        },
        { categoryId: 99, label: 'Invalid', barrierExists: true, aaMeasuresDeveloped: true },
      ],
    })
    expect(extracted.employerProfile).toBeNull()
    expect(extracted.barrierCategories).toHaveLength(1)
    expect(extractPrefillData(null)).toEqual({
      employerProfile: null,
      sectionAReadOnly: {
        registrationNumber: '',
        sector: '',
        province: '',
        totalEmployeesPriorYear: 0,
      },
      barrierCategories: [],
    })
  })

  it('usePrefill aborts the previous request before reloading', async () => {
    const observedSignals: AbortSignal[] = []
    const request = vi.fn((_tenantId: string, _reportingYear: number, signal: AbortSignal) => {
      observedSignals.push(signal)
      return Promise.resolve(ok({ barrierCategories: [] }))
    })
    const { result } = renderHook(() =>
      usePrefill('tenant-123', 2025, { autoLoad: false, request }),
    )

    await act(async () => {
      await result.current.reload()
      await result.current.reload()
    })

    expect(observedSignals).toHaveLength(2)
    expect(observedSignals[0]?.aborted).toBe(true)
    expect(result.current.result?.ok).toBe(true)
  })

  it('EmployerDetailsForm surfaces shared-schema validation errors before submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<EmployerDetailsForm onSubmit={onSubmit} submitLabel="Continue" />)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Trade name is required')).toBeInTheDocument()
    expect(screen.getByText('DTI registration name is required')).toBeInTheDocument()
    expect(screen.getByText('DTI registration number is required')).toBeInTheDocument()
    expect(screen.getByText('PAYE SARS number is required')).toBeInTheDocument()
    expect(screen.getByText('CEO name is required')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('exports a 14-step EEA2 registry with Sections A-H and Review', () => {
    expect(Object.keys(STEP_REGISTRY)).toEqual([
      'section-a',
      'section-b',
      'section-c1',
      'section-c2',
      'section-d1',
      'section-d2',
      'section-e-sector-targets',
      'section-e-next-year-targets',
      'section-f-consultation',
      'section-f-barriers',
      'section-g-monitoring',
      'section-h-declaration',
      'section-h-hitl',
      'review',
    ])
    expect(STEP_REGISTRY['section-a']?.sectionKey).toBe('sectionA')
    expect(STEP_REGISTRY['section-b']?.sectionKey).toBe('sectionB')
    expect(STEP_REGISTRY['section-c1']?.sectionKey).toBe('sectionC.current')
    expect(STEP_REGISTRY['section-d2']?.sectionKey).toBe('sectionD.trainingSpend')
    expect(STEP_REGISTRY['review']?.sectionKey).toBe('review')
  })

  it('registry components cover locked read-only, placeholders, D1 edits, and review submit paths', async () => {
    const user = userEvent.setup()
    const setStepData = vi.fn()

    const sectionAView = renderRegistryStep('section-a', {
      formState: {
        'section-a': {
          registrationNumber: 'REG-LOCKED',
          sector: 'Technology',
          province: 'gauteng',
          totalEmployeesPriorYear: 100,
          primaryContactName: 'Rivaan',
          primaryContactEmail: 'rivaan@simplifi.co.za',
          reportingYear: 2026,
        },
      },
      isLocked: true,
    })
    expect(screen.getByText('REG-LOCKED')).toBeInTheDocument()
    sectionAView.unmount()

    const sectionBView = renderRegistryStep('section-b', {
      formState: {
        'section-b': {
          permanent: { male: 1, female: 2 },
          nonPermanent: { male: 3, female: 4 },
          contract: { male: 5, female: 6 },
        },
      },
      isLocked: true,
    })
    expect(screen.getByText('Grand total')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
    sectionBView.unmount()

    const sectionD1View = renderRegistryStep('section-d1', {
      formState: { 'section-d1': zeroOccupationalMatrix() },
      setStepData,
    })
    fireEvent.change(screen.getAllByRole('spinbutton')[0] as HTMLElement, {
      target: { value: '3' },
    })
    expect(setStepData).toHaveBeenCalledWith('section-d1', expect.any(Object))
    sectionD1View.unmount()

    const placeholderView = renderRegistryStep('section-e-next-year-targets')
    expect(
      screen.getByText('This section will be completed in the next EEA2 tasks.'),
    ).toBeInTheDocument()
    placeholderView.unmount()

    const allCompletedSteps = new Set(
      Object.keys(STEP_REGISTRY).filter((stepId) => stepId !== 'review'),
    )
    const reviewState = {
      'section-a': {
        registrationNumber: 'REG-REVIEW',
        primaryContactName: 'Rivaan',
        primaryContactEmail: 'rivaan@simplifi.co.za',
        reportingYear: 2026,
      },
      'section-b': { permanent: 1, complete: true },
      'section-c1': null,
      'section-c2': 4,
      'section-d1': {},
      'section-d2': false,
    }

    const lockedReview = renderRegistryStep('review', {
      completedSteps: allCompletedSteps,
      formState: reviewState,
      isLocked: true,
      wizardContext: {
        ...defaultWizardContext,
        barrierTerminationFlag: true,
        accommodationOverdueFlag: true,
      },
    })
    expect(screen.getByTestId('barrier-termination-banner')).toBeInTheDocument()
    expect(screen.getByTestId('accommodation-overdue-banner')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit for CEO signing' })).not.toBeInTheDocument()
    lockedReview.unmount()

    const statusBodies: Array<Record<string, unknown>> = []
    server.use(
      http.patch('*/api/eea2/:formId/status', async ({ request }: { request: Request }) => {
        statusBodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({ status: 'pending_ceo' })
      }),
    )
    const successfulReview = renderRegistryStep('review', {
      completedSteps: allCompletedSteps,
      formState: reviewState,
    })
    await user.click(screen.getByRole('button', { name: 'Submit for CEO signing' }))
    await waitFor(() => {
      expect(statusBodies).toEqual([{ status: 'pending_ceo' }])
    })
    successfulReview.unmount()

    server.use(
      http.patch('*/api/eea2/:formId/status', () =>
        HttpResponse.json({ error: 'Unable to queue signing' }, { status: 409 }),
      ),
    )
    renderRegistryStep('review', {
      completedSteps: allCompletedSteps,
      formState: reviewState,
    })
    await user.click(screen.getByRole('button', { name: 'Submit for CEO signing' }))
    expect(await screen.findByText('Unable to queue signing')).toBeInTheDocument()
  })

  it('useEEAWizard exposes updateWizardContext and merges patches', () => {
    const { result } = renderHook(() => useEEAWizard({ formId: 'form-123' }))

    act(() => {
      result.current.updateWizardContext({ disabilityFlagActive: true })
    })

    expect(result.current.wizardContext).toMatchObject({
      disabilityFlagActive: true,
      barrierTerminationFlag: false,
    })
  })

  it('latches barrier/accommodation event flags but recomputes disability live', () => {
    const { result } = renderHook(() => useEEAWizard({ formId: 'form-123' }))

    act(() => {
      result.current.updateWizardContext({
        disabilityFlagActive: true,
        barrierTerminationFlag: true,
        accommodationOverdueFlag: true,
      })
    })

    expect(result.current.wizardContext).toMatchObject({
      disabilityFlagActive: true,
      barrierTerminationFlag: true,
      accommodationOverdueFlag: true,
    })

    act(() => {
      result.current.updateWizardContext({
        disabilityFlagActive: false,
        barrierTerminationFlag: false,
        accommodationOverdueFlag: false,
      })
    })

    // Disability representation is a live condition (rule_eea_013): a compliant
    // count clears it. The two event flags record something that occurred in the
    // reporting period, so they stay latched once raised.
    expect(result.current.wizardContext).toMatchObject({
      disabilityFlagActive: false,
      barrierTerminationFlag: true,
      accommodationOverdueFlag: true,
    })
  })

  it('SectionC1 shows the disability banner for a designated employer below 3%', () => {
    renderRegistryStep('section-c1', {
      formState: { 'section-c1': matrixWithHeadcount(100) },
      wizardContext: { ...defaultWizardContext, disabilityHeadcount: 0 },
    })

    expect(screen.getByTestId('disability-flag-banner')).toBeInTheDocument()
  })

  it('SectionC1 clears the disability banner once a compliant count is captured', () => {
    // 100 employees, 5 with disabilities = 5% >= 3% target → flag must NOT fire.
    renderRegistryStep('section-c1', {
      formState: { 'section-c1': matrixWithHeadcount(100) },
      wizardContext: { ...defaultWizardContext, disabilityHeadcount: 5 },
    })

    expect(screen.queryByTestId('disability-flag-banner')).not.toBeInTheDocument()
  })

  it('SectionC1 does not fire the disability flag below the designated threshold', () => {
    // 10 employees (< 50) is not a designated employer, so rule_eea_013 is inert.
    renderRegistryStep('section-c1', {
      formState: { 'section-c1': matrixWithHeadcount(10) },
      wizardContext: { ...defaultWizardContext, disabilityHeadcount: 0 },
    })

    expect(screen.queryByTestId('disability-flag-banner')).not.toBeInTheDocument()
  })

  it('SectionC1 captures the disability headcount through the manual input', () => {
    const updateWizardContext = vi.fn()
    const Step = STEP_REGISTRY['section-c1']?.component
    if (Step === undefined) throw new Error('Missing section-c1 step')

    render(
      <WizardFormContext.Provider
        value={{
          tenantId: '',
          reportingYear: 2026,
          prefillOptions: { autoLoad: false },
          formState: { 'section-c1': matrixWithHeadcount(100) },
          setStepData: vi.fn(),
        }}
      >
        <Step
          completedSteps={new Set()}
          formId="form-123"
          goToStep={vi.fn()}
          onAdvance={vi.fn()}
          updateWizardContext={updateWizardContext}
          wizardContext={{ ...defaultWizardContext, disabilityHeadcount: 0 }}
        />
      </WizardFormContext.Provider>,
    )

    fireEvent.change(screen.getByLabelText('Employees with disabilities'), {
      target: { value: '7' },
    })

    expect(updateWizardContext).toHaveBeenCalledWith({ disabilityHeadcount: 7 })
  })

  it('useEEAWizard gates advance on schema validity and stores Section B totals', async () => {
    const patchDraftState = createPatchDraftState()
    const { result } = renderHook(() =>
      useEEAWizard({
        formId: 'form-123',
        patchDraftState,
      }),
    )

    expect(result.current.currentStep).toBe('section-a')
    expect(result.current.canAdvance).toBe(false)

    act(() => {
      result.current.setStepData('section-a', {
        registrationNumber: 'DTI-55',
        sector: 'Software',
        province: 'gauteng',
        totalEmployeesPriorYear: 100,
        primaryContactName: 'Rivaan',
        primaryContactEmail: 'invalid-email',
        reportingYear: 2026,
      })
    })
    expect(result.current.canAdvance).toBe(false)

    act(() => {
      result.current.setStepData('section-a', {
        registrationNumber: 'DTI-55',
        sector: 'Software',
        province: 'gauteng',
        totalEmployeesPriorYear: 100,
        primaryContactName: 'Rivaan',
        primaryContactEmail: 'rivaan@simplifi.co.za',
        reportingYear: 2026,
      })
    })
    expect(result.current.canAdvance).toBe(true)

    await act(async () => {
      await result.current.advance()
    })

    expect(result.current.currentStep).toBe('section-b')
    expect(result.current.completedSteps.has('section-a')).toBe(true)
    const sectionAPatch = getPatchDraftStateCall(patchDraftState, 0)
    expect(sectionAPatch.formId).toBe('form-123')
    expect(sectionAPatch.stepId).toBe('section-a')
    expect(sectionAPatch.sectionKey).toBe('sectionA')
    expect(sectionAPatch.stepData).toMatchObject({
      primaryContactEmail: 'rivaan@simplifi.co.za',
    })

    act(() => {
      result.current.setStepData('section-b', {
        permanent: { male: 2, female: 3 },
        nonPermanent: { male: 4, female: 1 },
        contract: { male: 6, female: 7 },
      })
    })
    expect(result.current.canAdvance).toBe(true)

    await act(async () => {
      await result.current.advance()
    })

    expect(result.current.wizardContext.sectionBTotals).toEqual({
      permanent: 5,
      nonPermanent: 5,
      contract: 13,
      grandTotal: 23,
    })
  })

  it('EEAWizard shows the 14-step shell, blocks empty Section A email, and computes Section B totals', async () => {
    const user = userEvent.setup()
    const patchDraftState = createPatchDraftState()
    server.use(
      http.get(`*${PREFILL_ENDPOINT}`, () =>
        HttpResponse.json({
          report: {
            employerProfile: {
              registeredName: 'Simplifi Holdings',
              companyRegNumber: 'REG-2026-001',
              sectorCode: 'Technology',
              province: 'gauteng',
              totalEmployees: 42,
            },
          },
        }),
      ),
    )

    render(
      <EEAWizard
        formId="form-123"
        tenantId="tenant-123"
        reportingYear={2026}
        patchDraftState={patchDraftState}
      />,
    )

    expect(await screen.findByDisplayValue('REG-2026-001')).toHaveAttribute('readOnly')
    expect(screen.getByDisplayValue('Technology')).toHaveAttribute('readOnly')
    expect(screen.getByDisplayValue('gauteng')).toHaveAttribute('readOnly')
    expect(screen.getByDisplayValue('42')).toHaveAttribute('readOnly')
    expect(screen.getByText('Step 1 of 14')).toBeInTheDocument()

    const nextButton = screen.getByRole('button', { name: 'Next' })
    expect(nextButton).toBeDisabled()

    await user.type(screen.getByLabelText('Primary contact name'), 'Rivaan')
    await user.type(screen.getByLabelText('Primary contact email'), 'not-an-email')
    expect(nextButton).toBeDisabled()
    await user.clear(screen.getByLabelText('Primary contact email'))
    await user.type(screen.getByLabelText('Primary contact email'), 'rivaan@simplifi.co.za')
    expect(nextButton).toBeEnabled()

    await user.click(nextButton)
    expect(await screen.findByText('Step 2 of 14')).toBeInTheDocument()
    const sectionAPatch = getPatchDraftStateCall(patchDraftState, 0)
    expect(sectionAPatch.sectionKey).toBe('sectionA')
    expect(sectionAPatch.stepData).toMatchObject({
      primaryContactEmail: 'rivaan@simplifi.co.za',
    })

    const permanentMale = screen.getByLabelText('Permanent male')
    const permanentFemale = screen.getByLabelText('Permanent female')
    const permanentTotal = screen.getByLabelText('Permanent total')
    const grandTotal = screen.getByLabelText('Grand total')
    expect(permanentTotal).toHaveAttribute('readOnly')
    expect(grandTotal).toHaveAttribute('readOnly')

    await user.clear(permanentMale)
    await user.type(permanentMale, '5')
    await user.clear(permanentFemale)
    await user.type(permanentFemale, '7')
    expect(permanentTotal).toHaveValue(12)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    const sectionBPatch = getPatchDraftStateCall(patchDraftState, 1)
    expect(sectionBPatch.sectionKey).toBe('sectionB')
    expect(sectionBPatch.stepData).toMatchObject({
      totals: { permanent: 12, grandTotal: 12 },
    })
  })

  it('Section C1 hard-blocks advance when workforce total mismatches Section B total', async () => {
    const user = userEvent.setup()
    const patchDraftState = createPatchDraftState()

    render(<EEAWizard formId="form-123" patchDraftState={patchDraftState} />)

    await user.type(screen.getByLabelText('Primary contact name'), 'Rivaan')
    await user.type(screen.getByLabelText('Primary contact email'), 'rivaan@simplifi.co.za')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    await user.clear(await screen.findByLabelText('Permanent male'))
    await user.type(screen.getByLabelText('Permanent male'), '12')
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Step 3 of 14')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Workforce profile total (0) does not match total workforce count (12) entered in Section B.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(patchDraftState).toHaveBeenCalledTimes(2)
  })

  it('Section C1 shows a non-dismissible disability banner that clears when compliant', async () => {
    const user = userEvent.setup()

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        initialFormState={{
          'section-b': {
            permanent: { male: 100, female: 0 },
            nonPermanent: { male: 0, female: 0 },
            contract: { male: 0, female: 0 },
            totals: { permanent: 100, nonPermanent: 0, contract: 0, grandTotal: 100 },
          },
          'section-c1': matrixWithHeadcount(100),
        }}
        initialWizardContext={{
          disabilityFlagActive: false,
          barrierTerminationFlag: false,
          accommodationOverdueFlag: false,
          sectionBTotals: { permanent: 100, nonPermanent: 0, contract: 0, grandTotal: 100 },
        }}
        patchDraftState={createPatchDraftState()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Section C - Current workforce' }))

    // Designated employer (100 employees), 0 with disabilities → banner fires and
    // cannot be dismissed (rule_eea_013).
    expect(await screen.findByTestId('disability-flag-banner')).toBeInTheDocument()
    expect(document.querySelector('[data-dismiss]')).toBeNull()
    expect(document.querySelector('[data-close]')).toBeNull()

    // Capture a compliant count (5 of 100 = 5% >= 3%) → the live banner clears.
    fireEvent.change(screen.getByLabelText('Employees with disabilities'), {
      target: { value: '5' },
    })

    await waitFor(() => {
      expect(screen.queryByTestId('disability-flag-banner')).not.toBeInTheDocument()
    })
  })

  it('Section C2 pre-fills latest EEA13 goals and renders blank on 404', async () => {
    const user = userEvent.setup()
    server.use(
      http.get('*/api/eea13/latest', ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('tenantId') === 'tenant-404') {
          return HttpResponse.json({ error: 'not found' }, { status: 404 })
        }

        return HttpResponse.json({
          sectionC: {
            goals: matrixWithHeadcount(9),
          },
        })
      }),
    )

    const { rerender } = render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        patchDraftState={createPatchDraftState()}
        prefillOptions={{ autoLoad: false }}
        tenantId="tenant-123"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Section C - Numerical goals' }))
    expect(await screen.findByDisplayValue('9')).toBeInTheDocument()

    rerender(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-456"
        patchDraftState={createPatchDraftState()}
        prefillOptions={{ autoLoad: false }}
        tenantId="tenant-404"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Section C - Numerical goals' }))
    expect(await screen.findByTestId('occupational-matrix')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('9')).not.toBeInTheDocument()
  })

  it('PercentageSliders updates labels in real time and shows invalid totals', () => {
    const onChange = vi.fn()

    render(
      <PercentageSliders
        groups={['African', 'Coloured', 'Indian or Asian', 'White', 'Non-designated']}
        onChange={onChange}
        values={[20, 20, 20, 20, 10]}
      />,
    )

    expect(screen.getByText('African: 20%')).toBeInTheDocument()
    expect(screen.getByText('Total: 90%')).toHaveClass('text-red-700')

    fireEvent.change(screen.getByLabelText('African: 20%'), { target: { value: '34' } })

    expect(onChange).toHaveBeenCalledWith([34, 20, 20, 20, 10])
  })

  it('Section D2 blocks advance until slider percentages sum to exactly 100', async () => {
    const user = userEvent.setup()
    const patchDraftState = createPatchDraftState()

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        patchDraftState={patchDraftState}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Section D - Training spend' }))

    expect(screen.getByText('Total: 0%')).toHaveClass('text-red-700')
    expect(screen.getByText('Percentages must sum to 100%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('African: 0%'), { target: { value: '99' } })
    expect(screen.getByText('Total: 99%')).toHaveClass('text-red-700')
    expect(screen.getByText('Percentages must sum to 100%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('African: 99%'), { target: { value: '100' } })
    await user.type(screen.getByLabelText('Total training budget (ZAR)'), '50000')
    await user.type(screen.getByLabelText('Training spend narrative'), 'Focused scarce-skills plan')

    expect(screen.getByText('African: 100%')).toBeInTheDocument()
    expect(screen.getByText('26 / 500')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Next' }))

    const sectionDPatch = getPatchDraftStateCall(patchDraftState, 0)
    expect(sectionDPatch.sectionKey).toBe('sectionD.trainingSpend')
    expect(sectionDPatch.stepData).toMatchObject({
      percentages: [100, 0, 0, 0, 0],
      totalBudget: 50_000,
    })
  })

  it('Section E disables every promotion matrix input when no promotions is checked', async () => {
    const user = userEvent.setup()

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        patchDraftState={createPatchDraftState()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Section E - Sector targets' }))
    const checkbox = screen.getByLabelText('No promotions in reporting period')
    await user.click(checkbox)

    expect(checkbox).toBeChecked()
    expect(screen.getByLabelText('Promotion from level')).toBeDisabled()
    expect(screen.getByLabelText('Promotion to level')).toBeDisabled()
    const matrixInputs = screen.getAllByRole('spinbutton')
    expect(matrixInputs.length).toBeGreaterThan(0)
    for (const input of matrixInputs) {
      expect(input).toBeDisabled()
    }
  })

  it('Section F writes and latches the barrier termination flag event', async () => {
    const user = userEvent.setup()
    const eventBodies: Array<Record<string, unknown>> = []

    server.use(
      http.post('*/api/event-store/append', async ({ request }: { request: Request }) => {
        eventBodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({ success: true })
      }),
    )

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        patchDraftState={createPatchDraftState()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Section F - Consultation' }))
    await user.selectOptions(
      screen.getByLabelText('Top management termination reason'),
      'dismissal_misconduct',
    )
    const firstMatrixInput = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(firstMatrixInput as HTMLElement, { target: { value: '20' } })

    await waitFor(() => {
      expect(eventBodies).toHaveLength(1)
    })
    expect(eventBodies[0]).toMatchObject({ eventType: 'BARRIER_TERMINATION_FLAG' })
    expect(screen.getByTestId('barrier-termination-banner')).toBeInTheDocument()

    fireEvent.change(firstMatrixInput as HTMLElement, { target: { value: '0' } })
    expect(screen.getByTestId('barrier-termination-banner')).toBeInTheDocument()
    expect(eventBodies).toHaveLength(1)
  })

  it('Section G shows the WSP warning without blocking advance', async () => {
    const user = userEvent.setup()
    const patchDraftState = createPatchDraftState()

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        initialFormState={{
          'section-g-monitoring': {
            matrix: zeroOccupationalMatrix(),
            wspSubmitted: true,
            narrative: '',
          },
        }}
        patchDraftState={patchDraftState}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Section G - Monitoring' }))
    expect(screen.queryByTestId('wsp-warning-banner')).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('WSP submitted to the SETA'))
    expect(screen.getByTestId('wsp-warning-banner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Step 12 of 14')).toBeInTheDocument()
    expect(getPatchDraftStateCall(patchDraftState, 0)).toMatchObject({
      stepId: 'section-g-monitoring',
      sectionKey: 'sectionG.skillsDevelopment',
    })
  })

  it('Section H records overdue accommodation requests and exposes a non-dismissible banner', async () => {
    const user = userEvent.setup()
    const eventBodies: Array<Record<string, unknown>> = []
    const overdueDate = new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    server.use(
      http.post('*/api/event-store/append', async ({ request }: { request: Request }) => {
        eventBodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({ success: true })
      }),
    )

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        patchDraftState={createPatchDraftState()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Section H - Declaration' }))
    fireEvent.change(screen.getByLabelText('Physical status'), { target: { value: 'Pending' } })
    fireEvent.change(screen.getByLabelText('Physical created at'), {
      target: { value: overdueDate },
    })
    fireEvent.change(screen.getByLabelText('Physical count'), { target: { value: '1' } })

    await waitFor(() => {
      expect(eventBodies).toHaveLength(1)
    })
    expect(eventBodies[0]).toMatchObject({ eventType: 'ACCOMMODATION_OVERDUE_FLAG' })
    const banner = screen.getByTestId('accommodation-overdue-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.querySelector('[data-dismiss]')).toBeNull()
  })

  it('EEAWizard warns on dirty navigation and removes beforeunload listener on unmount', async () => {
    const user = userEvent.setup()
    const confirmNavigation = vi.fn(() => false)
    const patchDraftState = createPatchDraftState()
    const addListenerSpy = vi.spyOn(globalThis, 'addEventListener')
    const removeListenerSpy = vi.spyOn(globalThis, 'removeEventListener')

    const { unmount } = render(
      <EEAWizard confirmNavigation={confirmNavigation} patchDraftState={patchDraftState} />,
    )
    await user.type(screen.getByLabelText('Primary contact name'), 'Rivaan')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true })
    Object.defineProperty(beforeUnloadEvent, 'returnValue', {
      configurable: true,
      writable: true,
      value: '',
    })
    globalThis.dispatchEvent(beforeUnloadEvent)
    expect(beforeUnloadEvent.defaultPrevented).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Section B - Workforce totals' }))
    expect(confirmNavigation).toHaveBeenCalledWith(UNSAVED_CHANGES_WARNING)
    expect(screen.getByLabelText('Primary contact name')).toBeInTheDocument()

    const beforeUnloadHandler = addListenerSpy.mock.calls.find(
      (call): boolean => call[0] === 'beforeunload',
    )?.[1]
    unmount()
    expect(beforeUnloadHandler).toBeDefined()
    expect(removeListenerSpy).toHaveBeenCalledWith('beforeunload', beforeUnloadHandler)
  })

  it('EEAWizard allows confirmed dirty navigation and completes from review', async () => {
    const user = userEvent.setup()
    const confirmNavigation = vi.fn(() => true)
    const onComplete = vi.fn((_values: Record<string, unknown>): void => {})
    const patchDraftState = createPatchDraftState()

    render(
      <EEAWizard
        confirmNavigation={confirmNavigation}
        onComplete={onComplete}
        patchDraftState={patchDraftState}
      />,
    )
    await user.type(screen.getByLabelText('Primary contact name'), 'Rivaan')
    await user.click(screen.getByRole('button', { name: 'Review and submit' }))
    await user.click(screen.getByRole('button', { name: 'Submit' }))

    expect(confirmNavigation).toHaveBeenCalledWith(UNSAVED_CHANGES_WARNING)
    const completedState = onComplete.mock.calls[0]?.[0]
    expect(completedState?.['section-a']).toMatchObject({ primaryContactName: 'Rivaan' })
  })

  it('Review disables submit with a real disabled attribute when disability flag is active', async () => {
    const user = userEvent.setup()

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        initialWizardContext={{
          disabilityFlagActive: true,
          barrierTerminationFlag: false,
          accommodationOverdueFlag: false,
          sectionBTotals: null,
        }}
        patchDraftState={createPatchDraftState()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Review and submit' }))

    expect(screen.getByTestId('review-disability-flag')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit for CEO signing' })).toBeDisabled()
    expect(document.querySelector('[data-dismiss]')).toBeNull()
    expect(document.querySelector('[data-close]')).toBeNull()
  })

  it('Review disables submit when the wizard still has incomplete steps', async () => {
    const user = userEvent.setup()

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        patchDraftState={createPatchDraftState()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Review and submit' }))

    expect(screen.getByRole('button', { name: 'Submit for CEO signing' })).toBeDisabled()
  })

  it('keeps blank submissions guarded with zero completed steps', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()

    render(
      <EEAWizard
        confirmNavigation={() => true}
        formId="form-123"
        onComplete={onComplete}
        patchDraftState={createPatchDraftState()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Review and submit' }))

    const reviewSubmitButton = screen.getByRole('button', { name: 'Submit for CEO signing' })
    expect(reviewSubmitButton).toBeDisabled()
    await user.click(reviewSubmitButton)
    expect(reviewSubmitButton).toBeDisabled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('Signing ceremony uses the shared declaration text and gates submission on all fields', async () => {
    const user = userEvent.setup()
    const signRequest = vi.fn(() => Promise.resolve({ status: 'signed' as const }))
    const navigateToLockedView = vi.fn()

    render(
      <EEA2SigningCeremonyPage
        formId="form-123"
        navigateToLockedView={navigateToLockedView}
        signRequest={signRequest}
      />,
    )

    const signButton = screen.getByRole('button', { name: 'Confirm and Sign' })
    const declarationCheckbox = screen.getByLabelText(EEA2_DECLARATION_TEXT)
    expect(declarationCheckbox).toBeInTheDocument()
    expect(declarationCheckbox.closest('label')?.textContent).toContain(EEA2_DECLARATION_TEXT)
    expect(signButton).toBeDisabled()

    await user.type(screen.getByLabelText('TOTP code'), '123456')
    await user.type(
      screen.getByPlaceholderText('Type your full registered name exactly'),
      'Rivaan Pillay',
    )
    await user.click(declarationCheckbox)

    expect(signButton).toBeEnabled()
    await user.click(signButton)

    expect(signRequest).toHaveBeenCalledWith({
      formId: 'form-123',
      totpCode: '123456',
      typedName: 'Rivaan Pillay',
      confirmationChecked: true,
    })
    expect(navigateToLockedView).toHaveBeenCalledWith('form-123')
  })
})
