import { randomUUID } from 'node:crypto'
import { test as base } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const API_URL = process.env['PLAYWRIGHT_API_URL'] ?? 'http://localhost:3001'

export interface SeedData {
  tenantId: string
  eeaManagerToken: string
  eeaManagerSub: string
  employeeBToken: string
  employeeBSub: string
  ceoToken: string
  /** Pre-seeded EEA1 declaration for eeaManager — used by cross-employee access tests. */
  employeeADeclarationId: string
}

export interface TestSetup {
  seed: SeedData
  /** Swap the Bearer token injected into all proxied API requests. */
  setToken: (token: string) => void
}

function isApiPath(url: URL): boolean {
  const p = url.pathname
  return p.startsWith('/eea1') || p.startsWith('/api') || p.startsWith('/test')
}

async function installAuthInterceptor(page: Page, getToken: () => string): Promise<void> {
  await page.route(
    (url) => isApiPath(new URL(url)),
    async (route: Route) => {
      const headers = {
        ...route.request().headers(),
        Authorization: `Bearer ${getToken()}`,
      }
      await route.continue({ headers })
    },
  )
}

async function seedTenant(): Promise<Omit<SeedData, 'employeeADeclarationId'>> {
  const res = await fetch(`${API_URL}/test/seed`, { method: 'POST' })
  if (!res.ok) throw new Error(`Seed failed: ${res.status.toString()}`)
  return (await res.json()) as Omit<SeedData, 'employeeADeclarationId'>
}

async function seedDeclaration(eeaManagerToken: string, eeaManagerSub: string): Promise<string> {
  // 1×1 transparent PNG — minimal valid signature data URL.
  const minimalPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  const res = await fetch(`${API_URL}/eea1`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${eeaManagerToken}`,
    },
    body: JSON.stringify({ employeeId: eeaManagerSub, signatureDataUrl: minimalPng }),
  })
  if (!res.ok) {
    throw new Error(`Declaration seed failed: ${res.status.toString()}`)
  }
  const body = (await res.json()) as { id: string }
  return body.id
}

async function teardownTenant(tenantId: string): Promise<void> {
  await fetch(`${API_URL}/test/seed/${tenantId}`, { method: 'DELETE' })
}

export const test = base.extend<{ setup: TestSetup }>({
  setup: async ({ page }, use) => {
    const partial = await seedTenant()
    const employeeADeclarationId = await seedDeclaration(
      partial.eeaManagerToken,
      partial.eeaManagerSub,
    )
    const seed: SeedData = { ...partial, employeeADeclarationId }

    let currentToken = seed.eeaManagerToken
    await installAuthInterceptor(page, () => currentToken)

    await use({
      seed,
      setToken: (token: string) => {
        currentToken = token
      },
    })

    await teardownTenant(seed.tenantId)
  },
})

/** Generate a fresh UUID usable as formId inside tests. */
export function newFormId(): string {
  return randomUUID()
}

export { expect } from '@playwright/test'
