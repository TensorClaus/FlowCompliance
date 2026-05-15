import { prisma } from '../../../api/src/lib/prisma'
import { API_URL, createEea2Draft, seedAuditEvents } from '../eea2/helpers'
import { expect, seedTenantWithDeclaration, teardownSeedTenant, test } from '../fixtures'

interface EventsResponse {
  events: Array<{ id: string }>
}

test.describe.configure({ mode: 'serial' })

test.describe('RLS isolation', () => {
  test('tenant B cannot read tenant A EEA2 or EEA1 rows', async ({ page, setup }) => {
    const tenantA = setup.seed
    const tenantB = await seedTenantWithDeclaration()

    try {
      const formId = await createEea2Draft(tenantA)
      await seedAuditEvents(tenantA, formId)
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantA.tenantId}, true)`
        await tx.eea2Draft.update({ where: { id: formId }, data: { status: 'signed' } })
      })

      const tenantAEventsResponse = await fetch(`${API_URL}/eea2/${formId}/events?limit=100`, {
        headers: { Authorization: `Bearer ${tenantA.ceoToken}` },
      })
      expect(tenantAEventsResponse.status).toBe(200)
      const tenantAEvents = (await tenantAEventsResponse.json()) as EventsResponse
      expect(tenantAEvents.events.length).toBeGreaterThan(0)
      const tenantAEventId = tenantAEvents.events[0]?.id
      expect(tenantAEventId).toBeDefined()
      if (tenantAEventId === undefined) {
        throw new Error('Expected tenant A event id')
      }

      await page.setExtraHTTPHeaders({ Authorization: `Bearer ${tenantB.eeaManagerToken}` })
      const tenantBHeaders = { Authorization: `Bearer ${tenantB.eeaManagerToken}` }

      const eventsResponse = await page.request.get(`${API_URL}/eea2/${formId}/events`, {
        headers: tenantBHeaders,
      })
      expect(eventsResponse.status()).toBe(200)
      const eventsBody = (await eventsResponse.json()) as EventsResponse
      expect(eventsBody.events).toHaveLength(0)

      const draftResponse = await page.request.get(`${API_URL}/eea2/${formId}`, {
        headers: tenantBHeaders,
      })
      expect(draftResponse.status()).toBe(404)

      const replayResponse = await page.request.post(`${API_URL}/eea2/${formId}/replay`, {
        headers: {
          ...tenantBHeaders,
          'content-type': 'application/json',
        },
        data: { toEventId: tenantAEventId },
      })
      expect(replayResponse.status()).toBe(404)

      const declarationResponse = await page.request.get(
        `${API_URL}/eea1/${tenantA.employeeADeclarationId}`,
        { headers: tenantBHeaders },
      )
      const visibleDeclarations =
        declarationResponse.status() === 200 ? [await declarationResponse.json()] : []
      expect(declarationResponse.status()).not.toBe(200)
      expect(visibleDeclarations).toHaveLength(0)
    } finally {
      await teardownSeedTenant(tenantB.tenantId)
    }
  })
})
