/**
 * GN 6124 — Employment Equity Act, 1998: Determination of Sectoral
 * Numerical Targets. Government Gazette No. 52514, Regulation Gazette
 * No. 10177, published 15 April 2025 by the Minister of Employment and
 * Labour (Ms N. Meth, MP), under EEA s.15A(1)-(2).
 *
 * These are MANDATORY targets that designated employers must achieve by
 * 2029-12-31 (5-year window; targets are operative from the gazette's
 * publication date, 15 April 2025). Non-compliance attracts penalties
 * under EEA s.65 ranging from R1.5m to R2.7m or 10% of annual turnover.
 *
 * Source (primary): https://www.gov.za/sites/default/files/gcis_document/202504/52514gon6124.pdf
 * Source (cross-verified mirror): https://ee.labour.gov.za/DMISO/SECTOR%20TARGETS%20REGULATION.pdf
 *
 * The gazette's own heading for this data is "1. 5-Year Sectoral Numerical
 * Targets for All Sectors" (under gazette section "2. Sectoral numerical
 * targets") — informally referred to as "Schedule 1" in project docs, which
 * is not the gazette's own term.
 *
 * Reference rules: rule_eea_008, rule_eea_009, rule_eea_024
 * (see eea-patterns.md)
 *
 * This file is pure static data and types — no Zod, no runtime
 * dependencies beyond the OccupationalLevel type from enums.ts.
 */

import type { OccupationalLevel } from '../enums.js'

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

/** Gazette notice identifier and publication date for this target dataset. */
export const GN6124_VERSION = 'GN6124-2025-04-15' as const

// ---------------------------------------------------------------------------
// Sector codes
// ---------------------------------------------------------------------------

/**
 * The 18 sector codes defined in GN 6124 Section 1, "Identification of
 * Economic Sectors" (SIC-aligned). Used to classify designated employers
 * for sector-specific target lookup.
 *
 * Internal kebab/snake-case slugs — not Standard Industrial Classification
 * (SIC) numeric codes. The gazette references SIC codes but does not print
 * them alongside the sector names in the extracted table text.
 */
export const SECTOR_CODES = [
  'accommodation_food_service',
  'administrative_support',
  'agriculture_forestry_fishing',
  'arts_entertainment_recreation',
  'construction',
  'education',
  'electricity_gas',
  'finance_insurance',
  'health_social_work',
  'information_communication',
  'manufacturing',
  'mining_quarrying',
  'professional_scientific_technical',
  'public_administration_defence',
  'real_estate',
  'transport_storage',
  'water_supply',
  'wholesale_retail_trade',
] as const

/** Union type of all valid sector code strings. */
export type SectorCode = (typeof SECTOR_CODES)[number]

// ---------------------------------------------------------------------------
// Target occupational levels (GN 6124 target-setting scope)
// ---------------------------------------------------------------------------

/**
 * The 4 occupational levels for which GN 6124 sets numerical targets —
 * verbatim from the gazette's table preamble: "Top Management, Senior
 * Management, Professionally Qualified and Middle Management, and Skilled
 * Technical levels."
 *
 * IMPORTANT — this is a DIFFERENT scope from the 7-level workforce
 * classification scheme used by EEA1/EEA2 profile capture (see
 * OccupationalLevel in enums.ts and OCCUPATIONAL_LEVEL_LABELS below).
 * GN 6124 sets targets for only the top 4 of those 7 levels; Semi-Skilled,
 * Unskilled, and Non-Permanent (levels 5-7) are outside its target-setting
 * scope and have no gazetted target. Do NOT conflate the two schemes —
 * see 01-RESEARCH.md "Common Pitfall #1".
 */
export const TARGET_OCCUPATIONAL_LEVELS = [
  'top_management',
  'senior_management',
  'professionally_qualified_middle_management',
  'skilled_technical',
] as const

/** Union type of the 4 gazetted target-setting occupational levels. */
export type TargetOccupationalLevel = (typeof TARGET_OCCUPATIONAL_LEVELS)[number]

// ---------------------------------------------------------------------------
// Target interfaces
// ---------------------------------------------------------------------------

/**
 * Percentage targets for designated groups at a single gazetted
 * occupational level, split by gender only. All values are on a 0-100
 * scale.
 *
 * The gazette's "DESIGNATED GROUPS" column targets the aggregate legal
 * category (black people + women + persons with disabilities) split by
 * gender — it does NOT break targets down further by race (African,
 * Coloured, Indian, White). Per gazette clause 3.1, these gender targets
 * are NOT required to sum to 100%, because white non-disabled males and
 * foreign nationals are excluded from both the numerator and the frame
 * of reference.
 */
export interface SectorTargetLevel {
  /** Target percentage for designated-group male employees at this level. */
  readonly designatedGroupMale: number
  /** Target percentage for designated-group female employees at this level. */
  readonly designatedGroupFemale: number
}

/**
 * Full target profile for a single sector: sector metadata, a designated-
 * group gender target for each of the 4 gazetted occupational levels, and
 * one flat sector-wide disability target.
 *
 * The gazette gives ONE disability target per sector (verbatim: "Disability
 * only | All | 3%"), applied across the whole sector — NOT per occupational
 * level — so disabilityTarget lives here as a sibling field, not inside
 * SectorTargetLevel.
 */
export interface SectorTarget {
  readonly sectorCode: SectorCode
  readonly sectorName: string
  readonly targets: Readonly<Record<TargetOccupationalLevel, SectorTargetLevel>>
  /** Flat sector-wide disability target percentage (gazetted at 3% for all sectors). */
  readonly disabilityTarget: number
}

// ---------------------------------------------------------------------------
// Occupational level display names (workforce-classification scheme)
// ---------------------------------------------------------------------------

/**
 * Human-readable labels for occupational levels 1-7 — the workforce-
 * classification scheme used by EEA1/EEA2 profile capture. This is a
 * SEPARATE concern from GN 6124's 4-level target-setting scope above
 * (TargetOccupationalLevel): every employee is classified into one of
 * these 7 levels regardless of whether GN 6124 sets a numerical target
 * for that level. See 01-RESEARCH.md "Common Pitfall #1" — do not shrink
 * this map to 4 keys.
 */
export const OCCUPATIONAL_LEVEL_LABELS: Readonly<Record<OccupationalLevel, string>> = {
  1: 'Top Management',
  2: 'Senior Management',
  3: 'Professionally Qualified',
  4: 'Skilled Technical',
  5: 'Semi-Skilled',
  6: 'Unskilled',
  7: 'Non-Permanent',
} as const

// ---------------------------------------------------------------------------
// SECTOR_TARGETS — the primary data constant
// ---------------------------------------------------------------------------

/**
 * Complete sector target dataset for GN 6124, transcribed from the gazette's
 * "1. 5-Year Sectoral Numerical Targets for All Sectors" table (Gazette No.
 * 52514, 15 April 2025, pages 6-10).
 *
 * Every value below was visually verified against the rendered PDF table for
 * BOTH the primary source (gov.za) and the DEL mirror (ee.labour.gov.za) —
 * not read from `pdftotext` linear output, which interleaves the Male/
 * Female/Total sub-rows unreliably across columns (see 01-RESEARCH.md
 * "Common Pitfall #2"). Both sources render byte-identical table content.
 *
 * DISCREPANCY NOTE vs 01-RESEARCH.md's "Extracted sample values" table: that
 * table's 5 pre-verified values misattributed 3 gender labels — the values
 * 18.6 (Accommodation), 30.0 (Construction), and 27.6 (Human Health) are the
 * gazette's Top Management **Male** targets, not Female, for those sectors
 * (the two disability values, both 3%, were correctly labeled). This was a
 * `pdftotext` linear-extraction artifact in the research phase, not a
 * disagreement between the two source PDFs — both sources independently and
 * unambiguously render "Male" then "Female" then "Total" as the sub-row
 * order beneath each occupational level, confirmed by direct visual
 * rendering of the table (not text extraction) for every one of the 18
 * sectors below. See 01-02-SUMMARY.md for the full resolution record.
 *
 * No cell in this table was ambiguous, blurred, or unreadable on visual
 * inspection — every cell for every sector was legibly rendered in both
 * sources, so there are zero UNVERIFIED cells in this transcription.
 */
export const SECTOR_TARGETS: readonly SectorTarget[] = [
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, "5-Year Sectoral
    // Numerical Targets for All Sectors" table, p.6, column 1.
    sectorCode: 'accommodation_food_service',
    sectorName: 'Accommodation and Food Service Activities',
    targets: {
      // Gazette p.6, Accommodation and Food Service Activities, Top management row.
      top_management: { designatedGroupMale: 18.6, designatedGroupFemale: 38.1 },
      // Gazette p.6, Accommodation and Food Service Activities, Senior Management row.
      senior_management: { designatedGroupMale: 32.2, designatedGroupFemale: 46.1 },
      // Gazette p.6, Accommodation and Food Service Activities, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 38.6,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.6, Accommodation and Food Service Activities, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.6, Accommodation and Food Service Activities, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.6, column 2.
    sectorCode: 'administrative_support',
    sectorName: 'Administrative and Support Activities',
    targets: {
      // Gazette p.6, Administrative and Support Activities, Top management row.
      top_management: { designatedGroupMale: 33.2, designatedGroupFemale: 36.7 },
      // Gazette p.6, Administrative and Support Activities, Senior Management row.
      senior_management: { designatedGroupMale: 42.3, designatedGroupFemale: 43.5 },
      // Gazette p.6, Administrative and Support Activities, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 49.2,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.6, Administrative and Support Activities, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.6, Administrative and Support Activities, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.6, column 3.
    sectorCode: 'agriculture_forestry_fishing',
    sectorName: 'Agriculture, Forestry & Fishing',
    targets: {
      // Gazette p.6, Agriculture, Forestry & Fishing, Top management row.
      top_management: { designatedGroupMale: 13.2, designatedGroupFemale: 20.8 },
      // Gazette p.6, Agriculture, Forestry & Fishing, Senior Management row.
      senior_management: { designatedGroupMale: 21.6, designatedGroupFemale: 31 },
      // Gazette p.6, Agriculture, Forestry & Fishing, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 34.7,
        designatedGroupFemale: 41.7,
      },
      // Gazette p.6, Agriculture, Forestry & Fishing, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 44 },
    },
    // Gazette p.6, Agriculture, Forestry & Fishing, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.6, column 4.
    sectorCode: 'arts_entertainment_recreation',
    sectorName: 'Arts, Entertainment and Recreation',
    targets: {
      // Gazette p.6, Arts, Entertainment and Recreation, Top management row.
      top_management: { designatedGroupMale: 35.1, designatedGroupFemale: 33.5 },
      // Gazette p.6, Arts, Entertainment and Recreation, Senior Management row.
      senior_management: { designatedGroupMale: 40.3, designatedGroupFemale: 43.8 },
      // Gazette p.6, Arts, Entertainment and Recreation, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 49.8,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.6, Arts, Entertainment and Recreation, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.6, Arts, Entertainment and Recreation, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.7, column 1.
    sectorCode: 'construction',
    sectorName: 'Construction',
    targets: {
      // Gazette p.7, Construction, Top management row.
      top_management: { designatedGroupMale: 30, designatedGroupFemale: 24.8 },
      // Gazette p.7, Construction, Senior Management row.
      senior_management: { designatedGroupMale: 38.3, designatedGroupFemale: 27.8 },
      // Gazette p.7, Construction, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 46.7,
        designatedGroupFemale: 34.4,
      },
      // Gazette p.7, Construction, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.7, Construction, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.7, column 2.
    sectorCode: 'education',
    sectorName: 'Education',
    targets: {
      // Gazette p.7, Education, Top management row.
      top_management: { designatedGroupMale: 27.6, designatedGroupFemale: 46.1 },
      // Gazette p.7, Education, Senior Management row.
      senior_management: { designatedGroupMale: 30.5, designatedGroupFemale: 46.1 },
      // Gazette p.7, Education, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 43,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.7, Education, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.7, Education, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.7, column 3.
    sectorCode: 'electricity_gas',
    sectorName: 'Electricity, Gas, Steam and Air Conditioning Supply',
    targets: {
      // Gazette p.7, Electricity, Gas, Steam and Air Conditioning Supply, Top management row.
      top_management: { designatedGroupMale: 31.7, designatedGroupFemale: 27.9 },
      // Gazette p.7, Electricity, Gas, Steam and Air Conditioning Supply, Senior Management row.
      senior_management: { designatedGroupMale: 42.7, designatedGroupFemale: 39.5 },
      // Gazette p.7, Electricity, Gas, Steam and Air Conditioning Supply, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 49.8,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.7, Electricity, Gas, Steam and Air Conditioning Supply, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.7, Electricity, Gas, Steam and Air Conditioning Supply, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.7, column 4.
    sectorCode: 'finance_insurance',
    sectorName: 'Financial and Insurance Activities',
    targets: {
      // Gazette p.7, Financial and Insurance Activities, Top management row.
      top_management: { designatedGroupMale: 27.8, designatedGroupFemale: 35.3 },
      // Gazette p.7, Financial and Insurance Activities, Senior Management row.
      senior_management: { designatedGroupMale: 31.7, designatedGroupFemale: 45.3 },
      // Gazette p.7, Financial and Insurance Activities, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 40.7,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.7, Financial and Insurance Activities, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.5, designatedGroupFemale: 46.1 },
    },
    // Gazette p.7, Financial and Insurance Activities, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.8, column 1.
    sectorCode: 'health_social_work',
    sectorName: 'Human Health and Social Work Activities',
    targets: {
      // Gazette p.8, Human Health and Social Work Activities, Top management row.
      top_management: { designatedGroupMale: 27.6, designatedGroupFemale: 43.7 },
      // Gazette p.8, Human Health and Social Work Activities, Senior Management row.
      senior_management: { designatedGroupMale: 39.8, designatedGroupFemale: 46.1 },
      // Gazette p.8, Human Health and Social Work Activities, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 49.8,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.8, Human Health and Social Work Activities, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.8, Human Health and Social Work Activities, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.8, column 2.
    sectorCode: 'information_communication',
    sectorName: 'Information and Communication',
    targets: {
      // Gazette p.8, Information and Communication, Top management row.
      top_management: { designatedGroupMale: 25.4, designatedGroupFemale: 31.2 },
      // Gazette p.8, Information and Communication, Senior Management row.
      senior_management: { designatedGroupMale: 28.6, designatedGroupFemale: 40 },
      // Gazette p.8, Information and Communication, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 37.9,
        designatedGroupFemale: 38.9,
      },
      // Gazette p.8, Information and Communication, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 46, designatedGroupFemale: 45.7 },
    },
    // Gazette p.8, Information and Communication, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.8, column 3.
    sectorCode: 'manufacturing',
    sectorName: 'Manufacturing',
    targets: {
      // Gazette p.8, Manufacturing, Top management row.
      top_management: { designatedGroupMale: 24.1, designatedGroupFemale: 25 },
      // Gazette p.8, Manufacturing, Senior Management row.
      senior_management: { designatedGroupMale: 32.4, designatedGroupFemale: 33.6 },
      // Gazette p.8, Manufacturing, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 40.4,
        designatedGroupFemale: 37.7,
      },
      // Gazette p.8, Manufacturing, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 39.6 },
    },
    // Gazette p.8, Manufacturing, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.8, column 4.
    sectorCode: 'mining_quarrying',
    sectorName: 'Mining and Quarrying',
    targets: {
      // Gazette p.8, Mining and Quarrying, Top management row.
      top_management: { designatedGroupMale: 33.1, designatedGroupFemale: 24.4 },
      // Gazette p.8, Mining and Quarrying, Senior Management row.
      senior_management: { designatedGroupMale: 36.3, designatedGroupFemale: 28.2 },
      // Gazette p.8, Mining and Quarrying, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 43.2,
        designatedGroupFemale: 34.4,
      },
      // Gazette p.8, Mining and Quarrying, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 36.9 },
    },
    // Gazette p.8, Mining and Quarrying, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.9, column 1.
    sectorCode: 'professional_scientific_technical',
    sectorName: 'Professional, Scientific and Technical Activities',
    targets: {
      // Gazette p.9, Professional, Scientific and Technical Activities, Top management row.
      top_management: { designatedGroupMale: 24.4, designatedGroupFemale: 38.1 },
      // Gazette p.9, Professional, Scientific and Technical Activities, Senior Management row.
      senior_management: { designatedGroupMale: 29.9, designatedGroupFemale: 46.1 },
      // Gazette p.9, Professional, Scientific and Technical Activities, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 35.9,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.9, Professional, Scientific and Technical Activities, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.9, Professional, Scientific and Technical Activities, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.9, column 2.
    sectorCode: 'public_administration_defence',
    sectorName: 'Public Administration and Defence; Compulsory Social Security',
    targets: {
      // Gazette p.9, Public Administration and Defence; Compulsory Social Security, Top management row.
      top_management: { designatedGroupMale: 49.8, designatedGroupFemale: 41.9 },
      // Gazette p.9, Public Administration and Defence; Compulsory Social Security, Senior Management row.
      senior_management: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
      // Gazette p.9, Public Administration and Defence; Compulsory Social Security, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 49.8,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.9, Public Administration and Defence; Compulsory Social Security, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.9, Public Administration and Defence; Compulsory Social Security, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.9, column 3.
    sectorCode: 'real_estate',
    sectorName: 'Real Estate Activities',
    targets: {
      // Gazette p.9, Real Estate Activities, Top management row.
      top_management: { designatedGroupMale: 18.9, designatedGroupFemale: 30.3 },
      // Gazette p.9, Real Estate Activities, Senior Management row.
      senior_management: { designatedGroupMale: 22.9, designatedGroupFemale: 46.1 },
      // Gazette p.9, Real Estate Activities, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 32.4,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.9, Real Estate Activities, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 38.3, designatedGroupFemale: 46.1 },
    },
    // Gazette p.9, Real Estate Activities, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.9, column 4.
    sectorCode: 'transport_storage',
    sectorName: 'Transportation and Storage',
    targets: {
      // Gazette p.9, Transportation and Storage, Top management row.
      top_management: { designatedGroupMale: 32.2, designatedGroupFemale: 30 },
      // Gazette p.9, Transportation and Storage, Senior Management row.
      senior_management: { designatedGroupMale: 42.1, designatedGroupFemale: 35.9 },
      // Gazette p.9, Transportation and Storage, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 46.3,
        designatedGroupFemale: 40.7,
      },
      // Gazette p.9, Transportation and Storage, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 41.4 },
    },
    // Gazette p.9, Transportation and Storage, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.10, column 1.
    sectorCode: 'water_supply',
    sectorName: 'Water Supply, Sewerage, Waste Management and Remediation Activities',
    targets: {
      // Gazette p.10, Water Supply, Sewerage, Waste Management and Remediation Activities, Top management row.
      top_management: { designatedGroupMale: 49.8, designatedGroupFemale: 35.9 },
      // Gazette p.10, Water Supply, Sewerage, Waste Management and Remediation Activities, Senior Management row.
      senior_management: { designatedGroupMale: 49.8, designatedGroupFemale: 41 },
      // Gazette p.10, Water Supply, Sewerage, Waste Management and Remediation Activities, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 49.8,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.10, Water Supply, Sewerage, Waste Management and Remediation Activities, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 49.8, designatedGroupFemale: 46.1 },
    },
    // Gazette p.10, Water Supply, Sewerage, Waste Management and Remediation Activities, "Disability only | All" row.
    disabilityTarget: 3,
  },
  {
    // Source: Gazette No. 52514, 15 Apr 2025, GN 6124, table p.10, column 2.
    sectorCode: 'wholesale_retail_trade',
    sectorName: 'Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles',
    targets: {
      // Gazette p.10, Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles, Top management row.
      top_management: { designatedGroupMale: 24.2, designatedGroupFemale: 27.5 },
      // Gazette p.10, Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles, Senior Management row.
      senior_management: { designatedGroupMale: 35, designatedGroupFemale: 38.6 },
      // Gazette p.10, Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles, Professionally Qualified & Middle Management row.
      professionally_qualified_middle_management: {
        designatedGroupMale: 42.2,
        designatedGroupFemale: 46.1,
      },
      // Gazette p.10, Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles, Skilled Technical row.
      skilled_technical: { designatedGroupMale: 48.1, designatedGroupFemale: 46.1 },
    },
    // Gazette p.10, Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles, "Disability only | All" row.
    disabilityTarget: 3,
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the full target profile for a given sector.
 *
 * @param sectorCode - One of the 18 GN 6124 sector codes.
 * @returns The matching SectorTarget, or undefined if not found.
 */
export function getSectorTarget(sectorCode: SectorCode): SectorTarget | undefined {
  return SECTOR_TARGETS.find((t) => t.sectorCode === sectorCode)
}

/**
 * Retrieve the designated-group gender target for a specific sector and
 * gazetted target occupational level.
 *
 * @param sectorCode - One of the 18 GN 6124 sector codes.
 * @param level - One of the 4 gazetted target occupational levels.
 * @returns The matching SectorTargetLevel, or undefined if sector not found.
 */
export function getSectorTargetByLevel(
  sectorCode: SectorCode,
  level: TargetOccupationalLevel,
): SectorTargetLevel | undefined {
  const sector = getSectorTarget(sectorCode)
  if (!sector) return undefined
  return sector.targets[level]
}
