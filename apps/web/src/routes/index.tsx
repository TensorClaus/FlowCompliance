import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { EEAWizard } from '@/features/eea'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
})

function IndexPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <EEAWizard />
    </main>
  )
}
