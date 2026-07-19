-- ─── Restore M-005: index on eea1_declarations.tenantId ──────────────────────
--
-- Migration 20260514162526_add_user_name dropped "eea1_declarations_tenantId_idx"
-- (a Prisma-generated side effect of an unrelated schema change) and nothing
-- recreated it. Every RLS policy filters by tenantId, so without this index
-- tenant-scoped reads seq-scan as the declaration table grows. This restores the
-- original M-005 remediation index (20260330000008_eea1_tenant_index).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "eea1_declarations_tenantId_idx"
  ON "eea1_declarations" ("tenantId");
