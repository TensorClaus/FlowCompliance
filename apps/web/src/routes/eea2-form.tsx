import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { EEAWizard } from '@/features/eea'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/eea2/$formId',
  validateSearch: (search: Record<string, unknown>) => ({
    locked: search['locked'] === '1' || search['locked'] === true,
  }),
  component: EEA2FormRoute,
})

function EEA2FormRoute() {
  const { formId } = Route.useParams()
  const { locked } = Route.useSearch()

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <EEAWizard formId={formId} isLocked={locked} />
    </main>
  )
}
