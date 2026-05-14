import { createHmac, randomUUID } from 'node:crypto'
import type { Page, Route } from '@playwright/test'
import { Prisma } from '../../../api/src/generated/prisma/client'
import { prisma } from '../../../api/src/lib/prisma'
import { expect, type SeedData, type TestSetup } from '../fixtures'

export const API_URL = process.env['PLAYWRIGHT_API_URL'] ?? 'http://localhost:3001'
export const CEO_NAME = 'Rivaan Pillay'
export const CEO_TOTP_SECRET = 'US3WHSG7X5KAPV27VANWKQHF3SH3HULL'

const SECTION_A_PREFILL = {
  report: {
    employerProfile: {
      companyRegNumber: '2026/123456/07',
      sectorCode: 'FIN',
      province: 'Gauteng',
      totalEmployees: 18,
    },
  },
}

interface DraftResponse {
  id: string
}

export interface CompletedEea2Wizard {
  formId: string
  ceoTotpCode: string
  ceoName: string
}

const STEP_LABELS = [
  'Section A - Employer details',
  'Section B - Workforce totals',
  'Section C - Current workforce',
  'Section C - Numerical goals',
  'Section D - Trained employees',
  'Section D - Training spend',
  'Section E - Sector targets',
  'Section E - Next year targets',
  'Section F - Consultation',
  'Section F - Barriers',
  'Section G - Monitoring',
  'Section H - Declaration',
  'Section H - Human review',
  'Review and submit',
] as const

function decodeJwtSub(token: string): string {
  const [, payload] = token.split('.')
  if (payload === undefined) {
    throw new Error('Invalid JWT')
  }

  const decoded = Buffer.from(payload, 'base64url').toString('utf8')
  const parsed = JSON.parse(decoded) as { sub?: unknown }
  if (typeof parsed.sub !== 'string') {
    throw new TypeError('JWT subject missing')
  }
  return parsed.sub
}

function decodeBase32(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of input.replaceAll('=', '').toUpperCase()) {
    const value = alphabet.indexOf(char)
    if (value === -1) {
      throw new Error(`Invalid base32 character: ${char}`)
    }
    bits += value.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2))
  }
  return Buffer.from(bytes)
}

export function currentTotp(secret = CEO_TOTP_SECRET): string {
  const counter = Math.floor(Date.now() / 30_000)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', decodeBase32(secret)).update(buffer).digest()
  const lastByte = hmac.at(-1)
  if (lastByte === undefined) {
    throw new Error('Unable to generate TOTP from empty HMAC')
  }

  const offset = lastByte & 0xf
  const first = hmac.at(offset)
  const second = hmac.at(offset + 1)
  const third = hmac.at(offset + 2)
  const fourth = hmac.at(offset + 3)

  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    throw new Error('Unable to generate TOTP from truncated HMAC')
  }

  const binary =
    ((first & 0x7f) << 24) | ((second & 0xff) << 16) | ((third & 0xff) << 8) | (fourth & 0xff)

  return String(binary % 1_000_000).padStart(6, '0')
}

export async function prepareCeoForSigning(seed: SeedData): Promise<void> {
  const ceoId = decodeJwtSub(seed.ceoToken)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${seed.tenantId}, true)`
    await tx.user.update({
      where: { id: ceoId },
      data: { name: CEO_NAME, totpSecret: CEO_TOTP_SECRET },
    })
  })
}

export async function createEea2Draft(seed: SeedData): Promise<string> {
  const response = await fetch(`${API_URL}/eea2`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${seed.eeaManagerToken}`,
    },
    body: JSON.stringify({ reportingYear: 2026, state: {} }),
  })

  if (!response.ok) {
    throw new Error(`Draft seed failed: ${response.status.toString()}`)
  }

  const body = (await response.json()) as DraftResponse
  return body.id
}

export async function installEea2ApiRoutes(page: Page, getToken: () => string): Promise<void> {
  await page.route('**/api/eea2/**', async (route: Route) => {
    const request = route.request()
    const sourceUrl = new URL(request.url())
    const apiPath = sourceUrl.pathname.replace(/^\/api/, '')
    const targetUrl = `${API_URL}${apiPath}${sourceUrl.search}`
    await route.continue({
      url: targetUrl,
      headers: {
        ...request.headers(),
        Authorization: `Bearer ${getToken()}`,
      },
    })
  })

  await page.route('**/api/eea2/prefill**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SECTION_A_PREFILL),
    })
  })

  await page.route('**/api/eea13/latest**', async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'No EEA13 prefill available' }),
    })
  })
}

export function useBrowserToken(setup: TestSetup): {
  currentToken: () => string
  useToken: (token: string) => void
} {
  let token = setup.seed.eeaManagerToken
  return {
    currentToken: () => token,
    useToken: (nextToken: string) => {
      token = nextToken
      setup.setToken(nextToken)
    },
  }
}

export async function seedAuditEvents(seed: SeedData, formId: string): Promise<void> {
  const userId = decodeJwtSub(seed.eeaManagerToken)
  const fields = [
    ['sectionA', { registrationNumber: '2026/123456/07', primaryContactName: 'EE Manager' }],
    ['sectionB', { totalEmployees: 18 }],
    ['sectionC.current', { grandTotal: 18 }],
    ['sectionC.goals', { grandTotal: 0 }],
    ['sectionD.trained', { grandTotal: 5 }],
    ['sectionD.trainingSpend', { totalBudget: 12_000 }],
    ['sectionE.promotions', { noPromotions: true }],
    ['sectionE.annualTargetsNextYear', {}],
    ['sectionF.terminations', { reason: 'resignation' }],
    ['sectionF.barriers', {}],
    ['sectionG.skillsDevelopment', { wspSubmitted: true }],
    ['sectionH.accommodationRequests', { pending: 0 }],
    ['sectionH.accessibilityAssessment', { lastAssessmentDate: '2026-05-01' }],
  ] as const

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${seed.tenantId}, true)`
    for (const [fieldPath, newValue] of fields) {
      await tx.eeaEvent.create({
        data: {
          id: randomUUID(),
          tenantId: seed.tenantId,
          formType: 'EEA2',
          formId,
          eventType: 'FIELD_UPDATED',
          fieldPath,
          prevValue: Prisma.DbNull,
          newValue,
          metadata: { userId, source: 'eea2-e2e' },
        },
      })
    }
  })
}

async function clickNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Next' }).click()
}

async function expectActiveStep(page: Page, label: string): Promise<void> {
  await expect(page.getByText(label, { exact: true })).toBeVisible()
}

async function fillCurrentMatrix(page: Page, values: number[]): Promise<void> {
  const matrix = page.getByTestId('occupational-matrix').last()
  const inputs = matrix.locator('input[type="number"]')
  for (const [index, value] of values.entries()) {
    await inputs.nth(index).fill(String(value))
  }
}

export async function completeEea2Wizard(
  page: Page,
  setup: TestSetup,
): Promise<CompletedEea2Wizard> {
  const { seed } = setup
  const browserToken = useBrowserToken(setup)
  await installEea2ApiRoutes(page, browserToken.currentToken)
  await prepareCeoForSigning(seed)

  const formId = await createEea2Draft(seed)
  await page.goto(`/eea2/${formId}?tenantId=${seed.tenantId}`)

  await expectActiveStep(page, 'Section A - Employer details')
  await expect(page.getByLabel('Registration number')).toHaveAttribute('readonly')
  await expect(page.getByLabel('Registration number')).not.toHaveValue('')
  await page.getByLabel('Primary contact name').fill('EE Manager')
  await page.getByLabel('Primary contact email').fill('ee.manager@test.local')
  await clickNext(page)

  await expectActiveStep(page, 'Section B - Workforce totals')
  await page.getByLabel('Permanent male').fill('8')
  await page.getByLabel('Permanent female').fill('7')
  await page.getByLabel('Non-Permanent male').fill('1')
  await page.getByLabel('Non-Permanent female').fill('1')
  await page.getByLabel('Contract workers male').fill('1')
  await page.getByLabel('Contract workers female').fill('0')
  await expect(page.getByLabel('Permanent total')).toHaveValue('15')
  await expect(page.getByLabel('Grand total')).toHaveValue('18')
  await clickNext(page)

  await expectActiveStep(page, 'Section C - Current workforce')
  await fillCurrentMatrix(page, [3, 3, 2, 2, 2, 2, 1, 1, 1, 1])
  await expect(page.getByTestId('disability-flag-banner')).not.toBeAttached()
  await clickNext(page)

  await expectActiveStep(page, 'Section C - Numerical goals')
  await expect(page.getByTestId('occupational-matrix')).toBeVisible()
  await clickNext(page)

  await expectActiveStep(page, 'Section D - Trained employees')
  await fillCurrentMatrix(page, [1, 1, 1, 1, 1])
  await clickNext(page)

  await expectActiveStep(page, 'Section D - Training spend')
  await page.getByLabel('Total training budget (ZAR)').fill('12000')
  await page.getByLabel(/^African:/).fill('20')
  await page.getByLabel(/^Coloured:/).fill('20')
  await page.getByLabel(/^Indian or Asian:/).fill('20')
  await page.getByLabel(/^White:/).fill('20')
  await page.getByLabel(/^Non-designated:/).fill('20')
  await page.getByLabel('Training spend narrative').fill('Training spend allocated evenly.')
  await expect(page.getByText('Total: 100%')).toBeVisible()
  await clickNext(page)

  await expectActiveStep(page, 'Section E - Sector targets')
  await page.getByLabel('No promotions in reporting period').check()
  await clickNext(page)

  await expectActiveStep(page, 'Section E - Next year targets')
  await clickNext(page)

  await expectActiveStep(page, 'Section F - Consultation')
  for (const select of await page.locator('select[aria-label$="termination reason"]').all()) {
    await select.selectOption('resignation')
  }
  await expect(page.getByTestId('barrier-termination-banner')).not.toBeAttached()
  await clickNext(page)

  await expectActiveStep(page, 'Section F - Barriers')
  await clickNext(page)

  await expectActiveStep(page, 'Section G - Monitoring')
  await page.getByLabel('WSP submitted to the SETA').check()
  await page.getByLabel('Skills development narrative').fill('WSP submitted and aligned.')
  await clickNext(page)

  await expectActiveStep(page, 'Section H - Declaration')
  await expect(page.getByTestId('accommodation-overdue-banner')).not.toBeAttached()
  await clickNext(page)

  await expectActiveStep(page, 'Section H - Human review')
  await page.getByLabel('Last assessment date').fill('2026-05-01')
  await page.getByLabel('Next scheduled date').fill('2026-11-01')
  await clickNext(page)

  await expectActiveStep(page, 'Review and submit')
  const submitForSigning = page.getByRole('button', { name: 'Submit for CEO signing' })
  await expect(submitForSigning).toBeEnabled()
  const [statusResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/eea2/${formId}/status`) &&
        response.request().method() === 'PATCH',
    ),
    submitForSigning.click(),
  ])
  expect(statusResponse.status()).toBe(200)
  expect(await statusResponse.json()).toMatchObject({ status: 'pending_ceo' })

  browserToken.useToken(seed.ceoToken)
  await page.goto(`/eea2/${formId}/sign`)
  await expect(page.getByRole('heading', { name: 'EEA2 signing ceremony' })).toBeVisible()

  const ceoTotpCode = currentTotp()
  await page.getByLabel('TOTP code').fill(ceoTotpCode)
  await page.getByLabel('Typed name').fill(CEO_NAME)
  await page.getByLabel(/I declare that I am duly authorised/).check()

  const [signResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes(`/eea2/${formId}/sign`) && response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Confirm and Sign' }).click(),
  ])
  expect(signResponse.status()).toBe(200)
  expect(await signResponse.json()).toEqual({ status: 'signed' })
  await expect(page).toHaveURL(new RegExp(`/eea2/${formId}\\?locked=1$`))

  for (const label of STEP_LABELS) {
    await page.getByRole('button', { name: label }).click()
    await expect(page.locator('input, textarea, select')).toHaveCount(0)
  }

  return { formId, ceoTotpCode, ceoName: CEO_NAME }
}
