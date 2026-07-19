import React from 'react'

const PROVISIONAL_TITLE =
  'Provisional EAP data - cited StatsSA QLFS Q1 2026 figures, provisional pending reference-quarter confirmation (the EE Regulations reference the Q3-of-reporting-year EAP).'

export function ProvisionalEapBadge({
  testId = 'eea-provisional-badge',
}: {
  testId?: string
}): React.ReactElement {
  return (
    <span
      className="ml-1 inline-flex select-none items-center rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-amber-900"
      data-provisional="eap"
      data-testid={testId}
      role="note"
      title={PROVISIONAL_TITLE}
    >
      provisional EAP data
    </span>
  )
}
