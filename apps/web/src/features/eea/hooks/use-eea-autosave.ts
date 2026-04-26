import {
  AppError,
  AppendResultSchema,
  EEAEventSchema,
  err,
  ok,
  type AppendResult,
  type EEAEvent,
  type Result,
} from '@simplifi/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_DEBOUNCE_MS = 800
export const EVENT_EMITTER_ENDPOINT = '/api/event-store/append'

type AutosaveRequest = (
  event: EEAEvent,
  signal: AbortSignal,
) => Promise<Result<AppendResult, AppError>>

export interface UseEEAAutosaveOptions {
  debounceMs?: number
  endpoint?: string
  request?: AutosaveRequest
}

export interface UseEEAAutosaveResult {
  autosave: (event: EEAEvent) => Promise<Result<AppendResult, AppError>>
  flush: () => Promise<Result<AppendResult, AppError> | null>
  cancel: () => void
  isSaving: boolean
  lastResult: Result<AppendResult, AppError> | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }

  if (isRecord(value)) {
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right))
    const serializedEntries: string[] = []
    for (const key of keys) {
      serializedEntries.push(`${JSON.stringify(key)}:${stableSerialize(value[key])}`)
    }
    return `{${serializedEntries.join(',')}}`
  }

  return JSON.stringify(value)
}

const readErrorMessage = async (response: Response): Promise<string | null> => {
  const contentType = response.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    const payload: unknown = await response.json().catch((): null => null)
    if (isRecord(payload)) {
      const message = payload['message']
      if (typeof message === 'string' && message.length > 0) {
        return message
      }
      const errorMessage = payload['error']
      if (typeof errorMessage === 'string' && errorMessage.length > 0) {
        return errorMessage
      }
    }
    return null
  }

  const text = await response.text().catch((): string => '')
  return text.length > 0 ? text : null
}

const createDefaultAutosaveRequest = (endpoint: string): AutosaveRequest => {
  return async (event, signal) => {
    try {
      const url = new URL(endpoint, globalThis.location.origin)
      const requestInit: RequestInit = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(event),
      }

      const response = await fetch(url.toString(), { ...requestInit, signal }).catch(
        async (error: unknown): Promise<Response> => {
          if (error instanceof TypeError && error.message.includes('signal')) {
            return fetch(url.toString(), requestInit)
          }
          throw error
        },
      )

      if (!response.ok) {
        const message =
          (await readErrorMessage(response)) ?? 'Event emitter rejected the autosave payload'
        return err(new AppError('AUTOSAVE_REQUEST_FAILED', message))
      }

      const body: unknown = await response.json()
      const parsed = AppendResultSchema.safeParse(body)
      if (!parsed.success) {
        return err(
          new AppError(
            'AUTOSAVE_INVALID_RESPONSE',
            'Event emitter returned an invalid append response',
            parsed.error,
          ),
        )
      }

      return ok(parsed.data)
    } catch (error) {
      return err(
        new AppError(
          'AUTOSAVE_REQUEST_ERROR',
          'Autosave request failed before reaching the event emitter',
          error,
        ),
      )
    }
  }
}

const buildValidationError = (event: unknown, reason: unknown): AppError =>
  new AppError('AUTOSAVE_VALIDATION_ERROR', 'Invalid EEA event payload for autosave', {
    event,
    reason,
  })

export function useEEAAutosave(options: UseEEAAutosaveOptions = {}): UseEEAAutosaveResult {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const request = useMemo<AutosaveRequest>(() => {
    if (options.request) {
      return options.request
    }
    const endpoint = options.endpoint ?? EVENT_EMITTER_ENDPOINT
    return createDefaultAutosaveRequest(endpoint)
  }, [options.endpoint, options.request])

  const [isSaving, setIsSaving] = useState(false)
  const [lastResult, setLastResult] = useState<Result<AppendResult, AppError> | null>(null)
  const timeoutReference = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerReference = useRef<AbortController | null>(null)
  const queuedEventReference = useRef<EEAEvent | null>(null)
  const queuedHashReference = useRef<string | null>(null)
  const inFlightHashReference = useRef<string | null>(null)
  const lastSuccessfulHashReference = useRef<string | null>(null)
  const lastResultReference = useRef<Result<AppendResult, AppError> | null>(null)
  const resolverReference = useRef<Array<(result: Result<AppendResult, AppError>) => void>>([])

  const resolvePending = useCallback((result: Result<AppendResult, AppError>): void => {
    const pendingResolvers = resolverReference.current
    resolverReference.current = []
    for (const resolve of pendingResolvers) {
      resolve(result)
    }
  }, [])

  const runSave = useCallback(async (): Promise<Result<AppendResult, AppError> | null> => {
    const queuedEvent = queuedEventReference.current
    const queuedHash = queuedHashReference.current
    if (queuedEvent === null || queuedHash === null) {
      return null
    }

    queuedEventReference.current = null
    queuedHashReference.current = null

    if (
      lastSuccessfulHashReference.current === queuedHash &&
      lastResultReference.current !== null &&
      lastResultReference.current.ok
    ) {
      resolvePending(lastResultReference.current)
      return lastResultReference.current
    }

    const abortController = new AbortController()
    abortControllerReference.current = abortController
    inFlightHashReference.current = queuedHash
    setIsSaving(true)

    let result: Result<AppendResult, AppError>
    try {
      result = await request(queuedEvent, abortController.signal)
    } catch (error) {
      result = err(
        new AppError(
          'AUTOSAVE_UNHANDLED_REQUEST_ERROR',
          'Autosave request failed with an unhandled error',
          error,
        ),
      )
    }

    if (result.ok) {
      lastSuccessfulHashReference.current = queuedHash
    }

    lastResultReference.current = result
    setLastResult(result)
    resolvePending(result)
    setIsSaving(false)
    abortControllerReference.current = null

    if (inFlightHashReference.current === queuedHash) {
      inFlightHashReference.current = null
    }

    return result
  }, [request, resolvePending])

  const autosave = useCallback(
    (event: EEAEvent): Promise<Result<AppendResult, AppError>> => {
      const parsedEvent = EEAEventSchema.safeParse(event)
      if (!parsedEvent.success) {
        return Promise.resolve(err(buildValidationError(event, parsedEvent.error)))
      }

      const eventHash = stableSerialize(parsedEvent.data)
      if (
        lastSuccessfulHashReference.current === eventHash &&
        lastResultReference.current !== null &&
        lastResultReference.current.ok
      ) {
        return Promise.resolve(lastResultReference.current)
      }

      if (inFlightHashReference.current === eventHash) {
        return new Promise((resolve): void => {
          resolverReference.current.push(resolve)
        })
      }

      queuedEventReference.current = parsedEvent.data
      queuedHashReference.current = eventHash

      if (timeoutReference.current !== null) {
        clearTimeout(timeoutReference.current)
      }

      return new Promise((resolve): void => {
        resolverReference.current.push(resolve)
        timeoutReference.current = setTimeout((): void => {
          timeoutReference.current = null
          void runSave()
        }, debounceMs)
      })
    },
    [debounceMs, runSave],
  )

  const flush = useCallback(async (): Promise<Result<AppendResult, AppError> | null> => {
    if (timeoutReference.current !== null) {
      clearTimeout(timeoutReference.current)
      timeoutReference.current = null
    }

    if (queuedEventReference.current !== null && queuedHashReference.current !== null) {
      return runSave()
    }

    return lastResultReference.current
  }, [runSave])

  const cancel = useCallback((): void => {
    if (timeoutReference.current !== null) {
      clearTimeout(timeoutReference.current)
      timeoutReference.current = null
    }

    queuedEventReference.current = null
    queuedHashReference.current = null

    if (abortControllerReference.current !== null) {
      abortControllerReference.current.abort()
      abortControllerReference.current = null
    }

    const cancelledResult = err(new AppError('AUTOSAVE_CANCELLED', 'Autosave request cancelled'))
    resolvePending(cancelledResult)
    setIsSaving(false)
  }, [resolvePending])

  useEffect(() => cancel, [cancel])

  return {
    autosave,
    flush,
    cancel,
    isSaving,
    lastResult,
  }
}
