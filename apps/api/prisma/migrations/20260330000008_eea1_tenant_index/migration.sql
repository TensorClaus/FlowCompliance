-- ─── M-005: Index on eea1_declarations.tenantId ──────────────────────────────
--
-- Every RLS policy filters by tenantId. Without an index, each query requires a
-- sequential scan as the table grows with employee declarations over time.
-- This index is used by all tenant-scoped reads on this table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "eea1_declarations_tenantId_idx"
  ON "eea1_declarations" ("tenantId");
