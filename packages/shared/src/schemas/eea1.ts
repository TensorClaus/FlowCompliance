import { z } from 'zod'
import { GenderCodeSchema, RaceCodeSchema, EEAFormStatusSchema } from '../enums.js'

/**
 * EmployeeDeclarationSchema — EEA1 employee self-declaration form data.
 *
 * POPIA SENSITIVITY NOTICE (s.26):
 * The following fields constitute "special personal information" under
 * section 26 of the Protection of Personal Information Act 4 of 2013
 * and may only be processed with the data subject's explicit consent
 * or where required by law (Employment Equity Act 55 of 1998):
 *   - gender     (s.26(1) — sex)
 *   - race       (s.26(1) — race or ethnic origin)
 *   - disability (s.26(1) — health or sex life)
 *   - disabilityNature (s.26(1) — health information)
 *
 * Non-disclosure is a protected right. All three nullable fields
 * (gender, race, disability) use `null` to represent an explicit
 * choice to withhold, which must be preserved as a distinct value
 * rather than treated as missing data.
 */
export const EmployeeDeclarationSchema = z.object({
  /** Internal identifier for the employee record. */
  employeeId: z.string().min(1),

  /**
   * Tenant (employer) identifier injected at capture time.
   * Never entered by the employee directly.
   */
  tenantId: z.string().min(1),

  /** Full name of the employee as it appears on their ID document. */
  name: z.string().min(1),

  /**
   * Employer-assigned workplace number for the employee.
   * Maps to the "Employee workplace number" field in DC-002.
   */
  workplaceNumber: z.string().min(1),

  /**
   * Gender code. null = employee exercised the right of non-disclosure.
   * Special personal information per s.26(1) POPIA — handle with strict
   * access controls and purpose limitation.
   */
  gender: GenderCodeSchema.nullable(),

  /**
   * Race code. null = employee exercised the right of non-disclosure.
   * Special personal information per s.26(1) POPIA — handle with strict
   * access controls and purpose limitation.
   */
  race: RaceCodeSchema.nullable(),

  /**
   * Whether the employee is a foreign national.
   * Drives conditional display of citizenshipDate.
   */
  foreignNational: z.boolean(),

  /**
   * Date South African citizenship was acquired.
   * Conditional: only required when foreignNational is true.
   * Stored as a Date; use z.coerce.date() to accept ISO strings from
   * wire formats and form inputs.
   */
  citizenshipDate: z.coerce.date().optional(),

  /**
   * Whether the employee is a person with a disability.
   * null = employee exercised the protected right of non-disclosure.
   * Special personal information per s.26(1) POPIA — this value may
   * not be inferred or substituted; absence of consent must default
   * to null, never false.
   */
  disability: z.boolean().nullable(),

  /**
   * Nature of the employee's disability.
   * Conditional: only present when disability is true.
   * Special personal information per s.26(1) POPIA.
   */
  disabilityNature: z.string().min(1).optional(),

  /**
   * Whether the employee requires reasonable accommodation.
   * Conditional: only present when disability is true.
   */
  reasonableAccommodation: z.boolean().optional(),

  /**
   * Date on which the employee signed the declaration.
   * Accepts ISO 8601 strings from wire formats via z.coerce.date().
   */
  declarationDate: z.coerce.date(),

  /**
   * Base64-encoded data URL of the employee's captured signature.
   * Must be a non-empty string; validation of the data URL prefix
   * (e.g. "data:image/png;base64,") is the responsibility of the
   * signature-capture component upstream.
   */
  signatureDataUrl: z.string().min(1),
})

/** Inferred TypeScript type for a single EEA1 employee declaration. */
export type EmployeeDeclaration = z.infer<typeof EmployeeDeclarationSchema>

// ---------------------------------------------------------------------------
// EEA1Form — envelope that wraps the declaration with lifecycle metadata
// ---------------------------------------------------------------------------

/**
 * EEA1FormSchema — the persisted record for an EEA1 submission.
 *
 * Combines the employee's self-declaration with:
 *   - a system-generated record id
 *   - the form's current workflow status (EEAFormStatus)
 *   - audit timestamps (createdAt / updatedAt)
 *
 * Status transitions follow the EEAFormStatus state machine defined in
 * enums.ts: draft → pending_ceo → signed → submitted.
 */
export const EEA1FormSchema = z.object({
  /** Unique record identifier (UUID). */
  id: z.string().uuid(),

  /** The employee's completed self-declaration. */
  declaration: EmployeeDeclarationSchema,

  /**
   * Current workflow status of the form.
   * See EEAFormStatus in enums.ts for valid values and transition rules.
   */
  status: EEAFormStatusSchema,

  /** Timestamp of initial record creation. */
  createdAt: z.coerce.date(),

  /** Timestamp of most recent record update. */
  updatedAt: z.coerce.date(),
})

/** Inferred TypeScript type for a persisted EEA1 form record. */
export type EEA1Form = z.infer<typeof EEA1FormSchema>
