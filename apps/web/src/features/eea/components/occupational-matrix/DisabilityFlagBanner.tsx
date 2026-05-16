// @non-suppressible — see rule_eea_013 + EEA s27

export interface DisabilityFlagBannerProps {
  percentage: number
  headcount: number
  total: number
  testId?: string
}

export function DisabilityFlagBanner({
  percentage,
  headcount,
  total,
  testId = 'disability-flag-banner',
}: DisabilityFlagBannerProps) {
  return (
    <div
      aria-live="assertive"
      className="mb-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
      data-testid={testId}
      role="alert"
    >
      <strong>Disability representation below 3% threshold</strong>
      <p className="mt-1">
        Current representation: {percentage.toFixed(2)}% ({headcount} of {total} employees).
        Designated employers must reach 3% representation of persons with disabilities (EEA s27,
        rule_eea_013). This notice cannot be dismissed.
      </p>
    </div>
  )
}
