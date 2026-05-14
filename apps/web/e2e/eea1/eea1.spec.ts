import type { Page } from '@playwright/test'
import { test, expect, newFormId } from '../fixtures'

const API_URL = process.env['PLAYWRIGHT_API_URL'] ?? 'http://localhost:3001'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function grantConsent(page: Page): Promise<void> {
  await page.getByTestId('popia-consent-checkbox').check()
  await page.getByTestId('popia-consent-submit').click()
  await expect(page.getByTestId('demographic-fields-section')).toBeVisible({ timeout: 8000 })
}

async function injectSignature(page: Page): Promise<void> {
  // Draw on the canvas and dispatch synthetic pointer events so the React
  // component sets hasInk = true, enabling the submit button.
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="signature-canvas"]')
    if (!canvas) throw new Error('signature-canvas not found')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('cannot get 2d context')
    ctx.beginPath()
    ctx.moveTo(10, 10)
    ctx.lineTo(80, 60)
    ctx.stroke()
    const opts = { bubbles: true, cancelable: true, pointerId: 1 }
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...opts, clientX: 10, clientY: 10 }))
    canvas.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientX: 80, clientY: 60 }))
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...opts, clientX: 80, clientY: 60 }))
  })
  await expect(page.getByTestId('signature-submit')).toBeEnabled({ timeout: 3000 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('EEA1 declaration form', () => {
  // ── Scenario A — happy path ────────────────────────────────────────────────
  test('A: happy path — submit creates a 201 declaration', async ({ page, setup }) => {
    const { seed } = setup
    const formId = newFormId()
    const url = `/eea1/new?employeeId=${seed.eeaManagerSub}&formId=${formId}`

    await page.goto(url)

    // Consent gate hides demographic fields until acknowledged
    await expect(page.getByTestId('demographic-fields-section')).not.toBeAttached()

    await grantConsent(page)

    // Fill demographic fields
    await page.getByTestId('race-African').check()
    await page.getByTestId('gender-Male').check()
    await page.getByTestId('disability-No').check()

    await injectSignature(page)

    // Intercept the POST /eea1 response to capture the created ID
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/eea1') && r.request().method() === 'POST', {
        timeout: 10_000,
      }),
      page.getByTestId('signature-submit').click(),
    ])

    expect(response.status()).toBe(201)
    const { id } = (await response.json()) as { id: string }
    expect(id).toBeTruthy()

    // Verify record exists via direct API call with CEO token
    const getRes = await fetch(`${API_URL}/eea1/${id}`, {
      headers: { Authorization: `Bearer ${seed.ceoToken}` },
    })
    expect(getRes.status).toBe(200)
  })

  // ── Scenario B — POPIA consent gate ───────────────────────────────────────
  test('B: POPIA consent gate hides and reveals demographic fields', async ({ page, setup }) => {
    const { seed } = setup
    const formId = newFormId()

    await page.goto(`/eea1/new?employeeId=${seed.eeaManagerSub}&formId=${formId}`)

    // Demographic fields must be absent from DOM before consent
    await expect(page.getByTestId('demographic-fields-section')).not.toBeAttached()

    await grantConsent(page)

    // After consent demographic fields must be present
    await expect(page.getByTestId('demographic-fields-section')).toBeVisible()
  })

  // ── Scenario C — non-disclosure ───────────────────────────────────────────
  test('C: prefer-not-to-disclose maps to null on all PII fields', async ({ page, setup }) => {
    const { seed } = setup
    const formId = newFormId()

    await page.goto(`/eea1/new?employeeId=${seed.eeaManagerSub}&formId=${formId}`)
    await grantConsent(page)

    // Set every PII radio to "Prefer not to disclose"
    await page.getByTestId('race-null').check()
    await page.getByTestId('gender-null').check()
    await page.getByTestId('disability-null').check()

    await injectSignature(page)

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/eea1') && r.request().method() === 'POST', {
        timeout: 10_000,
      }),
      page.getByTestId('signature-submit').click(),
    ])

    expect(response.status()).toBe(201)
    const { id } = (await response.json()) as { id: string }

    // Fetch declaration with privileged token and assert null PII
    const getRes = await fetch(`${API_URL}/eea1/${id}`, {
      headers: { Authorization: `Bearer ${seed.ceoToken}` },
    })
    expect(getRes.status).toBe(200)
    const record = (await getRes.json()) as {
      race: unknown
      gender: unknown
      disability: unknown
    }
    expect(record.race).toBeNull()
    expect(record.gender).toBeNull()
    expect(record.disability).toBeNull()
  })

  // ── Scenario D — cross-employee 403 ───────────────────────────────────────
  test('D: cross-employee access to another employee declaration returns 403', async ({
    page,
    setup,
  }) => {
    const { seed } = setup

    // Switch to employee B's token so all browser requests use that identity
    setup.setToken(seed.employeeBToken)

    // Navigate to any page so the browser context is initialised at baseURL
    await page.goto('/')

    // Make a direct fetch from inside the browser context.
    // page.route() intercepts this request and adds employee B's Bearer token.
    const status = await page.evaluate(async (declarationId: string) => {
      const res = await fetch(`/eea1/${declarationId}`)
      return res.status
    }, seed.employeeADeclarationId)

    expect(status).toBe(403)
  })
})
