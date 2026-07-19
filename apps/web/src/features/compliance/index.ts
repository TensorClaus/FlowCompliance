export { ComplianceCalendar } from './components/compliance-calendar'
export { ComplianceDashboard } from './components/compliance-dashboard'
export { Eea4Report } from './components/eea4-report'
export { SectorTargetBoard } from './components/sector-target-board'
export { WorkforceHeatmap } from './components/workforce-heatmap'
export { DEMO_COMPANY } from './fixtures/demo-company'
export type {
  DemoCompany,
  GiniPoint,
  GroupPay,
  LevelHeadcount,
  LevelRemuneration,
  PayRace,
} from './fixtures/demo-company'
export {
  computeEea4Breakdown,
  computeIncomeDifferentialRatio,
  GINI_ESCALATION_THRESHOLD,
  PAY_GAP_FLAG_THRESHOLD_PCT,
} from './lib/eea4'
export type { Eea4LevelBreakdown, PayGroupRow } from './lib/eea4'
export {
  computeComplianceScore,
  computeLevelRepresentation,
  computePenaltyExposure,
  computeSectorCompliance,
  formatZar,
  getEea2SubmissionWindow,
} from './lib/representation'
export type {
  GapStatus,
  GroupGap,
  GroupKey,
  LevelRepresentation,
  SubmissionWindow,
} from './lib/representation'
