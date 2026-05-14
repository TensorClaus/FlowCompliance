/**
 * Test helpers for EEA integration tests.
 *
 * createTestTenant   — inserts a tenant row and returns its id.
 * getTestJwt         — issues a signed JWT bound to a tenant + role.
 * seedEvents         — inserts N minimal eea_events rows for a tenant/form pair.
 *
 * All helpers operate against the live test DB via the shared prisma client.
 * Callers are responsible for truncating tables in afterEach.
 *
 * POSTGRES_URL_TEST must be set in the environment (separate schema, never prod).
 * The vitest.config.ts for apps/api already sets DATABASE_URL for the test env;
 * these helpers reuse that same prisma instance.
 */

import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../lib/prisma.js'

// SESSION_SECRET must match the value loaded by config/env.ts during tests.
// vitest.config.ts injects it from process.env; fall back to empty string so
// the module loads — tests that need real JWT verification will fail loudly if
// the secret is missing, which is the correct behaviour.
const SESSION_SECRET = process.env['SESSION_SECRET'] ?? ''

export type TestRole = 'EE_MANAGER' | 'HR_DIRECTOR' | 'ADMIN' | 'CEO' | 'SENIOR_MANAGER' | 'CFO'

/**
 * Creates a tenant row in the test database and returns its generated id.
 *
 * Uses a random UUID so every test run is fully isolated.
 */
export async function createTestTenant(name = 'Integration Test Tenant'): Promise<string> {
  const id = randomUUID()
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${id}, true)`
    await tx.tenant.create({
      data: {
        id,
        name,
        kmsKeyId: 'local-dev-placeholder',
      },
    })
  })
  return id
}

/**
 * Issues a signed HS256 JWT matching the payload shape expected by
 * tenant-context and requireAuth plugins.
 *
 * totpVerified defaults to true so non-signing-role callers skip the TOTP
 * gate without extra configuration.
 */
export function getTestJwt(
  tenantId: string,
  role: TestRole = 'EE_MANAGER',
  totpVerified = true,
): string {
  return jwt.sign(
    {
      sub: randomUUID(),
      tenantId,
      email: 'test@simplifi.co.za',
      role,
      totpVerified,
      tokenType: 'access',
      jti: randomUUID(),
    },
    SESSION_SECRET,
    { expiresIn: 900 },
  )
}

interface SeededEvent {
  id: string
  tenantId: string
  formId: string
  fieldPath: string
  createdAt: Date
}

/**
 * Seeds `count` FIELD_UPDATED events for the given tenant/form pair.
 *
 * Returns the array of created event rows sorted by createdAt ascending.
 * Each event writes to a distinct field path (field.0, field.1, …) and
 * stores a plain string as newValue so replay assertions are predictable.
 */
export async function seedEvents(
  tenantId: string,
  formId: string,
  count: number,
): Promise<SeededEvent[]> {
  const seeded: SeededEvent[] = []

  for (let i = 0; i < count; i += 1) {
    const id = randomUUID()
    const fieldPath = `sectionA.field${i.toString()}`
    const createdAt = new Date(Date.now() + i * 1000)

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`
      await tx.eeaEvent.create({
        data: {
          id,
          tenantId,
          formId,
          formType: 'EEA2',
          eventType: 'FIELD_UPDATED',
          fieldPath,
          prevValue: Prisma.DbNull,
          newValue: `value-${i.toString()}`,
          metadata: {
            triggeredBy: 'test-user',
            ip: '127.0.0.1',
            userAgent: 'vitest',
            sessionId: 'test-session',
          },
          createdAt,
        },
      })
    })

    seeded.push({ id, tenantId, formId, fieldPath, createdAt })
  }

  return seeded.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
}
