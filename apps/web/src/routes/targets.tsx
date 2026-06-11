import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { SectorTargetBoard } from '@/features/compliance'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/targets',
  component: TargetsPage,
})

function TargetsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <SectorTargetBoard />
    </main>
  )
}
