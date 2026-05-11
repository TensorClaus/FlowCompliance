import type { OccupationalMatrix as OccupationalMatrixData } from '@simplifi/shared'
import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { OccupationalMatrix } from '../../features/eea/components/occupational-matrix/OccupationalMatrix'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SnapshotDrawerProps {
  eventId: string
  timestamp: string
  userName: string
  formId: string
  open: boolean
  onClose: () => void
}

interface SnapshotState {
  sectionC?: OccupationalMatrixData
  [key: string]: unknown
}

interface ReplayResponse {
  formId: string
  tenantId: string
  snapshotAt: string
  replayedToEventId: string
  state: SnapshotState
}

type DrawerState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; snapshot: ReplayResponse }
  | { status: 'error'; message: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }): React.ReactElement {
  return <div className={clsx('animate-pulse rounded bg-slate-200', className)} />
}

// ─── Amber banner — non-dismissable compliance notice ────────────────────────

function HistoricalBanner(): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-amber-50 px-5 py-3 border-b border-amber-200"
    >
      <span className="text-amber-600 text-base" aria-hidden="true">
        ⚠
      </span>
      <p className="text-sm font-medium text-amber-800">Historical snapshot — not current data</p>
    </div>
  )
}

// ─── Key-value section renderer ───────────────────────────────────────────────

function SectionDl({
  title,
  data,
}: {
  title: string
  data: Record<string, unknown>
}): React.ReactElement {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined)

  if (entries.length === 0) return <></>

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="contents">
            <dt className="text-slate-500 capitalize">
              {key.replaceAll(/([A-Z])/g, ' $1').trim()}
            </dt>
            <dd className="text-slate-800 break-all">
              {value === null || value === undefined
                ? '—'
                : typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value as string | number | boolean)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ─── SnapshotDrawer ───────────────────────────────────────────────────────────

/**
 * SnapshotDrawer — slide-over panel that replays the EEA2 event stream to a
 * historical point and renders a frozen snapshot of the form state.
 *
 * COMPLIANCE INVARIANTS:
 *  - The amber "Historical snapshot" banner is always the first visible element
 *    inside the sheet, rendered unconditionally with no dismiss affordance.
 *  - OccupationalMatrix is rendered with mode="locked" so no edits are possible.
 *  - tenantId is never passed in the request body; RLS handles tenant isolation.
 */
export function SnapshotDrawer({
  eventId,
  timestamp,
  userName,
  formId,
  open,
  onClose,
}: SnapshotDrawerProps): React.ReactElement {
  const [drawerState, setDrawerState] = useState<DrawerState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  // Fetch replay on open
  useEffect(() => {
    if (!open) {
      setDrawerState({ status: 'idle' })
      return
    }

    // Cancel any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setDrawerState({ status: 'loading' })

    void (async () => {
      try {
        const response = await fetch(`/eea2/${encodeURIComponent(formId)}/replay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toEventId: eventId }),
          signal: controller.signal,
        })

        if (controller.signal.aborted) return

        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null)
          const message =
            isRecord(body) && typeof body['error'] === 'string'
              ? body['error']
              : `Replay failed with status ${String(response.status)}`
          setDrawerState({ status: 'error', message })
          return
        }

        const payload: unknown = await response.json()
        if (!isRecord(payload)) {
          setDrawerState({ status: 'error', message: 'Unexpected response from replay API' })
          return
        }

        setDrawerState({
          status: 'success',
          snapshot: payload as unknown as ReplayResponse,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'Failed to load snapshot'
        setDrawerState({ status: 'error', message })
      }
    })()

    return () => {
      controller.abort()
    }
  }, [open, eventId, formId])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    globalThis.addEventListener('keydown', handleKey)
    return () => {
      globalThis.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return <></>

  const formattedTimestamp = formatTimestamp(timestamp)
  const sectionC =
    drawerState.status === 'success' ? drawerState.snapshot.state.sectionC : undefined

  const otherSections =
    drawerState.status === 'success'
      ? Object.entries(drawerState.snapshot.state).filter(
          ([key, value]) => key !== 'sectionC' && isRecord(value),
        )
      : []

  return (
    <>
      {/* Backdrop */}
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Sheet — 60vw wide, right side */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Snapshot as of ${formattedTimestamp}`}
        className={clsx(
          'fixed inset-y-0 right-0 z-50 flex w-[60vw] flex-col bg-white shadow-2xl',
          'overflow-hidden',
        )}
      >
        {/* AMBER BANNER — must be first visible element, no dismiss affordance */}
        <HistoricalBanner />

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-slate-900">
              Snapshot as of {formattedTimestamp}
            </h2>
            <p className="text-sm text-slate-500">{userName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close snapshot drawer"
            className={clsx(
              'rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600',
              'transition-colors',
            )}
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {drawerState.status === 'loading' && (
            <>
              <SkeletonBlock className="h-6 w-48" />
              <SkeletonBlock className="h-48 w-full" />
              <SkeletonBlock className="h-32 w-full" />
            </>
          )}

          {drawerState.status === 'error' && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {drawerState.message}
            </div>
          )}

          {drawerState.status === 'success' && (
            <>
              {/* Section C — Occupational Matrix in locked (read-only) mode */}
              {sectionC !== undefined && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Section C — Workforce Profile
                  </h3>
                  <OccupationalMatrix mode="locked" data={sectionC} isDesignatedEmployer={true} />
                </section>
              )}

              {/* Other sections — key-value display */}
              {otherSections.map(([key, value]) => (
                <SectionDl
                  key={key}
                  title={key
                    .replaceAll(/([A-Z])/g, ' $1')
                    .replace(/^./, (c) => c.toUpperCase())
                    .trim()}
                  data={value as Record<string, unknown>}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}
