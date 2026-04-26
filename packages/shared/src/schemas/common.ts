import { z } from 'zod'

/**
 * CEO / authorised signatory declaration — shared across EEA2 (Section H) and EEA4 (Section F).
 * The stricter `.min(1)` constraints from EEA4 are canonical — an empty string is never a valid signature.
 * DC-003 Section H / DC-004 Section F.
 */
export const CEODeclarationSchema = z.object({
  /** Full legal name of the CEO or authorised signatory */
  fullName: z.string().min(1),
  /** Registered organisation name as it appears on official documents */
  organisationName: z.string().min(1),
  /** Base64 or data-URL encoded signature image */
  signatureDataUrl: z.string().min(1),
  /** Date on which the declaration was signed */
  date: z.coerce.date(),
  /** Physical location (place) where the declaration was signed */
  place: z.string().min(1),
})

export type CEODeclaration = z.infer<typeof CEODeclarationSchema>
