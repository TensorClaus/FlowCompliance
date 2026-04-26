import jwt, { type JwtHeader, type JwtPayload } from 'jsonwebtoken'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  ACCESS_TOKEN_EXPIRY_SECONDS,
  AUTH_ALGORITHM,
  REFRESH_TOKEN_EXPIRY_SECONDS,
  buildTokenPair,
  issueAccessToken,
  issueRefreshToken,
} from './auth.js'

interface DecodedClaims extends JwtPayload {
  email?: string
  jti?: string
  role?: string
  tenantId?: string
  tokenType?: string
  totpVerified?: boolean
}

function decodeClaims(token: string): { header: JwtHeader; payload: DecodedClaims } {
  const decoded = jwt.decode(token, { complete: true })
  if (decoded === null || typeof decoded === 'string') {
    throw new Error('Token could not be decoded')
  }

  return {
    header: decoded.header,
    payload: decoded.payload as DecodedClaims,
  }
}

describe('auth token issuance', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-19T00:00:00.000Z'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('issues a 15 minute access token signed with HS256', () => {
    const token = issueAccessToken(
      {
        sub: 'user-1',
        tenantId: '11111111-1111-1111-1111-111111111111',
        email: 'user@simplifi.co.za',
        role: 'EE_MANAGER',
        totpVerified: false,
      },
      'session-1',
    )

    const decoded = decodeClaims(token)

    expect(decoded.header.alg).toBe(AUTH_ALGORITHM)
    expect(decoded.payload.tokenType).toBe('access')
    expect(decoded.payload.jti).toBe('session-1')
    expect(typeof decoded.payload.iat).toBe('number')
    expect(typeof decoded.payload.exp).toBe('number')
    expect((decoded.payload.exp ?? 0) - (decoded.payload.iat ?? 0)).toBe(
      ACCESS_TOKEN_EXPIRY_SECONDS,
    )
  })

  it('issues a 7 day refresh token signed with HS256', () => {
    const token = issueRefreshToken(
      {
        sub: 'user-1',
        tenantId: '11111111-1111-1111-1111-111111111111',
      },
      'session-1',
    )

    const decoded = decodeClaims(token)

    expect(decoded.header.alg).toBe(AUTH_ALGORITHM)
    expect(decoded.payload.tokenType).toBe('refresh')
    expect(decoded.payload.jti).toBe('session-1')
    expect(typeof decoded.payload.iat).toBe('number')
    expect(typeof decoded.payload.exp).toBe('number')
    expect((decoded.payload.exp ?? 0) - (decoded.payload.iat ?? 0)).toBe(
      REFRESH_TOKEN_EXPIRY_SECONDS,
    )
  })

  it('returns the expected pair shape for register/login responses', () => {
    const pair = buildTokenPair(
      {
        sub: 'user-1',
        tenantId: '11111111-1111-1111-1111-111111111111',
        email: 'user@simplifi.co.za',
        role: 'EE_MANAGER',
        totpVerified: false,
      },
      'session-1',
    )

    expect(pair).toHaveProperty('accessToken')
    expect(pair).toHaveProperty('refreshToken')
    expect(pair).toHaveProperty('expiresIn', ACCESS_TOKEN_EXPIRY_SECONDS)
  })
})
