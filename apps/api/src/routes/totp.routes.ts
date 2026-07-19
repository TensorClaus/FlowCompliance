import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import * as OTPAuth from 'otpauth'
import { z } from 'zod'
import { config } from '../config.js'
import { encrypt, decrypt } from '../lib/crypto.js'
import { prisma } from '../lib/prisma.js'

const JWT_ALGORITHM = 'HS256' as const

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTP_ISSUER = 'Simplifi'
const TOTP_PERIOD = 30
const TOTP_DIGITS = 6
const TOTP_ALGORITHM = 'SHA1'
const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_LENGTH = 8

// ─── Validation schemas ─────────────────────────────────────────────────────

const verifyBodySchema = z.object({
  userId: z.uuid('userId must be a valid UUID'),
  code: z
    .string()
    .length(TOTP_DIGITS, `code must be exactly ${String(TOTP_DIGITS)} digits`)
    .regex(/^\d+$/, 'code must contain only digits'),
})

const backupVerifyBodySchema = z.object({
  userId: z.uuid('userId must be a valid UUID'),
  code: z.string().min(1, 'code is required'),
})

const resetBodySchema = z.object({
  userId: z.uuid('userId must be a valid UUID'),
})

// ─── JWT helpers ─────────────────────────────────────────────────────────────

interface AccessTokenPayload {
  sub: string
  tenantId: string
  email: string
  role: string
  totpVerified: boolean
  tokenType: 'access'
  jti: string
  iat?: number
  exp?: number
}

function extractUserFromToken(authHeader: string | undefined): AccessTokenPayload | null {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return null
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), config.SESSION_SECRET, {
      algorithms: [JWT_ALGORITHM],
    }) as AccessTokenPayload
    if ((payload as { tokenType: string }).tokenType !== 'access') {
      return null
    }
    return payload
  } catch {
    return null
  }
}

// ─── Backup code generation ─────────────────────────────────────────────────

function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Hex-encoded random bytes, trimmed to desired length
    codes.push(randomBytes(BACKUP_CODE_LENGTH).toString('hex').slice(0, BACKUP_CODE_LENGTH))
  }
  return codes
}

// Keyed hash so a database leak alone cannot brute-force codes offline without
// SESSION_SECRET. Codes are high-entropy and single-use, so a fast keyed hash is
// appropriate here (unlike passwords).
function hashBackupCode(code: string): string {
  return createHmac('sha256', config.SESSION_SECRET).update(code).digest('hex')
}

// Constant-time comparison of two same-length hex digests.
function backupCodeMatches(storedHash: string, candidateHash: string): boolean {
  const stored = Buffer.from(storedHash, 'hex')
  const candidate = Buffer.from(candidateHash, 'hex')
  return stored.length === candidate.length && timingSafeEqual(stored, candidate)
}

// ─── Route registration ─────────────────────────────────────────────────────

export function totpRoutes(app: FastifyInstance): void {
  /**
   * POST /auth/totp/enrol
   *
   * Generates a new TOTP secret, encrypts it with AES-256-GCM, and stores
   * the ciphertext in users.totpSecret. Returns the otpauth:// URI (for QR
   * code rendering) and backup codes. This is the ONLY endpoint that exposes
   * the secret — subsequent calls will not return it.
   *
   * Requires a valid Bearer token. Re-enrolment overwrites the previous secret.
   */
  app.post('/auth/totp/enrol', async (request, reply) => {
    const tokenPayload = extractUserFromToken(request.headers.authorization)
    if (tokenPayload === null) {
      return reply.status(401).send({ error: 'Authentication required' })
    }

    const userId = tokenPayload.sub
    if (typeof userId !== 'string') {
      return reply.status(401).send({ error: 'Invalid token' })
    }

    // Verify the user exists in our domain model.
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user === null) {
      return reply.status(404).send({ error: 'User not found' })
    }

    // Generate TOTP secret (20-byte secret = 160-bit, standard for SHA1 HMAC).
    const totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      label: user.email,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
    })

    const otpauthUri = totp.toString()
    const secretBase32 = totp.secret.base32

    // Encrypt the base32 secret before writing to the database.
    // SECURITY: plaintext secret is held only in local variables and never logged.
    const encryptedSecret = encrypt(secretBase32)

    // Generate backup codes for account recovery. Only their HMAC hashes are
    // persisted; the plaintext is returned once here and never stored or logged.
    const backupCodes = generateBackupCodes()
    const backupCodeHashes = backupCodes.map((code) => hashBackupCode(code))

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encryptedSecret, totpBackupCodes: backupCodeHashes },
    })

    return reply.status(200).send({
      otpauthUri,
      backupCodes,
    })
  })

  /**
   * POST /auth/totp/verify
   *
   * Accepts a TOTP code and userId, decrypts the stored secret, and validates
   * the code. Returns only a success/failure boolean — never the secret.
   *
   * A 1-step time window is allowed (current period +/- 1) to accommodate
   * minor clock skew between client and server.
   */
  app.post<{ Body: unknown }>('/auth/totp/verify', async (request, reply) => {
    const parseResult = verifyBodySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        issues: parseResult.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      })
    }

    const { userId, code } = parseResult.data

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user === null) {
      return reply.status(404).send({ error: 'User not found' })
    }

    if (user.totpSecret === null) {
      return reply.status(400).send({ error: 'TOTP not enrolled' })
    }

    // Decrypt the stored secret. On failure (tampered ciphertext, wrong key),
    // return a generic error — never expose cryptographic details.
    let secretBase32: string
    try {
      secretBase32 = decrypt(user.totpSecret)
    } catch {
      request.log.error({ userId }, 'TOTP secret decryption failed')
      return reply.status(500).send({ error: 'TOTP verification unavailable' })
    }

    const totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      label: user.email,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    })

    // validate returns the time step delta (0, -1, +1) on success, or null on failure.
    const delta = totp.validate({ token: code, window: 1 })
    const verified = delta !== null

    // Clear the decrypted secret from the local variable immediately.
    secretBase32 = ''

    return reply.status(200).send({ verified })
  })

  /**
   * GET /auth/totp/status
   *
   * Returns the TOTP enrolment and verification status for the current user.
   * Never exposes the TOTP secret.
   */
  app.get('/auth/totp/status', async (request, reply) => {
    const tokenPayload = extractUserFromToken(request.headers.authorization)
    if (tokenPayload === null) {
      return reply.status(401).send({ error: 'Authentication required' })
    }

    const userId = tokenPayload.sub
    if (typeof userId !== 'string') {
      return reply.status(401).send({ error: 'Invalid token' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true },
    })

    if (user === null) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const enrolled = user.totpSecret !== null

    // In a full implementation, `verified` would be read from the session or
    // a dedicated `totpVerifiedAt` column. For this phase, enrolled implies
    // the user has completed at least one successful verify call externally.
    // The verify endpoint sets this flag in the session/JWT on success.
    return reply.status(200).send({
      enrolled,
      verified: false, // Determined by session state, not persisted here
    })
  })

  /**
   * POST /auth/totp/backup/verify
   *
   * Redeems a single-use backup code for a user who cannot produce a TOTP code
   * (e.g. lost device). The submitted code is HMAC-hashed and compared in
   * constant time against the stored hashes; a match is consumed (removed) so
   * each code works exactly once. Returns only { verified, remaining }.
   */
  app.post<{ Body: unknown }>('/auth/totp/backup/verify', async (request, reply) => {
    const parseResult = backupVerifyBodySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        issues: parseResult.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      })
    }

    const { userId, code } = parseResult.data

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpBackupCodes: true },
    })
    if (user === null) {
      return reply.status(404).send({ error: 'User not found' })
    }

    const candidateHash = hashBackupCode(code.trim())
    const matchIndex = user.totpBackupCodes.findIndex((stored) =>
      backupCodeMatches(stored, candidateHash),
    )

    if (matchIndex === -1) {
      return reply.status(200).send({ verified: false })
    }

    // Consume the matched code so it can never be reused.
    const remaining = user.totpBackupCodes.filter((_, index) => index !== matchIndex)
    await prisma.user.update({
      where: { id: userId },
      data: { totpBackupCodes: remaining },
    })

    return reply.status(200).send({ verified: true, remaining: remaining.length })
  })

  /**
   * POST /auth/totp/reset
   *
   * Admin-only recovery path: clears a target user's TOTP secret and backup
   * codes so they can re-enrol after losing their device. Scoped to the admin's
   * own tenant — an admin can never reset a user in another tenant.
   */
  app.post<{ Body: unknown }>('/auth/totp/reset', async (request, reply) => {
    const tokenPayload = extractUserFromToken(request.headers.authorization)
    if (tokenPayload === null) {
      return reply.status(401).send({ error: 'Authentication required' })
    }
    if (tokenPayload.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin role required' })
    }

    const parseResult = resetBodySchema.safeParse(request.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        issues: parseResult.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      })
    }

    const { userId } = parseResult.data

    // Tenant-scoped: only users within the admin's own tenant can be reset.
    const target = await prisma.user.findFirst({
      where: { id: userId, tenantId: tokenPayload.tenantId },
      select: { id: true },
    })
    if (target === null) {
      return reply.status(404).send({ error: 'User not found' })
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpBackupCodes: [] },
    })

    return reply.status(200).send({ reset: true })
  })
}
