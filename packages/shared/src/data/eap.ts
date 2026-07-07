/**
 * Economically Active Population (EAP) data from StatsSA Quarterly Labour
 * Force Survey (QLFS), Q1 2026 (Statistical release P0211), sheet "EAP".
 * Source: https://www.statssa.gov.za/publications/P0211/Economically%20active%20population%20QLFS%20Q1%202026.xlsx
 * Index page: https://www.statssa.gov.za/?page_id=1854&PPN=P0211
 *
 * EAP data is used by designated employers to set numerical goals under EEA
 * s.20, comparing their workforce profile against the economically active
 * population by province, race and gender.
 *
 * NOTE (quarter-currency discrepancy — see 02-RESEARCH.md Open Question 1):
 * The Employment Equity Regulations, 2025 (Regulation Gazette No. 10177,
 * gazetted 15 April 2025) direct designated employers to use "the Labour
 * Force Survey of the third quarter" for EE reporting purposes (EEA8/EEA12
 * instructions), and the CEE 25th Annual Report (2024/25) cites "QLFS
 * Quarter 3, 2024" as its own EAP source. This dataset instead pins the
 * NEWEST verified StatsSA release (Q1 2026) per this phase's "use the latest
 * verifiable release" discipline (mirroring Phase 1's gazette-currency
 * check). Phase 7/8 consumers wiring this dataset to EEA12/EEA13 MUST
 * confirm which quarter a given EE reporting cycle actually requires before
 * assuming Q1 2026 is a drop-in substitute for the Q3-of-reporting-year
 * figure DoL practice currently references.
 *
 * EAP is published by province, population group (race) and gender ONLY —
 * no authoritative source (StatsSA QLFS, the CEE Annual Report, or the
 * binding EE Regulations / EEA8 / EEA9 / EEA12 / EEA13) breaks EAP down by
 * EEA occupational level. See 02-RESEARCH.md Summary for the full sourcing
 * chain (three independent lines of evidence). This dataset therefore has NO
 * occupationalLevel dimension — do not add one without a newly located,
 * cited source.
 *
 * SCAFFOLD ONLY (this commit): this is the shape-reconciliation commit only.
 * All 80 EAP_DATA numeric fields below are zero placeholders — no real
 * StatsSA values have been transcribed yet. Real cited values are loaded in
 * the immediately-following commit under the never-synthesize regime (shape
 * first, values second, so the shape diff itself carries zero statistical
 * values for review purposes).
 *
 * The QLFS "Occupation" sheet (SASCO occupational categories, national-only)
 * is deliberately NOT transcribed here: no official crosswalk exists between
 * SASCO's 11 categories and the EEA's occupational levels (02-RESEARCH.md
 * Open Question 2, resolved: omit).
 *
 * Reference rules: rule_eea_005, rule_eea_008, rule_eea_009
 * (see eea-patterns.md)
 *
 * No runtime dependencies — pure static data and derived types only.
 */

import { RACE_LABELS, GENDER_LABELS } from './constants.js'

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

/** StatsSA QLFS release identifier for this dataset. */
export const EAP_VERSION = 'QLFS-2026Q1' as const

const SOURCE = 'StatsSA QLFS Q1 2026 (P0211)'
const QUARTER = 'QLFS-2026Q1'

// ---------------------------------------------------------------------------
// Provinces
// ---------------------------------------------------------------------------

/**
 * All nine South African provinces plus the "National" aggregate.
 * Display-name strings used in EAP reporting (distinct from the Zod
 * ProvinceSchema enum in enums.ts which uses underscore keys).
 */
export const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape',
  'National',
] as const

/**
 * Display-name province type derived from PROVINCES.
 * Named EapProvince to avoid collision with the Zod-based Province enum
 * (underscore keys) exported from enums.ts.
 */
export type EapProvince = (typeof PROVINCES)[number]

// ---------------------------------------------------------------------------
// EapDataPoint interface
// ---------------------------------------------------------------------------

/**
 * A single EAP data point representing the economically active population
 * for a specific combination of province, race and gender.
 *
 * No occupationalLevel dimension: no authoritative source publishes EAP
 * broken down by EEA occupational level (see file-level doc comment above).
 *
 * `economicallyActivePct` is DERIVED (not a direct source cell): this
 * cell's economicallyActiveThousands divided by the province's total
 * economically active thousands, times 100. See 02-02-PLAN.md for the
 * per-cell derivation and citation when real values are transcribed.
 */
export interface EapDataPoint {
  /** Province (or "National" for the aggregate). */
  readonly province: EapProvince
  /** Race label: 'African', 'Coloured', 'Indian/Asian', or 'White'. */
  readonly race: string
  /** Gender label: 'Male' or 'Female'. */
  readonly gender: string
  /** Derived share of the province's total economically active population (0-100 scale). */
  readonly economicallyActivePct: number
  /** QLFS "Economically active" column value, in thousands. */
  readonly economicallyActiveThousands: number
  /** QLFS "Employed" column value, in thousands. */
  readonly employedThousands: number
  /** QLFS "Unemployed" column value, in thousands. */
  readonly unemployedThousands: number
  /** Source dataset identifier. */
  readonly source: string
  /** Survey quarter identifier, e.g. 'QLFS-2026Q1'. */
  readonly quarter: string
}

// ---------------------------------------------------------------------------
// EAP_DATA — primary data constant
// ---------------------------------------------------------------------------

/**
 * 80 zero-scaffold data points (10 geographies x 4 races x 2 genders, no
 * occupational-level dimension). SCAFFOLD ONLY in this commit — every
 * numeric field is 0. Real cited StatsSA QLFS Q1 2026 values are loaded in
 * the immediately-following commit, replacing this scaffold under the
 * never-synthesize regime (shape first, values second).
 */
export const EAP_DATA: readonly EapDataPoint[] = [
  // -------------------------------------------------------------------------
  // Eastern Cape (sheet geography block: "Eastern Cape", rows 23-27)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Eastern Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Eastern Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Eastern Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Eastern Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Eastern Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Eastern Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Eastern Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Eastern Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Free State (sheet geography block: "Free State", rows 37-41)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Free State',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Free State',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Free State',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Free State',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Free State',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Free State',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Free State',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Free State',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Gauteng (sheet geography block: "Gauteng", rows 58-62)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Gauteng',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Gauteng',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Gauteng',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Gauteng',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Gauteng',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Gauteng',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Gauteng',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Gauteng',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // KwaZulu-Natal (sheet geography block: "KwaZulu-Natal", rows 44-48)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Limpopo (sheet geography block: "Limpopo", rows 72-76)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Limpopo',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Limpopo',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Limpopo',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Limpopo',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Limpopo',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Limpopo',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Limpopo',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Limpopo',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Mpumalanga (sheet geography block: "Mpumalanga", rows 65-69)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Mpumalanga',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Mpumalanga',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Mpumalanga',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Mpumalanga',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Mpumalanga',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Mpumalanga',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Mpumalanga',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Mpumalanga',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // North West (sheet geography block: "North West", rows 51-55)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'North West',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'North West',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'North West',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'North West',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'North West',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'North West',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'North West',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'North West',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Northern Cape (sheet geography block: "Northern Cape", rows 30-34)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Northern Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Northern Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Northern Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Northern Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Northern Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Northern Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Northern Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Northern Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Western Cape (sheet geography block: "Western cape", rows 16-20)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Western Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Western Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Western Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Western Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Western Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Western Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Western Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'Western Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // National (sheet geography block: "South Africa", rows 9-13)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa".
  // -------------------------------------------------------------------------
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'National',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'National',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'National',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'National',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'National',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'National',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'National',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // SCAFFOLD ONLY — zero placeholder; real value loaded in a follow-up commit under the never-synthesize regime.
    province: 'National',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0,
    economicallyActiveThousands: 0,
    employedThousands: 0,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Returns all EAP data points for a given province.
 *
 * @param province - One of the 10 province display names (including "National").
 */
export function getEapByProvince(province: EapProvince): EapDataPoint[] {
  return EAP_DATA.filter((d) => d.province === province)
}
