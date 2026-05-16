import { createRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Route as rootRoute } from './__root'
import { AuditHistoryPanel } from '@/components/eea/AuditHistoryPanel'
import { EEAWizard } from '@/features/eea'
import type { StepId, WizardContext } from '@/features/eea/wizard-types'

interface Eea2DraftResponse {
  id: string
  status: string
  state: unknown
  updatedAt: string
}

interface LoadedDraft {
  status: string
  state: Record<StepId, unknown>
  updatedAt: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getWizardContext = (state: Record<string, unknown>): WizardContext | undefined => {
  const value = state['wizardContext']
  if (!isRecord(value)) {
    return undefined
  }
  return value as WizardContext
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/eea2/$formId',
  validateSearch: (search: Record<string, unknown>) => ({
    locked: search['locked'] === '1' || search['locked'] === true,
    tenantId: typeof search['tenantId'] === 'string' ? search['tenantId'] : '',
  }),
  component: EEA2FormRoute,
})

function EEA2FormRoute() {
  const { formId } = Route.useParams()
  const { locked, tenantId } = Route.useSearch()
  const [draft, setDraft] = useState<LoadedDraft | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'form' | 'audit'>('form')

  useEffect(() => {
    const controller = new AbortController()
    setDraft(null)
    setLoadError(null)
    setActiveTab('form')

    fetch(`/api/eea2/${encodeURIComponent(formId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load EEA2 form (${response.status.toString()})`)
        }
        return response.json() as Promise<Eea2DraftResponse>
      })
      .then((body) => {
        setDraft({
          status: body.status,
          state: isRecord(body.state) ? body.state : {},
          updatedAt: body.updatedAt,
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load EEA2 form')
      })

    return () => {
      controller.abort()
    }
  }, [formId])

  const isLocked = locked || draft?.status === 'signed'
  const wizardContext = draft === null ? undefined : getWizardContext(draft.state)

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      {loadError === null ? null : <p className="mb-4 text-sm text-red-700">{loadError}</p>}
      <div className="mx-auto mb-4 flex w-full max-w-5xl gap-2" role="tablist">
        <button
          aria-selected={activeTab === 'form'}
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium aria-selected:bg-slate-900 aria-selected:text-white"
          onClick={() => {
            setActiveTab('form')
          }}
          role="tab"
          type="button"
        >
          Form
        </button>
        <button
          aria-selected={activeTab === 'audit'}
          className="rounded border border-slate-300 px-3 py-2 text-sm font-medium aria-selected:bg-slate-900 aria-selected:text-white"
          onClick={() => {
            setActiveTab('audit')
          }}
          role="tab"
          type="button"
        >
          Audit history
        </button>
      </div>
      {activeTab === 'form' ? (
        <EEAWizard
          formId={formId}
          {...(draft === null ? {} : { initialFormState: draft.state })}
          {...(wizardContext === undefined ? {} : { initialWizardContext: wizardContext })}
          isLocked={isLocked}
          key={`${formId}-${draft?.updatedAt ?? 'loading'}`}
          tenantId={tenantId}
        />
      ) : (
        <div className="mx-auto w-full max-w-5xl border border-slate-200 bg-white p-6">
          <AuditHistoryPanel formId={formId} />
        </div>
      )}
    </main>
  )
}
