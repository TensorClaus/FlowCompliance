import {
  OccupationalMatrixSchema,
  type EmployerProfile,
  type OccupationalMatrix,
} from '@simplifi/shared'
import { createRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Route as rootRoute } from './__root'
import type { EEA2Descriptor } from '@/features/eea4/eea4-form'
import { EEA4Form } from '@/features/eea4/eea4-form'

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/eea4-form/$formId',
  validateSearch: (search: Record<string, unknown>) => ({
    tenantId: typeof search['tenantId'] === 'string' ? search['tenantId'] : '',
    reportingYear:
      typeof search['reportingYear'] === 'number' && Number.isInteger(search['reportingYear'])
        ? search['reportingYear']
        : new Date().getFullYear(),
  }),
  component: EEA4FormRoute,
})

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

interface EEA4DraftResponse {
  id: string
  status: string
  report: unknown
  createdAt: string
  updatedAt: string
}

interface EEA2ListItem {
  id: string
  reportingYear: number
  status: string
  report?: {
    employerProfile?: unknown
    sectionB?: {
      workforceProfile?: unknown
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Attempt to extract an EmployerProfile-shaped object from an EEA2 list item.
 * Returns null if the required fields are absent — those records are excluded
 * from the picker because sectionA cannot be snapshotted without a profile.
 */
function extractEmployerProfile(item: EEA2ListItem): EmployerProfile | null {
  const profile = item.report?.employerProfile
  if (!isRecord(profile)) {
    return null
  }
  // Minimum required fields — the schema has more, but at display time we only
  // need enough to render the picker label and snapshot on selection.
  if (
    typeof profile['tradeName'] !== 'string' ||
    typeof profile['dtiRegistrationName'] !== 'string' ||
    typeof profile['dtiRegistrationNumber'] !== 'string'
  ) {
    return null
  }
  // Cast: full EmployerProfileSchema validation happens inside EEA4Form when
  // sectionA is Zod-parsed as part of EEA4FormSchema.parse on load.
  return profile as unknown as EmployerProfile
}

/**
 * Extract the EEA2 Table 1.1 workforce profile matrix from a list item, if it
 * is present and shaped like an OccupationalMatrix. Returns undefined when the
 * matrix cannot be validated — Sections C/D then fall back to a zero matrix.
 */
function extractWorkforceProfile(item: EEA2ListItem): OccupationalMatrix | undefined {
  const parsed = OccupationalMatrixSchema.safeParse(item.report?.sectionB?.workforceProfile)
  return parsed.success ? parsed.data : undefined
}

/**
 * Build the full EEA2 FORM WRAPPER the cross-form engine validates against.
 * The engine reads the wrapper `id` (Rule 2) and report.sectionB.workforceProfile
 * (headcount rule). We forward the item verbatim as the wrapper.
 */
function buildLinkedEEA2Form(item: EEA2ListItem): unknown {
  return { id: item.id, status: item.status, report: item.report ?? {} }
}

// ---------------------------------------------------------------------------
// Route component
// ---------------------------------------------------------------------------

function EEA4FormRoute() {
  const { formId } = Route.useParams()
  const { tenantId, reportingYear } = Route.useSearch()

  const [initialForm, setInitialForm] = useState<unknown>()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [availableEEA2Forms, setAvailableEEA2Forms] = useState<EEA2Descriptor[]>([])

  // Load the persisted EEA4 draft and the EEA2 list in parallel.
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(null)

    const loadDraft = fetch(`/api/eea4/${encodeURIComponent(formId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          // New form — no persisted draft yet; EEA4Form initialises a blank doc.
          return
        }
        if (!response.ok) {
          throw new Error(`Unable to load EEA4 form (${response.status.toString()})`)
        }
        const body = (await response.json()) as EEA4DraftResponse
        setInitialForm({
          id: body.id,
          status: body.status,
          report: body.report,
          createdAt: body.createdAt,
          updatedAt: body.updatedAt,
        })
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setLoadError(error instanceof Error ? error.message : 'Unable to load EEA4 form')
      })

    const loadEEA2List = fetch(
      `/api/eea2?tenantId=${encodeURIComponent(tenantId)}&reportingYear=${encodeURIComponent(reportingYear)}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) {
          return
        }
        const body: unknown = await response.json()
        const items: EEA2ListItem[] = Array.isArray(body) ? (body as EEA2ListItem[]) : []
        const descriptors: EEA2Descriptor[] = []
        for (const item of items) {
          const profile = extractEmployerProfile(item)
          if (profile !== null) {
            const workforceProfile = extractWorkforceProfile(item)
            descriptors.push({
              id: item.id,
              reportingYear: item.reportingYear,
              status: item.status,
              employerProfile: profile,
              form: buildLinkedEEA2Form(item),
              ...(workforceProfile === undefined ? {} : { workforceProfile }),
            })
          }
        }
        setAvailableEEA2Forms(descriptors)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        // Non-fatal — picker just shows empty state.
      })

    void Promise.all([loadDraft, loadEEA2List])

    return () => {
      controller.abort()
    }
  }, [formId, tenantId, reportingYear])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      {loadError === null ? null : <p className="mb-4 text-sm text-red-700">{loadError}</p>}
      <EEA4Form
        availableEEA2Forms={availableEEA2Forms}
        formId={formId}
        initialForm={initialForm}
        reportingYear={reportingYear}
        tenantId={tenantId}
      />
    </main>
  )
}
