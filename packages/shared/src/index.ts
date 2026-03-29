// @simplifi/shared — Zod schemas, TypeScript types, static data

// ─── Core utilities (import these first) ────────────────────────────────────

// Result<T,E> monad
export { ok, err, unwrap, mapResult, mapErr } from './result.js'
export type { Ok, Err, Result } from './result.js'

// Error hierarchy
export {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ExternalServiceError,
} from './errors.js'

// ─── EEA domain ─────────────────────────────────────────────────────────────

// Core enums
export {
  OccupationalLevelSchema,
  type OccupationalLevel,
  RaceCodeSchema,
  type RaceCode,
  GenderCodeSchema,
  type GenderCode,
  DesignationStatusSchema,
  type DesignationStatus,
  BusinessTypeSchema,
  type BusinessType,
  ProvinceSchema,
  type Province,
  EEAFormStatusSchema,
  type EEAFormStatus,
  MonitoringFrequencySchema,
  type MonitoringFrequency,
  FormTypeSchema,
  type FormType,
  EAPTypeSchema,
  type EAPType,
  EmployeeCountBandSchema,
  type EmployeeCountBand,
  TerminationReasonSchema,
  type TerminationReason,
} from './enums.js'

// Employer profile + address
export {
  AddressSchema,
  type Address,
  EmployerProfileSchema,
  type EmployerProfile,
} from './schemas/employer.js'

// Matrix cell types
export {
  MatrixCellSchema,
  type MatrixCell,
  RemunerationCellSchema,
  type RemunerationCell,
  RemBreakdownCellSchema,
  type RemBreakdownCell,
  MatrixRowSchema,
  type MatrixRow,
  RemunerationRowSchema,
  type RemunerationRow,
  RemBreakdownRowSchema,
  type RemBreakdownRow,
  OccupationalMatrixSchema,
  type OccupationalMatrix,
  RemunerationMatrixSchema,
  type RemunerationMatrix,
  RemBreakdownMatrixSchema,
  type RemBreakdownMatrix,
} from './schemas/matrix.js'

// EEA1 — Employee Declaration
export {
  EmployeeDeclarationSchema,
  type EmployeeDeclaration,
  EEA1FormSchema,
  type EEA1Form,
} from './schemas/eea1.js'

// EEA2 — Annual Report
export type {
  DateRange,
  JustifiableReasonsRow,
  JustifiableReasonsTable,
  ConsultationRecord,
  BarrierRecord,
  CEODeclaration,
  SectorTargetRow,
  SectorTargetsTable,
  EEA2Report,
  EEA2Form,
} from './schemas/eea2.js'
export {
  DateRangeSchema,
  JustifiableReasonsRowSchema,
  JustifiableReasonsTableSchema,
  ConsultationRecordSchema,
  BarrierRecordSchema,
  CEODeclarationSchema,
  SectorTargetRowSchema,
  SectorTargetsTableSchema,
  EEA2ReportSchema,
  EEA2FormSchema,
} from './schemas/eea2.js'

// EEA4 — Income Differential Statement
export type { RemunerationGapRange, EEA4Report, EEA4Form } from './schemas/eea4.js'
export { RemunerationGapRangeSchema, EEA4ReportSchema, EEA4FormSchema } from './schemas/eea4.js'

// Event sourcing — events
export {
  EEAEventTypeSchema,
  type EEAEventType,
  EventReasonSchema,
  type EventReason,
  EventSourceSchema,
  type EventSource,
  EventMetadataSchema,
  type EventMetadata,
  EEAEventSchema,
  type EEAEvent,
} from './schemas/events.js'

// Event sourcing — store types
export {
  EventStreamSchema,
  type EventStream,
  ProjectionSchema,
  type Projection,
  SnapshotSchema,
  type Snapshot,
  AppendResultSchema,
  type AppendResult,
  ReplayRequestSchema,
  type ReplayRequest,
} from './schemas/event-store.js'

// Cross-form validation rules
export {
  ValidationSeveritySchema,
  type ValidationSeverity,
  RuleTypeSchema,
  type RuleType,
  ValidationRuleSchema,
  type ValidationRule,
  ValidationResultSchema,
  type ValidationResult,
  ValidationReportSchema,
  type ValidationReport,
  CROSS_FORM_RULES,
} from './schemas/validation-rules.js'
