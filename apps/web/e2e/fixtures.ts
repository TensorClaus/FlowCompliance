import { randomUUID } from 'node:crypto'
import { test as base } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { prisma } from '../../api/src/lib/prisma'

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
  const res = await fetch(`${API_URL}/test/seed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  })
  if (!res.ok) throw new Error(`Seed failed: ${res.status.toString()}`)
  return (await res.json()) as Omit<SeedData, 'employeeADeclarationId'>
}

async function seedDeclaration(tenantId: string, eeaManagerSub: string): Promise<string> {
  // 1×1 transparent PNG — minimal valid signature data URL.
  const minimalPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  const declaration = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    return tx.eea1Declaration.create({
      data: {
        tenantId,
        employeeId: eeaManagerSub,
        foreignNational: false,
        name: 'EE Manager',
        signatureDataUrl: minimalPng,
        workplaceNumber: 'WP-EE-MANAGER',
        declarationDate: new Date(),
      },
      select: { id: true },
    })
  })
  return declaration.id
}

async function teardownTenant(tenantId: string): Promise<void> {
  await fetch(`${API_URL}/test/seed/${tenantId}`, { method: 'DELETE' })
}

export async function seedTenantWithDeclaration(): Promise<SeedData> {
  const partial = await seedTenant()
  const employeeADeclarationId = await seedDeclaration(partial.tenantId, partial.eeaManagerSub)
  return { ...partial, employeeADeclarationId }
}

export async function teardownSeedTenant(tenantId: string): Promise<void> {
  await teardownTenant(tenantId)
}

export const test = base.extend<{ setup: TestSetup }>({
  setup: async ({ page }, use) => {
    const seed = await seedTenantWithDeclaration()

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
