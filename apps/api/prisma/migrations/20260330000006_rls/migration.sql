-- ─── Postgres role ───────────────────────────────────────────────────────────
-- simplifi_app is the application role used by the API process.
-- NOINHERIT: does not automatically acquire privileges of roles it is a member of.
-- No superuser, no createdb, no createrole.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'simplifi_app') THEN
    CREATE ROLE simplifi_app NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE current_database() TO simplifi_app;
GRANT USAGE ON SCHEMA public TO simplifi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO simplifi_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO simplifi_app;

-- ─── Enable RLS on all tenant-scoped tables ───────────────────────────────────
ALTER TABLE "tenants"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employer_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eea_events"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eea2_drafts"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "eea1_declarations" ENABLE ROW LEVEL SECURITY;

-- ─── RLS policies ────────────────────────────────────────────────────────────
-- current_setting('app.tenant_id', true) — the second arg suppresses error if
-- the GUC is not set (returns NULL), so unscoped connections see zero rows.

-- tenants: a tenant may only see its own row
CREATE POLICY tenant_isolation ON "tenants"
  AS PERMISSIVE FOR ALL
  TO simplifi_app
  USING (id = current_setting('app.tenant_id', true)::uuid);

-- users
CREATE POLICY tenant_isolation ON "users"
  AS PERMISSIVE FOR ALL
  TO simplifi_app
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

-- employer_profiles
CREATE POLICY tenant_isolation ON "employer_profiles"
  AS PERMISSIVE FOR ALL
  TO simplifi_app
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

-- eea_events (append-only; update/delete already blocked by Postgres rules)
CREATE POLICY tenant_isolation ON "eea_events"
  AS PERMISSIVE FOR ALL
  TO simplifi_app
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

-- eea2_drafts
CREATE POLICY tenant_isolation ON "eea2_drafts"
  AS PERMISSIVE FOR ALL
  TO simplifi_app
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);

-- eea1_declarations
CREATE POLICY tenant_isolation ON "eea1_declarations"
  AS PERMISSIVE FOR ALL
  TO simplifi_app
  USING ("tenantId" = current_setting('app.tenant_id', true)::uuid);
