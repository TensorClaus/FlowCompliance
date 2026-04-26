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

// EEA12 — Barriers Analysis, Workforce Profile, EAP Comparison
export type {
  BarrierCategory,
  BarrierSeverity,
  BarrierEntry,
  BarriersAnalysis,
  WorkforceProfileRow,
  WorkforceProfile,
  EapComparisonRow,
  EapComparison,
  EEA12ReportingPeriod,
  EEA12,
} from './schemas/eea12.js'
export {
  BARRIER_CATEGORIES,
  BarrierCategoryEnum,
  BarrierSeveritySchema,
  BarrierEntrySchema,
  BarriersAnalysisSchema,
  WorkforceProfileRowSchema,
  WorkforceProfileSchema,
  EapComparisonRowSchema,
  EapComparisonSchema,
  EEA12ReportingPeriodSchema,
  EEA12Schema,
} from './schemas/eea12.js'

// EEA13 — 5-Year Employment Equity Plan with Numerical Goals
export type {
  NumericalGoal,
  PlanYear,
  BarriersRemovalPlan,
  DisputeResolution,
  EEA13,
} from './schemas/eea13.js'
export {
  SectorCodeSchema,
  DesignatedGroupCodeSchema,
  NumericalGoalSchema,
  PlanYearSchema,
  BarriersRemovalPlanSchema,
  DisputeResolutionSchema,
  EEA13Schema,
} from './schemas/eea13.js'

// EEA14 — DG Notification Return
export type {
  NotificationType,
  SupportingDocument,
  DGNotification,
  EEA14,
} from './schemas/eea14.js'
export {
  NotificationTypeEnum,
  SupportingDocumentSchema,
  DGNotificationSchema,
  EEA14Schema,
} from './schemas/eea14.js'

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

// GN 6124 sector-specific numerical targets
export {
  GN6124_VERSION,
  SECTOR_CODES,
  type SectorCode,
  type DesignatedGroupTarget,
  type SectorTarget,
  SECTOR_TARGETS,
  OCCUPATIONAL_LEVEL_LABELS,
  getSectorTarget,
  getSectorTargetByLevel,
} from './data/sector-targets.js'

// Shared constants — canonical reference data for EEA domain
// Note: BARRIER_CATEGORIES and BarrierCategory are already exported from
// schemas/eea12.js above; DesignationStatus from enums.js above.
// Only the net-new constants are re-exported here.
export {
  OCCUPATIONAL_LEVELS,
  type OccupationalLevelLabel,
  RACE_CODES,
  RACE_LABELS,
  GENDER_CODES,
  GENDER_LABELS,
  DESIGNATION_STATUSES,
  DISABILITY_CATEGORIES,
  type DisabilityCategory,
} from './data/constants.js'

// EAP reference data — StatsSA QLFS
// Note: EapProvince replaces Province to avoid collision with enums.js Province.
export {
  PROVINCES,
  type EapProvince,
  type EapDataPoint,
  EAP_DATA,
  getEapByProvince,
  getEapByProvinceAndLevel,
} from './data/eap.js'

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
