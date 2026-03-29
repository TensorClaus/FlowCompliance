-- CreateTable
CREATE TABLE "eea_events" (
    "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"  UUID        NOT NULL,
    "formType"  TEXT,
    "formId"    UUID,
    "eventType" TEXT,
    "fieldPath" TEXT,
    "prevValue" JSONB,
    "newValue"  JSONB,
    "metadata"  JSONB       NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "eea_events_pkey" PRIMARY KEY ("id")
);

-- Composite index for replay queries: filter by tenant+form, ordered by time
CREATE INDEX "eea_events_tenantId_formId_createdAt_idx"
    ON "eea_events"("tenantId", "formId", "createdAt");

-- AddForeignKey
ALTER TABLE "eea_events"
    ADD CONSTRAINT "eea_events_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutability: Postgres rules prevent any UPDATE or DELETE on this table.
-- The event store is append-only by architectural contract (TRD §event-sourcing).
CREATE RULE no_update_events AS ON UPDATE TO eea_events DO INSTEAD NOTHING;
CREATE RULE no_delete_events AS ON DELETE TO eea_events DO INSTEAD NOTHING;
