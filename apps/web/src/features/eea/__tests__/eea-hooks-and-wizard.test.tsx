import {
  AppError,
  EEAEventSchema,
  ok,
  type AppendResult,
  type EEAEvent,
  type Result,
} from '@simplifi/shared'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EEAWizard,
  EmployerDetailsForm,
  EVENT_EMITTER_ENDPOINT,
  PREFILL_ENDPOINT,
  STEP_REGISTRY,
  UNSAVED_CHANGES_WARNING,
  extractPrefillData,
  useEEAAutosave,
  useEEAWizard,
  usePrefill,
  type PatchDraftStateInput,
  type UseEEAAutosaveOptions,
} from '..'
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
      'section-c-recruitment',
      'section-c-promotions',
      'section-c-terminations',
      'section-d-skills',
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
    expect(STEP_REGISTRY['review']?.sectionKey).toBe('review')
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
})
