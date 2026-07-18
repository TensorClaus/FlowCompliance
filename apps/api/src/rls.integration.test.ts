/**
 * RLS Integration Test — requires a live PostgreSQL instance with migrations applied.
 *
 * Run with:
 *   DATABASE_URL=<url> RLS_INTEGRATION=true pnpm --filter @simplifi/api test
 *
 * Skipped automatically in CI (stub DATABASE_URL has no live DB).
 */
import { PrismaPg } from '@prisma/adapter-pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from './generated/prisma/client.js'

const RLS_INTEGRATION = process.env['RLS_INTEGRATION'] === 'true'

describe.skipIf(!RLS_INTEGRATION)('RLS cross-tenant isolation', () => {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  })
  const prisma = new PrismaClient({ adapter })

  const TENANT_A_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
  const TENANT_B_ID = 'bbbbbbbb-0000-0000-0000-000000000001'

  beforeAll(async () => {
    // Seed two isolated tenants (bypasses RLS — superuser connection)
    await prisma.$executeRaw`
      INSERT INTO tenants (id, name, "kmsKeyId")
      VALUES
        (${TENANT_A_ID}::uuid, 'Tenant A', 'local-dev-placeholder'),
        (${TENANT_B_ID}::uuid, 'Tenant B', 'local-dev-placeholder')
      ON CONFLICT (id) DO NOTHING
    `

    // Insert an eea_event owned by Tenant A
    await prisma.$executeRaw`
      INSERT INTO eea_events (id, "tenantId", "formType", "metadata")
      VALUES (
        gen_random_uuid(),
        ${TENANT_A_ID}::uuid,
        'EEA2',
        '{"source":"rls-integration-test"}'::jsonb
      )
    `
  })

  afterAll(async () => {
    // Clean up test data (raw SQL bypasses RLS)
    await prisma.$executeRaw`DELETE FROM eea_events WHERE metadata->>'source' = 'rls-integration-test'`
    await prisma.$executeRaw`DELETE FROM tenants WHERE id IN (${TENANT_A_ID}::uuid, ${TENANT_B_ID}::uuid)`
    await prisma.$disconnect()
  })

  it('Tenant A can see its own eea_events', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${TENANT_A_ID}, true)`
      return tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM eea_events
      `
    })
    expect(Number(rows[0]?.count)).toBeGreaterThan(0)
  })

  it('Tenant B cannot see Tenant A eea_events (RLS blocks cross-tenant reads)', async () => {
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${TENANT_B_ID}, true)`
      return tx.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM eea_events
      `
    })
    // RLS policy filters to zero rows — no error, no data leakage
    expect(Number(rows[0]?.count)).toBe(0)
  })

  it('Unscoped connection (no tenant_id set) sees zero rows', async () => {
    // current_setting('app.tenant_id', true) returns NULL when unset,
    // so tenantId = NULL::uuid never matches any row
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM eea_events
    `
    expect(Number(rows[0]?.count)).toBe(0)
  })
})
