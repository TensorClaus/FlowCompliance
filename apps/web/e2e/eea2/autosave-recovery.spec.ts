import { expect, test } from '../fixtures'
import { API_URL, createEea2Draft, installEea2ApiRoutes, useBrowserToken } from './helpers'

interface AuditEvent {
  eventType: string | null
  fieldPath: string | null
}

interface EventsResponse {
  events: AuditEvent[]
}

test.describe.configure({ mode: 'serial' })

test.describe('EEA2 autosave recovery', () => {
  test('retries failed Section C matrix cell autosaves without duplicates', async ({
    page,
    setup,
  }) => {
    const { seed } = setup
    const browserToken = useBrowserToken(setup)
    await installEea2ApiRoutes(page, browserToken.currentToken)

    const formId = await createEea2Draft(seed)
    await page.goto(`/eea2/${formId}?tenantId=${seed.tenantId}`)
    await page.getByLabel('Primary contact name').fill('EE Manager')
    await page.getByLabel('Primary contact email').fill('ee.manager@test.local')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('spinbutton', { name: 'Permanent male', exact: true }).fill('1')
    await page.getByRole('spinbutton', { name: 'Permanent female', exact: true }).fill('1')
    await page.getByRole('spinbutton', { name: 'Non-Permanent male', exact: true }).fill('1')
    await page.getByRole('spinbutton', { name: 'Non-Permanent female', exact: true }).fill('0')
    await page.getByRole('spinbutton', { name: 'Contract workers male', exact: true }).fill('0')
    await page.getByRole('spinbutton', { name: 'Contract workers female', exact: true }).fill('0')
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText('Section C - Current workforce', { exact: true })).toBeVisible()

    const routePattern = `**/eea2/${formId}/events`
    await page.route(routePattern, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'temporary autosave outage' }),
        })
        return
      }
      await route.continue()
    })

    const matrix = page.getByTestId('occupational-matrix').last()
    const inputs = matrix.locator('input[type="number"]')
    const cellValues = ['1', '2', '3']
    for (const [index, value] of cellValues.entries()) {
      const input = inputs.nth(index)
      await input.fill(value)
      await input.evaluate((element) => {
        if (element instanceof HTMLInputElement) {
          element.blur()
        }
      })
    }

    await expect(page.getByTestId('save-pending')).toBeVisible()
    await page.unroute(routePattern)
    await expect(page.getByTestId('save-pending')).toHaveCount(0, { timeout: 5000 })

    const readCellEvents = async (): Promise<AuditEvent[]> => {
      const response = await page.request.get(`${API_URL}/eea2/${formId}/events?limit=100`, {
        headers: { Authorization: `Bearer ${seed.eeaManagerToken}` },
      })
      expect(response.status()).toBe(200)
      const body = (await response.json()) as EventsResponse
      return body.events.filter(
        (event) =>
          event.eventType === 'FIELD_UPDATED' &&
          event.fieldPath?.startsWith('sectionB.table1_1.') === true,
      )
    }

    await expect
      .poll(
        async () => {
          const events = await readCellEvents()
          return events.length
        },
        { timeout: 5000 },
      )
      .toBe(3)
    const cellEvents = await readCellEvents()
    const fieldPaths = cellEvents.map((event) => event.fieldPath)
    expect(new Set(fieldPaths).size).toBe(3)

    for (const [index, value] of cellValues.entries()) {
      await expect(inputs.nth(index)).toHaveValue(value)
    }
  })
})
