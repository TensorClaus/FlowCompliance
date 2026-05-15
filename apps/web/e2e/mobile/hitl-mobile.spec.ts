import {
  API_URL,
  CEO_NAME,
  createEea2Draft,
  currentTotp,
  installEea2ApiRoutes,
  prepareCeoForSigning,
  useBrowserToken,
} from '../eea2/helpers'
import { expect, test } from '../fixtures'

test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 667 } })

test.describe.configure({ mode: 'serial' })

interface SignResult {
  body: unknown
  status: number
}

test.describe('Mobile HITL signing', () => {
  test('CEO can complete signing on Pixel-sized mobile viewport', async ({ page, setup }) => {
    const { seed } = setup
    const browserToken = useBrowserToken(setup)
    await installEea2ApiRoutes(page, browserToken.currentToken)
    await prepareCeoForSigning(seed)

    const formId = await createEea2Draft(seed)
    browserToken.useToken(seed.ceoToken)

    await page.goto('/')
    await page.evaluate(() => {
      globalThis.localStorage.setItem('simplifi:role', 'CEO')
    })
    await page.goto(`/eea2/${formId}/sign`)

    const totpInput = page.getByLabel('TOTP code')
    await expect(totpInput).toBeVisible()
    await totpInput.click()
    await expect(totpInput).toBeFocused()

    const typedNameInput = page.getByLabel('Typed name')
    await typedNameInput.click()
    await expect(typedNameInput).toBeFocused()

    const checkboxSize = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="declaration-checkbox"]')
      if (!(el instanceof HTMLElement)) {
        throw new TypeError('declaration-checkbox not found')
      }
      const rect = el.getBoundingClientRect()
      return { h: rect.height, w: rect.width }
    })
    expect(checkboxSize.w).toBeGreaterThanOrEqual(44)
    expect(checkboxSize.h).toBeGreaterThanOrEqual(44)

    await totpInput.fill(currentTotp())
    await typedNameInput.fill(CEO_NAME)
    await page.getByTestId('declaration-checkbox').check()

    const signResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes(`/eea2/${formId}/sign`) && response.request().method() === 'POST',
      )
      .then(
        async (response): Promise<SignResult> => ({
          body: (await response.json().catch((): unknown => null)) as unknown,
          status: response.status(),
        }),
      )

    const [signResult] = await Promise.all([
      signResponsePromise,
      page.getByRole('button', { name: 'Confirm and Sign' }).click(),
    ])
    expect(signResult.status).toBe(200)
    if (signResult.body !== null) {
      expect(signResult.body).toEqual({ status: 'signed' })
    }
    const signedDraftResponse = await page.request.get(`${API_URL}/eea2/${formId}`, {
      headers: { Authorization: `Bearer ${seed.ceoToken}` },
    })
    expect(signedDraftResponse.status()).toBe(200)
    const signedDraft = (await signedDraftResponse.json()) as unknown
    expect(signedDraft).toMatchObject({ status: 'signed' })

    await page.goto(`/eea2/${formId}?locked=1&tenantId=${seed.tenantId}`)
    await page.getByRole('button', { name: 'Section C - Current workforce' }).click()
    const hasNoHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth === window.innerWidth,
    )
    expect(hasNoHorizontalOverflow).toBe(true)
  })
})
