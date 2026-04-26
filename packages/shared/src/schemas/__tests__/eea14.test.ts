import { describe, it, expect } from 'vitest'
import {
  NotificationTypeEnum,
  SupportingDocumentSchema,
  DGNotificationSchema,
  EEA14Schema,
} from '../eea14.js'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const validCeoDeclaration = {
  fullName: 'Sipho Nkosi',
  organisationName: 'Transform Holdings (Pty) Ltd',
  signatureDataUrl: 'data:image/png;base64,sig123',
  date: '2025-08-01',
  place: 'Cape Town',
}

const validSupportingDoc = {
  documentId: '660e8400-e29b-41d4-a716-446655440001',
  fileName: 'compliance-order.pdf',
  s3Key: 'docs/2025/compliance-order.pdf',
  mimeType: 'application/pdf' as const,
  uploadedAt: '2025-07-15T10:00:00Z',
}

const validNotification = {
  notificationType: 'compliance_order' as const,
  referenceNumber: 'DEL-2025-00123',
  issuedDate: '2025-07-01',
  responseDeadline: '2025-08-01',
  description: 'Compliance order regarding failure to submit EEA2',
  supportingDocuments: [validSupportingDoc],
}

function buildValidEEA14() {
  return {
    employerId: '550e8400-e29b-41d4-a716-446655440000',
    notification: validNotification,
    supportingDocuments: [],
    ceoDeclaration: validCeoDeclaration,
    submittedAt: '2025-08-10T14:30:00Z',
  }
}

// ---------------------------------------------------------------------------
// NotificationTypeEnum
// ---------------------------------------------------------------------------

describe('NotificationTypeEnum', () => {
  it.each(['compliance_order', 'undertaking', 'recommendation', 'assessment'] as const)(
    'accepts type "%s"',
    (type) => {
      expect(NotificationTypeEnum.safeParse(type).success).toBe(true)
    },
  )

  it('rejects unknown notification type', () => {
    expect(NotificationTypeEnum.safeParse('warning').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(NotificationTypeEnum.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SupportingDocumentSchema
// ---------------------------------------------------------------------------

describe('SupportingDocumentSchema', () => {
  it('accepts a valid PDF document', () => {
    expect(SupportingDocumentSchema.safeParse(validSupportingDoc).success).toBe(true)
  })

  it('accepts image/png MIME type', () => {
    const doc = { ...validSupportingDoc, mimeType: 'image/png' }
    expect(SupportingDocumentSchema.safeParse(doc).success).toBe(true)
  })

  it('accepts image/jpeg MIME type', () => {
    const doc = { ...validSupportingDoc, mimeType: 'image/jpeg' }
    expect(SupportingDocumentSchema.safeParse(doc).success).toBe(true)
  })

  it('rejects invalid MIME type', () => {
    const doc = { ...validSupportingDoc, mimeType: 'application/zip' }
    const result = SupportingDocumentSchema.safeParse(doc)
    expect(result.success).toBe(false)
  })

  it('rejects text/plain MIME type', () => {
    const doc = { ...validSupportingDoc, mimeType: 'text/plain' }
    expect(SupportingDocumentSchema.safeParse(doc).success).toBe(false)
  })

  it('rejects non-UUID documentId', () => {
    const doc = { ...validSupportingDoc, documentId: 'not-a-uuid' }
    expect(SupportingDocumentSchema.safeParse(doc).success).toBe(false)
  })

  it('rejects empty s3Key', () => {
    const doc = { ...validSupportingDoc, s3Key: '' }
    expect(SupportingDocumentSchema.safeParse(doc).success).toBe(false)
  })

  it('accepts optional description', () => {
    const doc = { ...validSupportingDoc, description: 'Supporting evidence' }
    expect(SupportingDocumentSchema.safeParse(doc).success).toBe(true)
  })

  it('rejects empty description when provided', () => {
    const doc = { ...validSupportingDoc, description: '' }
    expect(SupportingDocumentSchema.safeParse(doc).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DGNotificationSchema
// ---------------------------------------------------------------------------

describe('DGNotificationSchema', () => {
  it('accepts a valid notification', () => {
    expect(DGNotificationSchema.safeParse(validNotification).success).toBe(true)
  })

  it('accepts notification with zero supporting documents', () => {
    const notification = { ...validNotification, supportingDocuments: [] }
    expect(DGNotificationSchema.safeParse(notification).success).toBe(true)
  })

  it('rejects empty referenceNumber', () => {
    const notification = { ...validNotification, referenceNumber: '' }
    expect(DGNotificationSchema.safeParse(notification).success).toBe(false)
  })

  it('rejects empty description', () => {
    const notification = { ...validNotification, description: '' }
    expect(DGNotificationSchema.safeParse(notification).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// EEA14Schema — full envelope
// ---------------------------------------------------------------------------

describe('EEA14Schema', () => {
  it('accepts a complete valid EEA14 return', () => {
    const result = EEA14Schema.safeParse(buildValidEEA14())
    expect(result.success).toBe(true)
  })

  it('accepts EEA14 with zero envelope-level supporting documents', () => {
    const data = buildValidEEA14()
    data.supportingDocuments = []
    expect(EEA14Schema.safeParse(data).success).toBe(true)
  })

  it('accepts all four notification types in a valid envelope', () => {
    const base = buildValidEEA14()
    for (const type of [
      'compliance_order',
      'undertaking',
      'recommendation',
      'assessment',
    ] as const) {
      expect(
        EEA14Schema.safeParse({
          ...base,
          notification: { ...validNotification, notificationType: type },
        }).success,
      ).toBe(true)
    }
  })

  it('rejects responseDeadline before issuedDate', () => {
    const data = buildValidEEA14()
    data.notification = {
      ...validNotification,
      issuedDate: '2025-08-01',
      responseDeadline: '2025-07-01',
    }
    const result = EEA14Schema.safeParse(data)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths.some((p) => p.includes('responseDeadline'))).toBe(true)
    }
  })

  it('rejects responseDeadline equal to issuedDate', () => {
    const data = buildValidEEA14()
    data.notification = {
      ...validNotification,
      issuedDate: '2025-08-01',
      responseDeadline: '2025-08-01',
    }
    const result = EEA14Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects unknown notification type in envelope', () => {
    const data = buildValidEEA14()
    // @ts-expect-error -- intentionally invalid
    data.notification = { ...validNotification, notificationType: 'penalty' }
    const result = EEA14Schema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects missing ceoDeclaration', () => {
    const { ceoDeclaration: _, ...rest } = buildValidEEA14()
    const result = EEA14Schema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid employerId', () => {
    const data = { ...buildValidEEA14(), employerId: '123' }
    expect(EEA14Schema.safeParse(data).success).toBe(false)
  })

  it('rejects invalid submittedAt', () => {
    const data = { ...buildValidEEA14(), submittedAt: 'yesterday' }
    expect(EEA14Schema.safeParse(data).success).toBe(false)
  })
})
