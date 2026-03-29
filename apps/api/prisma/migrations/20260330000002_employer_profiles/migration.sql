-- CreateTable
CREATE TABLE "employer_profiles" (
    "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"           UUID        NOT NULL,
    "reportingYear"      INT         NOT NULL,

    -- Section A — 19 employer detail fields (EEA2 §A, TRD §2.1)
    "registeredName"     TEXT        NOT NULL,
    "tradingName"        TEXT,
    "companyRegNumber"   TEXT,
    "sarsRefNumber"      TEXT,
    "province"           TEXT        NOT NULL,
    "region"             TEXT,
    "localMunicipality"  TEXT,
    "physicalAddress"    TEXT        NOT NULL,
    "city"               TEXT        NOT NULL,
    "postalCode"         TEXT        NOT NULL,
    "postalAddress"      TEXT,
    "telephoneNumber"    TEXT,
    "faxNumber"          TEXT,
    "emailAddress"       TEXT,
    "sectorCode"         TEXT        NOT NULL,
    "totalEmployees"     INT         NOT NULL,
    "contactPersonName"  TEXT        NOT NULL,
    "contactDesignation" TEXT        NOT NULL,
    "contactPersonEmail" TEXT,

    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"          TIMESTAMPTZ NOT NULL,

    CONSTRAINT "employer_profiles_pkey" PRIMARY KEY ("id")
);

-- Unique: one profile per tenant per reporting year (prior-year record stays for pre-fill)
CREATE UNIQUE INDEX "employer_profiles_tenantId_reportingYear_key"
    ON "employer_profiles"("tenantId", "reportingYear");

-- AddForeignKey
ALTER TABLE "employer_profiles"
    ADD CONSTRAINT "employer_profiles_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
