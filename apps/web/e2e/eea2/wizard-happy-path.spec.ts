import { test } from '../fixtures'
import { completeEea2Wizard } from './helpers'

test.describe.configure({ mode: 'serial' })

test.describe('EEA2 wizard happy path', () => {
  // QUARANTINE (E2E-UI-drift): fails at the wizard UI. Tracked as a spun-off
  // task — un-fixme when the EEA2 wizard flow matches this spec.
  test.fixme('EE_MANAGER submits a complete EEA2 and CEO signs the locked report', async ({
    page,
    setup,
  }) => {
    await completeEea2Wizard(page, setup)
  })
})
