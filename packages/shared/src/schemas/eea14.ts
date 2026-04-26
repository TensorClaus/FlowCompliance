import { z } from 'zod'
import { CEODeclarationSchema } from './common.js'

/**
 * EEA14 — Director General (DG) Notification Return.
 *
 * Scope:
 *   - Section A: DG notification metadata (employer details, notification
 *     type, reference number, issued date, response deadline, description)
 *   - Section B: S3 supporting document references (uploaded evidence files)
 *   - Section C: CEO declaration (re-used from common.ts per DC-003 Section H)
 *
 * Cross-field constraints:
 *   - responseDeadline must be strictly after issuedDate (enforced via
 *     .refine() on EEA14Schema)
 *
 * Persistence notes:
 *   - supportingDocuments at the top level represent documents attached to
 *     the full submission envelope; supportingDocuments nested inside
 *     DGNotificationSchema represent documents specifically evidencing the
 *     notification content. Both use the same SupportingDocumentSchema shape.
 *   - s3Key values are validated as non-empty strings only — format and
 *     bucket-policy assertions are the responsibility of the storage layer.
 */

// ---------------------------------------------------------------------------
// NotificationTypeEnum — canonical DG notification type taxonomy
// ---------------------------------------------------------------------------

/**
 * Canonical DG notification type taxonomy.
 *
 * compliance_order  — formal order issued under EEA s.44
 * undertaking       — written undertaking given by the employer under s.44
 * recommendation    — DG recommendation following a review under s.43
 * assessment        — DG assessment of the employer's EEP progress
 */
export const NotificationTypeEnum = z.enum([
  'compliance_order',
  'undertaking',
  'recommendation',
  'assessment',
])
export type NotificationType = z.infer<typeof NotificationTypeEnum>

// ---------------------------------------------------------------------------
// SupportingDocumentSchema — individual evidence file reference
// ---------------------------------------------------------------------------

/**
 * A reference to a single supporting document stored in S3.
 *
 * Only PDF and common image formats are accepted as evidence attachments.
 * The s3Key must be a non-empty string; path structure and bucket-level
 * access controls are enforced outside this schema.
 */
export const SupportingDocumentSchema = z.object({
  /** Unique document identifier (UUID). */
  documentId: z.string().uuid(),

  /** Original file name as supplied by the uploader. */
  fileName: z.string().min(1),

  /**
   * S3 object key for the stored file.
   * Must be a non-empty string; full path structure is validated by the
   * storage layer, not here.
   */
  s3Key: z.string().min(1),

  /** MIME type of the uploaded file. Only PDF and image types are accepted. */
  mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg']),

  /** ISO 8601 datetime at which the file was uploaded to S3. */
  uploadedAt: z.string().datetime(),

  /** Optional plain-language description of the document's relevance. */
  description: z.string().min(1).optional(),
})
export type SupportingDocument = z.infer<typeof SupportingDocumentSchema>

// ---------------------------------------------------------------------------
// DGNotificationSchema — the notification body (Section A + B)
// ---------------------------------------------------------------------------

/**
 * DG notification body — captures the formal notification record issued by
 * or in response to the Director General under EEA Chapter IV (ss.40–45).
 *
 * Note: responseDeadline > issuedDate is validated at the EEA14Schema level
 * (top-level .refine()) so that the error path is rooted correctly on the
 * submission envelope rather than the nested notification object.
 */
export const DGNotificationSchema = z.object({
  /** Canonical notification type (see NotificationTypeEnum). */
  notificationType: NotificationTypeEnum,

  /**
   * DEL-assigned reference number for this notification.
   * Must be a non-empty string; format is determined by the DEL portal.
   */
  referenceNumber: z.string().min(1),

  /** Date on which the notification was issued (ISO 8601 date string, YYYY-MM-DD). */
  issuedDate: z.string().min(1),

  /**
   * Deadline by which the employer must respond or comply (ISO 8601 date string).
   * Must be strictly after issuedDate — enforced at EEA14Schema level.
   */
  responseDeadline: z.string().min(1),

  /** Plain-language description of the notification's subject matter. */
  description: z.string().min(1),

  /**
   * Supporting documents that specifically evidence or substantiate this
   * notification's content. May be empty at draft stage.
   */
  supportingDocuments: z.array(SupportingDocumentSchema),
})
export type DGNotification = z.infer<typeof DGNotificationSchema>

// ---------------------------------------------------------------------------
// EEA14Schema — top-level submission envelope
// ---------------------------------------------------------------------------

/**
 * Full EEA14 submission envelope.
 *
 * Combines:
 *   - employer identifier
 *   - DG notification body (DGNotificationSchema)
 *   - submission-level supporting documents (separate from notification docs)
 *   - CEO declaration (re-used from common.ts)
 *   - submission timestamp
 *
 * The .refine() below enforces that responseDeadline is strictly after
 * issuedDate. Both values are parsed via Date.parse() so ISO 8601 date
 * strings ("YYYY-MM-DD") and ISO 8601 datetime strings are both accepted.
 */
export const EEA14Schema = z
  .object({
    /** Employer (tenant) UUID — references the EmployerProfile record. */
    employerId: z.string().uuid(),

    /** The DG notification body (Section A + Section B notification docs). */
    notification: DGNotificationSchema,

    /**
     * Supporting documents attached at the submission envelope level.
     * These complement notification.supportingDocuments and may include
     * cover letters, board resolutions, or remediation plans.
     * May be empty.
     */
    supportingDocuments: z.array(SupportingDocumentSchema),

    /**
     * CEO or authorised signatory declaration (Section C).
     * Shape is canonical — imported from common.ts; do not redefine.
     */
    ceoDeclaration: CEODeclarationSchema,

    /** ISO 8601 datetime at which this return was submitted to the DEL portal. */
    submittedAt: z.string().datetime(),
  })
  .refine(
    (data) =>
      Date.parse(data.notification.responseDeadline) > Date.parse(data.notification.issuedDate),
    {
      message: 'notification.responseDeadline must be strictly after notification.issuedDate',
      path: ['notification', 'responseDeadline'],
    },
  )

export type EEA14 = z.infer<typeof EEA14Schema>
