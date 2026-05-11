/**
 * PII_FIELD_PATHS — field paths that contain personally identifiable or
 * sensitive employment information under POPIA and the EEA.
 *
 * This list is a compliance control. It MUST NOT be mutated at runtime.
 * Any component or utility that renders field diffs MUST check membership
 * before displaying a value, with no bypass path.
 *
 * Covers: race, gender, disability attributes, biometric/signature data,
 * and remuneration values that could re-identify individuals.
 */
export const PII_FIELD_PATHS: readonly string[] = [
  'gender',
  'race',
  'disability',
  'disabilityNature',
  'signatureDataUrl',
  'medianRemuneration',
] as const
