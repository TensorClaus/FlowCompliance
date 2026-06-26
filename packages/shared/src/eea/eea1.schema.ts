import { z } from 'zod'

/**
 * EEA1DeclarationBaseSchema — the raw ZodObject for the five EEA1 declaration
 * fields. Exported separately so consumers can access .shape for per-field
 * validation without triggering TypeScript errors caused by ZodEffects (which
 * superRefine produces) not exposing .shape.
 *
 * Use EEA1DeclarationSchema (with superRefine) for full cross-field validation
 * at form submission. Use EEA1DeclarationBaseSchema.shape for per-field blur
 * validation inside components.
 */
export const EEA1DeclarationBaseSchema = z.object({
  /** UUID that identifies the employee record — pre-filled from the JWT. */
  employeeId: z.uuid(),

  /** Full name as it appears on the employee's ID document. */
  name: z.string().min(2).max(100),

  /**
   * Employer-assigned workplace number.
   * Maps to the "Employee workplace number" field in DC-002.
   */
  workplaceNumber: z.string().min(1).max(20),

  /**
   * Whether the employee is a foreign national.
   * Drives conditional display and validation of citizenshipDate.
   * Foreign nationals are excluded from designated-group counts per EEA s.1
   * and appear in a separate column on the EEA2 workforce profile.
   */
  foreignNational: z.boolean(),

  /**
   * ISO 8601 date on which South African citizenship or permanent residence
   * was granted. Stored as a date string (yyyy-mm-dd).
   * Conditional: required when foreignNational is true.
   */
  citizenshipDate: z.iso.date().optional(),
})

/**
 * EEA1DeclarationSchema — adds cross-field validation via superRefine.
 *
 * superRefine enforces the statutory rule: a foreign national MUST supply the
 * date citizenship or permanent residence was granted. If foreignNational is
 * true and citizenshipDate is absent, a ZodIssueCode.custom error is issued on
 * the citizenshipDate path so React Hook Form (or any other consumer) can
 * surface the error on the correct field.
 *
 * This schema wraps EEA1DeclarationBaseSchema in ZodEffects; use
 * EEA1DeclarationBaseSchema.shape for per-field access.
 */
export const EEA1DeclarationSchema = EEA1DeclarationBaseSchema.superRefine((data, ctx) => {
  if (data.foreignNational && !data.citizenshipDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['citizenshipDate'],
      message: 'Citizenship/permanent residence date is required for foreign nationals',
    })
  }
})

export type EEA1Declaration = z.infer<typeof EEA1DeclarationSchema>
