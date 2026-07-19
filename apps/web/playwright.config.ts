import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  // Retry in CI only: several specs drive autosave/debounce timing and network
  // mocks that flake under load (e.g. eea2/autosave-recovery). A pass-on-retry
  // is reported as "flaky" (visible), not hidden. Locally, no retries.
  retries: process.env['CI'] === undefined ? 0 : 2,
  reporter: [['html'], ['github']],
  use: { baseURL: process.env['VITE_APP_URL'] ?? 'http://localhost:5173' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  globalSetup: './e2e/global-setup.ts',
})
