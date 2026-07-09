import 'dotenv/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/simplifi_test',
      REDIS_URL: 'redis://localhost:6379',
      SESSION_SECRET: process.env.SESSION_SECRET ?? '',
      NODE_ENV: 'test',
    },
    coverage: {
      // istanbul, matching packages/shared and apps/web: the v8 provider
      // emits synthetic unreachable line-1 branches per module, distorting
      // branch coverage.
      provider: 'istanbul',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
        'src/providers/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/event-store/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
})
