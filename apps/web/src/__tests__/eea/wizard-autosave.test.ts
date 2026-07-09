import { AppError, err, ok, type AppendResult, type EEAEvent } from '@simplifi/shared'
import { act, renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEEAAutosave } from '@/features/eea/hooks/use-eea-autosave'
import { server } from '@/test/server'

const APPEND_RESULT: AppendResult = {
  success: true,
  eventId: '01890a5d-ac96-774b-bcce-b302099a8057',
  newVersion: 2,
  projectionSyncTriggered: true,
}

function buildEvent(overrides: Partial<EEAEvent> = {}): EEAEvent {
  return {
    eventId: '01890a5d-ac96-774b-bcce-b302099a8057',
    tenantId: 'tenant-001',
    formType: 'EEA2',
    formId: 'form-eea2-001',
    eventType: 'FIELD_UPDATED',
    fieldPath: 'sectionA.tradingName',
    previousValue: 'Old',
    newValue: 'New',
    metadata: {
      triggeredBy: 'user-001',
      ip: '196.25.1.10',
      userAgent: 'Mozilla/5.0',
      sessionId: 'sess-abc123',
    },
    timestamp: new Date('2026-01-10T09:00:00Z'),
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useEEAAutosave (wizard event autosave)', () => {
  it('rejects an invalid event with AUTOSAVE_VALIDATION_ERROR before any request', async () => {
    const request = vi.fn()
    const { result } = renderHook(() => useEEAAutosave({ request }))

    const outcome = await result.current.autosave({ eventId: 'nope' } as unknown as EEAEvent)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('AUTOSAVE_VALIDATION_ERROR')
    }
    expect(request).not.toHaveBeenCalled()
  })

  it('debounces, sends via the injected request, and dedupes an identical follow-up', async () => {
    vi.useFakeTimers()
    const request = vi.fn().mockResolvedValue(ok(APPEND_RESULT))
    const { result } = renderHook(() => useEEAAutosave({ debounceMs: 100, request }))

    let first: Awaited<ReturnType<typeof result.current.autosave>> | null = null
    act(() => {
      void result.current.autosave(buildEvent()).then((r) => {
        first = r
      })
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(request).toHaveBeenCalledTimes(1)
    expect(first).toEqual(ok(APPEND_RESULT))
    expect(result.current.lastResult).toEqual(ok(APPEND_RESULT))

    // An identical event resolves from the success cache without a new request.
    const second = await result.current.autosave(buildEvent())
    expect(second).toEqual(ok(APPEND_RESULT))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('flush() sends the queued event immediately without waiting for the debounce', async () => {
    const request = vi.fn().mockResolvedValue(ok(APPEND_RESULT))
    const { result } = renderHook(() => useEEAAutosave({ debounceMs: 60_000, request }))

    act(() => {
      void result.current.autosave(buildEvent())
    })
    const flushed = await act(async () => result.current.flush())

    expect(request).toHaveBeenCalledTimes(1)
    expect(flushed).toEqual(ok(APPEND_RESULT))
  })

  it('flush() with nothing queued returns the last result', async () => {
    const request = vi.fn()
    const { result } = renderHook(() => useEEAAutosave({ request }))

    await expect(result.current.flush()).resolves.toBeNull()
    expect(request).not.toHaveBeenCalled()
  })

  it('cancel() resolves pending saves with AUTOSAVE_CANCELLED', async () => {
    const request = vi.fn().mockResolvedValue(ok(APPEND_RESULT))
    const { result } = renderHook(() => useEEAAutosave({ debounceMs: 60_000, request }))

    let pending: Awaited<ReturnType<typeof result.current.autosave>> | null = null
    act(() => {
      void result.current.autosave(buildEvent()).then((r) => {
        pending = r
      })
    })
    act(() => {
      result.current.cancel()
    })
    await act(async () => {})

    expect(pending).not.toBeNull()
    const settled = pending as unknown as { ok: boolean; error: AppError }
    expect(settled.ok).toBe(false)
    expect(settled.error.code).toBe('AUTOSAVE_CANCELLED')
    expect(request).not.toHaveBeenCalled()
  })

  it('wraps a request that throws in AUTOSAVE_UNHANDLED_REQUEST_ERROR', async () => {
    const request = vi.fn().mockRejectedValue(new Error('exploded'))
    const { result } = renderHook(() => useEEAAutosave({ debounceMs: 10, request }))

    act(() => {
      void result.current.autosave(buildEvent())
    })
    const outcome = await act(async () => result.current.flush())

    expect(outcome?.ok).toBe(false)
    if (outcome && !outcome.ok) {
      expect(outcome.error.code).toBe('AUTOSAVE_UNHANDLED_REQUEST_ERROR')
    }
  })

  it('retryOnFailure retries a failed save until it succeeds', async () => {
    vi.useFakeTimers()
    const request = vi
      .fn()
      .mockResolvedValueOnce(err(new AppError('AUTOSAVE_REQUEST_FAILED', 'first attempt down')))
      .mockResolvedValueOnce(ok(APPEND_RESULT))
    const { result } = renderHook(() =>
      useEEAAutosave({ debounceMs: 50, request, retryDelayMs: 100, retryOnFailure: true }),
    )

    let settled: Awaited<ReturnType<typeof result.current.autosave>> | null = null
    act(() => {
      void result.current.autosave(buildEvent()).then((r) => {
        settled = r
      })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50) // debounce → first attempt fails
    })
    expect(request).toHaveBeenCalledTimes(1)
    expect(settled).toBeNull() // resolver held until success

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100) // retry timer → second attempt succeeds
    })
    expect(request).toHaveBeenCalledTimes(2)
    expect(settled).toEqual(ok(APPEND_RESULT))
  })

  it('retryOnFailure coalesces successive saves for the same fieldPath', async () => {
    vi.useFakeTimers()
    const request = vi.fn().mockResolvedValue(ok(APPEND_RESULT))
    const { result } = renderHook(() =>
      useEEAAutosave({ debounceMs: 50, request, retryOnFailure: true }),
    )

    act(() => {
      void result.current.autosave(buildEvent({ newValue: 'draft-1' }))
      void result.current.autosave(buildEvent({ newValue: 'draft-2' }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })

    expect(request).toHaveBeenCalledTimes(1)
    const sentEvent = request.mock.calls[0]?.[0] as EEAEvent
    expect(sentEvent.newValue).toBe('draft-2')
  })

  describe('default request (event emitter endpoint)', () => {
    it('resolves ok when the emitter returns a valid AppendResult', async () => {
      server.use(http.post('/api/event-store/append', () => HttpResponse.json(APPEND_RESULT)))
      const { result } = renderHook(() => useEEAAutosave({ debounceMs: 10 }))

      act(() => {
        void result.current.autosave(buildEvent())
      })
      const outcome = await act(async () => result.current.flush())

      expect(outcome?.ok).toBe(true)
    })

    it('surfaces the emitter JSON error message on a non-2xx response', async () => {
      server.use(
        http.post('/api/event-store/append', () =>
          HttpResponse.json({ message: 'tenant mismatch' }, { status: 403 }),
        ),
      )
      const { result } = renderHook(() => useEEAAutosave({ debounceMs: 10 }))

      act(() => {
        void result.current.autosave(buildEvent())
      })
      const outcome = await act(async () => result.current.flush())

      expect(outcome?.ok).toBe(false)
      if (outcome && !outcome.ok) {
        expect(outcome.error.code).toBe('AUTOSAVE_REQUEST_FAILED')
        expect(outcome.error.message).toBe('tenant mismatch')
      }
    })

    it('rejects an emitter response that fails AppendResult validation', async () => {
      server.use(http.post('/api/event-store/append', () => HttpResponse.json({ nonsense: true })))
      const { result } = renderHook(() => useEEAAutosave({ debounceMs: 10 }))

      act(() => {
        void result.current.autosave(buildEvent())
      })
      const outcome = await act(async () => result.current.flush())

      expect(outcome?.ok).toBe(false)
      if (outcome && !outcome.ok) {
        expect(outcome.error.code).toBe('AUTOSAVE_INVALID_RESPONSE')
      }
    })

    it('falls back to the plain-text error body when the response is not JSON', async () => {
      server.use(
        http.post('/api/event-store/append', () => new HttpResponse('quota hit', { status: 429 })),
      )
      const { result } = renderHook(() => useEEAAutosave({ debounceMs: 10 }))

      act(() => {
        void result.current.autosave(buildEvent())
      })
      const outcome = await act(async () => result.current.flush())

      expect(outcome?.ok).toBe(false)
      if (outcome && !outcome.ok) {
        expect(outcome.error.message).toBe('quota hit')
      }
    })
  })
})
