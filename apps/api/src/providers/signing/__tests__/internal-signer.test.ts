/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSigningProvider as createSigningProviderBarrel,
  InternalSigner as InternalSignerBarrel,
  NotImplementedError as NotImplementedErrorBarrel,
} from '../index.js'
import { InternalSigner } from '../internal-signer.js'
import { createSigningProvider, NotImplementedError } from '../signing-provider.factory.js'

describe('InternalSigner', () => {
  let signer: InternalSigner

  beforeEach(() => {
    signer = new InternalSigner()
  })

  // ─── generateOtp ──────────────────────────────────────────────────────────

  describe('generateOtp', () => {
    it('returns a 6-digit numeric string', async () => {
      const otp = await signer.generateOtp('tenant-1', 'user-1')
      expect(otp).toMatch(/^\d{6}$/)
      expect(Number(otp)).toBeGreaterThanOrEqual(100_000)
      expect(Number(otp)).toBeLessThanOrEqual(999_999)
    })

    it('overwrites previous OTP for same tenant+sub (no double OTP)', async () => {
      const otp1 = await signer.generateOtp('tenant-1', 'user-1')
      const otp2 = await signer.generateOtp('tenant-1', 'user-1')

      // The second OTP is the valid one; first should no longer work
      // (unless they happen to be identical, which is astronomically unlikely)
      // We verify by signing with otp2 — it should succeed
      const record = await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Test User',
        formRef: 'eea2:2024:draft_abc',
        otp: otp2,
      })
      expect(record.recordId).toBeDefined()

      // Now otp1 should fail (OTP was consumed, and even if not, it was overwritten)
      await expect(
        signer.sign({
          tenantId: 'tenant-1',
          signerSub: 'user-1',
          signerName: 'Test User',
          formRef: 'eea2:2024:draft_abc',
          otp: otp1,
        }),
      ).rejects.toThrow('Invalid or expired OTP')
    })
  })

  // ─── sign ─────────────────────────────────────────────────────────────────

  describe('sign', () => {
    it('valid OTP produces SignRecord with correct structure', async () => {
      const otp = await signer.generateOtp('tenant-1', 'user-1')
      const record = await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Jane Doe',
        formRef: 'eea2:2024:draft_xyz',
        otp,
      })

      expect(record.recordId).toBeTruthy()
      expect(record.tenantId).toBe('tenant-1')
      expect(record.signerSub).toBe('user-1')
      expect(record.signerName).toBe('Jane Doe')
      expect(record.formRef).toBe('eea2:2024:draft_xyz')
      expect(record.timestamp).toBeTruthy()
      expect(record.prevHash).toBe('genesis')
      expect(record.hash).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })

    it('invalid OTP throws with expected message', async () => {
      await signer.generateOtp('tenant-1', 'user-1')

      await expect(
        signer.sign({
          tenantId: 'tenant-1',
          signerSub: 'user-1',
          signerName: 'Jane Doe',
          formRef: 'eea2:2024:draft_xyz',
          otp: '000000',
        }),
      ).rejects.toThrow('Invalid or expired OTP')
    })

    it('expired OTP throws', async () => {
      const otp = await signer.generateOtp('tenant-1', 'user-1')

      // Advance time by 11 minutes (past 10-minute TTL)
      const realDateNow = Date.now
      vi.spyOn(Date, 'now').mockReturnValue(realDateNow() + 11 * 60 * 1000)

      await expect(
        signer.sign({
          tenantId: 'tenant-1',
          signerSub: 'user-1',
          signerName: 'Jane Doe',
          formRef: 'eea2:2024:draft_xyz',
          otp,
        }),
      ).rejects.toThrow('Invalid or expired OTP')

      vi.restoreAllMocks()
    })
  })

  // ─── hash chain ───────────────────────────────────────────────────────────

  describe('hash chain', () => {
    it('genesis record has prevHash === "genesis"', async () => {
      const otp = await signer.generateOtp('tenant-1', 'user-1')
      const record = await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Genesis Signer',
        formRef: 'eea2:2024:draft_001',
        otp,
      })

      expect(record.prevHash).toBe('genesis')
    })

    it('second record prevHash === first record hash', async () => {
      const otp1 = await signer.generateOtp('tenant-1', 'user-1')
      const first = await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'First Signer',
        formRef: 'eea2:2024:draft_001',
        otp: otp1,
      })

      const otp2 = await signer.generateOtp('tenant-1', 'user-1')
      const second = await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Second Signer',
        formRef: 'eea2:2024:draft_002',
        otp: otp2,
      })

      expect(second.prevHash).toBe(first.hash)
    })
  })

  // ─── verifyChain ──────────────────────────────────────────────────────────

  describe('verifyChain', () => {
    it('pristine chain returns true', async () => {
      const otp1 = await signer.generateOtp('tenant-1', 'user-1')
      await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Signer A',
        formRef: 'eea2:2024:draft_a',
        otp: otp1,
      })

      const otp2 = await signer.generateOtp('tenant-1', 'user-1')
      await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Signer B',
        formRef: 'eea2:2024:draft_b',
        otp: otp2,
      })

      expect(await signer.verifyChain('tenant-1')).toBe(true)
    })

    it('tampered signerName on any record returns false', async () => {
      const otp1 = await signer.generateOtp('tenant-1', 'user-1')
      await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Original Name',
        formRef: 'eea2:2024:draft_a',
        otp: otp1,
      })

      // getChain returns a copy — tamper via the internal store directly
      const internalChain = (
        signer as unknown as { chainStore: Map<string, { signerName: string }[]> }
      ).chainStore.get('tenant-1')!
      internalChain[0]!.signerName = 'Tampered Name'

      expect(await signer.verifyChain('tenant-1')).toBe(false)
    })

    it('tampered hash field directly returns false', async () => {
      const otp1 = await signer.generateOtp('tenant-1', 'user-1')
      await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Valid Name',
        formRef: 'eea2:2024:draft_a',
        otp: otp1,
      })

      const internalChain = (
        signer as unknown as { chainStore: Map<string, { hash: string }[]> }
      ).chainStore.get('tenant-1')!
      internalChain[0]!.hash = 'deadbeef'.repeat(8)

      expect(await signer.verifyChain('tenant-1')).toBe(false)
    })

    it('tampered prevHash on second record returns false', async () => {
      const otp1 = await signer.generateOtp('tenant-link', 'user-1')
      await signer.sign({
        tenantId: 'tenant-link',
        signerSub: 'user-1',
        signerName: 'First Signer',
        formRef: 'ref-001',
        otp: otp1,
      })
      const otp2 = await signer.generateOtp('tenant-link', 'user-1')
      await signer.sign({
        tenantId: 'tenant-link',
        signerSub: 'user-1',
        signerName: 'Second Signer',
        formRef: 'ref-002',
        otp: otp2,
      })

      const internalChain = (
        signer as unknown as { chainStore: Map<string, { prevHash: string }[]> }
      ).chainStore.get('tenant-link')!
      internalChain[1]!.prevHash = 'deliberately-broken-prev-hash'

      expect(await signer.verifyChain('tenant-link')).toBe(false)
    })

    it('empty chain returns true (vacuously valid)', async () => {
      expect(await signer.verifyChain('nonexistent-tenant')).toBe(true)
    })
  })

  // ─── getChain ─────────────────────────────────────────────────────────────

  describe('getChain', () => {
    it('returns records in insertion order', async () => {
      const otp1 = await signer.generateOtp('tenant-1', 'user-1')
      const first = await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'First',
        formRef: 'eea2:2024:draft_001',
        otp: otp1,
      })

      const otp2 = await signer.generateOtp('tenant-1', 'user-1')
      const second = await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Second',
        formRef: 'eea2:2024:draft_002',
        otp: otp2,
      })

      const chain = await signer.getChain('tenant-1')
      expect(chain).toHaveLength(2)
      expect(chain[0]!.recordId).toBe(first.recordId)
      expect(chain[1]!.recordId).toBe(second.recordId)
    })

    it('returns a defensive copy (mutating result does not affect internal state)', async () => {
      const otp = await signer.generateOtp('tenant-1', 'user-1')
      await signer.sign({
        tenantId: 'tenant-1',
        signerSub: 'user-1',
        signerName: 'Copy Test',
        formRef: 'eea2:2024:draft_copy',
        otp,
      })

      const chain = await signer.getChain('tenant-1')
      chain.pop()

      const chainAgain = await signer.getChain('tenant-1')
      expect(chainAgain).toHaveLength(1)
    })

    it('getChain returns empty array for nonexistent tenant', async () => {
      const chain = await signer.getChain('tenant-no-records-xyz')
      expect(chain).toEqual([])
    })
  })
})

// ─── Factory ──────────────────────────────────────────────────────────────────

describe('createSigningProvider', () => {
  it('SIGNING_PROVIDER=internal returns InternalSigner instance', () => {
    // vitest.config.ts does not set SIGNING_PROVIDER, so it defaults to "internal"
    const provider = createSigningProvider()
    expect(provider).toBeInstanceOf(InternalSigner)
  })

  it('SIGNING_PROVIDER=opensign throws NotImplementedError', async () => {
    // Temporarily override the config value
    const { config } = await import('../../../config.js')
    const original = config.SIGNING_PROVIDER
    ;(config as { SIGNING_PROVIDER: string }).SIGNING_PROVIDER = 'opensign'

    try {
      expect(() => createSigningProvider()).toThrow(NotImplementedError)
      expect(() => createSigningProvider()).toThrow('SigningProvider "opensign" is not implemented')
    } finally {
      ;(config as { SIGNING_PROVIDER: string }).SIGNING_PROVIDER = original
    }
  })
})

// ─── Barrel index ─────────────────────────────────────────────────────────────

describe('signing barrel index', () => {
  it('re-exports createSigningProvider, InternalSigner, NotImplementedError', () => {
    expect(createSigningProviderBarrel).toBeDefined()
    expect(InternalSignerBarrel).toBeDefined()
    expect(NotImplementedErrorBarrel).toBeDefined()
  })
})
