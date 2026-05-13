/**
 * PII_FIELD_PATHS — exhaustive list of EEA event fieldPath values that contain
 * personally identifiable information under POPIA s.1 definitions.
 *
 * These paths correspond to fields that carry individual employee demographic
 * data (race, gender, disability status, salary, citizenship) stored on EEA
 * form field paths in the event stream.
 *
 * SECURITY: This list is server-side only. Before sending any EEAEvent over
 * the wire, prevValue and newValue MUST be nulled for any event whose
 * fieldPath appears in this list. Raw values must never leave the API server.
 *
 * @see POPIA s.1 — definition of personal information
 * @see rule_eea_006 — designated group classification obligations
 * @see rule_eea_018 — income differential report (EEA4)
 * @see rule_eea_019 — Gini coefficient income data
 */
export const PII_FIELD_PATHS: readonly string[] = [
  // EEA1 — individual employee declarations (race, gender, disability, citizenship)
  'race',
  'gender',
  'disability',
  'disabilityCategory',
  'citizenship',
  'nationalId',
  'passportNumber',
  'dateOfBirth',
  'employeeId',
  'employeeName',
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phone',
  'address',

  // EEA4 — individual salary / CTC data per employee
  'salary',
  'ctc',
  'annualCTC',
  'monthlyCtc',
  'basicSalary',
  'totalRemuneration',
  'remunerationAmount',
  'incomeAmount',
  'payrollRef',

  // EEA1 declaration form personal details section
  'personalDetails.race',
  'personalDetails.gender',
  'personalDetails.disability',
  'personalDetails.disabilityCategory',
  'personalDetails.citizenship',
  'personalDetails.nationalId',
  'personalDetails.passportNumber',
  'personalDetails.dateOfBirth',
  'personalDetails.firstName',
  'personalDetails.lastName',
  'personalDetails.fullName',
  'personalDetails.email',
  'personalDetails.phone',

  // Remuneration paths nested inside EEA4 sections
  'sectionD.salary',
  'sectionD.ctc',
  'sectionD.annualCTC',
  'sectionD.monthlyCtc',
  'sectionD.basicSalary',
  'sectionD.totalRemuneration',
  'sectionD.remunerationAmount',
  'sectionD.incomeAmount',
]
