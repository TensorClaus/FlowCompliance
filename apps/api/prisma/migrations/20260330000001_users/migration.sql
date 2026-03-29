-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EE_MANAGER', 'HR_DIRECTOR', 'CFO', 'SENIOR_MANAGER', 'CEO', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"   UUID        NOT NULL,
    "email"      TEXT        NOT NULL,
    "role"       "UserRole"  NOT NULL,
    "totpSecret" TEXT,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "users"
    ADD CONSTRAINT "users_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
