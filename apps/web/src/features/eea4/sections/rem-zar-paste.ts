import type { PasteWarning } from '../../eea/components/matrix-grid'

export type RemDecimalTruncatedWarning = {
  code: 'REM_DECIMAL_TRUNCATED'
  cellPath: string
  severity: 'warning'
  message: string
}

export type RemZarPasteWarning = PasteWarning | RemDecimalTruncatedWarning

const WARNING_MESSAGES = {
  nonNumeric: 'Non-numeric remuneration replaced with 0 during paste.',
  decimalTruncated: 'Decimal remuneration truncated during paste.',
} as const

export function parseIntegerZarToken(token: string): {
  value: number
  warnings: RemZarPasteWarning[]
} {
  const raw = token.trim()
  if (raw === '') {
    return { value: 0, warnings: [] }
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      value: 0,
      warnings: [
        {
          code: 'PASTE_NON_NUMERIC',
          cellPath: '',
          severity: 'warning',
          message: WARNING_MESSAGES.nonNumeric,
        },
      ],
    }
  }

  const truncated = Math.trunc(parsed)
  if (truncated !== parsed) {
    return {
      value: truncated,
      warnings: [
        {
          code: 'REM_DECIMAL_TRUNCATED',
          cellPath: '',
          severity: 'warning',
          message: WARNING_MESSAGES.decimalTruncated,
        },
      ],
    }
  }

  return { value: parsed, warnings: [] }
}
