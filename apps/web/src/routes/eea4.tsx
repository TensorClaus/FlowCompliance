import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { Eea4Report } from '@/features/compliance'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports/eea4',
  component: Eea4Page,
})

function Eea4Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <Eea4Report />
    </main>
  )
}
