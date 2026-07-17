import { createRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Route as rootRoute } from './__root'
import { BundleDashboard, type BundlePeriodRef } from '@/features/submission-bundle/BundleDashboard'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/submission-bundle',
  validateSearch: (search: Record<string, unknown>) => ({
    tenantId: typeof search['tenantId'] === 'string' ? search['tenantId'] : '',
  }),
  component: SubmissionBundleRoute,
})

// ---------------------------------------------------------------------------
// API shape
// ---------------------------------------------------------------------------

interface BundleIndexResponse {
  periods?: BundlePeriodRef[]
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

function SubmissionBundleRoute(): React.ReactElement {
  const { tenantId } = Route.useSearch()
  const [periods, setPeriods] = useState<BundlePeriodRef[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  // The bundle index lists every reporting period together with the EEA2/EEA4
  // form ids and the informational EEA12/EEA13 presence flags. The dashboard
  // then re-fetches the live gating wrappers per period on every look.
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(null)

    fetch(`/api/submission-bundle?tenantId=${encodeURIComponent(tenantId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as BundleIndexResponse
        setPeriods(Array.isArray(body.periods) ? body.periods : [])
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLoadError('Unable to load submission bundle periods')
      })

    return () => {
      controller.abort()
    }
  }, [tenantId])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      {loadError === null ? null : <p className="mb-4 text-sm text-red-700">{loadError}</p>}
      <BundleDashboard periods={periods} />
    </main>
  )
}
