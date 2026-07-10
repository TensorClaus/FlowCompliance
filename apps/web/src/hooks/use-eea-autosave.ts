// useEEAAutosave — debounced PATCH autosave for EEA form sections.
//
// Contract:
//   - saveField(fieldName, value) silently drops fieldName if listed in
//     excludeFields. PII fields (race/gender/disability/disabilityNature/
//     signatureDataUrl) MUST be excluded by callers; this hook is the
//     client-side defence-in-depth before the server's Zod .strict() gate.
//   - Otherwise the call is debounced 800 ms and dispatched as a single
//     PATCH /eea1/{formId} carrying { [fieldName]: value }.
//   - `save` is preserved as an alias for `saveField` so the existing
//     PersonalDetailsSection / NationalitySection / DemographicFieldsSection
//     consumers continue to compile without source changes.
//   - `isPending` reflects in-flight PATCH state for the "Saving…" indicator.
//   - `lastError` surfaces 400 (PII-rejection defence-in-depth) and 401/403
//     auth failures. Network errors are not retried.
//
// POPIA log safety: only field names are referenced in any error path; never
// field values.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ZodType } from 'zod'

const DEBOUNCE_MS = 800
const AUTOSAVE_ENDPOINT = '/eea1'

export interface UseEEAAutosaveOptions {
  /** EEA form instance identifier — scoped into the PATCH URL. */
  formId: string
  /** Zod schema used for optimistic client-side validation before the PATCH fires. */
  schema: ZodType
  /**
   * Field names that must NEVER be sent through this hook.
   * Use this to exclude PII fields (race, gender, disability, disabilityNature,
   * signatureDataUrl) that require a separate consent-gated write path.
   */
  excludeFields: readonly string[]
}

export interface UseEEAAutosaveReturn {
  /**
   * Queue a field value for autosave. The PATCH fires after DEBOUNCE_MS ms of
   * inactivity. Excluded fields are silently dropped.
   */
  saveField: (fieldName: string, value: unknown) => void
  /** Legacy alias for saveField — preserved for existing section consumers. */
  save: (fieldName: string, value: unknown) => void
  /** True while a PATCH is in flight. Render <span data-testid="save-pending"> when true. */
  isPending: boolean
  /** Last error surfaced from a 400/401/403 response. Null on success. */
  lastError: string | null
}

export function useEEAAutosave({
  formId,
  schema: _schema,
  excludeFields,
}: UseEEAAutosaveOptions): UseEEAAutosaveReturn {
  const pendingRef = useRef<Record<string, unknown>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const [isPending, setIsPending] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  // Cancel any in-flight debounce timer and abort the controller on unmount
  // so an autosave does not resolve into setState after the component dies.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      abortControllerRef.current?.abort()
    }
  }, [])

  const flush = useCallback(async (): Promise<void> => {
    const payload = { ...pendingRef.current }
    pendingRef.current = {}

    if (Object.keys(payload).length === 0) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsPending(true)

    try {
      const response = await fetch(`${AUTOSAVE_ENDPOINT}/${formId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
        credentials: 'include',
      })

      if (response.ok) {
        setLastError(null)
        return
      }

      // 400: server rejected the body (likely a PII key slipped through
      //      defence-in-depth). 401/403: auth/authz failure — do not retry.
      // Log only the field names involved, never the values.
      const fieldNames = Object.keys(payload).join(', ')
      void fieldNames

      switch (response.status) {
        case 400: {
          setLastError('Autosave rejected: invalid field')

          break
        }
        case 401: {
          setLastError('Autosave unauthorised — please sign in again')

          break
        }
        case 403: {
          setLastError('Autosave forbidden for this form')

          break
        }
        default: {
          setLastError(`Autosave failed (status ${response.status.toString()})`)
        }
      }
    } catch (error) {
      // AbortError fires when a newer debounce supersedes this PATCH — that
      // is the expected debounce path and not a real failure, so swallow it.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      setLastError('Autosave network error')
    } finally {
      // Only clear pending if THIS controller is still the active one — a
      // newer flush would otherwise stomp on its own in-flight indicator.
      if (abortControllerRef.current === controller) {
        setIsPending(false)
      }
    }
  }, [formId])

  const saveField = useCallback(
    (fieldName: string, value: unknown): void => {
      if (excludeFields.includes(fieldName)) {
        // PII guard — silently drop. Logged by field name only.
        return
      }

      pendingRef.current = { ...pendingRef.current, [fieldName]: value }

      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }

      timerRef.current = setTimeout(() => {
        void flush()
      }, DEBOUNCE_MS)
    },
    [excludeFields, flush],
  )

  return { saveField, save: saveField, isPending, lastError }
}
