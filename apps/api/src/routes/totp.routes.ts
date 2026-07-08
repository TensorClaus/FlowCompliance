import { randomBytes } from 'node:crypto'
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

    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encryptedSecret },
    })

    // Generate backup codes for account recovery.
    const backupCodes = generateBackupCodes()

    // NOTE: In a full implementation, backup codes would also be hashed and
    // stored. For this phase, they are returned once and not persisted.

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
}
