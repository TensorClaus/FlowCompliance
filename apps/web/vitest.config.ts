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
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
})
