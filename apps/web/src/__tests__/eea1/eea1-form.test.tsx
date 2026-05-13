import { EEA1DeclarationBaseSchema, EmployeeDeclarationSchema } from '@simplifi/shared'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DemographicFieldsSection } from '@/components/eea1/DemographicFieldsSection'
import { NationalitySection } from '@/components/eea1/NationalitySection'
import { PopiaConsentGate } from '@/components/eea1/PopiaConsentGate'
import { SignatureStep } from '@/components/eea1/SignatureStep'
import { useEEAAutosave } from '@/hooks/use-eea-autosave'
import { server } from '@/test/server'

const FORM_ID = '11111111-1111-4111-8111-111111111111'

function EEA1ConsentHarness(): React.JSX.Element {
  const [hasConsent, setHasConsent] = useState(false)

  return hasConsent ? (
    <DemographicFieldsSection formId={FORM_ID} />
  ) : (
    <PopiaConsentGate
      employerName="Simplifi"
      formId={FORM_ID}
      onConsent={() => {
        setHasConsent(true)
      }}
    />
  )
}

describe('EEA1 form sections', () => {
  afterEach(() => {
    server.resetHandlers()
    vi.useRealTimers()
  })

  it('keeps demographic fields behind the POPIA consent gate', async () => {
    server.use(
      http.post('/api/event-store/append', () => {
        return HttpResponse.json({ success: true })
      }),
    )

    const user = userEvent.setup()
    render(<EEA1ConsentHarness />)

    expect(screen.queryByTestId('demographic-fields-section')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('popia-consent-checkbox'))
    await user.click(screen.getByTestId('popia-consent-submit'))

    expect(await screen.findByTestId('demographic-fields-section')).toBeInTheDocument()
  })

  it('maps race non-disclosure to a schema-level null value', async () => {
    const user = userEvent.setup()
    render(<DemographicFieldsSection formId={FORM_ID} />)

    await user.click(screen.getByTestId('race-null'))

    const raceInput = screen.getByTestId('race-null')
    expect(raceInput).toBeChecked()

    const parsed = EmployeeDeclarationSchema.parse({
      employeeId: 'employee-001',
      tenantId: 'tenant-001',
      name: 'Test Employee',
      workplaceNumber: 'WP-001',
      gender: null,
      race: null,
      foreignNational: false,
      disability: null,
      declarationDate: '2026-05-13',
      signatureDataUrl: 'data:image/png;base64,SIGNATURE',
    })

    expect(parsed.race).toBeNull()
  })

  it('renders citizenshipDate only when foreignNational is true', async () => {
    const user = userEvent.setup()
    render(<NationalitySection formId={FORM_ID} />)

    expect(screen.queryByTestId('citizenship-date')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('nationality-foreign-national'))
    expect(screen.getByTestId('citizenship-date')).toBeInTheDocument()
  })

  it('renders disabilityNature only when disability is Yes', async () => {
    const user = userEvent.setup()
    render(<DemographicFieldsSection formId={FORM_ID} />)

    await user.click(screen.getByTestId('disability-No'))
    expect(screen.queryByTestId('disability-nature')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('disability-Yes'))
    expect(screen.getByTestId('disability-nature')).toBeInTheDocument()
  })

  it('renders reasonableAccommodation when disability is Yes', async () => {
    const user = userEvent.setup()
    render(<DemographicFieldsSection formId={FORM_ID} />)

    await user.click(screen.getByTestId('disability-Yes'))

    expect(screen.getByTestId('reasonable-accommodation')).toBeInTheDocument()
  })

  it('renders declarationDate read-only with today in YYYY-MM-DD form', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      lineCap: 'round',
      lineJoin: 'round',
      lineWidth: 2,
      scale: () => {},
      strokeStyle: '#0f172a',
    } as unknown as CanvasRenderingContext2D)

    render(<SignatureStep formId={FORM_ID} onSubmit={() => {}} />)

    const today = new Date().toISOString().split('T')[0]
    const declarationDate = screen.getByTestId('declaration-date')

    expect(declarationDate).toHaveAttribute('readonly')
    expect(declarationDate).toHaveValue(today)
  })

  it('autosaves non-PII name but never PATCHes race', async () => {
    vi.useFakeTimers()
    const patchBodies: Array<Record<string, unknown>> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let normalizedInit: RequestInit | undefined
      if (init !== undefined) {
        const { signal, ...rest } = init
        void signal
        normalizedInit = rest
      }
      if (typeof input === 'string' && input.startsWith('/')) {
        return originalFetch(new URL(input, globalThis.location.origin).toString(), normalizedInit)
      }
      return originalFetch(input, normalizedInit)
    }

    server.use(
      http.patch('/eea1/:formId', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        patchBodies.push(body)
        return HttpResponse.json({ ok: true })
      }),
    )

    try {
      const { result } = renderHook(() =>
        useEEAAutosave({
          formId: FORM_ID,
          schema: EEA1DeclarationBaseSchema,
          excludeFields: ['race'],
        }),
      )

      await act(async () => {
        result.current.saveField('name', 'Test Employee')
        await vi.advanceTimersByTimeAsync(800)
      })

      await vi.waitFor(() => {
        expect(patchBodies).toHaveLength(1)
      })
      expect(patchBodies[0]).toHaveProperty('name', 'Test Employee')

      await act(async () => {
        result.current.saveField('race', 'African')
        await vi.advanceTimersByTimeAsync(800)
      })

      expect(patchBodies).toHaveLength(1)
      expect(patchBodies.some((body) => Object.hasOwn(body, 'race'))).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
