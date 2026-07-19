/**
 * Economically Active Population (EAP) data from StatsSA Quarterly Labour
 * Force Survey (QLFS), Q1 2026 (Statistical release P0211), sheet "EAP".
 * Source: https://www.statssa.gov.za/publications/P0211/Economically%20active%20population%20QLFS%20Q1%202026.xlsx
 * Index page: https://www.statssa.gov.za/?page_id=1854&PPN=P0211
 *
 * WAF note: direct re-fetch of the file URL from this environment returns an
 * Incapsula 212-byte bot-challenge response (HTTP 200, not the file); the
 * verified local artifact (34,796 bytes, valid OOXML, `docProps/core.xml`
 * lastModified 2026-05-12T07:41:19Z) is the authoritative copy used for every
 * value transcribed below (02-02-PLAN.md STEP 0 gate).
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
 * TRANSCRIPTION METHOD (02-02-PLAN.md): programmatic Node extraction from the
 * raw OOXML (unzip + regex cell/shared-string parsing; no npm package), cross
 * -checked by THREE arithmetic identity checks per geography block — (1) NEA
 * + Economically active = Total, (2) Employed + Unemployed = Economically
 * active, (3) Male Total + Female Total = Grand Total — plus a race-row-sum
 * -to-Total-row cross-check, all PASSING for every one of the 10 geography
 * blocks. National grand total confirmed = 42,188.923710376126 thousand
 * (matches the externally-corroborated ~42.2 million EAP figure). The sheet
 * "EAP" row order (verified programmatically; differs slightly from
 * 02-RESEARCH.md's summarized order) is: South Africa (National), Western
 * cape, Eastern Cape, Northern Cape, Free State, KwaZulu-Natal, North West,
 * Gauteng, Mpumalanga, Limpopo. Reliability caveat (StatsSA footnote row 23 /
 * 43, verbatim): "For all values of 10 000 or lower the sample size is too
 * small for reliable estimates" — cells at or below 10.0 thousand carry an
 * inline RELIABILITY CAVEAT comment below.
 *
 * DERIVED vs UNVERIFIED cells: 8 of the 80 points have one blank source cell
 * (Employed or Unemployed) where the OTHER two cited cells in the same row
 * make that value arithmetically certain via Identity 2 (Employed +
 * Unemployed = Economically active) — these are marked DERIVED, not
 * fabricated. 2 points (Free State / Indian/Asian / Female; North West /
 * Indian/Asian / Female) have ALL THREE cells genuinely blank in the source
 * (below the sheet's own reliability threshold) with no cited cell to derive
 * from — these are marked UNVERIFIED and recorded as 0 (the only shape-legal,
 * non-fabricated value; the required interface fields are non-optional
 * numbers, see EapDataPoint below).
 *
 * economicallyActivePct is DERIVED per-point from two cited cells (this
 * point's Economically active thousands / the geography block's Total row,
 * Total-gender-block, Economically active column [N]) x 100 — shown as a
 * formula comment above each point, per 02-RESEARCH.md's "Derived-percentage
 * fields" pattern.
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
// Dataset version
// ---------------------------------------------------------------------------

/**
 * Version identifier for the EAP dataset shipped in this module.
 *
 * PLACEHOLDER: the values below are demographically informed placeholders,
 * NOT licensed StatsSA QLFS figures. The "PLACEHOLDER" prefix is deliberate
 * and load-bearing — consumers persist this string alongside any EAP-derived
 * output so a saved record is auditable against the exact dataset that
 * produced its numbers, and a downstream reviewer can immediately tell the
 * figures were provisional. When the official QLFS Q4 2024 tabulations are
 * licensed and ingested, replace both the data and this identifier (dropping
 * the PLACEHOLDER prefix) in the same commit.
 */
export const EAP_DATASET_VERSION = 'PLACEHOLDER-StatsSA-QLFS-Q4-2024' as const

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
 * 80 cited StatsSA QLFS Q1 2026 data points (10 geographies x 4 races x 2
 * genders), transcribed programmatically from the verified local xlsx
 * artifact and cross-checked by three arithmetic identities per geography
 * block (see file-level doc comment above for the full method and the
 * DERIVED/UNVERIFIED cell policy). Every geography is independently sourced
 * from its own row in the QLFS "EAP" sheet — no stubbed/scaled provinces.
 *
 * Per-point citation comments give the sheet name, geography block label,
 * race row (with row number), gender block, and exact column letters for
 * economicallyActiveThousands / employedThousands / unemployedThousands,
 * plus the economicallyActivePct derivation formula and cited numerator/
 * denominator cells.
 */
export const EAP_DATA: readonly EapDataPoint[] = [
  // -------------------------------------------------------------------------
  // Eastern Cape (sheet geography block: "Eastern Cape", rows 23-27)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape", race row "Black African" (row 23), Male block.
    // Economically active: col D23 = 1036.7191734736589; Employed: col E23 = 550.8584751675373; Unemployed: col F23 = 485.86069830612166.
    // economicallyActivePct = (Economically-active[row 23, col D] / Total-row Economically-active[row 27, col N]) * 100
    //                       = (1036.7191734736589 / 2405.137238909898) * 100 = 43.10436663246462
    province: 'Eastern Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 43.104_366_632_464_62,
    economicallyActiveThousands: 1036.719_173_473_658_9,
    employedThousands: 550.858_475_167_537_3,
    unemployedThousands: 485.860_698_306_121_66,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape", race row "Black African" (row 23), Female block.
    // Economically active: col I23 = 971.1344896921191; Employed: col J23 = 483.62139833481376; Unemployed: col K23 = 487.51309135730537.
    // economicallyActivePct = (Economically-active[row 23, col I] / Total-row Economically-active[row 27, col N]) * 100
    //                       = (971.1344896921191 / 2405.137238909898) * 100 = 40.37750835924337
    province: 'Eastern Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 40.377_508_359_243_37,
    economicallyActiveThousands: 971.134_489_692_119_1,
    employedThousands: 483.621_398_334_813_76,
    unemployedThousands: 487.513_091_357_305_37,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape", race row "Coloured" (row 24), Male block.
    // Economically active: col D24 = 147.07788474620503; Employed: col E24 = 97.98957962688156; Unemployed: col F24 = 49.08830511932346.
    // economicallyActivePct = (Economically-active[row 24, col D] / Total-row Economically-active[row 27, col N]) * 100
    //                       = (147.07788474620503 / 2405.137238909898) * 100 = 6.115155608037838
    province: 'Eastern Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 6.115_155_608_037_838,
    economicallyActiveThousands: 147.077_884_746_205_03,
    employedThousands: 97.989_579_626_881_56,
    unemployedThousands: 49.088_305_119_323_46,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape", race row "Coloured" (row 24), Female block.
    // Economically active: col I24 = 103.99593262855778; Employed: col J24 = 71.02017859376342; Unemployed: col K24 = 32.97575403479436.
    // economicallyActivePct = (Economically-active[row 24, col I] / Total-row Economically-active[row 27, col N]) * 100
    //                       = (103.99593262855778 / 2405.137238909898) * 100 = 4.323908463356245
    province: 'Eastern Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 4.323_908_463_356_245,
    economicallyActiveThousands: 103.995_932_628_557_78,
    employedThousands: 71.020_178_593_763_42,
    unemployedThousands: 32.975_754_034_794_36,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape", race row "Indian/ Asian" (row 25), Male block.
    // Economically active: col D25 = 4.417943982782268; Employed: col E25 = 4.417943982782268; Unemployed: col F25 = 0.
    // DERIVED: Unemployed cell blank in source; Unemployed = Economically-active(col D) - Employed(col E) = 4.417944 - 4.417944 = 0 (Identity 2, forced by two cited cells, not fabricated).
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 25, col D] / Total-row Economically-active[row 27, col N]) * 100
    //                       = (4.417943982782268 / 2405.137238909898) * 100 = 0.1836878125418179
    province: 'Eastern Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.183_687_812_541_817_9,
    economicallyActiveThousands: 4.417_943_982_782_268,
    employedThousands: 4.417_943_982_782_268,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape", race row "Indian/ Asian" (row 25), Female block.
    // Economically active: col I25 = 4.726706086978918; Employed: col J25 = 3.3733821081027573; Unemployed: col K25 = 1.3533239788761615.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 25, col I] / Total-row Economically-active[row 27, col N]) * 100
    //                       = (4.726706086978918 / 2405.137238909898) * 100 = 0.19652542110741447
    province: 'Eastern Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.196_525_421_107_414_47,
    economicallyActiveThousands: 4.726_706_086_978_918,
    employedThousands: 3.373_382_108_102_757_3,
    unemployedThousands: 1.353_323_978_876_161_5,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape", race row "White" (row 26), Male block.
    // Economically active: col D26 = 80.08003972162801; Employed: col E26 = 72.88570510323973; Unemployed: col F26 = 7.194334618388283.
    // economicallyActivePct = (Economically-active[row 26, col D] / Total-row Economically-active[row 27, col N]) * 100
    //                       = (80.08003972162801 / 2405.137238909898) * 100 = 3.329541384421099
    province: 'Eastern Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 3.329_541_384_421_099,
    economicallyActiveThousands: 80.080_039_721_628_01,
    employedThousands: 72.885_705_103_239_73,
    unemployedThousands: 7.194_334_618_388_283,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Eastern Cape", race row "White" (row 26), Female block.
    // Economically active: col I26 = 56.98506857796861; Employed: col J26 = 49.22249396991436; Unemployed: col K26 = 7.762574608054253.
    // economicallyActivePct = (Economically-active[row 26, col I] / Total-row Economically-active[row 27, col N]) * 100
    //                       = (56.98506857796861 / 2405.137238909898) * 100 = 2.3693063188276304
    province: 'Eastern Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 2.369_306_318_827_630_4,
    economicallyActiveThousands: 56.985_068_577_968_61,
    employedThousands: 49.222_493_969_914_36,
    unemployedThousands: 7.762_574_608_054_253,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Free State (sheet geography block: "Free State", rows 37-41)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State", race row "Black African" (row 37), Male block.
    // Economically active: col D37 = 603.3973375771666; Employed: col E37 = 370.2854012632908; Unemployed: col F37 = 233.11193631387582.
    // economicallyActivePct = (Economically-active[row 37, col D] / Total-row Economically-active[row 41, col N]) * 100
    //                       = (603.3973375771666 / 1221.2720920305887) * 100 = 49.407281269639746
    province: 'Free State',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 49.407_281_269_639_746,
    economicallyActiveThousands: 603.397_337_577_166_6,
    employedThousands: 370.285_401_263_290_8,
    unemployedThousands: 233.111_936_313_875_82,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State", race row "Black African" (row 37), Female block.
    // Economically active: col I37 = 505.57302539371005; Employed: col J37 = 294.81670628247264; Unemployed: col K37 = 210.75631911123742.
    // economicallyActivePct = (Economically-active[row 37, col I] / Total-row Economically-active[row 41, col N]) * 100
    //                       = (505.57302539371005 / 1221.2720920305887) * 100 = 41.3972470748187
    province: 'Free State',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 41.397_247_074_818_7,
    economicallyActiveThousands: 505.573_025_393_710_05,
    employedThousands: 294.816_706_282_472_64,
    unemployedThousands: 210.756_319_111_237_42,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State", race row "Coloured" (row 38), Male block.
    // Economically active: col D38 = 15.87668219001242; Employed: col E38 = 11.209058778608066; Unemployed: col F38 = 4.667623411404354.
    // economicallyActivePct = (Economically-active[row 38, col D] / Total-row Economically-active[row 41, col N]) * 100
    //                       = (15.87668219001242 / 1221.2720920305887) * 100 = 1.3000118723432488
    province: 'Free State',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 1.300_011_872_343_248_8,
    economicallyActiveThousands: 15.876_682_190_012_42,
    employedThousands: 11.209_058_778_608_066,
    unemployedThousands: 4.667_623_411_404_354,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State", race row "Coloured" (row 38), Female block.
    // Economically active: col I38 = 9.987652663084326; Employed: col J38 = 5.795939422873866; Unemployed: col K38 = 4.1917132402104595.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 38, col I] / Total-row Economically-active[row 41, col N]) * 100
    //                       = (9.987652663084326 / 1221.2720920305887) * 100 = 0.8178073279704625
    province: 'Free State',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.817_807_327_970_462_5,
    economicallyActiveThousands: 9.987_652_663_084_326,
    employedThousands: 5.795_939_422_873_866,
    unemployedThousands: 4.191_713_240_210_459_5,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State", race row "Indian/ Asian" (row 39), Male block.
    // Economically active: col D39 = 6.622694463704965; Employed: col E39 = 6.622694463704965; Unemployed: col F39 = 0.
    // DERIVED: Unemployed cell blank in source; Unemployed = Economically-active(col D) - Employed(col E) = 6.622694 - 6.622694 = 0 (Identity 2, forced by two cited cells, not fabricated).
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 39, col D] / Total-row Economically-active[row 41, col N]) * 100
    //                       = (6.622694463704965 / 1221.2720920305887) * 100 = 0.5422783757134352
    province: 'Free State',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.542_278_375_713_435_2,
    economicallyActiveThousands: 6.622_694_463_704_965,
    employedThousands: 6.622_694_463_704_965,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State", race row "Indian/ Asian" (row 39), Female block.
    // Economically active: col I39 = <blank in source>; Employed: col J39 = <blank in source>; Unemployed: col K39 = <blank in source>.
    // UNVERIFIED: source cells (Economically active / Employed / Unemployed) are blank for this race-gender row in the sheet (below reliable-estimate threshold per sheet footnote); no cited cell exists to derive a value. Recorded as 0 per shape constraint (non-negative required) — NOT a fabricated positive figure.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 39, col I] / Total-row Economically-active[row 41, col N]) * 100
    //                       = (0 / 1221.2720920305887) * 100 = 0
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
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State", race row "White" (row 40), Male block.
    // Economically active: col D40 = 51.352022286232355; Employed: col E40 = 45.21353876084592; Unemployed: col F40 = 6.1384835253864365.
    // economicallyActivePct = (Economically-active[row 40, col D] / Total-row Economically-active[row 41, col N]) * 100
    //                       = (51.352022286232355 / 1221.2720920305887) * 100 = 4.204797818711325
    province: 'Free State',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 4.204_797_818_711_325,
    economicallyActiveThousands: 51.352_022_286_232_355,
    employedThousands: 45.213_538_760_845_92,
    unemployedThousands: 6.138_483_525_386_436_5,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Free State", race row "White" (row 40), Female block.
    // Economically active: col I40 = 28.46267745667874; Employed: col J40 = 25.949227932311274; Unemployed: col K40 = 2.513449524367468.
    // economicallyActivePct = (Economically-active[row 40, col I] / Total-row Economically-active[row 41, col N]) * 100
    //                       = (28.46267745667874 / 1221.2720920305887) * 100 = 2.330576260803137
    province: 'Free State',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 2.330_576_260_803_137,
    economicallyActiveThousands: 28.462_677_456_678_74,
    employedThousands: 25.949_227_932_311_274,
    unemployedThousands: 2.513_449_524_367_468,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Gauteng (sheet geography block: "Gauteng", rows 58-62)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng", race row "Black African" (row 58), Male block.
    // Economically active: col D58 = 3553.2203224755012; Employed: col E58 = 2347.765322401593; Unemployed: col F58 = 1205.4550000739082.
    // economicallyActivePct = (Economically-active[row 58, col D] / Total-row Economically-active[row 62, col N]) * 100
    //                       = (3553.2203224755012 / 7760.438267563332) * 100 = 45.78633577084252
    province: 'Gauteng',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 45.786_335_770_842_52,
    economicallyActiveThousands: 3553.220_322_475_501_2,
    employedThousands: 2347.765_322_401_593,
    unemployedThousands: 1205.455_000_073_908_2,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng", race row "Black African" (row 58), Female block.
    // Economically active: col I58 = 2942.2136268159657; Employed: col J58 = 1696.3062909765897; Unemployed: col K58 = 1245.907335839376.
    // economicallyActivePct = (Economically-active[row 58, col I] / Total-row Economically-active[row 62, col N]) * 100
    //                       = (2942.2136268159657 / 7760.438267563332) * 100 = 37.91298281585041
    province: 'Gauteng',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 37.912_982_815_850_41,
    economicallyActiveThousands: 2942.213_626_815_965_7,
    employedThousands: 1696.306_290_976_589_7,
    unemployedThousands: 1245.907_335_839_376,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng", race row "Coloured" (row 59), Male block.
    // Economically active: col D59 = 82.24667723015716; Employed: col E59 = 54.849742664047426; Unemployed: col F59 = 27.396934566109728.
    // economicallyActivePct = (Economically-active[row 59, col D] / Total-row Economically-active[row 62, col N]) * 100
    //                       = (82.24667723015716 / 7760.438267563332) * 100 = 1.0598200049335804
    province: 'Gauteng',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 1.059_820_004_933_580_4,
    economicallyActiveThousands: 82.246_677_230_157_16,
    employedThousands: 54.849_742_664_047_426,
    unemployedThousands: 27.396_934_566_109_728,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng", race row "Coloured" (row 59), Female block.
    // Economically active: col I59 = 106.59537371559415; Employed: col J59 = 60.03872430337701; Unemployed: col K59 = 46.55664941221713.
    // economicallyActivePct = (Economically-active[row 59, col I] / Total-row Economically-active[row 62, col N]) * 100
    //                       = (106.59537371559415 / 7760.438267563332) * 100 = 1.3735741467223033
    province: 'Gauteng',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 1.373_574_146_722_303_3,
    economicallyActiveThousands: 106.595_373_715_594_15,
    employedThousands: 60.038_724_303_377_01,
    unemployedThousands: 46.556_649_412_217_13,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng", race row "Indian/ Asian" (row 60), Male block.
    // Economically active: col D60 = 162.90852461065725; Employed: col E60 = 141.9306288955072; Unemployed: col F60 = 20.977895715150055.
    // economicallyActivePct = (Economically-active[row 60, col D] / Total-row Economically-active[row 62, col N]) * 100
    //                       = (162.90852461065725 / 7760.438267563332) * 100 = 2.0992180981784707
    province: 'Gauteng',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 2.099_218_098_178_470_7,
    economicallyActiveThousands: 162.908_524_610_657_25,
    employedThousands: 141.930_628_895_507_2,
    unemployedThousands: 20.977_895_715_150_055,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng", race row "Indian/ Asian" (row 60), Female block.
    // Economically active: col I60 = 113.06184511307382; Employed: col J60 = 93.748686770657; Unemployed: col K60 = 19.31315834241681.
    // economicallyActivePct = (Economically-active[row 60, col I] / Total-row Economically-active[row 62, col N]) * 100
    //                       = (113.06184511307382 / 7760.438267563332) * 100 = 1.456900257626476
    province: 'Gauteng',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 1.456_900_257_626_476,
    economicallyActiveThousands: 113.061_845_113_073_82,
    employedThousands: 93.748_686_770_657,
    unemployedThousands: 19.313_158_342_416_81,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng", race row "White" (row 61), Male block.
    // Economically active: col D61 = 440.6620158110001; Employed: col E61 = 403.18760839933327; Unemployed: col F61 = 37.47440741166685.
    // economicallyActivePct = (Economically-active[row 61, col D] / Total-row Economically-active[row 62, col N]) * 100
    //                       = (440.6620158110001 / 7760.438267563332) * 100 = 5.678313525833404
    province: 'Gauteng',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 5.678_313_525_833_404,
    economicallyActiveThousands: 440.662_015_811_000_1,
    employedThousands: 403.187_608_399_333_27,
    unemployedThousands: 37.474_407_411_666_85,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Gauteng", race row "White" (row 61), Female block.
    // Economically active: col I61 = 359.529881791388; Employed: col J61 = 318.2427393487878; Unemployed: col K61 = 41.287142442600185.
    // economicallyActivePct = (Economically-active[row 61, col I] / Total-row Economically-active[row 62, col N]) * 100
    //                       = (359.529881791388 / 7760.438267563332) * 100 = 4.632855380012903
    province: 'Gauteng',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 4.632_855_380_012_903,
    economicallyActiveThousands: 359.529_881_791_388,
    employedThousands: 318.242_739_348_787_8,
    unemployedThousands: 41.287_142_442_600_185,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // KwaZulu-Natal (sheet geography block: "KwaZulu-Natal", rows 44-48)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal", race row "Black African" (row 44), Male block.
    // Economically active: col D44 = 1812.4165797799603; Employed: col E44 = 1274.2621119841733; Unemployed: col F44 = 538.154467795787.
    // economicallyActivePct = (Economically-active[row 44, col D] / Total-row Economically-active[row 48, col N]) * 100
    //                       = (1812.4165797799603 / 3955.856557195068) * 100 = 45.81603386208394
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 45.816_033_862_083_94,
    economicallyActiveThousands: 1812.416_579_779_960_3,
    employedThousands: 1274.262_111_984_173_3,
    unemployedThousands: 538.154_467_795_787,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal", race row "Black African" (row 44), Female block.
    // Economically active: col I44 = 1747.600185685843; Employed: col J44 = 1103.1461191750793; Unemployed: col K44 = 644.4540665107635.
    // economicallyActivePct = (Economically-active[row 44, col I] / Total-row Economically-active[row 48, col N]) * 100
    //                       = (1747.600185685843 / 3955.856557195068) * 100 = 44.17754184001538
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 44.177_541_840_015_38,
    economicallyActiveThousands: 1747.600_185_685_843,
    employedThousands: 1103.146_119_175_079_3,
    unemployedThousands: 644.454_066_510_763_5,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal", race row "Coloured" (row 45), Male block.
    // Economically active: col D45 = 19.304667579167877; Employed: col E45 = 17.19210010995614; Unemployed: col F45 = 2.112567469211738.
    // economicallyActivePct = (Economically-active[row 45, col D] / Total-row Economically-active[row 48, col N]) * 100
    //                       = (19.304667579167877 / 3955.856557195068) * 100 = 0.4880022139340666
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.488_002_213_934_066_6,
    economicallyActiveThousands: 19.304_667_579_167_877,
    employedThousands: 17.192_100_109_956_14,
    unemployedThousands: 2.112_567_469_211_738,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal", race row "Coloured" (row 45), Female block.
    // Economically active: col I45 = 12.552548152848917; Employed: col J45 = 10.113519211056541; Unemployed: col K45 = 2.439028941792377.
    // economicallyActivePct = (Economically-active[row 45, col I] / Total-row Economically-active[row 48, col N]) * 100
    //                       = (12.552548152848917 / 3955.856557195068) * 100 = 0.3173155540743217
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.317_315_554_074_321_7,
    economicallyActiveThousands: 12.552_548_152_848_917,
    employedThousands: 10.113_519_211_056_541,
    unemployedThousands: 2.439_028_941_792_377,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal", race row "Indian/ Asian" (row 46), Male block.
    // Economically active: col D46 = 153.77963458602855; Employed: col E46 = 131.31312675481175; Unemployed: col F46 = 22.466507831216806.
    // economicallyActivePct = (Economically-active[row 46, col D] / Total-row Economically-active[row 48, col N]) * 100
    //                       = (153.77963458602855 / 3955.856557195068) * 100 = 3.8873915765810083
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 3.887_391_576_581_008_3,
    economicallyActiveThousands: 153.779_634_586_028_55,
    employedThousands: 131.313_126_754_811_75,
    unemployedThousands: 22.466_507_831_216_806,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal", race row "Indian/ Asian" (row 46), Female block.
    // Economically active: col I46 = 89.44281173644923; Employed: col J46 = 78.0290822753923; Unemployed: col K46 = 11.413729461056931.
    // economicallyActivePct = (Economically-active[row 46, col I] / Total-row Economically-active[row 48, col N]) * 100
    //                       = (89.44281173644923 / 3955.856557195068) * 100 = 2.261022624133504
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 2.261_022_624_133_504,
    economicallyActiveThousands: 89.442_811_736_449_23,
    employedThousands: 78.029_082_275_392_3,
    unemployedThousands: 11.413_729_461_056_931,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal", race row "White" (row 47), Male block.
    // Economically active: col D47 = 70.99100799748683; Employed: col E47 = 60.68823512310803; Unemployed: col F47 = 10.3027728743788.
    // economicallyActivePct = (Economically-active[row 47, col D] / Total-row Economically-active[row 48, col N]) * 100
    //                       = (70.99100799748683 / 3955.856557195068) * 100 = 1.7945799341072057
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 1.794_579_934_107_205_7,
    economicallyActiveThousands: 70.991_007_997_486_83,
    employedThousands: 60.688_235_123_108_03,
    unemployedThousands: 10.302_772_874_378_8,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "KwaZulu-Natal", race row "White" (row 47), Female block.
    // Economically active: col I47 = 49.76912167728463; Employed: col J47 = 46.76466131385276; Unemployed: col K47 = 3.0044603634318707.
    // economicallyActivePct = (Economically-active[row 47, col I] / Total-row Economically-active[row 48, col N]) * 100
    //                       = (49.76912167728463 / 3955.856557195068) * 100 = 1.2581123950706097
    province: 'KwaZulu-Natal',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 1.258_112_395_070_609_7,
    economicallyActiveThousands: 49.769_121_677_284_63,
    employedThousands: 46.764_661_313_852_76,
    unemployedThousands: 3.004_460_363_431_870_7,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Limpopo (sheet geography block: "Limpopo", rows 72-76)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo", race row "Black African" (row 72), Male block.
    // Economically active: col D72 = 1151.7111761529195; Employed: col E72 = 818.4485569811336; Unemployed: col F72 = 333.2626191717859.
    // economicallyActivePct = (Economically-active[row 72, col D] / Total-row Economically-active[row 76, col N]) * 100
    //                       = (1151.7111761529195 / 2207.714632413192) * 100 = 52.16757452452158
    province: 'Limpopo',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 52.167_574_524_521_58,
    economicallyActiveThousands: 1151.711_176_152_919_5,
    employedThousands: 818.448_556_981_133_6,
    unemployedThousands: 333.262_619_171_785_9,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo", race row "Black African" (row 72), Female block.
    // Economically active: col I72 = 980.8419683819147; Employed: col J72 = 624.5147269207341; Unemployed: col K72 = 356.32724146118056.
    // economicallyActivePct = (Economically-active[row 72, col I] / Total-row Economically-active[row 76, col N]) * 100
    //                       = (980.8419683819147 / 2207.714632413192) * 100 = 44.427932577037076
    province: 'Limpopo',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 44.427_932_577_037_076,
    economicallyActiveThousands: 980.841_968_381_914_7,
    employedThousands: 624.514_726_920_734_1,
    unemployedThousands: 356.327_241_461_180_56,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo", race row "Coloured" (row 73), Male block.
    // Economically active: col D73 = 3.321977595465616; Employed: col E73 = 3.321977595465616; Unemployed: col F73 = 0.
    // DERIVED: Unemployed cell blank in source; Unemployed = Economically-active(col D) - Employed(col E) = 3.321978 - 3.321978 = 0 (Identity 2, forced by two cited cells, not fabricated).
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 73, col D] / Total-row Economically-active[row 76, col N]) * 100
    //                       = (3.321977595465616 / 2207.714632413192) * 100 = 0.15047133115363076
    province: 'Limpopo',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.150_471_331_153_630_76,
    economicallyActiveThousands: 3.321_977_595_465_616,
    employedThousands: 3.321_977_595_465_616,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo", race row "Coloured" (row 73), Female block.
    // Economically active: col I73 = 2.1406160115875603; Employed: col J73 = 0.8197396438531629; Unemployed: col K73 = 1.3208763677343973.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 73, col I] / Total-row Economically-active[row 76, col N]) * 100
    //                       = (2.1406160115875603 / 2207.714632413192) * 100 = 0.09696072038294697
    province: 'Limpopo',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.096_960_720_382_946_97,
    economicallyActiveThousands: 2.140_616_011_587_560_3,
    employedThousands: 0.819_739_643_853_162_9,
    unemployedThousands: 1.320_876_367_734_397_3,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo", race row "Indian/ Asian" (row 74), Male block.
    // Economically active: col D74 = 11.172005126215764; Employed: col E74 = 9.139008491693977; Unemployed: col F74 = 2.0329966345217874.
    // economicallyActivePct = (Economically-active[row 74, col D] / Total-row Economically-active[row 76, col N]) * 100
    //                       = (11.172005126215764 / 2207.714632413192) * 100 = 0.506043895446938
    province: 'Limpopo',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.506_043_895_446_938,
    economicallyActiveThousands: 11.172_005_126_215_764,
    employedThousands: 9.139_008_491_693_977,
    unemployedThousands: 2.032_996_634_521_787_4,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo", race row "Indian/ Asian" (row 74), Female block.
    // Economically active: col I74 = 2.0329966345217874; Employed: col J74 = 0; Unemployed: col K74 = 2.0329966345217874.
    // DERIVED: Employed cell blank in source; Employed = Economically-active(col I) - Unemployed(col K) = 2.032997 - 2.032997 = 0 (Identity 2, forced by two cited cells, not fabricated).
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 74, col I] / Total-row Economically-active[row 76, col N]) * 100
    //                       = (2.0329966345217874 / 2207.714632413192) * 100 = 0.09208602437442628
    province: 'Limpopo',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.092_086_024_374_426_28,
    economicallyActiveThousands: 2.032_996_634_521_787_4,
    employedThousands: 0,
    unemployedThousands: 2.032_996_634_521_787_4,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo", race row "White" (row 75), Male block.
    // Economically active: col D75 = 33.0522573739609; Employed: col E75 = 31.3757599762251; Unemployed: col F75 = 1.6764973977357946.
    // economicallyActivePct = (Economically-active[row 75, col D] / Total-row Economically-active[row 76, col N]) * 100
    //                       = (33.0522573739609 / 2207.714632413192) * 100 = 1.4971254386185044
    province: 'Limpopo',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 1.497_125_438_618_504_4,
    economicallyActiveThousands: 33.052_257_373_960_9,
    employedThousands: 31.375_759_976_225_1,
    unemployedThousands: 1.676_497_397_735_794_6,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Limpopo", race row "White" (row 75), Female block.
    // Economically active: col I75 = 23.441635136605456; Employed: col J75 = 21.297081310301323; Unemployed: col K75 = 2.144553826304132.
    // economicallyActivePct = (Economically-active[row 75, col I] / Total-row Economically-active[row 76, col N]) * 100
    //                       = (23.441635136605456 / 2207.714632413192) * 100 = 1.061805488464877
    province: 'Limpopo',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 1.061_805_488_464_877,
    economicallyActiveThousands: 23.441_635_136_605_456,
    employedThousands: 21.297_081_310_301_323,
    unemployedThousands: 2.144_553_826_304_132,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Mpumalanga (sheet geography block: "Mpumalanga", rows 65-69)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga", race row "Black African" (row 65), Male block.
    // Economically active: col D65 = 978.7702796959632; Employed: col E65 = 650.318505178858; Unemployed: col F65 = 328.4517745171052.
    // economicallyActivePct = (Economically-active[row 65, col D] / Total-row Economically-active[row 69, col N]) * 100
    //                       = (978.7702796959632 / 1929.1926263120142) * 100 = 50.734709761308395
    province: 'Mpumalanga',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 50.734_709_761_308_395,
    economicallyActiveThousands: 978.770_279_695_963_2,
    employedThousands: 650.318_505_178_858,
    unemployedThousands: 328.451_774_517_105_2,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga", race row "Black African" (row 65), Female block.
    // Economically active: col I65 = 814.8515044574265; Employed: col J65 = 464.3045934309675; Unemployed: col K65 = 350.546911026459.
    // economicallyActivePct = (Economically-active[row 65, col I] / Total-row Economically-active[row 69, col N]) * 100
    //                       = (814.8515044574265 / 1929.1926263120142) * 100 = 42.23795453827523
    province: 'Mpumalanga',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 42.237_954_538_275_23,
    economicallyActiveThousands: 814.851_504_457_426_5,
    employedThousands: 464.304_593_430_967_5,
    unemployedThousands: 350.546_911_026_459,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga", race row "Coloured" (row 66), Male block.
    // Economically active: col D66 = 8.61067124186587; Employed: col E66 = 6.77735205861692; Unemployed: col F66 = 1.8333191832489504.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 66, col D] / Total-row Economically-active[row 69, col N]) * 100
    //                       = (8.61067124186587 / 1929.1926263120142) * 100 = 0.4463354837887111
    province: 'Mpumalanga',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.446_335_483_788_711_1,
    economicallyActiveThousands: 8.610_671_241_865_87,
    employedThousands: 6.777_352_058_616_92,
    unemployedThousands: 1.833_319_183_248_950_4,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga", race row "Coloured" (row 66), Female block.
    // Economically active: col I66 = 4.718714304667173; Employed: col J66 = 1.616845352157451; Unemployed: col K66 = 3.101868952509722.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 66, col I] / Total-row Economically-active[row 69, col N]) * 100
    //                       = (4.718714304667173 / 1929.1926263120142) * 100 = 0.2445952902944592
    province: 'Mpumalanga',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.244_595_290_294_459_2,
    economicallyActiveThousands: 4.718_714_304_667_173,
    employedThousands: 1.616_845_352_157_451,
    unemployedThousands: 3.101_868_952_509_722,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga", race row "Indian/ Asian" (row 67), Male block.
    // Economically active: col D67 = 4.706227999552242; Employed: col E67 = 4.706227999552242; Unemployed: col F67 = 0.
    // DERIVED: Unemployed cell blank in source; Unemployed = Economically-active(col D) - Employed(col E) = 4.706228 - 4.706228 = 0 (Identity 2, forced by two cited cells, not fabricated).
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 67, col D] / Total-row Economically-active[row 69, col N]) * 100
    //                       = (4.706227999552242 / 1929.1926263120142) * 100 = 0.2439480607257458
    province: 'Mpumalanga',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.243_948_060_725_745_8,
    economicallyActiveThousands: 4.706_227_999_552_242,
    employedThousands: 4.706_227_999_552_242,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga", race row "Indian/ Asian" (row 67), Female block.
    // Economically active: col I67 = 5.509920559634049; Employed: col J67 = 4.884388439597174; Unemployed: col K67 = 0.6255321200368743.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 67, col I] / Total-row Economically-active[row 69, col N]) * 100
    //                       = (5.509920559634049 / 1929.1926263120142) * 100 = 0.2856075896457896
    province: 'Mpumalanga',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.285_607_589_645_789_6,
    economicallyActiveThousands: 5.509_920_559_634_049,
    employedThousands: 4.884_388_439_597_174,
    unemployedThousands: 0.625_532_120_036_874_3,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga", race row "White" (row 68), Male block.
    // Economically active: col D68 = 64.91347551821829; Employed: col E68 = 57.08417341719139; Unemployed: col F68 = 7.829302101026908.
    // economicallyActivePct = (Economically-active[row 68, col D] / Total-row Economically-active[row 69, col N]) * 100
    //                       = (64.91347551821829 / 1929.1926263120142) * 100 = 3.3648001051254086
    province: 'Mpumalanga',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 3.364_800_105_125_408_6,
    economicallyActiveThousands: 64.913_475_518_218_29,
    employedThousands: 57.084_173_417_191_39,
    unemployedThousands: 7.829_302_101_026_908,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Mpumalanga", race row "White" (row 68), Female block.
    // Economically active: col I68 = 47.11183253468748; Employed: col J68 = 39.72732832315851; Unemployed: col K68 = 7.384504211528972.
    // economicallyActivePct = (Economically-active[row 68, col I] / Total-row Economically-active[row 69, col N]) * 100
    //                       = (47.11183253468748 / 1929.1926263120142) * 100 = 2.442049170836295
    province: 'Mpumalanga',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 2.442_049_170_836_295,
    economicallyActiveThousands: 47.111_832_534_687_48,
    employedThousands: 39.727_328_323_158_51,
    unemployedThousands: 7.384_504_211_528_972,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // North West (sheet geography block: "North West", rows 51-55)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West", race row "Black African" (row 51), Male block.
    // Economically active: col D51 = 710.0751507349012; Employed: col E51 = 487.67208285618324; Unemployed: col F51 = 222.40306787871788.
    // economicallyActivePct = (Economically-active[row 51, col D] / Total-row Economically-active[row 55, col N]) * 100
    //                       = (710.0751507349012 / 1382.2146844159229) * 100 = 51.37227658921558
    province: 'North West',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 51.372_276_589_215_58,
    economicallyActiveThousands: 710.075_150_734_901_2,
    employedThousands: 487.672_082_856_183_24,
    unemployedThousands: 222.403_067_878_717_88,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West", race row "Black African" (row 51), Female block.
    // Economically active: col I51 = 560.0999976374134; Employed: col J51 = 307.1682557023277; Unemployed: col K51 = 252.93174193508563.
    // economicallyActivePct = (Economically-active[row 51, col I] / Total-row Economically-active[row 55, col N]) * 100
    //                       = (560.0999976374134 / 1382.2146844159229) * 100 = 40.52192499127534
    province: 'North West',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 40.521_924_991_275_34,
    economicallyActiveThousands: 560.099_997_637_413_4,
    employedThousands: 307.168_255_702_327_7,
    unemployedThousands: 252.931_741_935_085_63,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West", race row "Coloured" (row 52), Male block.
    // Economically active: col D52 = 32.4363910493367; Employed: col E52 = 31.48164841306858; Unemployed: col F52 = 0.9547426362681162.
    // economicallyActivePct = (Economically-active[row 52, col D] / Total-row Economically-active[row 55, col N]) * 100
    //                       = (32.4363910493367 / 1382.2146844159229) * 100 = 2.3466970373739895
    province: 'North West',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 2.346_697_037_373_989_5,
    economicallyActiveThousands: 32.436_391_049_336_7,
    employedThousands: 31.481_648_413_068_58,
    unemployedThousands: 0.954_742_636_268_116_2,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West", race row "Coloured" (row 52), Female block.
    // Economically active: col I52 = 20.74128752783291; Employed: col J52 = 18.219272332271643; Unemployed: col K52 = 2.5220151955612646.
    // economicallyActivePct = (Economically-active[row 52, col I] / Total-row Economically-active[row 55, col N]) * 100
    //                       = (20.74128752783291 / 1382.2146844159229) * 100 = 1.5005836475104066
    province: 'North West',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 1.500_583_647_510_406_6,
    economicallyActiveThousands: 20.741_287_527_832_91,
    employedThousands: 18.219_272_332_271_643,
    unemployedThousands: 2.522_015_195_561_264_6,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West", race row "Indian/ Asian" (row 53), Male block.
    // Economically active: col D53 = 2.449254037911436; Employed: col E53 = 2.0481215671168442; Unemployed: col F53 = 0.4011324707945918.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 53, col D] / Total-row Economically-active[row 55, col N]) * 100
    //                       = (2.449254037911436 / 1382.2146844159229) * 100 = 0.17719780187014927
    province: 'North West',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.177_197_801_870_149_27,
    economicallyActiveThousands: 2.449_254_037_911_436,
    employedThousands: 2.048_121_567_116_844_2,
    unemployedThousands: 0.401_132_470_794_591_8,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West", race row "Indian/ Asian" (row 53), Female block.
    // Economically active: col I53 = <blank in source>; Employed: col J53 = <blank in source>; Unemployed: col K53 = <blank in source>.
    // UNVERIFIED: source cells (Economically active / Employed / Unemployed) are blank for this race-gender row in the sheet (below reliable-estimate threshold per sheet footnote); no cited cell exists to derive a value. Recorded as 0 per shape constraint (non-negative required) — NOT a fabricated positive figure.
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 53, col I] / Total-row Economically-active[row 55, col N]) * 100
    //                       = (0 / 1382.2146844159229) * 100 = 0
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
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West", race row "White" (row 54), Male block.
    // Economically active: col D54 = 28.317870015448023; Employed: col E54 = 21.554458618445672; Unemployed: col F54 = 6.763411397002352.
    // economicallyActivePct = (Economically-active[row 54, col D] / Total-row Economically-active[row 55, col N]) * 100
    //                       = (28.317870015448023 / 1382.2146844159229) * 100 = 2.048731672056732
    province: 'North West',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 2.048_731_672_056_732,
    economicallyActiveThousands: 28.317_870_015_448_023,
    employedThousands: 21.554_458_618_445_672,
    unemployedThousands: 6.763_411_397_002_352,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "North West", race row "White" (row 54), Female block.
    // Economically active: col I54 = 28.094733413078707; Employed: col J54 = 25.48064087072387; Unemployed: col K54 = 2.6140925423548347.
    // economicallyActivePct = (Economically-active[row 54, col I] / Total-row Economically-active[row 55, col N]) * 100
    //                       = (28.094733413078707 / 1382.2146844159229) * 100 = 2.0325882606977648
    province: 'North West',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 2.032_588_260_697_764_8,
    economicallyActiveThousands: 28.094_733_413_078_707,
    employedThousands: 25.480_640_870_723_87,
    unemployedThousands: 2.614_092_542_354_834_7,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Northern Cape (sheet geography block: "Northern Cape", rows 30-34)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape", race row "Black African" (row 30), Male block.
    // Economically active: col D30 = 151.85056573097737; Employed: col E30 = 108.74959253114707; Unemployed: col F30 = 43.100973199830285.
    // economicallyActivePct = (Economically-active[row 30, col D] / Total-row Economically-active[row 34, col N]) * 100
    //                       = (151.85056573097737 / 442.4121746207459) * 100 = 34.323324366276765
    province: 'Northern Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 34.323_324_366_276_765,
    economicallyActiveThousands: 151.850_565_730_977_37,
    employedThousands: 108.749_592_531_147_07,
    unemployedThousands: 43.100_973_199_830_285,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape", race row "Black African" (row 30), Female block.
    // Economically active: col I30 = 117.49575910075832; Employed: col J30 = 77.44009309479203; Unemployed: col K30 = 40.05566600596629.
    // economicallyActivePct = (Economically-active[row 30, col I] / Total-row Economically-active[row 34, col N]) * 100
    //                       = (117.49575910075832 / 442.4121746207459) * 100 = 26.5579850286626
    province: 'Northern Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 26.557_985_028_662_6,
    economicallyActiveThousands: 117.495_759_100_758_32,
    employedThousands: 77.440_093_094_792_03,
    unemployedThousands: 40.055_666_005_966_29,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape", race row "Coloured" (row 31), Male block.
    // Economically active: col D31 = 80.45541272321486; Employed: col E31 = 55.012889807621654; Unemployed: col F31 = 25.442522915593216.
    // economicallyActivePct = (Economically-active[row 31, col D] / Total-row Economically-active[row 34, col N]) * 100
    //                       = (80.45541272321486 / 442.4121746207459) * 100 = 18.185623574257328
    province: 'Northern Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 18.185_623_574_257_328,
    economicallyActiveThousands: 80.455_412_723_214_86,
    employedThousands: 55.012_889_807_621_654,
    unemployedThousands: 25.442_522_915_593_216,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape", race row "Coloured" (row 31), Female block.
    // Economically active: col I31 = 68.04663923157818; Employed: col J31 = 42.92934120991097; Unemployed: col K31 = 25.117298021667217.
    // economicallyActivePct = (Economically-active[row 31, col I] / Total-row Economically-active[row 34, col N]) * 100
    //                       = (68.04663923157818 / 442.4121746207459) * 100 = 15.380824293524606
    province: 'Northern Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 15.380_824_293_524_606,
    economicallyActiveThousands: 68.046_639_231_578_18,
    employedThousands: 42.929_341_209_910_97,
    unemployedThousands: 25.117_298_021_667_217,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape", race row "Indian/ Asian" (row 32), Male block.
    // Economically active: col D32 = 3.2851409628622914; Employed: col E32 = 3.2851409628622914; Unemployed: col F32 = 0.
    // DERIVED: Unemployed cell blank in source; Unemployed = Economically-active(col D) - Employed(col E) = 3.285141 - 3.285141 = 0 (Identity 2, forced by two cited cells, not fabricated).
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 32, col D] / Total-row Economically-active[row 34, col N]) * 100
    //                       = (3.2851409628622914 / 442.4121746207459) * 100 = 0.742552115722957
    province: 'Northern Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.742_552_115_722_957,
    economicallyActiveThousands: 3.285_140_962_862_291_4,
    employedThousands: 3.285_140_962_862_291_4,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape", race row "Indian/ Asian" (row 32), Female block.
    // Economically active: col I32 = 1.5133477457370255; Employed: col J32 = 1.5133477457370255; Unemployed: col K32 = 0.
    // DERIVED: Unemployed cell blank in source; Unemployed = Economically-active(col I) - Employed(col J) = 1.513348 - 1.513348 = 0 (Identity 2, forced by two cited cells, not fabricated).
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 32, col I] / Total-row Economically-active[row 34, col N]) * 100
    //                       = (1.5133477457370255 / 442.4121746207459) * 100 = 0.34206738253402047
    province: 'Northern Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.342_067_382_534_020_47,
    economicallyActiveThousands: 1.513_347_745_737_025_5,
    employedThousands: 1.513_347_745_737_025_5,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape", race row "White" (row 33), Male block.
    // Economically active: col D33 = 10.28337499605496; Employed: col E33 = 9.710346176478218; Unemployed: col F33 = 0.5730288195767421.
    // economicallyActivePct = (Economically-active[row 33, col D] / Total-row Economically-active[row 34, col N]) * 100
    //                       = (10.28337499605496 / 442.4121746207459) * 100 = 2.3243878866738457
    province: 'Northern Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 2.324_387_886_673_845_7,
    economicallyActiveThousands: 10.283_374_996_054_96,
    employedThousands: 9.710_346_176_478_218,
    unemployedThousands: 0.573_028_819_576_742_1,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Northern Cape", race row "White" (row 33), Female block.
    // Economically active: col I33 = 9.481934129562822; Employed: col J33 = 9.481934129562822; Unemployed: col K33 = 0.
    // DERIVED: Unemployed cell blank in source; Unemployed = Economically-active(col I) - Employed(col J) = 9.481934 - 9.481934 = 0 (Identity 2, forced by two cited cells, not fabricated).
    // RELIABILITY CAVEAT: Economically-active <= 10.0 thousand — StatsSA footnote: "For all values of 10 000 or lower the sample size is too small for reliable estimates."
    // economicallyActivePct = (Economically-active[row 33, col I] / Total-row Economically-active[row 34, col N]) * 100
    //                       = (9.481934129562822 / 442.4121746207459) * 100 = 2.143235352347871
    province: 'Northern Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 2.143_235_352_347_871,
    economicallyActiveThousands: 9.481_934_129_562_822,
    employedThousands: 9.481_934_129_562_822,
    unemployedThousands: 0,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // Western Cape (sheet geography block: "Western cape", rows 16-20)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape", race row "Black African" (row 16), Male block.
    // Economically active: col D16 = 838.8629532393434; Employed: col E16 = 660.5632989620469; Unemployed: col F16 = 178.2996542772964.
    // economicallyActivePct = (Economically-active[row 16, col D] / Total-row Economically-active[row 20, col N]) * 100
    //                       = (838.8629532393434 / 3586.730141350969) * 100 = 23.387958396094426
    province: 'Western Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 23.387_958_396_094_426,
    economicallyActiveThousands: 838.862_953_239_343_4,
    employedThousands: 660.563_298_962_046_9,
    unemployedThousands: 178.299_654_277_296_4,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape", race row "Black African" (row 16), Female block.
    // Economically active: col I16 = 695.1717765289959; Employed: col J16 = 502.430132419472; Unemployed: col K16 = 192.74164410952392.
    // economicallyActivePct = (Economically-active[row 16, col I] / Total-row Economically-active[row 20, col N]) * 100
    //                       = (695.1717765289959 / 3586.730141350969) * 100 = 19.381769721520065
    province: 'Western Cape',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 19.381_769_721_520_065,
    economicallyActiveThousands: 695.171_776_528_995_9,
    employedThousands: 502.430_132_419_472,
    unemployedThousands: 192.741_644_109_523_92,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape", race row "Coloured" (row 17), Male block.
    // Economically active: col D17 = 811.7249641956812; Employed: col E17 = 652.187943719899; Unemployed: col F17 = 159.5370204757822.
    // economicallyActivePct = (Economically-active[row 17, col D] / Total-row Economically-active[row 20, col N]) * 100
    //                       = (811.7249641956812 / 3586.730141350969) * 100 = 22.63133640408026
    province: 'Western Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 22.631_336_404_080_26,
    economicallyActiveThousands: 811.724_964_195_681_2,
    employedThousands: 652.187_943_719_899,
    unemployedThousands: 159.537_020_475_782_2,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape", race row "Coloured" (row 17), Female block.
    // Economically active: col I17 = 691.3666076586011; Employed: col J17 = 550.6654092943332; Unemployed: col K17 = 140.7011983642678.
    // economicallyActivePct = (Economically-active[row 17, col I] / Total-row Economically-active[row 20, col N]) * 100
    //                       = (691.3666076586011 / 3586.730141350969) * 100 = 19.27567953016372
    province: 'Western Cape',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 19.275_679_530_163_72,
    economicallyActiveThousands: 691.366_607_658_601_1,
    employedThousands: 550.665_409_294_333_2,
    unemployedThousands: 140.701_198_364_267_8,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape", race row "Indian/ Asian" (row 18), Male block.
    // Economically active: col D18 = 25.79385663256438; Employed: col E18 = 23.357549954390343; Unemployed: col F18 = 2.436306678174038.
    // economicallyActivePct = (Economically-active[row 18, col D] / Total-row Economically-active[row 20, col N]) * 100
    //                       = (25.79385663256438 / 3586.730141350969) * 100 = 0.7191468445086011
    province: 'Western Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 0.719_146_844_508_601_1,
    economicallyActiveThousands: 25.793_856_632_564_38,
    employedThousands: 23.357_549_954_390_343,
    unemployedThousands: 2.436_306_678_174_038,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape", race row "Indian/ Asian" (row 18), Female block.
    // Economically active: col I18 = 22.352564430463474; Employed: col J18 = 21.693288494184596; Unemployed: col K18 = 0.659275936278879.
    // economicallyActivePct = (Economically-active[row 18, col I] / Total-row Economically-active[row 20, col N]) * 100
    //                       = (22.352564430463474 / 3586.730141350969) * 100 = 0.6232017338790984
    province: 'Western Cape',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.623_201_733_879_098_4,
    economicallyActiveThousands: 22.352_564_430_463_474,
    employedThousands: 21.693_288_494_184_596,
    unemployedThousands: 0.659_275_936_278_879,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape", race row "White" (row 19), Male block.
    // Economically active: col D19 = 279.8290797346366; Employed: col E19 = 262.48951937118886; Unemployed: col F19 = 17.33956036344776.
    // economicallyActivePct = (Economically-active[row 19, col D] / Total-row Economically-active[row 20, col N]) * 100
    //                       = (279.8290797346366 / 3586.730141350969) * 100 = 7.801787943523314
    province: 'Western Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 7.801_787_943_523_314,
    economicallyActiveThousands: 279.829_079_734_636_6,
    employedThousands: 262.489_519_371_188_86,
    unemployedThousands: 17.339_560_363_447_76,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "Western cape", race row "White" (row 19), Female block.
    // Economically active: col I19 = 221.62833893068182; Employed: col J19 = 209.9508653913308; Unemployed: col K19 = 11.677473539351013.
    // economicallyActivePct = (Economically-active[row 19, col I] / Total-row Economically-active[row 20, col N]) * 100
    //                       = (221.62833893068182 / 3586.730141350969) * 100 = 6.179119426230484
    province: 'Western Cape',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 6.179_119_426_230_484,
    economicallyActiveThousands: 221.628_338_930_681_82,
    employedThousands: 209.950_865_391_330_8,
    unemployedThousands: 11.677_473_539_351_013,
    source: SOURCE,
    quarter: QUARTER,
  },

  // -------------------------------------------------------------------------
  // National (sheet geography block: "South Africa", rows 9-13)
  // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa".
  // -------------------------------------------------------------------------
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa", race row "Black African" (row 9), Male block.
    // Economically active: col D9 = 10837.023538860407; Employed: col E9 = 7268.923347325976; Unemployed: col F9 = 3568.100191534432.
    // economicallyActivePct = (Economically-active[row 9, col D] / Total-row Economically-active[row 13, col N]) * 100
    //                       = (10837.023538860407 / 24890.96841481173) * 100 = 43.53797473147601
    province: 'National',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 43.537_974_731_476_01,
    economicallyActiveThousands: 10_837.023_538_860_407,
    employedThousands: 7268.923_347_325_976,
    unemployedThousands: 3568.100_191_534_432,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa", race row "Black African" (row 9), Female block.
    // Economically active: col I9 = 9334.982333694143; Employed: col J9 = 5553.748316337236; Unemployed: col K9 = 3781.234017356906.
    // economicallyActivePct = (Economically-active[row 9, col I] / Total-row Economically-active[row 13, col N]) * 100
    //                       = (9334.982333694143 / 24890.96841481173) * 100 = 37.50349194183713
    province: 'National',
    race: RACE_LABELS.A,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 37.503_491_941_837_13,
    economicallyActiveThousands: 9334.982_333_694_143,
    employedThousands: 5553.748_316_337_236,
    unemployedThousands: 3781.234_017_356_906,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa", race row "Coloured" (row 10), Male block.
    // Economically active: col D10 = 1201.0553285511066; Employed: col E10 = 930.022292774165; Unemployed: col F10 = 271.03303577694163.
    // economicallyActivePct = (Economically-active[row 10, col D] / Total-row Economically-active[row 13, col N]) * 100
    //                       = (1201.0553285511066 / 24890.96841481173) * 100 = 4.82526556835933
    province: 'National',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 4.825_265_568_359_33,
    economicallyActiveThousands: 1201.055_328_551_106_6,
    employedThousands: 930.022_292_774_165,
    unemployedThousands: 271.033_035_776_941_63,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa", race row "Coloured" (row 10), Female block.
    // Economically active: col I10 = 1020.1453718943523; Employed: col J10 = 761.2189693635975; Unemployed: col K10 = 258.9264025307548.
    // economicallyActivePct = (Economically-active[row 10, col I] / Total-row Economically-active[row 13, col N]) * 100
    //                       = (1020.1453718943523 / 24890.96841481173) * 100 = 4.098455933467418
    province: 'National',
    race: RACE_LABELS.C,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 4.098_455_933_467_418,
    economicallyActiveThousands: 1020.145_371_894_352_3,
    employedThousands: 761.218_969_363_597_5,
    unemployedThousands: 258.926_402_530_754_8,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa", race row "Indian/ Asian" (row 11), Male block.
    // Economically active: col D11 = 375.13528240227936; Employed: col E11 = 326.82044307242205; Unemployed: col F11 = 48.31483932985728.
    // economicallyActivePct = (Economically-active[row 11, col D] / Total-row Economically-active[row 13, col N]) * 100
    //                       = (375.13528240227936 / 24890.96841481173) * 100 = 1.507114050970591
    province: 'National',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 1.507_114_050_970_591,
    economicallyActiveThousands: 375.135_282_402_279_36,
    employedThousands: 326.820_443_072_422_05,
    unemployedThousands: 48.314_839_329_857_28,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa", race row "Indian/ Asian" (row 11), Female block.
    // Economically active: col I11 = 238.6401923068584; Employed: col J11 = 203.24217583367098; Unemployed: col K11 = 35.39801647318743.
    // economicallyActivePct = (Economically-active[row 11, col I] / Total-row Economically-active[row 13, col N]) * 100
    //                       = (238.6401923068584 / 24890.96841481173) * 100 = 0.9587420960481879
    province: 'National',
    race: RACE_LABELS.I,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 0.958_742_096_048_187_9,
    economicallyActiveThousands: 238.640_192_306_858_4,
    employedThousands: 203.242_175_833_670_98,
    unemployedThousands: 35.398_016_473_187_43,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa", race row "White" (row 12), Male block.
    // Economically active: col D12 = 1059.481143454667; Employed: col E12 = 964.1893449460572; Unemployed: col F12 = 95.29179850860992.
    // economicallyActivePct = (Economically-active[row 12, col D] / Total-row Economically-active[row 13, col N]) * 100
    //                       = (1059.481143454667 / 24890.96841481173) * 100 = 4.256488240225348
    province: 'National',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.M,
    economicallyActivePct: 4.256_488_240_225_348,
    economicallyActiveThousands: 1059.481_143_454_667,
    employedThousands: 964.189_344_946_057_2,
    unemployedThousands: 95.291_798_508_609_92,
    source: SOURCE,
    quarter: QUARTER,
  },
  {
    // Source: StatsSA QLFS Q1 2026, sheet "EAP", geography block "South Africa", race row "White" (row 12), Female block.
    // Economically active: col I12 = 824.5052236479377; Employed: col J12 = 746.1169725899449; Unemployed: col K12 = 78.38825105799272.
    // economicallyActivePct = (Economically-active[row 12, col I] / Total-row Economically-active[row 13, col N]) * 100
    //                       = (824.5052236479377 / 24890.96841481173) * 100 = 3.312467437616063
    province: 'National',
    race: RACE_LABELS.W,
    gender: GENDER_LABELS.F,
    economicallyActivePct: 3.312_467_437_616_063,
    economicallyActiveThousands: 824.505_223_647_937_7,
    employedThousands: 746.116_972_589_944_9,
    unemployedThousands: 78.388_251_057_992_72,
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
