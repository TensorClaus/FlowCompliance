-- ─── C-003: FORCE ROW LEVEL SECURITY ────────────────────────────────────────
--
-- Problem: Tables currently have ENABLE ROW LEVEL SECURITY but not
-- FORCE ROW LEVEL SECURITY. Without FORCE, the table owner role
-- bypasses ALL RLS policies silently — every query running as the
-- owner sees all rows across all tenants regardless of policies.
--
-- FORCE ROW LEVEL SECURITY makes RLS apply even to the table owner,
-- closing this privilege-escalation gap.
--
-- Note: simplifi_app is the non-owner application role used by the
-- API process. It is already subject to RLS policies. FORCE RLS adds
-- defence-in-depth so that even if a query were to execute as the
-- table owner (e.g. via a misconfigured connection or superuser
-- fallback), tenant isolation is still enforced.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "tenants"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "users"             FORCE ROW LEVEL SECURITY;
ALTER TABLE "employer_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "eea_events"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "eea2_drafts"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "eea1_declarations" FORCE ROW LEVEL SECURITY;
