// Audit history panel for EEA2 event timeline with URL-driven filter state.
//
// Filter state constraints (non-negotiable):
//   - ALL filter state (section, from, to, cursor) lives in the URL search string.
//     useLocation provides the raw search string; useNavigate writes updates back.
//   - Filtering is SERVER-SIDE ONLY. The events array is never post-filtered in JS.
//     Every filter change fires a new fresh API request.
//   - On any filter change: cursor is reset to null and events are cleared BEFORE
//     the new fetch fires. Stale results must never appear during the new load.

import { useLocation, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useReducer, useRef, useState, type ReactElement } from 'react'
import { SnapshotDrawer } from './SnapshotDrawer'
import { TimelineEntry } from './TimelineEntry'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// URL mutation helper
//
// TanStack Router's navigate({ search: fn }) is strictly typed to the
// registered route's searchSchema. Because AuditHistoryPanel is a generic
// component used across routes that have no declared search validator, we use
// navigate({ href }) instead — constructing the target href manually from the
// current search string. This is an officially supported escape hatch:
//   https://tanstack.com/router/latest/docs/framework/react/api/router/NavigateOptionsType#href
// ---------------------------------------------------------------------------

type SearchMutation = (params: URLSearchParams) => void

function buildHref(pathname: string, currentSearch: string, mutate: SearchMutation): string {
  const params = new URLSearchParams(currentSearch)
  mutate(params)
  const qs = params.toString()
  return qs.length > 0 ? `${pathname}?${qs}` : pathname
}

// ---------------------------------------------------------------------------
// Section filter value set
// ---------------------------------------------------------------------------

const SECTION_VALUES = [
  'All',
  'Section A',
  'Section B/C',
  'Section D',
  'Section E',
  'Section F',
  'Section G',
  'Section H',
] as const

type SectionValue = (typeof SECTION_VALUES)[number]

function isSectionValue(value: string): value is SectionValue {
  return (SECTION_VALUES as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Default date range — computed dynamically, never hardcoded
// ---------------------------------------------------------------------------

function defaultFrom(): string {
  return `${new Date().getFullYear().toString()}-01-01`
}

function defaultTo(): string {
  return `${new Date().getFullYear().toString()}-12-31`
}

// ---------------------------------------------------------------------------
// API shape
// ---------------------------------------------------------------------------

export interface AuditEvent {
  eventId: string
  eventType: string
  fieldPath: string | null
  timestamp: string
  triggeredBy: string
}

interface EventsApiResponse {
  events: AuditEvent[]
  nextCursor: string | null
}

export interface AuditHistoryPanelProps {
  /** EEA2 form instance identifier — scopes the events endpoint. */
  formId: string
}

// ---------------------------------------------------------------------------
// Fetch reducer — manages render-visible state only.
// Filter state lives in the URL; next cursor is buffered in a ref.
// ---------------------------------------------------------------------------

interface FetchState {
  events: AuditEvent[]
  isLoading: boolean
  error: string | null
  hasNextPage: boolean
}

type FetchAction =
  | { type: 'FETCH_START'; append: boolean }
  | { type: 'FETCH_SUCCESS'; events: AuditEvent[]; hasNextPage: boolean; append: boolean }
  | { type: 'FETCH_ERROR'; error: string }

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case 'FETCH_START': {
      return {
        events: action.append ? state.events : [],
        isLoading: true,
        error: null,
        hasNextPage: action.append ? state.hasNextPage : false,
      }
    }
    case 'FETCH_SUCCESS': {
      return {
        events: action.append ? [...state.events, ...action.events] : action.events,
        isLoading: false,
        error: null,
        hasNextPage: action.hasNextPage,
      }
    }
    case 'FETCH_ERROR': {
      return { ...state, isLoading: false, error: action.error }
    }
    default: {
      return state
    }
  }
}

const INITIAL_FETCH_STATE: FetchState = {
  events: [],
  isLoading: false,
  error: null,
  hasNextPage: false,
}

// ---------------------------------------------------------------------------
// URL search param parsing
// ---------------------------------------------------------------------------

interface ActiveFilters {
  section: SectionValue
  /** null when the ?from param is absent — component falls back to defaultFrom() for display */
  from: string | null
  /** null when the ?to param is absent — component falls back to defaultTo() for display */
  to: string | null
  /** null on page 1; populated when the user presses Load more */
  cursor: string | null
}

function parseFilters(searchString: string): ActiveFilters {
  const params = new URLSearchParams(searchString)

  const rawSection = params.get('section') ?? ''
  const section: SectionValue = isSectionValue(rawSection) ? rawSection : 'All'

  return {
    section,
    from: params.get('from'),
    to: params.get('to'),
    cursor: params.get('cursor'),
  }
}

// ---------------------------------------------------------------------------
// AuditHistoryPanel
// ---------------------------------------------------------------------------

export function AuditHistoryPanel({ formId }: AuditHistoryPanelProps): ReactElement {
  // The raw URL search string is the single source of truth for all filters.
  // Explicit return-type annotations on the select callbacks are required so
  // TypeScript infers TSelected = string rather than TSelected = unknown.
  // loc.searchStr is the raw "?key=value" string; loc.search is the parsed object.
  const searchString = useLocation({ select: (loc): string => loc.searchStr })
  const pathname = useLocation({ select: (loc): string => loc.pathname })
  const navigate = useNavigate()

  const { section, from, to, cursor } = parseFilters(searchString)

  // For display: if URL has no date param, show current-year default in the input
  // without writing it to the URL (only user interaction triggers a URL write).
  const displayFrom = from ?? defaultFrom()
  const displayTo = to ?? defaultTo()

  // ---------------------------------------------------------------------------
  // Fetch state
  // ---------------------------------------------------------------------------

  const [fetchState, dispatch] = useReducer(fetchReducer, INITIAL_FETCH_STATE)

  // Snapshot drawer state — selectedEventId drives the drawer open/closed.
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const handleViewSnapshot = useCallback((eventId: string) => {
    setSelectedEventId(eventId)
  }, [])

  const handleCloseSnapshot = useCallback(() => {
    setSelectedEventId(null)
  }, [])

  // Buffer the next-page cursor returned by the API.
  // It must NOT go into useState (that would be client state duplicating URL state).
  // It lives here until the user clicks "Load more", at which point it is written
  // to the URL as ?cursor=<value>, triggering a fresh fetch via the effect below.
  const nextCursorBuffer = useRef<string | null>(null)

  // Abort controller for in-flight requests.
  const abortControllerRef = useRef<AbortController | null>(null)

  // ---------------------------------------------------------------------------
  // Core fetch effect — re-runs whenever formId or any URL filter changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // cursor === null → page-1 request (filter change or initial load)
    // cursor !== null → append request triggered by "Load more"
    const isAppend = cursor !== null

    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    dispatch({ type: 'FETCH_START', append: isAppend })

    const params = new URLSearchParams()
    if (section !== 'All') params.set('section', section)
    if (from !== null) params.set('from', from)
    if (to !== null) params.set('to', to)
    if (cursor !== null) params.set('cursor', cursor)
    params.set('limit', '50')

    const url = `/eea2/${formId}/events?${params.toString()}`

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status.toString()}`)
        }
        return response.json() as Promise<EventsApiResponse>
      })
      .then(({ events, nextCursor }) => {
        // Buffer the next cursor for use by the Load more handler.
        nextCursorBuffer.current = nextCursor
        dispatch({
          type: 'FETCH_SUCCESS',
          events,
          hasNextPage: nextCursor !== null,
          append: isAppend,
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        const message = error instanceof Error ? error.message : 'Failed to load audit events'
        dispatch({ type: 'FETCH_ERROR', error: message })
      })

    return () => {
      controller.abort()
    }
  }, [formId, section, from, to, cursor])

  // ---------------------------------------------------------------------------
  // Filter update helpers — each writes ONLY to the URL.
  // All helpers reset ?cursor and let the effect above handle the new fetch.
  // ---------------------------------------------------------------------------

  const handleSectionChange = useCallback(
    (newSection: SectionValue) => {
      void navigate({
        href: buildHref(pathname, searchString, (p) => {
          p.delete('cursor')
          if (newSection === 'All') {
            p.delete('section')
          } else {
            p.set('section', newSection)
          }
        }),
      })
    },
    [navigate, pathname, searchString],
  )

  const handleFromChange = useCallback(
    (value: string) => {
      void navigate({
        href: buildHref(pathname, searchString, (p) => {
          p.delete('cursor')
          if (value.length > 0) {
            p.set('from', value)
          } else {
            p.delete('from')
          }
        }),
      })
    },
    [navigate, pathname, searchString],
  )

  const handleToChange = useCallback(
    (value: string) => {
      void navigate({
        href: buildHref(pathname, searchString, (p) => {
          p.delete('cursor')
          if (value.length > 0) {
            p.set('to', value)
          } else {
            p.delete('to')
          }
        }),
      })
    },
    [navigate, pathname, searchString],
  )

  // Clear button: removes ?from and ?to from URL; inputs snap back to current-year defaults.
  const handleClearDateRange = useCallback(() => {
    void navigate({
      href: buildHref(pathname, searchString, (p) => {
        p.delete('from')
        p.delete('to')
        p.delete('cursor')
      }),
    })
  }, [navigate, pathname, searchString])

  // Load more: writes the buffered next cursor to the URL.
  // The effect above detects cursor !== null and fires an append fetch.
  const handleLoadMore = useCallback(() => {
    const nextCursor = nextCursorBuffer.current
    if (nextCursor === null) return
    void navigate({
      href: buildHref(pathname, searchString, (p) => {
        p.set('cursor', nextCursor)
      }),
    })
  }, [navigate, pathname, searchString])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section
      aria-labelledby="audit-history-title"
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      data-testid="audit-history-panel"
    >
      <header>
        <h2 className="text-lg font-semibold text-slate-900" id="audit-history-title">
          Audit history
        </h2>
      </header>

      {/* ---- Section filter ---- */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600" htmlFor="audit-section-filter">
          Section
        </label>
        <select
          className={cn(
            'w-48 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
            'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
          )}
          data-testid="audit-section-filter"
          id="audit-section-filter"
          onChange={(e) => {
            const val = e.target.value
            if (isSectionValue(val)) {
              handleSectionChange(val)
            }
          }}
          value={section}
        >
          {SECTION_VALUES.map((sv) => (
            <option key={sv} value={sv}>
              {sv}
            </option>
          ))}
        </select>
      </div>

      {/* ---- Date range filter ---- */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="audit-from-date">
            From
          </label>
          <input
            className={cn(
              'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
              'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
            )}
            data-testid="audit-from-date"
            id="audit-from-date"
            onChange={(e) => {
              handleFromChange(e.target.value)
            }}
            type="date"
            value={displayFrom}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="audit-to-date">
            To
          </label>
          <input
            className={cn(
              'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
              'focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
            )}
            data-testid="audit-to-date"
            id="audit-to-date"
            onChange={(e) => {
              handleToChange(e.target.value)
            }}
            type="date"
            value={displayTo}
          />
        </div>

        <button
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-slate-300',
            'px-3 py-2 text-sm font-medium text-slate-700',
            'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
          )}
          data-testid="audit-clear-date-range"
          onClick={handleClearDateRange}
          type="button"
        >
          Clear
        </button>
      </div>

      {/* ---- Loading (initial / page-1) ---- */}
      {fetchState.isLoading && fetchState.events.length === 0 && (
        <p aria-live="polite" className="text-sm text-slate-500" data-testid="audit-loading">
          Loading events…
        </p>
      )}

      {/* ---- Error ---- */}
      {fetchState.error !== null && (
        <div
          aria-live="assertive"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          data-testid="audit-error"
          role="alert"
        >
          {fetchState.error}
        </div>
      )}

      {/* ---- Empty state ---- */}
      {!fetchState.isLoading && fetchState.error === null && fetchState.events.length === 0 && (
        <p className="text-sm text-slate-500" data-testid="audit-empty">
          No audit events found for the selected filters.
        </p>
      )}

      {/* ---- Event timeline ---- */}
      {fetchState.events.length > 0 && (
        <ol
          aria-label="Audit event timeline"
          className="flex flex-col gap-2"
          data-testid="audit-timeline"
        >
          {fetchState.events.map((event) => (
            <TimelineEntry
              eventId={event.eventId}
              eventType={event.eventType}
              fieldPath={event.fieldPath}
              key={event.eventId}
              onViewSnapshot={handleViewSnapshot}
              timestamp={event.timestamp}
              triggeredBy={event.triggeredBy}
            />
          ))}
        </ol>
      )}

      {/* ---- Load more ---- */}
      {fetchState.hasNextPage && !fetchState.isLoading && (
        <button
          className={cn(
            'self-start rounded-md border border-slate-300 px-4 py-2',
            'text-sm font-medium text-slate-700',
            'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1',
          )}
          data-testid="audit-load-more"
          onClick={handleLoadMore}
          type="button"
        >
          Load more
        </button>
      )}

      {/* ---- Inline loading for append (load-more) fetches ---- */}
      {fetchState.isLoading && fetchState.events.length > 0 && (
        <p aria-live="polite" className="text-sm text-slate-500" data-testid="audit-loading-more">
          Loading more events…
        </p>
      )}

      {/* ---- Snapshot drawer — mounted outside the scroll area so it can
               use fixed positioning without being clipped by overflow ---- */}
      {selectedEventId !== null &&
        (() => {
          const selectedEvent = fetchState.events.find((e) => e.eventId === selectedEventId)
          if (selectedEvent === undefined) return null
          return (
            <SnapshotDrawer
              eventId={selectedEventId}
              formId={formId}
              onClose={handleCloseSnapshot}
              open={true}
              timestamp={selectedEvent.timestamp}
              userName={selectedEvent.triggeredBy}
            />
          )
        })()}
    </section>
  )
}
