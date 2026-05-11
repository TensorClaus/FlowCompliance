/**
 * FIELD_LABELS — human-readable labels for EEA form fieldPaths.
 *
 * Keys are dot-notation fieldPath values stored on EEAEvent records.
 * Values are display labels for the audit history UI.
 *
 * Sections A–H of the EEA2 annual report are represented below.
 * If a fieldPath is absent from this map, the raw fieldPath is shown
 * as a fallback (see TimelineEntry).
 */
export const FIELD_LABELS: Record<string, string> = {
  // ── Section A — Employer details ──────────────────────────────────────────
  'sectionA.tradingName': 'Trading name',
  'sectionA.registeredName': 'Registered name',
  'sectionA.registrationNumber': 'Company registration number',
  'sectionA.reportingPeriod.from': 'Reporting period start',
  'sectionA.reportingPeriod.to': 'Reporting period end',
  'sectionA.province': 'Province',
  'sectionA.sector': 'Sector',
  'sectionA.totalEmployees': 'Total employees',

  // ── Section B — Workforce profile (Table 1.1) ─────────────────────────────
  'sectionB.targetsAchieved': 'Annual targets achieved',
  'sectionB.table1_1.topManagement': 'Table 1.1 — Top Management',
  'sectionB.table1_1.seniorManagement': 'Table 1.1 — Senior Management',
  'sectionB.table1_1.professionallyQualified': 'Table 1.1 — Professionally Qualified',
  'sectionB.table1_1.skilledTechnical': 'Table 1.1 — Skilled Technical',
  'sectionB.table1_1.semiSkilled': 'Table 1.1 — Semi-Skilled',
  'sectionB.table1_1.unskilled': 'Table 1.1 — Unskilled',
  'sectionB.table1_1.disability': 'Table 1.1 — Persons with Disabilities',

  // ── Section C — Numerical goals ───────────────────────────────────────────
  'sectionC.numericalGoals': 'Numerical goals (Section C)',
  'sectionC.justifiableReasons.topManagement': 'Justifiable reasons — Top Management',
  'sectionC.justifiableReasons.seniorManagement': 'Justifiable reasons — Senior Management',

  // ── Section D — Affirmative action measures ───────────────────────────────
  'sectionD.recruitmentMeasures': 'Recruitment AA measures',
  'sectionD.retentionMeasures': 'Retention AA measures',
  'sectionD.trainingMeasures': 'Training and development measures',
  'sectionD.reasonableAccommodation': 'Reasonable accommodation measures',

  // ── Section E — Monitoring ────────────────────────────────────────────────
  'sectionE.monitoringFrequency': 'Monitoring frequency',
  'sectionE.lastMonitoringDate': 'Last monitoring date',

  // ── Section F — Consultation ──────────────────────────────────────────────
  'sectionF.consultationDate': 'Consultation date',
  'sectionF.consultationMechanism': 'Consultation mechanism',
  'sectionF.employeeRepresentatives': 'Employee representatives consulted',

  // ── Section G — Barriers analysis ────────────────────────────────────────
  'sectionG.barriersAnalysisDate': 'Barriers analysis date',
  'sectionG.barriers': 'Identified barriers',

  // ── Section H — CEO declaration ───────────────────────────────────────────
  'sectionH.ceoName': 'CEO name',
  'sectionH.ceoDesignation': 'CEO designation',
  'sectionH.declarationDate': 'Declaration date',
  'sectionH.signatureDataUrl': 'CEO signature',

  // ── PII / sensitive fields (labels shown; values guarded by TimelineEntry) ─
  gender: 'Gender',
  race: 'Race',
  disability: 'Disability status',
  disabilityNature: 'Nature of disability',
  signatureDataUrl: 'Signature',
  medianRemuneration: 'Median remuneration',

  // ── EEA4 income differential ──────────────────────────────────────────────
  'eea4.giniCoefficient': 'Gini coefficient',
  'eea4.averageRemunerationRatio': 'Average remuneration ratio',
  'eea4.medianRemunerationRatio': 'Median remuneration ratio',

  // ── Workflow / lifecycle ──────────────────────────────────────────────────
  formStatus: 'Form status',
  submissionReference: 'DoL submission reference',
} as const
