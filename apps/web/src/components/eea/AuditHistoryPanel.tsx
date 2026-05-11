import type { EEAEvent } from '@simplifi/shared'
import { EEAEventSchema } from '@simplifi/shared'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { TimelineEntry } from './TimelineEntry'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditHistoryPanelProps {
  formType: 'EEA1' | 'EEA2'
  formId: string
}

type SectionOption =
  | 'All'
  | 'Section A'
  | 'Section B/C'
  | 'Section D'
  | 'Section E'
  | 'Section F'
  | 'Section G'
  | 'Section H'

const SECTION_OPTIONS: SectionOption[] = [
  'All',
  'Section A',
  'Section B/C',
  'Section D',
  'Section E',
  'Section F',
  'Section G',
  'Section H',
]

function currentYearStart(): string {
  return `${String(new Date().getFullYear())}-01-01`
}

function currentYearEnd(): string {
  return `${String(new Date().getFullYear())}-12-31`
}

interface EventsApiResponse {
  events: EEAEvent[]
  nextCursor: string | null
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success' }

// ── API ───────────────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

interface FetchFilters {
  section: SectionOption
  from: string
  to: string
}

async function fetchEvents(
  formId: string,
  cursor: string | null,
  filters: FetchFilters,
  signal: AbortSignal,
): Promise<EventsApiResponse> {
  const url = new URL(`/eea2/${encodeURIComponent(formId)}/events`, globalThis.location.origin)
  url.searchParams.set('limit', '50')
  if (cursor !== null) {
    url.searchParams.set('cursor', cursor)
  }
  if (filters.section !== 'All') {
    url.searchParams.set('section', filters.section)
  }
  url.searchParams.set('from', filters.from)
  url.searchParams.set('to', filters.to)

  const response = await fetch(url.toString(), { signal })

  if (!response.ok) {
    const body: unknown = await response.json().catch((): null => null)
    const message =
      isRecord(body) && typeof body['message'] === 'string'
        ? body['message']
        : `Request failed with status ${String(response.status)}`
    throw new Error(message)
  }

  const payload: unknown = await response.json()

  if (!isRecord(payload)) {
    throw new Error('Unexpected response shape from events API')
  }

  const rawEvents = payload['events']
  if (!Array.isArray(rawEvents)) {
    throw new TypeError('events field missing or not an array')
  }

  const events: EEAEvent[] = rawEvents.map((item, index) => {
    const parsed = EEAEventSchema.safeParse(item)
    if (!parsed.success) {
      throw new Error(`Event at index ${String(index)} failed validation: ${parsed.error.message}`)
    }
    return parsed.data
  })

  const rawCursor = payload['nextCursor']
  const nextCursor = typeof rawCursor === 'string' ? rawCursor : null

  return { events, nextCursor }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow(): React.ReactElement {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-slate-100 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-3 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
    </li>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * AuditHistoryPanel — displays a paginated, chronological audit log for a
 * single EEA form. Fetches from GET /eea2/:formId/events with cursor pagination.
 *
 * Section and date-range filters are backed by URL search params so that
 * filtered views are shareable. All filtering is server-side only — no
 * Array.filter() is applied to the fetched events array.
 *
 * Loading state renders exactly 3 Skeleton rows.
 * PII field values are guarded unconditionally by TimelineEntry.
 */
export function AuditHistoryPanel({
  formId,
  formType,
}: AuditHistoryPanelProps): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Derive filter state from URL ───────────────────────────────────────────

  const rawSection = searchParams.get('section')
  const activeSection: SectionOption =
    rawSection !== null && (SECTION_OPTIONS as string[]).includes(rawSection)
      ? (rawSection as SectionOption)
      : 'All'

  const activeFrom = searchParams.get('from') ?? currentYearStart()
  const activeTo = searchParams.get('to') ?? currentYearEnd()

  // ── Component state ────────────────────────────────────────────────────────

  const [events, setEvents] = useState<EEAEvent[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [fetchState, setFetchState] = useState<FetchState>({ status: 'idle' })
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadEvents = useCallback(
    async (cursor: string | null, filters: FetchFilters, signal: AbortSignal): Promise<void> => {
      if (cursor === null) {
        setFetchState({ status: 'loading' })
      } else {
        setIsLoadingMore(true)
      }

      try {
        const result = await fetchEvents(formId, cursor, filters, signal)

        if (signal.aborted) return

        setEvents((prev) => (cursor === null ? result.events : [...prev, ...result.events]))
        setNextCursor(result.nextCursor)
        setFetchState({ status: 'success' })
      } catch (error) {
        if (signal.aborted) return
        const message = error instanceof Error ? error.message : 'Failed to load audit events'
        setFetchState({ status: 'error', message })
      } finally {
        if (!signal.aborted) {
          setIsLoadingMore(false)
        }
      }
    },
    [formId],
  )

  // Re-fetch from page 1 whenever filters change.
  useEffect(() => {
    const controller = new AbortController()
    setEvents([])
    setNextCursor(null)
    const filters: FetchFilters = { section: activeSection, from: activeFrom, to: activeTo }
    void loadEvents(null, filters, controller.signal)
    return () => {
      controller.abort()
    }
  }, [loadEvents, activeSection, activeFrom, activeTo])

  const handleLoadMore = useCallback((): void => {
    if (nextCursor === null || isLoadingMore) return
    const controller = new AbortController()
    const filters: FetchFilters = { section: activeSection, from: activeFrom, to: activeTo }
    void loadEvents(nextCursor, filters, controller.signal)
  }, [nextCursor, isLoadingMore, loadEvents, activeSection, activeFrom, activeTo])

  // ── Filter change handlers ─────────────────────────────────────────────────

  const handleSectionChange = useCallback(
    (value: SectionOption): void => {
      setSearchParams((prev: URLSearchParams) => {
        const next = new URLSearchParams(prev)
        if (value === 'All') {
          next.delete('section')
        } else {
          next.set('section', value)
        }
        return next
      })
    },
    [setSearchParams],
  )

  const handleFromChange = useCallback(
    (value: string): void => {
      setSearchParams((prev: URLSearchParams) => {
        const next = new URLSearchParams(prev)
        next.set('from', value)
        return next
      })
    },
    [setSearchParams],
  )

  const handleToChange = useCallback(
    (value: string): void => {
      setSearchParams((prev: URLSearchParams) => {
        const next = new URLSearchParams(prev)
        next.set('to', value)
        return next
      })
    },
    [setSearchParams],
  )

  const handleClearFilters = useCallback((): void => {
    setSearchParams((prev: URLSearchParams) => {
      const next = new URLSearchParams(prev)
      next.delete('section')
      next.delete('from')
      next.delete('to')
      return next
    })
  }, [setSearchParams])

  const isFiltered =
    activeSection !== 'All' || activeFrom !== currentYearStart() || activeTo !== currentYearEnd()

  const isInitialLoading = fetchState.status === 'loading' || fetchState.status === 'idle'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label={`Audit history for ${formType} form`}
      className={cn('flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4')}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Audit history</h2>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            'bg-slate-200 text-slate-600',
          )}
        >
          {formType}
        </span>
      </header>

      {/* Section filter */}
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="audit-section-select" className="text-xs font-medium text-slate-500">
          Section
        </label>
        <select
          id="audit-section-select"
          value={activeSection}
          onChange={(e) => {
            handleSectionChange(e.target.value as SectionOption)
          }}
          className={cn(
            'rounded-md border border-slate-200 bg-white px-2 py-1',
            'text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400',
          )}
        >
          {SECTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="audit-from-date" className="text-xs font-medium text-slate-500">
            From
          </label>
          <input
            id="audit-from-date"
            type="date"
            value={activeFrom}
            onChange={(e) => {
              handleFromChange(e.target.value)
            }}
            className={cn(
              'rounded-md border border-slate-200 bg-white px-2 py-1',
              'text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400',
            )}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="audit-to-date" className="text-xs font-medium text-slate-500">
            To
          </label>
          <input
            id="audit-to-date"
            type="date"
            value={activeTo}
            onChange={(e) => {
              handleToChange(e.target.value)
            }}
            className={cn(
              'rounded-md border border-slate-200 bg-white px-2 py-1',
              'text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400',
            )}
          />
        </div>
        {isFiltered && (
          <button
            type="button"
            onClick={handleClearFilters}
            className={cn(
              'rounded-md border border-slate-200 bg-white px-3 py-1',
              'text-xs font-medium text-slate-500',
              'hover:bg-slate-50 transition-colors',
            )}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error state */}
      {fetchState.status === 'error' && (
        <div
          role="alert"
          className={cn(
            'rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
          )}
        >
          {fetchState.message}
        </div>
      )}

      {/* Scrollable event list */}
      <div className="max-h-[60vh] overflow-y-auto rounded-md">
        <ul className="flex flex-col gap-2">
          {isInitialLoading ? (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          ) : events.length === 0 ? (
            <li className="py-8 text-center text-sm text-slate-400">No audit events yet</li>
          ) : (
            events.map((event) => <TimelineEntry event={event} key={event.eventId} />)
          )}
        </ul>
      </div>

      {/* Load more */}
      {nextCursor !== null && fetchState.status === 'success' && (
        <button
          className={cn(
            'w-full rounded-md border border-slate-200 bg-white px-4 py-2',
            'text-sm font-medium text-slate-600',
            'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors',
          )}
          disabled={isLoadingMore}
          onClick={handleLoadMore}
          type="button"
        >
          {isLoadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  )
}
