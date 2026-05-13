// SnapshotDrawer — right-side drawer that replays an EEA2 form to a historical
// point in time and displays the materialised snapshot.
//
// Security constraints (non-negotiable):
//   - POST body contains only { toEventId }. tenantId is NEVER sent from the
//     client; RLS enforces tenant isolation at the API layer.
//   - The amber banner is the first element inside the drawer panel and has no
//     dismiss mechanism — it must always be visible when snapshot data is shown.
//
// Fetch behaviour:
//   - POST /eea2/:formId/replay fires only when open transitions false → true.
//   - A new fetch fires if eventId or formId changes while the drawer is open.
//   - In-flight requests are aborted on cleanup to prevent stale state.

import type { OccupationalMatrix as OccupationalMatrixData } from '@simplifi/shared'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { OccupationalMatrix } from '@/features/eea/components/occupational-matrix/OccupationalMatrix'
import { cn } from '@/lib/utils'

// Format a Date as "dd MMM yyyy HH:mm" without date-fns (not installed).
// Example: 09 May 2026 14:30
function formatSnapshotDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mmm = date.toLocaleString('en-ZA', { month: 'short' })
  const yyyy = String(date.getFullYear())
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd} ${mmm} ${yyyy} ${hh}:${min}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotDrawerProps {
  eventId: string
  timestamp: string
  userName: string
  formId: string
  open: boolean
  onClose: () => void
}

// The replay endpoint returns the materialised EEA2Report state object.
// We narrow only the fields we need to render; unknown extras are ignored.
interface ReplaySnapshot {
  sectionC?: OccupationalMatrixData
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// SnapshotDrawer
// ---------------------------------------------------------------------------

export function SnapshotDrawer({
  eventId,
  timestamp,
  userName,
  formId,
  open,
  onClose,
}: SnapshotDrawerProps): ReactElement {
  const [snapshot, setSnapshot] = useState<ReplaySnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the previous open value so we can detect false → true transitions.
  const prevOpenRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Fire POST /eea2/:formId/replay only when open transitions false → true.
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open

    // Only fetch on the false → true transition.
    if (!open || wasOpen) return

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)
    setSnapshot(null)

    // tenantId is intentionally absent from the body — RLS handles isolation.
    fetch(`/eea2/${formId}/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEventId: eventId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Replay failed with status ${response.status.toString()}`)
        }
        return response.json() as Promise<ReplaySnapshot>
      })
      .then((data) => {
        setSnapshot(data)
        setIsLoading(false)
      })
      .catch((error_: unknown) => {
        if (error_ instanceof DOMException && error_.name === 'AbortError') return
        const message = error_ instanceof Error ? error_.message : 'Failed to load snapshot'
        setError(message)
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [open, eventId, formId])

  // Format the timestamp for the header.
  const formattedAt = formatSnapshotDate(new Date(timestamp))

  // Collect non-sectionC fields for the generic dl rendering.
  const otherEntries =
    snapshot === null
      ? []
      : Object.entries(snapshot).filter(
          ([key]) => key !== 'sectionC' && snapshot[key] !== undefined,
        )

  return (
    <>
      {/* Fixed overlay — closes on click */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        aria-label="Historical snapshot drawer"
        aria-modal="true"
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-[60vw] bg-white shadow-xl',
          'transform transition-transform duration-300',
          'flex flex-col overflow-hidden',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
      >
        {/* ── Amber banner — FIRST element, no dismiss, always sticky ──────── */}
        <div
          className="sticky top-0 z-10 bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900"
          data-testid="snapshot-banner"
        >
          Historical snapshot — not current data
        </div>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Snapshot as of {formattedAt} — {userName}
          </h2>

          {/* Close button */}
          <button
            aria-label="Close snapshot drawer"
            className={cn(
              'rounded-md border border-slate-300 p-1.5 text-slate-600',
              'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
            )}
            data-testid="snapshot-drawer-close"
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable content area ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Loading state */}
          {isLoading && (
            <div aria-live="polite" className="flex flex-col gap-3" data-testid="snapshot-loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div className="h-8 animate-pulse rounded bg-slate-200" key={i} />
              ))}
            </div>
          )}

          {/* Error state */}
          {!isLoading && error !== null && (
            <p
              aria-live="assertive"
              className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
              data-testid="snapshot-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Snapshot content */}
          {!isLoading && error === null && snapshot !== null && (
            <div className="flex flex-col gap-6">
              {/* Section C — Occupational Matrix */}
              {snapshot.sectionC !== undefined && (
                <section aria-labelledby="snapshot-section-c-title">
                  <h3
                    className="mb-3 text-sm font-semibold text-slate-700"
                    id="snapshot-section-c-title"
                  >
                    Section C — Workforce Profile
                  </h3>
                  <OccupationalMatrix
                    data={snapshot.sectionC}
                    isDesignatedEmployer={false}
                    mode="view"
                  />
                </section>
              )}

              {/* Other sections — generic key/value pairs */}
              {otherEntries.length > 0 && (
                <section aria-labelledby="snapshot-other-title">
                  <h3
                    className="mb-3 text-sm font-semibold text-slate-700"
                    id="snapshot-other-title"
                  >
                    Other fields
                  </h3>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    {otherEntries.map(([key, value]) => (
                      <div className="contents" key={key}>
                        <dt className="font-medium text-slate-600">{key}</dt>
                        <dd className="text-slate-900">
                          {typeof value === 'object'
                            ? JSON.stringify(value)
                            : String((value as string | number | boolean | null | undefined) ?? '')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
