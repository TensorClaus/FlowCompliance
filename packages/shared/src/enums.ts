import { z } from 'zod'

/**
 * Occupational level classification for employees
 * Level 7 represents Non-Permanent/Temporary employees
 * Used in employment equity reporting and compliance tracking
 */
export const OccupationalLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
])
export type OccupationalLevel = z.infer<typeof OccupationalLevelSchema>

/**
 * Race classification codes for employment equity purposes
 * A = African/Black, C = Coloured, I = Indian/Asian, W = White
 * Required for regulatory compliance in South Africa
 */
export const RaceCodeSchema = z.enum(['A', 'C', 'I', 'W'])
export type RaceCode = z.infer<typeof RaceCodeSchema>

/**
 * Gender classification for employment equity tracking
 * M = Male, F = Female
 */
export const GenderCodeSchema = z.enum(['M', 'F'])
export type GenderCode = z.infer<typeof GenderCodeSchema>

/**
 * Designation status for employment equity compliance
 * designated: Designated group member
 * non_designated: Non-designated group member
 * foreign_national: Foreign national employee
 * non_disclosure: Employee chose not to disclose
 */
export const DesignationStatusSchema = z.enum([
  'designated',
  'non_designated',
  'foreign_national',
  'non_disclosure',
])
export type DesignationStatus = z.infer<typeof DesignationStatusSchema>

/**
 * Business entity type classification
 * Used to categorize the organizational structure for compliance purposes
 */
export const BusinessTypeSchema = z.enum([
  'sole_proprietor',
  'partnership',
  'close_corporation',
  'private_company',
  'public_company',
  'organ_of_state',
  'other',
])
export type BusinessType = z.infer<typeof BusinessTypeSchema>

/**
 * South African provinces
 * All nine provinces required for geographical compliance tracking
 */
export const ProvinceSchema = z.enum([
  'eastern_cape',
  'free_state',
  'gauteng',
  'kwazulu_natal',
  'limpopo',
  'mpumalanga',
  'north_west',
  'northern_cape',
  'western_cape',
])
export type Province = z.infer<typeof ProvinceSchema>

/**
 * EEA Form submission and processing status
 * draft: Form created but not finalized
 * pending_ceo: Awaiting CEO/Director signature
 * signed: Signed by authorized representative
 * submitted: Submitted to Department of Employment and Labour
 */
export const EEAFormStatusSchema = z.enum(['draft', 'pending_ceo', 'signed', 'submitted'])
export type EEAFormStatus = z.infer<typeof EEAFormStatusSchema>

/**
 * Monitoring frequency for compliance tracking
 * Defines how often employment equity metrics must be reviewed
 */
export const MonitoringFrequencySchema = z.enum(['monthly', 'quarterly'])
export type MonitoringFrequency = z.infer<typeof MonitoringFrequencySchema>

/**
 * EEA form types for different compliance scenarios
 * EEA1: Initial equity plan
 * EEA2: Annual employment equity report
 * EEA4: Provisional exemption application
 * EEA12: Skills development report
 * EEA13: Designated employer notification
 * EEA14: Equity plan amendment
 */
export const FormTypeSchema = z.enum(['EEA1', 'EEA2', 'EEA4', 'EEA12', 'EEA13', 'EEA14'])
export type FormType = z.infer<typeof FormTypeSchema>

/**
 * Employment Equity Plan scope classification
 * national: Plan covers all operations nationally
 * provincial: Plan covers specific provincial operation(s)
 */
export const EAPTypeSchema = z.enum(['national', 'provincial'])
export type EAPType = z.infer<typeof EAPTypeSchema>

/**
 * Employee count band for statistical reporting
 * Used to categorize employer size for compliance purposes
 */
export const EmployeeCountBandSchema = z.enum(['1-49', '50-149', '150+'])
export type EmployeeCountBand = z.infer<typeof EmployeeCountBandSchema>

/**
 * Termination reason classification for EEA2 Section C
 * Used to track and analyze reasons for employment terminations
 * resignation: Employee voluntarily left
 * dismissal_misconduct: Dismissed due to misconduct
 * dismissal_incapacity: Dismissed due to incapacity/performance
 * retrenchment: Dismissed due to operational requirements
 * retirement: Employee reached retirement age or chose to retire
 * death: Employee deceased
 * end_of_contract: Fixed-term contract ended
 * other: Other reason not listed above
 */
export const TerminationReasonSchema = z.enum([
  'resignation',
  'dismissal_misconduct',
  'dismissal_incapacity',
  'retrenchment',
  'retirement',
  'death',
  'end_of_contract',
  'other',
])
export type TerminationReason = z.infer<typeof TerminationReasonSchema>
