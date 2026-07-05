import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { ComplianceCalendar } from '@/features/compliance'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/calendar',
  component: CalendarPage,
})

function CalendarPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <ComplianceCalendar />
    </main>
  )
}
