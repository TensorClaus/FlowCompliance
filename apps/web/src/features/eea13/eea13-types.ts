import type { NumericalGoal } from '@simplifi/shared'

/**
 * Internal draft types for EEA13 form steps.
 *
 * These are NOT the same as the EEA13Schema Zod types — they are working
 * state shapes used in the WizardFormContext. Final submission validates
 * against EEA13Schema before persistence.
 */

// ---------------------------------------------------------------------------
// Step 1 — Plan Setup
// ---------------------------------------------------------------------------

export interface EEA13PlanSetupData {
  /** GN 6124 sector code (empty string when not yet selected). */
  sectorCode: string
  planPeriod: {
    startDate: string
    endDate: string
  }
  consultation: {
    consultedWithEmployees: boolean
    eecfEstablished: boolean
    consultationDate: string
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Workforce Analysis
// ---------------------------------------------------------------------------

export interface EEA13WorkforceData {
  totalEmployees: number
  designatedEmployees: number
  foreignNationals: number
}

// ---------------------------------------------------------------------------
// Step 3 — Yearly Plans
// ---------------------------------------------------------------------------

/**
 * Draft representation of a PlanYear.
 */
export interface PlanYearDraft {
  year: number
  goals: NumericalGoal[]
  reviewDate: string
  annualBudget: number | undefined
}

export interface EEA13YearlyPlansData {
  entries: PlanYearDraft[]
}

// ---------------------------------------------------------------------------
// Step 5 — Dispute Resolution and Monitoring
// ---------------------------------------------------------------------------

export interface EEA13DisputeMonitoringData {
  internalProcedure: string
  ccmaReferralProcess: string
  labourCourtEscalation: string
  monitoringMechanism: string
}
