import {
  AppError,
  BarrierRecordSchema,
  EmployerProfileSchema,
  err,
  ok,
  type BarrierRecord,
  type EmployerProfile,
  type Result,
} from '@simplifi/shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export const PREFILL_ENDPOINT = '/api/eea2/prefill'

export interface PrefillData {
  employerProfile: EmployerProfile | null
  barrierCategories: BarrierRecord[]
}

type PrefillRequest = (
  tenantId: string,
  reportingYear: number,
  signal: AbortSignal,
) => Promise<Result<unknown, AppError>>

export interface UsePrefillOptions {
  endpoint?: string
  request?: PrefillRequest
  autoLoad?: boolean
}

export interface UsePrefillResult {
  data: PrefillData | null
  result: Result<PrefillData, AppError> | null
  isLoading: boolean
  reload: () => Promise<Result<PrefillData, AppError>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const defaultPrefillData: PrefillData = {
  employerProfile: null,
  barrierCategories: [],
}

const createDefaultPrefillRequest = (endpoint: string): PrefillRequest => {
  return async (tenantId, reportingYear, signal) => {
    try {
      const url = new URL(endpoint, globalThis.location.origin)
      url.searchParams.set('tenantId', tenantId)
      url.searchParams.set('reportingYear', String(reportingYear))

      const response = await fetchWithSignalRetry(url.toString(), createPrefillRequestInit(signal))

      if (!response.ok) {
        return err(new AppError('PREFILL_REQUEST_FAILED', 'Prefill endpoint returned an error'))
      }

      const payload: unknown = await response.json()
      return ok(payload)
    } catch (error) {
      return err(new AppError('PREFILL_REQUEST_ERROR', 'Failed to load prefill data', error))
    }
  }
}

const toReportShape = (payload: unknown): Record<string, unknown> => {
  if (!isRecord(payload)) {
    return {}
  }

  const report = payload['report']
  if (isRecord(report)) {
    return report
  }

  return payload
}

const createPrefillRequestInit = (signal: AbortSignal): RequestInit => ({
  method: 'GET',
  headers: { accept: 'application/json' },
  signal,
})

const fetchWithSignalRetry = async (url: string, requestInit: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, requestInit)
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('signal')) {
      const { signal: _signal, ...requestInitWithoutSignal } = requestInit
      return fetch(url, requestInitWithoutSignal)
    }
    throw error
  }
}

export const extractPrefillData = (payload: unknown): PrefillData => {
  const report = toReportShape(payload)

  const employerProfileParse = EmployerProfileSchema.safeParse(report['employerProfile'])
  const employerProfile = employerProfileParse.success ? employerProfileParse.data : null

  let barrierCandidates: unknown[] = []
  const sectionF = report['sectionF']
  if (isRecord(sectionF) && Array.isArray(sectionF['barriers'])) {
    barrierCandidates = sectionF['barriers']
  } else if (isRecord(payload) && Array.isArray(payload['barrierCategories'])) {
    barrierCandidates = payload['barrierCategories']
  }

  const barrierCategories: BarrierRecord[] = []
  for (const barrierCandidate of barrierCandidates) {
    const parsedBarrier = BarrierRecordSchema.safeParse(barrierCandidate)
    if (parsedBarrier.success) {
      barrierCategories.push(parsedBarrier.data)
    }
  }

  return {
    employerProfile,
    barrierCategories,
  }
}

export function usePrefill(
  tenantId: string,
  reportingYear: number,
  options: UsePrefillOptions = {},
): UsePrefillResult {
  const autoLoad = options.autoLoad ?? true
  const request = useMemo<PrefillRequest>(() => {
    if (options.request) {
      return options.request
    }

    return createDefaultPrefillRequest(options.endpoint ?? PREFILL_ENDPOINT)
  }, [options.endpoint, options.request])

  const [data, setData] = useState<PrefillData | null>(null)
  const [result, setResult] = useState<Result<PrefillData, AppError> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const abortControllerReference = useRef<AbortController | null>(null)

  const reload = useCallback(async (): Promise<Result<PrefillData, AppError>> => {
    if (tenantId.length === 0) {
      const tenantError = err(
        new AppError('PREFILL_INPUT_ERROR', 'Tenant ID is required to load prefill data'),
      )
      setResult(tenantError)
      return tenantError
    }

    if (!Number.isInteger(reportingYear) || reportingYear < 2000) {
      const yearError = err(
        new AppError('PREFILL_INPUT_ERROR', 'Reporting year must be a valid integer year'),
      )
      setResult(yearError)
      return yearError
    }

    if (abortControllerReference.current !== null) {
      abortControllerReference.current.abort()
    }

    const abortController = new AbortController()
    abortControllerReference.current = abortController
    setIsLoading(true)

    const response = await request(tenantId, reportingYear, abortController.signal)
    if (!response.ok) {
      setResult(response)
      setIsLoading(false)
      return response
    }

    const prefillData = extractPrefillData(response.value)
    const successResult = ok(prefillData)
    setData(prefillData)
    setResult(successResult)
    setIsLoading(false)
    return successResult
  }, [reportingYear, request, tenantId])

  useEffect(() => {
    if (!autoLoad) {
      return
    }

    void reload()
  }, [autoLoad, reload])

  useEffect(
    () => () => {
      if (abortControllerReference.current !== null) {
        abortControllerReference.current.abort()
      }
    },
    [],
  )

  return {
    data: data ?? defaultPrefillData,
    result,
    isLoading,
    reload,
  }
}
