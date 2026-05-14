import { test } from '../fixtures'
import { completeEea2Wizard } from './helpers'

test.describe.configure({ mode: 'serial' })

test.describe('EEA2 wizard happy path', () => {
  test('EE_MANAGER submits a complete EEA2 and CEO signs the locked report', async ({
    page,
    setup,
  }) => {
    await completeEea2Wizard(page, setup)
  })
})
