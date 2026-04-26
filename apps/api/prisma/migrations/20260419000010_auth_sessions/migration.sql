-- Auth session support for Simplifi
-- Adds password hashing, updated timestamps, and tenant-scoped refresh sessions.

ALTER TABLE "users"
  ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE "users"
  ALTER COLUMN "role" SET DEFAULT 'EE_MANAGER';

CREATE INDEX IF NOT EXISTS "users_tenantId_idx"
  ON "users" ("tenantId");

CREATE INDEX IF NOT EXISTS "users_email_idx"
  ON "users" ("email");

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" UUID NOT NULL,
  "refreshTokenJti" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sessions_refreshTokenJti_key"
  ON "sessions" ("refreshTokenJti");

CREATE INDEX "sessions_tenantId_idx"
  ON "sessions" ("tenantId");

CREATE INDEX "sessions_userId_idx"
  ON "sessions" ("userId");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "sessions" TO simplifi_app;

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "sessions"
  AS PERMISSIVE FOR ALL
  TO simplifi_app
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);
