import 'dotenv/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration suites build the full app + hit the service DB in their
    // beforeAll hooks; cold CI runners need more than the 10s default.
    hookTimeout: 30_000,
    // The suites share one database and several truncate tables in cleanup;
    // parallel files corrupt each other's fixtures (FK violations on tenants).
    fileParallelism: false,
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
      // Ratchet floor: set just under measured coverage from the first-ever
      // full CI execution of these suites (global 74.4 lines / 77.6 branches;
      // providers 87.9 branches; event-store 89.0 lines / 66.7 branches).
      // The original scaffold values were never enforced. Raise these as
      // coverage grows — never lower them.
      thresholds: {
        branches: 75,
        functions: 80,
        lines: 72,
        statements: 72,
        'src/providers/**': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/event-store/**': {
          branches: 65,
          functions: 90,
          lines: 87,
          statements: 87,
        },
      },
    },
  },
})
