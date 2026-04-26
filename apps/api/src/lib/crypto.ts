import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { config } from '../config.js'

/**
 * AES-256-GCM encryption utility for sensitive fields (TOTP secrets, PII).
 *
 * Key source priority:
 *   1. KMS_KEY_ID — in production, this would call AWS KMS to obtain a data
 *      encryption key. Currently mocked: the KMS_KEY_ID string is hashed to
 *      derive a 256-bit key locally. Replace the `resolveKey` function with
 *      a real KMS Decrypt/GenerateDataKey call before production deployment.
 *   2. SESSION_SECRET — fallback for dev/test. A SHA-256 hash of the secret
 *      produces a deterministic 256-bit key.
 *
 * Ciphertext format (base64-encoded):
 *   [12-byte IV] [ciphertext] [16-byte auth tag]
 *
 * SECURITY: The plaintext value is never logged, stored in error messages,
 * or returned in API responses after initial generation.
 */

const ALGORITHM = 'aes-256-gcm' as const
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

/**
 * Derive a 256-bit encryption key from the configured secret material.
 *
 * In production, replace this with an actual KMS GenerateDataKey or
 * Decrypt call that returns a plaintext data key.
 */
function resolveKey(): Buffer {
  const source = config.KMS_KEY_ID ?? config.SESSION_SECRET
  return createHash('sha256').update(source).digest()
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 *
 * @returns Base64-encoded ciphertext in the format: IV + ciphertext + authTag
 */
export function encrypt(plaintext: string): string {
  const key = resolveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Pack as: IV (12) || ciphertext (variable) || authTag (16)
  const packed = Buffer.concat([iv, encrypted, authTag])
  return packed.toString('base64')
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext.
 *
 * @returns The original plaintext string.
 * @throws If the ciphertext is tampered with or the key is wrong.
 */
export function decrypt(ciphertextBase64: string): string {
  const key = resolveKey()
  const packed = Buffer.from(ciphertextBase64, 'base64')

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext: too short')
  }

  const iv = packed.subarray(0, IV_LENGTH)
  const authTag = packed.subarray(packed.length - AUTH_TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH, packed.length - AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
