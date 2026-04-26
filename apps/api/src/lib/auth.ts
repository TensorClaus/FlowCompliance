import { randomUUID } from 'node:crypto'
import { prismaAdapter } from '@better-auth/prisma-adapter'
import { betterAuth } from 'better-auth'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { prisma } from './prisma.js'

export const ACCESS_TOKEN_EXPIRY_SECONDS = config.ACCESS_TOKEN_TTL_MINUTES * 60
export const REFRESH_TOKEN_EXPIRY_SECONDS = config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60
export const AUTH_ALGORITHM = 'HS256' as const

export interface AccessTokenClaims {
  sub: string
  tenantId: string
  email: string
  role: string
  totpVerified: boolean
  tokenType: 'access'
  jti: string
}

export interface RefreshTokenClaims {
  sub: string
  tenantId: string
  tokenType: 'refresh'
  jti: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface TokenResponse {
  accessToken: string
  expiresIn: number
}

export interface BetterAuthSessionLike {
  sessionToken: string
  expiresAt: Date | string | number
}

export const auth = betterAuth({
  appName: 'Simplifi',
  secret: config.SESSION_SECRET,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
  session: {
    expiresIn: REFRESH_TOKEN_EXPIRY_SECONDS,
  },
}) as unknown as ReturnType<typeof betterAuth>

function signJwt(claims: object, expiresIn: number): string {
  return jwt.sign(claims, config.SESSION_SECRET, {
    algorithm: AUTH_ALGORITHM,
    expiresIn,
  })
}

export function issueAccessToken(
  input: Omit<AccessTokenClaims, 'tokenType' | 'jti'>,
  sessionId: string = randomUUID(),
): string {
  return signJwt(
    {
      ...input,
      jti: sessionId,
      tokenType: 'access',
    },
    ACCESS_TOKEN_EXPIRY_SECONDS,
  )
}

export function issueRefreshToken(
  input: Omit<RefreshTokenClaims, 'tokenType' | 'jti'>,
  sessionId: string = randomUUID(),
): string {
  return signJwt(
    {
      ...input,
      jti: sessionId,
      tokenType: 'refresh',
    },
    REFRESH_TOKEN_EXPIRY_SECONDS,
  )
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, config.SESSION_SECRET, {
    algorithms: [AUTH_ALGORITHM],
  }) as AccessTokenClaims

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (payload.tokenType !== 'access') {
    throw new Error('Not an access token')
  }

  return payload
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  const payload = jwt.verify(token, config.SESSION_SECRET, {
    algorithms: [AUTH_ALGORITHM],
  }) as RefreshTokenClaims

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (payload.tokenType !== 'refresh') {
    throw new Error('Not a refresh token')
  }

  return payload
}

export function buildTokenPair(
  input: Omit<AccessTokenClaims, 'tokenType' | 'jti'>,
  sessionId: string = randomUUID(),
): TokenPair {
  return {
    accessToken: issueAccessToken(input, sessionId),
    refreshToken: issueRefreshToken(
      {
        sub: input.sub,
        tenantId: input.tenantId,
      },
      sessionId,
    ),
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  }
}

export function mapBetterAuthSession(session: BetterAuthSessionLike): TokenResponse {
  const expiresAt = new Date(session.expiresAt).getTime()
  const expiresIn = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))

  return {
    accessToken: session.sessionToken,
    expiresIn,
  }
}

export type Auth = typeof auth
