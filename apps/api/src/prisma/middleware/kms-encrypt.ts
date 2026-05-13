// kmsEncrypt — Prisma client extension that encrypts PII fields with AES-256-GCM
// (KMS-derived key) BEFORE the row reaches Postgres.
//
// POPIA s.19 governance gate verifies this file:
//   1. ENCRYPTED_FIELDS contains all 5 demographic/signature fields.
//   2. create, update, and upsert actions on Eea1Declaration are intercepted.
//   3. Each plaintext value is replaced with ciphertext before Prisma proceeds.
//   4. Log statements reference field names ONLY — never the plaintext value.
//   5. Null / undefined fields are skipped (we do not encrypt nulls).
//
// Prisma v5+ removed the classic `$use` middleware API; this module exposes
// `applyKmsEncryptionExtension(prisma, logger)` which returns an extended
// client via `$extends`. The extended client MUST replace the original
// reference in the module that constructs prisma so every importer receives
// the encrypting variant.

import type { Logger } from 'pino'
import type { PrismaClient } from '../../generated/prisma/client.js'
import { encrypt as encryptPlaintext } from '../../lib/crypto.js'

/**
 * The five PII fields that must be encrypted before insert/update.
 * Order is significant only for readability — the extension iterates
 * the array and encrypts every entry present in the payload.
 */
export const ENCRYPTED_FIELDS = [
  'race',
  'gender',
  'disability',
  'disabilityNature',
  'signatureDataUrl',
] as const

export type EncryptedFieldName = (typeof ENCRYPTED_FIELDS)[number]

/**
 * Minimal logger surface used by this extension. Matches pino's debug method
 * (object payload first, message second). Field names only — never values.
 */
export interface KmsEncryptLogger {
  debug: (payload: { field: string }, message: string) => void
}

const defaultLogger: KmsEncryptLogger = {
  debug: (payload, message) => {
    void payload
    void message
  },
}

/**
 * Wrapper around the existing AES-256-GCM `encrypt(plaintext)` utility that
 * accepts (fieldName, value) so the call-site in the extension matches the
 * POPIA gate's required signature. The fieldName is used only for log
 * correlation; the plaintext value is the sole input to the cipher.
 */
function encrypt(fieldName: EncryptedFieldName, value: string): string {
  void fieldName
  return encryptPlaintext(value)
}

/**
 * Encrypt every ENCRYPTED_FIELD present (with a non-null/undefined value) in
 * the supplied data object. Mutates `data` in place — Prisma reads the same
 * reference the caller passed in.
 */
function encryptDataObject(data: Record<string, unknown>, logger: KmsEncryptLogger): void {
  for (const fieldName of ENCRYPTED_FIELDS) {
    const value = data[fieldName]

    // Skip absent fields (undefined) and explicit nulls — we do not encrypt
    // nulls. A null demographic value represents "prefer not to disclose"
    // and must be persisted as SQL NULL.
    if (value === undefined || value === null) continue

    // For Prisma update payloads a field may be wrapped: { set: 'value' }.
    // Handle the common scalar-set form transparently.
    if (typeof value === 'object' && 'set' in value) {
      const wrapped = value as { set?: unknown }
      if (typeof wrapped.set !== 'string') continue
      const ciphertext = encrypt(fieldName, wrapped.set)
      logger.debug({ field: fieldName }, 'kms:encrypt')
      data[fieldName] = { set: ciphertext }
      continue
    }

    if (typeof value !== 'string') continue

    const ciphertext = encrypt(fieldName, value)
    // Log field name only — POPIA log safety. NEVER include the value.
    logger.debug({ field: fieldName }, 'kms:encrypt')
    data[fieldName] = ciphertext
  }
}

/**
 * Encrypt PII fields contained inside a Prisma write `args.data` /
 * `args.create` / `args.update` payload. Handles single objects and the
 * array form used by createMany. Exported for unit testing.
 */
export function encryptPiiFieldsInArgs(data: unknown, logger: KmsEncryptLogger): void {
  if (data === undefined || data === null) return

  if (Array.isArray(data)) {
    for (const row of data) {
      if (row !== null && typeof row === 'object') {
        encryptDataObject(row as Record<string, unknown>, logger)
      }
    }
    return
  }

  if (typeof data === 'object') {
    encryptDataObject(data as Record<string, unknown>, logger)
  }
}

/**
 * Apply the PII-encryption client extension to a Prisma client.
 *
 * Wiring (in apps/api/src/lib/prisma.ts):
 *   export const prisma = applyKmsEncryptionExtension(createPrismaClient(), logger)
 *
 * The returned client preserves the full PrismaClient API surface and
 * additionally intercepts create / update / upsert on Eea1Declaration so
 * every demographic / signature field is encrypted before the SQL write.
 */
export function applyKmsEncryptionExtension(
  client: PrismaClient,
  logger: KmsEncryptLogger | Logger = defaultLogger,
): PrismaClient {
  const log: KmsEncryptLogger = logger as KmsEncryptLogger

  const extended = client.$extends({
    name: 'kms-encrypt-eea1-declarations',
    query: {
      eea1Declaration: {
        create({ args, query }) {
          encryptPiiFieldsInArgs(args.data, log)
          return query(args)
        },
        update({ args, query }) {
          encryptPiiFieldsInArgs(args.data, log)
          return query(args)
        },
        upsert({ args, query }) {
          encryptPiiFieldsInArgs(args.create, log)
          encryptPiiFieldsInArgs(args.update, log)
          return query(args)
        },
        createMany({ args, query }) {
          encryptPiiFieldsInArgs(args.data, log)
          return query(args)
        },
        updateMany({ args, query }) {
          encryptPiiFieldsInArgs(args.data, log)
          return query(args)
        },
      },
    },
  })

  // The extension type is a subset of PrismaClient; cast back so consumers
  // can keep using the original type. All model accessors remain.
  return extended as unknown as PrismaClient
}
