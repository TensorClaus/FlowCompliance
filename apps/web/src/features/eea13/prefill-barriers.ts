import type { BarrierEntry, BarriersRemovalPlan, BarrierSeverity } from '@simplifi/shared'

/**
 * Severity sort order — high first, then medium, then low.
 * Values are stable-sort weights; lower value sorts earlier.
 */
const SEVERITY_ORDER: Record<BarrierSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

/**
 * Result of seeding a barriers removal plan from EEA12 barrier entries.
 *
 * ONE-TIME SEED semantics:
 *   This function is called exactly once, at EEA13 step-4 mount, when
 *   formState['eea13-barriers'] is undefined AND a linked EEA12 prefill source
 *   is present. After the seed is written to formState the EEA12 data is
 *   never consulted again — editing the EEA12 after this point does NOT
 *   mutate the EEA13 barriers removal plan.
 */
export interface SeedResult {
  /** One stub BarriersRemovalPlan per distinct barrier category. */
  plans: BarriersRemovalPlan[]
  /**
   * Category strings for entries that were skipped because an earlier entry
   * with the same category already produced a stub.
   */
  duplicates: string[]
}

/**
 * Derive a set of BarriersRemovalPlan stubs from EEA12 barrier entries.
 *
 * Rules:
 *   - One stub per DISTINCT category. First entry of that category wins;
 *     later entries for the same category are recorded in `duplicates`.
 *   - Severity sort: high entries first, then medium, then low (stable within
 *     each tier — input order preserved for ties).
 *   - barrierCategory  = entry.category
 *   - action           = entry.mitigationActions joined with '; '
 *   - responsible      = '' (user fills in)
 *   - timeline         = '' (user fills in)
 *   - measurableOutcome = '' (user fills in)
 *
 * @param entries - Flat array of BarrierEntry objects from the EEA12 barriers
 *                  analysis section. May be empty, in which case both output
 *                  arrays will be empty.
 */
export function seedRemovalPlan(entries: BarrierEntry[]): SeedResult {
  // Sort by severity (high → medium → low), stable within each tier.
  const sorted = [...entries].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )

  const seenCategories = new Set<string>()
  const plans: BarriersRemovalPlan[] = []
  const duplicates: string[] = []

  for (const entry of sorted) {
    if (seenCategories.has(entry.category)) {
      duplicates.push(entry.category)
      continue
    }

    seenCategories.add(entry.category)
    plans.push({
      barrierCategory: entry.category,
      action: entry.mitigationActions.join('; '),
      responsible: '',
      timeline: '',
      measurableOutcome: '',
    })
  }

  return { plans, duplicates }
}
