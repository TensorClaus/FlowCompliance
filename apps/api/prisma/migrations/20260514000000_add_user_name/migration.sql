ALTER TABLE "users" ADD COLUMN "name" TEXT;

CREATE TABLE "notifications" (
    "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"  UUID        NOT NULL,
    "userId"    UUID        NOT NULL,
    "role"      "UserRole"  NOT NULL,
    "message"   TEXT        NOT NULL,
    "read"      BOOLEAN     NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_tenantId_userId_idx" ON "notifications"("tenantId", "userId");
CREATE INDEX "notifications_tenantId_role_idx" ON "notifications"("tenantId", "role");

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON "notifications" TO simplifi_app;

CREATE POLICY tenant_isolation ON "notifications"
  AS PERMISSIVE FOR ALL
  TO simplifi_app
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);
