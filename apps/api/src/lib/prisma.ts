import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { applyKmsEncryptionExtension } from '../prisma/middleware/kms-encrypt.js'

// Singleton pattern: reuse the client across hot-reloads in dev (tsx watch).
// In production a single instance is created once and never replaced.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  })
  // POPIA s.19 — every Prisma client constructed in this process is wrapped
  // with the KMS encryption extension so create/update/upsert writes against
  // Eea1Declaration cannot bypass PII encryption.
  return applyKmsEncryptionExtension(new PrismaClient({ adapter }))
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient()

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma
}
