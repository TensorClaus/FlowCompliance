-- Migration: 20260330000009_eea_events_not_null
-- Enforces TRD §2.5 NOT NULL requirements on formType, formId, and eventType
-- columns of the eea_events table.
--
-- Backfill rationale:
--   The UPDATE statements below are a safety net for dev/test environments.
--   Production eea_events rows should not have nulls if the application was
--   functioning correctly prior to this migration.
--
-- formId sentinel:
--   Null formId values are backfilled with the nil UUID
--   (00000000-0000-0000-0000-000000000000). Any rows carrying this value after
--   the migration has run should be investigated and corrected — the nil UUID
--   is a sentinel, not a valid foreign-key reference.

-- Backfill nulls before constraining
UPDATE "eea_events" SET "formType"  = ''                                     WHERE "formType"  IS NULL;
UPDATE "eea_events" SET "eventType" = ''                                     WHERE "eventType" IS NULL;
UPDATE "eea_events" SET "formId"    = '00000000-0000-0000-0000-000000000000' WHERE "formId"    IS NULL;

-- Apply NOT NULL constraints
ALTER TABLE "eea_events" ALTER COLUMN "formType"  SET NOT NULL;
ALTER TABLE "eea_events" ALTER COLUMN "eventType" SET NOT NULL;
ALTER TABLE "eea_events" ALTER COLUMN "formId"    SET NOT NULL;
