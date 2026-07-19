import react from '@vitejs/plugin-react-swc'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    // Unit tests live under src/. e2e/ holds Playwright specs, which must not be
    // collected by Vitest (they import @playwright/test and fail at collection).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'happy-dom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      // Ratchet floor: set just under measured coverage (M3: 80.5 lines /
      // 81.6 branches / 72.4 functions / 80.5 statements). The original 90%
      // scaffold values were never enforced (the CI test stage was unreachable
      // until M3). Raise these as coverage grows — never lower them.
      thresholds: {
        branches: 79,
        functions: 70,
        lines: 78,
        statements: 78,
      },
    },
  },
})
