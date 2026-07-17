import { OccupationalMatrixSchema, type OccupationalMatrix } from '@simplifi/shared'
import { createRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Route as rootRoute } from './__root'
import { EEA12Form } from '@/features/eea12/eea12-form'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/eea12-form/$formId',
  validateSearch: (search: Record<string, unknown>) => ({
    tenantId: typeof search['tenantId'] === 'string' ? search['tenantId'] : '',
    linkedEEA2Id: typeof search['linkedEEA2Id'] === 'string' ? search['linkedEEA2Id'] : undefined,
  }),
  component: EEA12FormRoute,
})

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface EEA2SectionBResponse {
  sectionB?: {
    workforceProfile?: unknown
    disabilityProfile?: unknown
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to extract an OccupationalMatrix from an unknown EEA2 API response.
 * Returns undefined when the matrix is absent or fails schema validation.
 */
function extractMatrix(raw: unknown): OccupationalMatrix | undefined {
  const parsed = OccupationalMatrixSchema.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

function EEA12FormRoute(): React.ReactElement {
  const { formId } = Route.useParams()
  const { tenantId, linkedEEA2Id } = Route.useSearch()

  const [linkedEEA2Workforce, setLinkedEEA2Workforce] = useState<OccupationalMatrix | undefined>()
  const [linkedEEA2Disability, setLinkedEEA2Disability] = useState<OccupationalMatrix | undefined>()
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load linked EEA2 Section B matrices when a linkedEEA2Id is provided.
  useEffect(() => {
    if (linkedEEA2Id === undefined || linkedEEA2Id.length === 0) return

    const controller = new AbortController()
    setLoadError(null)

    fetch(`/api/eea2/${encodeURIComponent(linkedEEA2Id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          // Non-fatal — Section B falls back to empty rows.
          return
        }
        const body = (await response.json()) as { report?: EEA2SectionBResponse }
        const sectionB = body.report?.sectionB
        const workforce = extractMatrix(sectionB?.workforceProfile)
        const disability = extractMatrix(sectionB?.disabilityProfile)
        if (workforce !== undefined) setLinkedEEA2Workforce(workforce)
        if (disability !== undefined) setLinkedEEA2Disability(disability)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLoadError(error instanceof Error ? error.message : 'Unable to load linked EEA2 data')
      })

    return () => {
      controller.abort()
    }
  }, [linkedEEA2Id])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      {loadError === null ? null : <p className="mb-4 text-sm text-red-700">{loadError}</p>}
      <EEA12Form
        formId={formId}
        tenantId={tenantId}
        {...(linkedEEA2Workforce === undefined ? {} : { linkedEEA2Workforce })}
        {...(linkedEEA2Disability === undefined ? {} : { linkedEEA2Disability })}
      />
    </main>
  )
}
