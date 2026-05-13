/**
 * kmsExtension.test — smoke test asserting that the Prisma client extension
 * applied in apps/api/src/lib/prisma.ts actually encrypts PII fields on
 * `eea1_declarations` writes (POPIA s.19).
 *
 * The persisted column MUST NOT contain plaintext 'African' — the row should
 * store the AES-256-GCM ciphertext produced by the KMS encryption extension.
 *
 * We read the raw row via $queryRaw to bypass any future decryption-on-read
 * logic; today the column also holds ciphertext when read via the model API.
 */

import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { decrypt } from '../lib/crypto.js'
import { prisma } from '../lib/prisma.js'
import { encryptPiiFieldsInArgs } from '../prisma/middleware/kms-encrypt.js'
import { createTestTenant } from './helpers/tenant.js'

interface RawEea1Row {
  id: string
  race: string | null
  gender: string | null
  signatureDataUrl: string
}

describe('encryptPiiFieldsInArgs (unit)', () => {
  it('replaces plaintext race / gender / signatureDataUrl with ciphertext', () => {
    const data: Record<string, unknown> = {
      employeeId: 'EMP-001',
      name: 'Test',
      workplaceNumber: 'WP-001',
      race: 'African',
      gender: 'Female',
      disability: null,
      foreignNational: false,
      signatureDataUrl: 'data:image/png;base64,SIGNATURE_PLAINTEXT',
    }

    encryptPiiFieldsInArgs(data, { debug: () => {} })

    expect(data['race']).not.toBe('African')
    expect(data['gender']).not.toBe('Female')
    expect(data['signatureDataUrl']).not.toBe('data:image/png;base64,SIGNATURE_PLAINTEXT')

    // Null fields stay null — we never encrypt "prefer not to disclose".
    expect(data['disability']).toBeNull()

    // Round-trip decrypt confirms ciphertext is valid AES-256-GCM output.
    expect(decrypt(data['race'] as string)).toBe('African')
    expect(decrypt(data['gender'] as string)).toBe('Female')
    expect(decrypt(data['signatureDataUrl'] as string)).toBe(
      'data:image/png;base64,SIGNATURE_PLAINTEXT',
    )
  })

  it('handles the update { set: value } wrapper form', () => {
    const data: Record<string, unknown> = {
      race: { set: 'White' },
    }

    encryptPiiFieldsInArgs(data, { debug: () => {} })

    const wrapped = data['race'] as { set: string }
    expect(wrapped.set).not.toBe('White')
    expect(decrypt(wrapped.set)).toBe('White')
  })
})

describe('kms encryption extension (eea1_declarations)', () => {
  const createdIds: string[] = []
  const createdTenantIds: string[] = []

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM eea1_declarations WHERE id = ANY($1::uuid[])`,
        createdIds,
      )
    }
    if (createdTenantIds.length > 0) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM tenants WHERE id = ANY($1::uuid[])`,
        createdTenantIds,
      )
    }
  })

  it('encrypts race and signatureDataUrl before persisting', async () => {
    const tenantId = await createTestTenant('kms-extension-test')
    createdTenantIds.push(tenantId)

    const id = randomUUID()
    createdIds.push(id)

    await prisma.eea1Declaration.create({
      data: {
        id,
        tenantId,
        employeeId: 'EMP-001',
        name: 'Test Employee',
        workplaceNumber: 'WP-001',
        race: 'African',
        gender: 'Female',
        foreignNational: false,
        signatureDataUrl: 'data:image/png;base64,PLAINTEXT_SIGNATURE',
        declarationDate: new Date('2026-01-15'),
      },
    })

    const rows = await prisma.$queryRawUnsafe<RawEea1Row[]>(
      `SELECT id, race, gender, "signatureDataUrl" FROM eea1_declarations WHERE id = $1`,
      id,
    )

    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row).toBeDefined()

    // Plaintext MUST be absent — the extension should have replaced it.
    expect(row?.race).not.toBe('African')
    expect(row?.gender).not.toBe('Female')
    expect(row?.signatureDataUrl).not.toBe('data:image/png;base64,PLAINTEXT_SIGNATURE')

    // Ciphertext is non-empty and base64-shaped.
    expect(row?.race).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(row?.gender).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(row?.signatureDataUrl).toMatch(/^[A-Za-z0-9+/=]+$/)
  })
})
