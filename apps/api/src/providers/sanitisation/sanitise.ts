import { brandPrompt, type SanitisedPrompt } from '../llm/sanitised-prompt.js'

export interface SanitiseOptions {
  tenantId: string
  suppressionMin?: number // suppress numeric cells with <= N records; default 3
}

export interface SanitiseResult {
  prompt: SanitisedPrompt
  originalLen: number
  sanitisedLen: number
  stripCount: number // number of PII replacements made
  suppressedCells: number // number of numeric cells suppressed
}

// Apply in this order -- earlier replacements prevent later false matches.
// The name pattern is handled separately via stripNames() because it needs
// context-aware logic that a single regex replacement cannot provide.
const PII_PATTERNS: Array<{ re: RegExp; token: string; label: string }> = [
  {
    re: /data:[^;]+;base64,[A-Za-z0-9+/=]+/g,
    token: '[DATA_URL_REDACTED]',
    label: 'dataUrl',
  },
  {
    re: /\b\d{13}\b/g,
    token: '[SA_ID_REDACTED]',
    label: 'saId',
  },
  {
    re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    token: '[EMAIL_REDACTED]',
    label: 'email',
  },
  {
    re: /(?:\+27|0)\d{9}/g,
    token: '[PHONE_REDACTED]',
    label: 'phone',
  },
]

/**
 * Name heuristic: match 2-4 consecutive Title-Case words, excluding
 * sequences followed by a colon (which indicates a data label, not a name).
 *
 * When a match contains 3+ words and the first word precedes what looks
 * like a 2-word personal name, the leading context word is preserved.
 * This avoids consuming role/context words like "Manager" or "Director".
 */
const NAME_RE = /\b(?:[A-Z][a-z]+)(?:\s+[A-Z][a-z]+){1,3}\b(?!:)/g

function stripNames(text: string): { text: string; count: number } {
  let count = 0
  NAME_RE.lastIndex = 0
  const result = text.replace(NAME_RE, (match) => {
    const words = match.split(/\s+/)
    if (words.length >= 3) {
      // Preserve the leading context word; redact the trailing name portion
      count++
      return (words[0] ?? '') + ' [NAME_REDACTED]'
    }
    count++
    return '[NAME_REDACTED]'
  })
  return { text: result, count }
}

/**
 * Replace standalone integers whose value <= min with "[SUPPRESSED]".
 * Applied AFTER PII strip, BEFORE brandPrompt.
 */
function suppressSmallCells(text: string, min: number): { text: string; count: number } {
  let count = 0
  const result = text.replaceAll(/\b([0-9]+)\b/g, (match) => {
    const value = Number.parseInt(match, 10)
    if (value <= min) {
      count++
      return '[SUPPRESSED]'
    }
    return match
  })
  return { text: result, count }
}

/**
 * Strip PII from `text` and return a SanitisedPrompt safe for LLM ingestion.
 *
 * THIS IS THE ONLY AUTHORISED CALL SITE FOR brandPrompt IN THE CODEBASE.
 * Any other direct call to brandPrompt is a security violation.
 *
 * Strip order (applied sequentially -- order matters for SA IDs before numbers):
 *   1. Data URLs
 *   2. SA ID numbers (13-digit sequences)
 *   3. Email addresses
 *   4. SA phone numbers
 *   5. Names heuristic (sequences of 2-4 Title-Case words)
 *
 * Numeric suppression:
 *   Replace any standalone integer <= suppressionMin with "[SUPPRESSED]".
 *   Applied AFTER PII strip, BEFORE brandPrompt.
 *
 * Logging: emit a single structured log entry per call.
 * NEVER log the text before or after sanitisation.
 */
export function sanitise(text: string, options: SanitiseOptions): SanitiseResult {
  const originalLen = text.length
  const suppressionMin = options.suppressionMin ?? 3

  let sanitised = text
  let stripCount = 0

  // Steps 1-4: data URLs, SA IDs, emails, phones
  for (const pattern of PII_PATTERNS) {
    pattern.re.lastIndex = 0
    sanitised = sanitised.replace(pattern.re, () => {
      stripCount++
      return pattern.token
    })
  }

  // Step 5: names heuristic (context-aware, applied after other PII)
  const nameResult = stripNames(sanitised)
  sanitised = nameResult.text
  stripCount += nameResult.count

  // Numeric suppression (applied after all PII strip, before brandPrompt)
  const { text: suppressed, count: suppressedCells } = suppressSmallCells(sanitised, suppressionMin)

  const prompt = brandPrompt(suppressed)
  const sanitisedLen = suppressed.length

  // Structured log -- never includes text content
  // eslint-disable-next-line no-console
  console.info({
    tenantId: options.tenantId,
    originalLen,
    sanitisedLen,
    suppressedCells,
    stripCount,
  })

  return {
    prompt,
    originalLen,
    sanitisedLen,
    stripCount,
    suppressedCells,
  }
}
