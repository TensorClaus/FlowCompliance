/**
 * SigningProvider — abstract interface for cryptographic document signing.
 *
 * Implementations must maintain an append-only hash chain of SignRecords
 * per tenant, ensuring tamper-evident auditability of all signing events.
 */

export interface SignRecord {
  /** UUID — unique per signing event */
  recordId: string
  /** Tenant UUID */
  tenantId: string
  /** JWT sub (user UUID) */
  signerSub: string
  /** Typed full legal name confirmed by signer */
  signerName: string
  /** Form reference, e.g. "eea2:2024:draft_abc123" */
  formRef: string
  /** ISO 8601 timestamp of signing */
  timestamp: string
  /** SHA-256 of previous record ("genesis" for first) */
  prevHash: string
  /** SHA-256 of this record's canonical fields */
  hash: string
}

export interface SigningProvider {
  /**
   * Initiates a signing ceremony: generates a one-time OTP, stores it
   * internally against (tenantId, signerSub), and returns it for delivery
   * (e.g. via email/SMS — delivery is out of scope; return the OTP).
   */
  generateOtp(tenantId: string, signerSub: string): Promise<string>

  /**
   * Confirms OTP, creates a SignRecord appended to the tenant's hash chain,
   * and returns the completed record. Throws if OTP is invalid/expired.
   * `signerName` is the typed name the signer confirmed on the declaration.
   */
  sign(params: {
    tenantId: string
    signerSub: string
    signerName: string
    formRef: string
    otp: string
  }): Promise<SignRecord>

  /**
   * Verifies the full hash chain for a tenant. Returns true only if every
   * record's hash is consistent with its fields and links correctly to
   * the previous record. Returns false (never throws) on any inconsistency.
   */
  verifyChain(tenantId: string): Promise<boolean>

  /**
   * Returns all SignRecords for a tenant in chain order (oldest first).
   */
  getChain(tenantId: string): Promise<SignRecord[]>
}
