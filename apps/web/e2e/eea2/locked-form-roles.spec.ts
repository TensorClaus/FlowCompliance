import { expect, test, type SeedData } from '../fixtures'
import { API_URL, createSignedEea2Form, installEea2ApiRoutes, useBrowserToken } from './helpers'

const ROLE_TOKEN_KEYS = [
  ['EE_MANAGER', 'eeaManagerToken'],
  ['HR_DIRECTOR', 'hrDirectorToken'],
  ['CFO', 'cfoToken'],
  ['SENIOR_MANAGER', 'seniorManagerToken'],
  ['CEO', 'ceoToken'],
  ['ADMIN', 'adminToken'],
] as const satisfies ReadonlyArray<readonly [string, keyof SeedData]>

test.describe.configure({ mode: 'serial' })

test.describe('EEA2 locked form role access', () => {
  for (const [role, tokenKey] of ROLE_TOKEN_KEYS) {
    test(`${role} sees a read-only signed EEA2 form with audit history`, async ({
      page,
      setup,
    }) => {
      const { seed } = setup
      const { formId: signedFormId, tenantId } = await createSignedEea2Form(seed)
      const token = seed[tokenKey]
      const browserToken = useBrowserToken(setup)
      await installEea2ApiRoutes(page, browserToken.currentToken)
      browserToken.useToken(token)

      await page.goto('/')
      await page.evaluate((nextRole) => {
        globalThis.localStorage.setItem('simplifi:role', nextRole)
      }, role)

      const loadResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/eea2/${signedFormId}`) &&
          response.request().method() === 'GET' &&
          !response.url().includes('/events'),
      )
      await page.goto(`/eea2/${signedFormId}?tenantId=${tenantId}`)
      await loadResponse
      await page.getByRole('button', { name: 'Section C - Current workforce' }).click()

      await expect(page.locator('input')).toHaveCount(0)
      await expect(page.locator('textarea')).toHaveCount(0)
      await expect(page.locator('select')).toHaveCount(0)
      const matrixCellTag = await page
        .locator('[data-testid="matrix-cell"]')
        .first()
        .evaluate((el) => el.tagName)
      expect(matrixCellTag).toBe('SPAN')

      const patchResponse = await page.request.patch(`${API_URL}/eea2/${signedFormId}`, {
        data: { reportingYear: 2025 },
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(patchResponse.status()).toBe(409)

      await page.getByRole('tab', { name: 'Audit history' }).click()
      await expect
        .poll(() => page.locator('[data-testid="timeline-entry"]').count())
        .toBeGreaterThan(0)
    })
  }
})
