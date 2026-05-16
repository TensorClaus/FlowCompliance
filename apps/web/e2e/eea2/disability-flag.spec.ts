import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures'
import { createEea2Draft, installEea2ApiRoutes, useBrowserToken } from './helpers'

async function clickNext(page: Page): Promise<void> {
  const next = page.getByRole('button', { name: 'Next', exact: true })
  await expect(next).toBeEnabled()
  await next.click()
}

async function fillMatrix(page: Page, values: number[]): Promise<void> {
  const matrix = page.getByTestId('occupational-matrix').last()
  const inputs = matrix.locator('input[type="number"]')
  for (const [index, value] of values.entries()) {
    await inputs.nth(index).fill(String(value))
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('EEA2 disability flag suppression', () => {
  test('keeps the disability flag visible and disables submission', async ({ page, setup }) => {
    const { seed } = setup
    const browserToken = useBrowserToken(setup)
    await installEea2ApiRoutes(page, browserToken.currentToken)

    const formId = await createEea2Draft(seed)
    await page.goto(`/eea2/${formId}?tenantId=${seed.tenantId}`)
    await page.waitForLoadState('networkidle')

    await page.getByLabel('Primary contact name').fill('EE Manager')
    await page.getByLabel('Primary contact email').fill('ee.manager@test.local')
    await clickNext(page)

    await page.getByRole('spinbutton', { name: 'Permanent male', exact: true }).fill('100')
    await page.getByRole('spinbutton', { name: 'Permanent female', exact: true }).fill('100')
    await page.getByRole('spinbutton', { name: 'Non-Permanent male', exact: true }).fill('0')
    await page.getByRole('spinbutton', { name: 'Non-Permanent female', exact: true }).fill('0')
    await page.getByRole('spinbutton', { name: 'Contract workers male', exact: true }).fill('0')
    await page.getByRole('spinbutton', { name: 'Contract workers female', exact: true }).fill('0')
    await clickNext(page)

    await fillMatrix(page, [200])
    await expect(page.locator('[data-testid="disability-flag-banner"]')).toBeVisible()
    await expect(page.locator('[data-testid="disability-flag-banner"] [data-dismiss]')).toHaveCount(
      0,
    )
    await expect(page.locator('[data-testid="disability-flag-banner"] [data-close]')).toHaveCount(0)

    await clickNext(page)
    await expect(page.getByText('Section C - Numerical goals', { exact: true })).toBeVisible()
    await clickNext(page)

    await fillMatrix(page, [1, 1, 1, 1, 1])
    await clickNext(page)

    await page.getByLabel('Total training budget (ZAR)').fill('12000')
    await page.getByLabel(/^African:/).fill('20')
    await page.getByLabel(/^Coloured:/).fill('20')
    await page.getByLabel(/^Indian or Asian:/).fill('20')
    await page.getByLabel(/^White:/).fill('20')
    await page.getByLabel(/^Non-designated:/).fill('20')
    await page.getByLabel('Training spend narrative').fill('Training spend allocated evenly.')
    await clickNext(page)

    await page.getByLabel('No promotions in reporting period').check()
    await clickNext(page)
    await clickNext(page)

    for (const select of await page.locator('select[aria-label$="termination reason"]').all()) {
      await select.selectOption('resignation')
    }
    await clickNext(page)
    await clickNext(page)

    await page.getByLabel('WSP submitted to the SETA').check()
    await page.getByLabel('Skills development narrative').fill('WSP submitted and aligned.')
    await clickNext(page)
    await clickNext(page)

    await page.getByLabel('Last assessment date').fill('2026-05-01')
    await page.getByLabel('Next scheduled date').fill('2026-11-01')
    await clickNext(page)

    await expect(page.locator('[data-testid="review-disability-flag"]')).toBeVisible()
    const disabled = await page
      .locator('[data-testid="submit-for-ceo-signing"]')
      .getAttribute('disabled')
    expect(disabled).not.toBeNull()
  })
})
