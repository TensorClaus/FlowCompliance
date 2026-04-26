declare const __sanitised__: unique symbol

/**
 * Branded wrapper around a prompt string that has been processed by the
 * AI sanitisation layer (C3). The brand is a compile-time-only marker —
 * it does not affect the runtime value.
 *
 * PRODUCTION RULE: only the sanitisation layer (C3) may call `brandPrompt`.
 * All other code must accept `SanitisedPrompt` and never construct it
 * directly. Enforced at compile time by the unique symbol brand.
 */
export type SanitisedPrompt = string & { readonly [__sanitised__]: true }

/**
 * Wraps a sanitised string as a SanitisedPrompt. Called ONLY by C3.
 * The name makes misuse visible in code review.
 */
export function brandPrompt(sanitised: string): SanitisedPrompt {
  return sanitised as SanitisedPrompt
}
