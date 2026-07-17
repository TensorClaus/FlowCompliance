import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { EEA13Form } from '@/features/eea13/eea13-form'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/eea13-form/$formId',
  validateSearch: (search: Record<string, unknown>) => ({
    tenantId: typeof search['tenantId'] === 'string' ? search['tenantId'] : '',
  }),
  component: EEA13FormRoute,
})

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

function EEA13FormRoute(): React.ReactElement {
  const { formId } = Route.useParams()
  const { tenantId } = Route.useSearch()

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <EEA13Form autosaveEndpoint="/api/event-store/append" formId={formId} tenantId={tenantId} />
    </main>
  )
}
