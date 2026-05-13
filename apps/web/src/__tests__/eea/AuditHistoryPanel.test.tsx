/**
 * AuditHistoryPanel — frontend unit tests (Vitest + @testing-library/react + MSW)
 *
 * Tests 1–6 cover the core behaviours of the panel:
 *   1. Timeline renders the correct number of entries
 *   2. Section filter is forwarded as a query param
 *   3. Date-range filters are forwarded as query params
 *   4. "View snapshot" opens the SnapshotDrawer (snapshot-banner is in DOM)
 *   5. PII guard — client never renders raw PII values
 *   6. Empty-state message when the API returns zero events
 *
 * Routing context: the component uses @tanstack/react-router's useLocation and
 * useNavigate. We wrap the component in a RouterProvider backed by a
 * createMemoryHistory so we can control the initial URL.
 */

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { buildAuditEvent } from '../mocks/handlers'
import { AuditHistoryPanel } from '@/components/eea/AuditHistoryPanel'
import { server } from '@/test/server'

// ---------------------------------------------------------------------------
// Router test wrapper
//
// TanStack Router requires a full router tree to satisfy useLocation and
// useNavigate. We create a minimal memory-router for each test, which also
// gives us full control over the initial search string.
// ---------------------------------------------------------------------------

function makeRouter(initialSearch = '') {
  const rootRoute = createRootRoute()
  const panelRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <AuditHistoryPanel formId="form-test-001" />,
  })

  const routeTree = rootRoute.addChildren([panelRoute])

  // createMemoryHistory takes string entries in the form "/path?search".
  const initialEntry = initialSearch.length > 0 ? `/${initialSearch}` : '/'
  const history = createMemoryHistory({
    initialEntries: [initialEntry],
  })

  return createRouter({ routeTree, history })
}

// Re-usable render helper.
function renderPanel(initialSearch = '') {
  const router = makeRouter(initialSearch)
  return render(<RouterProvider router={router} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuditHistoryPanel', () => {
  // server.resetHandlers() is called globally in src/test/setup.ts afterEach.
  // Per-test handlers are registered inside each it() block via server.use().

  // -------------------------------------------------------------------------
  // Test 1 — Timeline count
  // -------------------------------------------------------------------------

  it('renders exactly 5 timeline entries when the API returns 5 events', async () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      buildAuditEvent({ eventId: `evt-${String(i)}`, fieldPath: `sectionA.field${String(i)}` }),
    )

    server.use(
      http.get('/eea2/:formId/events', () => HttpResponse.json({ events, nextCursor: null })),
    )

    renderPanel()

    // Wait for the timeline entries to appear.
    await waitFor(() => {
      expect(screen.getAllByTestId(/^timeline-entry-/).length).toBe(5)
    })
  })

  // -------------------------------------------------------------------------
  // Test 2 — Section filter is forwarded in the request URL
  // -------------------------------------------------------------------------

  it('forwards the section filter to the API when the URL contains ?section=Section+D', async () => {
    const capturedUrls: string[] = []

    server.use(
      http.get('/eea2/:formId/events', ({ request }) => {
        capturedUrls.push(request.url)
        return HttpResponse.json({ events: [], nextCursor: null })
      }),
    )

    // Render with ?section=Section+D already in the URL — the component reads
    // this synchronously from useLocation and fires the first fetch.
    renderPanel('?section=Section+D')

    await waitFor(() => {
      expect(capturedUrls.length).toBeGreaterThan(0)
    })

    const lastUrl = capturedUrls.at(-1) ?? ''
    expect(lastUrl).toContain('section=Section+D')
  })

  // -------------------------------------------------------------------------
  // Test 3 — Date range filters are forwarded in the request URL
  // -------------------------------------------------------------------------

  it('forwards from and to query params when the URL contains a date range', async () => {
    const capturedUrls: string[] = []

    server.use(
      http.get('/eea2/:formId/events', ({ request }) => {
        capturedUrls.push(request.url)
        return HttpResponse.json({ events: [], nextCursor: null })
      }),
    )

    renderPanel('?from=2026-01-01&to=2026-03-31')

    await waitFor(() => {
      expect(capturedUrls.length).toBeGreaterThan(0)
    })

    const lastUrl = capturedUrls.at(-1) ?? ''
    expect(lastUrl).toContain('from=2026-01-01')
    expect(lastUrl).toContain('to=2026-03-31')
  })

  // -------------------------------------------------------------------------
  // Test 4 — "View snapshot" button opens the SnapshotDrawer
  // -------------------------------------------------------------------------

  it('opens the SnapshotDrawer (snapshot-banner visible) when "View snapshot" is clicked', async () => {
    const eventId = 'evt-snap-001'
    const event = buildAuditEvent({ eventId })

    server.use(
      http.get('/eea2/:formId/events', () =>
        HttpResponse.json({ events: [event], nextCursor: null }),
      ),
      // The SnapshotDrawer POSTs to /replay; respond with a minimal snapshot.
      http.post('/eea2/:formId/replay', () =>
        HttpResponse.json({ sectionA: { companyName: 'Simplifi SA' } }),
      ),
    )

    const user = userEvent.setup()
    renderPanel()

    // Wait for the timeline entry and click its "View snapshot" button.
    const viewBtn = await screen.findByTestId(`view-snapshot-${eventId}`)
    await user.click(viewBtn)

    // The amber banner is the first child of the drawer panel and is always
    // in the DOM when the drawer is open (no dismiss mechanism per spec).
    expect(screen.getByTestId('snapshot-banner')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Test 5 — PII guard: client never renders raw PII values
  // -------------------------------------------------------------------------

  it('renders [Protected field] instead of the raw race value for PII events', async () => {
    // Primary defence: the API server nulls prevValue/newValue for PII fieldPaths
    // before the response leaves the server (stripPii in events.ts).
    // Secondary defence: TimelineEntry replaces any PII fieldPath with
    // '[Protected field]' so the path name itself is never exposed in the UI.
    // This test verifies the secondary (client-side) layer.
    const piiEvent = buildAuditEvent({
      eventId: 'evt-pii-001',
      fieldPath: 'race',
      eventType: 'FIELD_UPDATED',
      triggeredBy: 'test-user@simplifi.co.za',
    })

    // The response includes a hypothetical newValue to prove the client never
    // renders it — the AuditEvent interface has no newValue field, so
    // 'African' cannot reach a render path through the typed shape.
    server.use(
      http.get('/eea2/:formId/events', () =>
        HttpResponse.json({
          events: [{ ...piiEvent, newValue: 'African', prevValue: null }],
          nextCursor: null,
        }),
      ),
    )

    renderPanel()

    await screen.findByTestId('timeline-entry-evt-pii-001')

    // TimelineEntry must replace 'race' with the placeholder.
    expect(screen.getByText('[Protected field]')).toBeInTheDocument()

    // The raw demographic value must be absent from the entire rendered DOM.
    expect(screen.queryByText('African')).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Test 6 — Empty state
  // -------------------------------------------------------------------------

  it('renders the empty-state paragraph when the API returns zero events', async () => {
    server.use(
      http.get('/eea2/:formId/events', () => HttpResponse.json({ events: [], nextCursor: null })),
    )

    renderPanel()

    await screen.findByText('No audit events found for the selected filters.')
  })
})
