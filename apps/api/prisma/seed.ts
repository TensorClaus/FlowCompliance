import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'],
})
const prisma = new PrismaClient({ adapter })

// Fixed UUIDs so seeds are idempotent across re-runs
const ACME_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const THANDI_USER_ID = '00000000-0000-0000-0000-000000000011'
const CEO_USER_ID = '00000000-0000-0000-0000-000000000012'

async function main() {
  // ── Tenant ─────────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { id: ACME_TENANT_ID },
    update: {},
    create: {
      id: ACME_TENANT_ID,
      name: 'Acme (Pty) Ltd',
      kmsKeyId: 'local-dev-placeholder',
    },
  })
  console.log(`✔ Tenant: ${tenant.name} (${tenant.id})`)

  // ── Users ──────────────────────────────────────────────────────────────────
  const thandi = await prisma.user.upsert({
    where: { id: THANDI_USER_ID },
    update: {},
    create: {
      id: THANDI_USER_ID,
      tenantId: ACME_TENANT_ID,
      email: 'thandi@acme.co.za',
      role: 'EE_MANAGER',
    },
  })
  console.log(`✔ User: ${thandi.email} (${thandi.role})`)

  const ceo = await prisma.user.upsert({
    where: { id: CEO_USER_ID },
    update: {},
    create: {
      id: CEO_USER_ID,
      tenantId: ACME_TENANT_ID,
      email: 'ceo@acme.co.za',
      role: 'CEO',
    },
  })
  console.log(`✔ User: ${ceo.email} (${ceo.role})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
