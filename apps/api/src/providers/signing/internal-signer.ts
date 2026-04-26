/**
 * InternalSigner — concrete SigningProvider using OTP confirmation + SHA-256
 * hash chain for tamper-evident signing records.
 *
 * Storage: in-memory Maps for this phase. Production persistence requires a
 * dedicated database table (see SCHEMA-NEEDED comment below).
 */

// SCHEMA-NEEDED: Production signing records table
// CREATE TABLE signing_records (
//   record_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
//   tenant_id   UUID        NOT NULL REFERENCES tenants(id),
//   signer_sub  UUID        NOT NULL,
//   signer_name TEXT        NOT NULL,
//   form_ref    TEXT        NOT NULL,
//   timestamp   TIMESTAMPTZ NOT NULL,
//   prev_hash   TEXT        NOT NULL,
//   hash        TEXT        NOT NULL,
//   created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
//   CONSTRAINT signing_records_hash_unique UNIQUE (tenant_id, hash)
// );
// CREATE INDEX idx_signing_records_tenant ON signing_records (tenant_id, created_at);
// -- RLS policy: tenant_id = current_setting('app.current_tenant_id')::uuid

import { createHash, randomInt, randomUUID } from 'node:crypto'
import type { SignRecord, SigningProvider } from './signing-provider.js'

/** OTP time-to-live in milliseconds (10 minutes). */
const OTP_TTL_MS = 10 * 60 * 1000

interface OtpEntry {
  otp: string
  expiresAt: number
}

export class InternalSigner implements SigningProvider {
  /**
   * In-memory OTP store keyed by `"${tenantId}:${signerSub}"`.
   * A second generateOtp call for the same key overwrites the previous entry.
   */
  private readonly otpStore = new Map<string, OtpEntry>()

  /**
   * In-memory hash chain store keyed by tenantId.
   * Each tenant maintains an independent append-only chain.
   */
  private readonly chainStore = new Map<string, SignRecord[]>()

  generateOtp(tenantId: string, signerSub: string): Promise<string> {
    // Generate a cryptographically random 6-digit numeric OTP.
    // randomInt(100_000, 1_000_000) gives a value in [100000, 999999].
    const otp = String(randomInt(100_000, 1_000_000))
    const key = `${tenantId}:${signerSub}`

    this.otpStore.set(key, {
      otp,
      expiresAt: Date.now() + OTP_TTL_MS,
    })

    return Promise.resolve(otp)
  }

  sign(params: {
    tenantId: string
    signerSub: string
    signerName: string
    formRef: string
    otp: string
  }): Promise<SignRecord> {
    const { tenantId, signerSub, signerName, formRef, otp } = params
    const key = `${tenantId}:${signerSub}`

    // Validate OTP
    const entry = this.otpStore.get(key)
    if (entry === undefined || entry.otp !== otp || Date.now() > entry.expiresAt) {
      return Promise.reject(new Error('Invalid or expired OTP'))
    }

    // Consume OTP (single-use)
    this.otpStore.delete(key)

    // Build the new record
    const chain = this.chainStore.get(tenantId) ?? []
    const lastRecord = chain.length > 0 ? chain.at(-1) : undefined
    const prevHash = lastRecord === undefined ? 'genesis' : lastRecord.hash

    const recordId = randomUUID()
    const timestamp = new Date().toISOString()

    const canonical = `${prevHash}|${recordId}|${tenantId}|${signerSub}|${signerName}|${formRef}|${timestamp}`
    const hash = createHash('sha256').update(canonical).digest('hex')

    const record: SignRecord = {
      recordId,
      tenantId,
      signerSub,
      signerName,
      formRef,
      timestamp,
      prevHash,
      hash,
    }

    chain.push(record)
    this.chainStore.set(tenantId, chain)

    return Promise.resolve(record)
  }

  verifyChain(tenantId: string): Promise<boolean> {
    const chain = this.chainStore.get(tenantId) ?? []

    // Empty chain is vacuously valid
    if (chain.length === 0) return Promise.resolve(true)

    for (let i = 0; i < chain.length; i++) {
      const record = chain[i] as SignRecord
      const expectedPrevHash = i === 0 ? 'genesis' : (chain[i - 1] as SignRecord).hash

      // Verify the prevHash link
      if (record.prevHash !== expectedPrevHash) return Promise.resolve(false)

      // Recompute and verify the hash
      const canonical = `${record.prevHash}|${record.recordId}|${record.tenantId}|${record.signerSub}|${record.signerName}|${record.formRef}|${record.timestamp}`
      const expectedHash = createHash('sha256').update(canonical).digest('hex')

      if (record.hash !== expectedHash) return Promise.resolve(false)
    }

    return Promise.resolve(true)
  }

  getChain(tenantId: string): Promise<SignRecord[]> {
    return Promise.resolve([...(this.chainStore.get(tenantId) ?? [])])
  }
}
