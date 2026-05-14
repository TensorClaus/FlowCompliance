import { createRoute, redirect } from '@tanstack/react-router'
import { Route as rootRoute } from './__root'
import { EEA2SigningCeremonyPage } from '@/features/eea'

const SIGNING_ROLES = new Set(['CEO', 'SENIOR_MANAGER'])

function getCurrentRole(): string | null {
  try {
    return globalThis.localStorage.getItem('simplifi:role')
  } catch {
    return null
  }
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/eea2/$formId/sign',
  beforeLoad: () => {
    const role = getCurrentRole()
    if (role !== null && !SIGNING_ROLES.has(role)) {
      return redirect({ to: '/' })
    }
    return
  },
  component: EEA2SignRoute,
})

function EEA2SignRoute() {
  const { formId } = Route.useParams()
  return <EEA2SigningCeremonyPage formId={formId} />
}
