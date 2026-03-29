-- CreateTable
CREATE TABLE "tenants" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "name"       TEXT        NOT NULL,
    "kmsKeyId"   TEXT        NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
