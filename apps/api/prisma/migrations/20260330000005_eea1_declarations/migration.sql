-- CreateTable
-- Column-level encryption (gender, race, disability, disabilityNature, signatureDataUrl)
-- is enforced at the application layer via Prisma middleware, not Postgres native.
-- Encrypted columns are stored as ciphertext TEXT — Postgres treats them as opaque strings.
CREATE TABLE "eea1_declarations" (
    "id"                      UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"                UUID        NOT NULL,
    "employeeId"              TEXT        NOT NULL,
    "name"                    TEXT        NOT NULL,
    "workplaceNumber"         TEXT        NOT NULL,
    "gender"                  TEXT,
    "race"                    TEXT,
    "disability"              TEXT,
    "foreignNational"         BOOLEAN     NOT NULL,
    "citizenshipDate"         DATE,
    "disabilityNature"        TEXT,
    "reasonableAccommodation" BOOLEAN,
    "signatureDataUrl"        TEXT        NOT NULL,
    "declarationDate"         DATE        NOT NULL,
    "createdAt"               TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "eea1_declarations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "eea1_declarations"
    ADD CONSTRAINT "eea1_declarations_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
