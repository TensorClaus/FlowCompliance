-- CreateTable
CREATE TABLE "eea2_drafts" (
    "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"      UUID        NOT NULL,
    "reportingYear" INT         NOT NULL,
    "state"         JSONB       NOT NULL,
    "status"        TEXT        NOT NULL DEFAULT 'draft',
    "lastEventId"   UUID,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ NOT NULL,

    CONSTRAINT "eea2_drafts_pkey" PRIMARY KEY ("id")
);

-- Unique: one draft per tenant per reporting year
CREATE UNIQUE INDEX "eea2_drafts_tenantId_reportingYear_key"
    ON "eea2_drafts"("tenantId", "reportingYear");

-- AddForeignKey: tenant scope
ALTER TABLE "eea2_drafts"
    ADD CONSTRAINT "eea2_drafts_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: lastEventId is the replay watermark — null until first event recorded
ALTER TABLE "eea2_drafts"
    ADD CONSTRAINT "eea2_drafts_lastEventId_fkey"
    FOREIGN KEY ("lastEventId") REFERENCES "eea_events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
