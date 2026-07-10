import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { ComplianceDashboard } from '@/features/compliance'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <ComplianceDashboard />
    </main>
  )
}
