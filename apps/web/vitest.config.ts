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
      // istanbul, matching packages/shared: the v8 provider emits synthetic
      // unreachable line-1 branches per module, distorting branch coverage.
      provider: 'istanbul',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/**/__tests__/**'],
      // 80 aligns web with the shared and api gates (ci.yml enforces
      // per-package thresholds and documents 80). The previous 90 was set
      // while the coverage step was broken and never actually enforced.
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
