// @non-suppressible — POPIA s.18 audit trail + EEA event sourcing (DC-012)
//
// One-shot event writer used by gate components that must record a single
// statutory event before unlocking downstream UI (e.g. POPIA consent capture
// before demographic field collection on EEA1).
//
// Unlike useEEAAutosave, this writer is intentionally NOT debounced and
// surfaces transport errors directly to the caller. The caller is expected
// to await the promise and gate any state transition on successful resolution.

const DEFAULT_ENDPOINT = '/api/event-store/append'

export interface EEAEventWriteInput {
  readonly eventType: string
  readonly formId: string
  readonly newValue: string
}

export interface EEAEventWriteOptions {
  readonly endpoint?: string
  readonly signal?: AbortSignal
}

export class EEAEventWriteError extends Error {
  public readonly status: number | null

  public constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'EEAEventWriteError'
    this.status = status
  }
}

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const resolveEndpoint = (endpoint: string): string => {
  if (isAbsoluteUrl(endpoint)) {
    return endpoint
  }
  return new URL(endpoint, globalThis.location.origin).toString()
}

/**
 * useEEAEventWriter
 *
 * Plain async function (not a React hook in the useState sense — no internal
 * state, no rules-of-hooks dependency). The `use` prefix follows the call
 * convention required by the PopiaConsentGate spec and keeps the call site
 * symmetrical with other EEA hooks.
 *
 * Resolves with no value on success. Throws EEAEventWriteError on any failure
 * (network, non-2xx response, abort). The caller MUST treat any thrown error
 * as "event not recorded" and must NOT proceed to dependent state changes.
 */
export async function useEEAEventWriter(
  input: EEAEventWriteInput,
  options: EEAEventWriteOptions = {},
): Promise<void> {
  if (input.formId.length === 0) {
    throw new EEAEventWriteError('formId is required to append an EEA event')
  }
  if (input.eventType.length === 0) {
    throw new EEAEventWriteError('eventType is required to append an EEA event')
  }

  const endpoint = resolveEndpoint(options.endpoint ?? DEFAULT_ENDPOINT)
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      eventType: input.eventType,
      formId: input.formId,
      newValue: input.newValue,
    }),
  }
  if (options.signal !== undefined) {
    init.signal = options.signal
  }

  let response: Response
  try {
    response = await fetch(endpoint, init)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown transport error'
    throw new EEAEventWriteError(`Event write request failed: ${reason}`)
  }

  if (!response.ok) {
    throw new EEAEventWriteError(
      `Event store rejected the event (status ${response.status.toString()})`,
      response.status,
    )
  }
}
