-- ─── Persist TOTP backup codes ───────────────────────────────────────────────
--
-- Backup codes were previously generated and returned once but never stored, so
-- a user who lost their authenticator device was permanently locked out (no
-- redemption path). This column stores the HMAC-SHA256 hash of each single-use
-- code; a matched code is removed from the array on redemption. Plaintext codes
-- are never persisted.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN "totpBackupCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
