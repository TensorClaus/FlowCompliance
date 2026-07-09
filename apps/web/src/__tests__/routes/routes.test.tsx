import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Route as rootRoute } from '@/routes/__root'
import { Route as eea1NewRoute } from '@/routes/eea1-new'
import { Route as eea2FormRoute } from '@/routes/eea2-form'
import { Route as eea2SignRoute } from '@/routes/eea2-sign'
import { Route as indexRoute } from '@/routes/index'
import { installCanvasMock } from '@/test/canvas-mock'
import { server } from '@/test/server'

const FORM_ID = '11111111-1111-4111-8111-111111111111'

const routeTree = rootRoute.addChildren([indexRoute, eea1NewRoute, eea2FormRoute, eea2SignRoute])

function renderAt(initialPath: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

beforeAll(() => {
  installCanvasMock()
})

afterEach(() => {
  globalThis.localStorage.clear()
})

// ---------------------------------------------------------------------------
// /eea1/new — POPIA consent gate → sections → signed submission
// ---------------------------------------------------------------------------

function useEea1Handlers(submitResponse: () => Response): void {
  server.use(
    http.post('/api/event-store/append', () => HttpResponse.json({ success: true })),
    http.patch(`/eea1/${FORM_ID}`, () => new HttpResponse(null, { status: 200 })),
    http.post('/eea1', submitResponse),
  )
}

async function passConsentGate(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByTestId('popia-consent-gate')
  await user.click(screen.getByTestId('popia-consent-checkbox'))
  await user.click(screen.getByTestId('popia-consent-submit'))
  await screen.findByTestId('personal-details-section')
}

function drawAndSubmit(): void {
  const canvas = screen.getByTestId('signature-canvas')
  fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 15, clientY: 15 })
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 60, clientY: 40 })
  fireEvent.pointerUp(canvas, { pointerId: 1 })
}

describe('/eea1/new route', () => {
  it('holds all form sections behind the POPIA consent gate', async () => {
    useEea1Handlers(() => HttpResponse.json({ id: 'decl-1' }))
    const user = userEvent.setup()
    renderAt(`/eea1/new?employeeId=emp-001&formId=${FORM_ID}`)

    expect(await screen.findByTestId('popia-consent-gate')).toBeInTheDocument()
    expect(screen.queryByTestId('personal-details-section')).not.toBeInTheDocument()

    await passConsentGate(user)

    expect(screen.getByTestId('personal-details-section')).toBeInTheDocument()
    expect(screen.getByTestId('signature-step')).toBeInTheDocument()
  })

  it('submits the signed declaration and shows the created declaration id', async () => {
    useEea1Handlers(() => HttpResponse.json({ id: 'decl-42' }))
    const user = userEvent.setup()
    renderAt(`/eea1/new?employeeId=emp-001&formId=${FORM_ID}`)

    await passConsentGate(user)
    drawAndSubmit()
    await user.click(screen.getByTestId('signature-submit'))

    expect(await screen.findByTestId('eea1-submit-success')).toBeInTheDocument()
    expect(screen.getByTestId('eea1-declaration-id')).toHaveTextContent('decl-42')
  })

  it('surfaces the API error body when the submission is rejected', async () => {
    useEea1Handlers(() => HttpResponse.json({ error: 'Consent event missing' }, { status: 400 }))
    const user = userEvent.setup()
    renderAt(`/eea1/new?employeeId=emp-001&formId=${FORM_ID}`)

    await passConsentGate(user)
    drawAndSubmit()
    await user.click(screen.getByTestId('signature-submit'))

    const alert = await screen.findByTestId('eea1-submit-error')
    expect(alert).toHaveTextContent('Consent event missing')
    expect(screen.queryByTestId('eea1-submit-success')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// /eea2/$formId — draft loading, tab switching, load failure
// ---------------------------------------------------------------------------

describe('/eea2/$formId route', () => {
  it('loads the draft and renders the wizard on the form tab', async () => {
    server.use(
      http.get(`/api/eea2/${FORM_ID}`, () =>
        HttpResponse.json({
          id: FORM_ID,
          status: 'draft',
          state: {},
          updatedAt: '2026-07-01T08:00:00Z',
        }),
      ),
    )
    renderAt(`/eea2/${FORM_ID}`)

    expect(await screen.findByRole('tab', { name: 'Form' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      await screen.findByRole('button', { name: 'Section A - Employer details' }),
    ).toBeInTheDocument()
  })

  it('switches to the audit history tab', async () => {
    server.use(
      http.get(`/api/eea2/${FORM_ID}`, () =>
        HttpResponse.json({
          id: FORM_ID,
          status: 'draft',
          state: {},
          updatedAt: '2026-07-01T08:00:00Z',
        }),
      ),
      http.get(`/eea2/${FORM_ID}/events`, () => HttpResponse.json({ events: [] })),
    )
    const user = userEvent.setup()
    renderAt(`/eea2/${FORM_ID}`)

    await screen.findByRole('tab', { name: 'Audit history' })
    await user.click(screen.getByRole('tab', { name: 'Audit history' }))

    expect(await screen.findByTestId('audit-history-panel')).toBeInTheDocument()
  })

  it('shows a load error when the draft fetch fails', async () => {
    server.use(http.get(`/api/eea2/${FORM_ID}`, () => new HttpResponse(null, { status: 500 })))
    renderAt(`/eea2/${FORM_ID}`)

    expect(await screen.findByText('Unable to load EEA2 form (500)')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// /eea2/$formId/sign — role-gated signing ceremony
// ---------------------------------------------------------------------------

describe('/eea2/$formId/sign route', () => {
  it('redirects to the index when no signing role is present', async () => {
    const router = renderAt(`/eea2/${FORM_ID}/sign`)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
    expect(screen.queryByText('EEA2 signing ceremony')).not.toBeInTheDocument()
  })

  it('redirects to the index for a non-signing role', async () => {
    globalThis.localStorage.setItem('simplifi:role', 'EMPLOYEE')
    const router = renderAt(`/eea2/${FORM_ID}/sign`)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })

  it('renders the signing ceremony for the CEO role', async () => {
    globalThis.localStorage.setItem('simplifi:role', 'CEO')
    renderAt(`/eea2/${FORM_ID}/sign`)

    expect(await screen.findByText('EEA2 signing ceremony')).toBeInTheDocument()
  })

  it('renders the signing ceremony for the SENIOR_MANAGER role', async () => {
    globalThis.localStorage.setItem('simplifi:role', 'SENIOR_MANAGER')
    renderAt(`/eea2/${FORM_ID}/sign`)

    expect(await screen.findByText('EEA2 signing ceremony')).toBeInTheDocument()
  })
})
