import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { useEEAAutosave } from '@/hooks/use-eea-autosave'
import { EEAEventWriteError, useEEAEventWriter } from '@/hooks/use-eea-event-writer'

const FORM_ID = '11111111-1111-4111-8111-111111111111'

const autosaveOptions = {
  formId: FORM_ID,
  schema: z.object({}),
  excludeFields: ['race', 'gender', 'disability', 'disabilityNature', 'signatureDataUrl'],
}

function stubFetch(response: () => Promise<Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useEEAAutosave', () => {
  it('debounces and batches multiple field writes into a single PATCH', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 200 })))
    const { result } = renderHook(() => useEEAAutosave(autosaveOptions))

    act(() => {
      result.current.save('name', 'Thandi Mokoena')
      result.current.save('workplaceNumber', 'WP-042')
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`/eea1/${FORM_ID}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Thandi Mokoena',
      workplaceNumber: 'WP-042',
    })
    expect(result.current.lastError).toBeNull()
  })

  it.each(['race', 'gender', 'disability', 'disabilityNature', 'signatureDataUrl'])(
    'silently drops excluded PII field "%s" without any network call',
    async (field) => {
      vi.useFakeTimers()
      const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 200 })))
      const { result } = renderHook(() => useEEAAutosave(autosaveOptions))

      act(() => {
        result.current.saveField(field, 'A')
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it.each([
    [400, 'Autosave rejected: invalid field'],
    [401, 'Autosave unauthorised — please sign in again'],
    [403, 'Autosave forbidden for this form'],
    [500, 'Autosave failed (status 500)'],
  ])('surfaces a %i response as "%s"', async (status, expectedError) => {
    vi.useFakeTimers()
    stubFetch(() => Promise.resolve(new Response(null, { status })))
    const { result } = renderHook(() => useEEAAutosave(autosaveOptions))

    act(() => {
      result.current.save('name', 'Thandi')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(result.current.lastError).toBe(expectedError)
  })

  it('surfaces a network failure without echoing field values', async () => {
    vi.useFakeTimers()
    stubFetch(() => Promise.reject(new TypeError('socket closed')))
    const { result } = renderHook(() => useEEAAutosave(autosaveOptions))

    act(() => {
      result.current.save('name', 'Thandi')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(result.current.lastError).toBe('Autosave network error')
  })

  it('clears lastError after a subsequent successful save', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 400 })))
    const { result } = renderHook(() => useEEAAutosave(autosaveOptions))

    act(() => {
      result.current.save('name', 'Thandi')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(result.current.lastError).toBe('Autosave rejected: invalid field')

    fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 200 })))
    act(() => {
      result.current.save('name', 'Thandi Mokoena')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(result.current.lastError).toBeNull()
  })

  it('does not fire a PATCH after unmount cancels the pending debounce', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 200 })))
    const { result, unmount } = renderHook(() => useEEAAutosave(autosaveOptions))

    act(() => {
      result.current.save('name', 'Thandi')
    })
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('useEEAEventWriter', () => {
  it('POSTs the event to the default endpoint and resolves on 2xx', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 201 })))

    await expect(
      useEEAEventWriter({ eventType: 'EEA1_POPIA_CONSENT', formId: FORM_ID, newValue: 'ts' }),
    ).resolves.toBeUndefined()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(new URL('/api/event-store/append', globalThis.location.origin).toString())
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      eventType: 'EEA1_POPIA_CONSENT',
      formId: FORM_ID,
      newValue: 'ts',
    })
  })

  it('uses an absolute endpoint verbatim', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 200 })))

    await useEEAEventWriter(
      { eventType: 'HITL_GATE_OPENED', formId: FORM_ID, newValue: 'x' },
      { endpoint: 'https://events.example/api/append' },
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://events.example/api/append')
  })

  it('rejects an empty formId before any network call', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 200 })))

    await expect(
      useEEAEventWriter({ eventType: 'HITL_GATE_OPENED', formId: '', newValue: 'x' }),
    ).rejects.toThrow('formId is required')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an empty eventType before any network call', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 200 })))

    await expect(
      useEEAEventWriter({ eventType: '', formId: FORM_ID, newValue: 'x' }),
    ).rejects.toThrow('eventType is required')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws EEAEventWriteError carrying the status on a non-2xx response', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 403 })))

    const failure = useEEAEventWriter({
      eventType: 'HITL_GATE_OPENED',
      formId: FORM_ID,
      newValue: 'x',
    })
    await expect(failure).rejects.toBeInstanceOf(EEAEventWriteError)
    await failure.catch((error: unknown) => {
      expect((error as EEAEventWriteError).status).toBe(403)
    })
  })

  it('wraps transport failures in EEAEventWriteError with a null status', async () => {
    stubFetch(() => Promise.reject(new TypeError('network down')))

    const failure = useEEAEventWriter({
      eventType: 'HITL_GATE_OPENED',
      formId: FORM_ID,
      newValue: 'x',
    })
    await expect(failure).rejects.toThrow('Event write request failed: network down')
    await failure.catch((error: unknown) => {
      expect((error as EEAEventWriteError).status).toBeNull()
    })
  })
})
