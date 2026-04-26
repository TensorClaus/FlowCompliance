export interface GoldenFixture {
  name: string
  input: string
  expected: string // exact expected output after sanitise()
  stripCount: number
  suppressedCells: number
}

export const GOLDEN_FIXTURES: GoldenFixture[] = [
  {
    name: 'SA ID number',
    input: 'Employee 9001015009087 joined today',
    expected: 'Employee [SA_ID_REDACTED] joined today',
    stripCount: 1,
    suppressedCells: 0,
  },
  {
    name: 'Email address',
    input: 'Send to john.doe@simplifi.co.za for review',
    expected: 'Send to [EMAIL_REDACTED] for review',
    stripCount: 1,
    suppressedCells: 0,
  },
  {
    name: 'SA phone +27',
    input: 'Call +27821234567 to confirm',
    expected: 'Call [PHONE_REDACTED] to confirm',
    stripCount: 1,
    suppressedCells: 0,
  },
  {
    name: 'SA phone 0xx',
    input: 'Reach us on 0821234567',
    expected: 'Reach us on [PHONE_REDACTED]',
    stripCount: 1,
    suppressedCells: 0,
  },
  {
    name: 'Data URL',
    input: 'Signature: data:image/png;base64,iVBORw0KGgo=',
    expected: 'Signature: [DATA_URL_REDACTED]',
    stripCount: 1,
    suppressedCells: 0,
  },
  {
    name: 'Title-case name (2 words)',
    input: 'Manager John Smith approved the form',
    expected: 'Manager [NAME_REDACTED] approved the form',
    stripCount: 1,
    suppressedCells: 0,
  },
  {
    name: 'Numeric suppression <=3 cells',
    input: 'African Female: 2, African Male: 1, Coloured Female: 3',
    expected:
      'African Female: [SUPPRESSED], African Male: [SUPPRESSED], Coloured Female: [SUPPRESSED]',
    stripCount: 0,
    suppressedCells: 3,
  },
  {
    name: 'Numeric value above suppression threshold not suppressed',
    input: 'Total employees: 47',
    expected: 'Total employees: 47',
    stripCount: 0,
    suppressedCells: 0,
  },
  {
    name: 'Mixed PII -- ID + email in same string',
    input: 'ID 8001015009087 registered as user@example.com',
    expected: 'ID [SA_ID_REDACTED] registered as [EMAIL_REDACTED]',
    stripCount: 2,
    suppressedCells: 0,
  },
  {
    name: 'Empty string',
    input: '',
    expected: '',
    stripCount: 0,
    suppressedCells: 0,
  },
]
