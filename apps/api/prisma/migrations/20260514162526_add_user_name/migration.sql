-- DropIndex
DROP INDEX "eea1_declarations_tenantId_idx";

-- AlterTable
ALTER TABLE "eea_events" ALTER COLUMN "formType" DROP NOT NULL,
ALTER COLUMN "formId" DROP NOT NULL,
ALTER COLUMN "eventType" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revokedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT;
