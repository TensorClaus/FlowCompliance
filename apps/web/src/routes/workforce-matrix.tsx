import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { WorkforceHeatmap } from '@/features/compliance'

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workforce/matrix',
  component: WorkforceMatrixPage,
})

function WorkforceMatrixPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <WorkforceHeatmap />
    </main>
  )
}
