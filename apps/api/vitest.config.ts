import 'dotenv/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration suites build the full app + hit the service DB in their
    // beforeAll hooks; cold CI runners need more than the 10s default.
    hookTimeout: 30_000,
    env: {
      // CI provides its own service credentials; the literals are local-dev defaults.
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/simplifi_test',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      SESSION_SECRET: process.env.SESSION_SECRET ?? '',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
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
