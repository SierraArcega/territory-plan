import type {
  PlanLayerFilter,
  ContactLayerFilter,
  VacancyLayerFilter,
  ActivityLayerFilter,
} from "./store";

/** Is any plan layer filter actively narrowing results? */
export function isPlansFiltered(f: Partial<PlanLayerFilter>): boolean {
  return !!(
    f.planIds?.length ||
    f.ownerIds?.length ||
    f.status?.length ||
    f.fiscalYear ||
    f.ownerScope === "all"
  );
}

/** Is any contact layer filter actively narrowing results? */
export function isContactsFiltered(f: Partial<ContactLayerFilter>): boolean {
  return !!(f.seniorityLevel?.length || f.persona?.length || f.primaryOnly);
}

/** Is any vacancy layer filter actively narrowing results? */
export function isVacanciesFiltered(f: Partial<VacancyLayerFilter>): boolean {
  return !!(
    f.category?.length ||
    f.status?.length ||
    f.fullmindRelevant ||
    (f.minDaysOpen != null && f.minDaysOpen > 0) ||
    (f.maxDaysOpen != null && f.maxDaysOpen < 365)
  );
}

/** Is any activity layer filter actively narrowing results? */
export function isActivitiesFiltered(f: Partial<ActivityLayerFilter>): boolean {
  return !!(f.type?.length || f.status?.length || f.outcome?.length);
}

/**
 * Extract unique leaids from either:
 *   - a GeoJSON FeatureCollection (one feature per district)
 *   - a flat array of plan-row objects ({ leaid, ... })
 * Both shapes occur in this codebase: the contacts/vacancies/activities
 * overlays still use FeatureCollection, while plans switched to a flat
 * array after the MVT cutover.
 */
export function extractLeaids(input: any): Set<string> {
  const leaids = new Set<string>();
  if (!input) return leaids;

  // FeatureCollection shape
  if (Array.isArray(input.features)) {
    for (const f of input.features) {
      const id = f.properties?.leaid;
      if (id) leaids.add(id);
    }
    return leaids;
  }

  // Flat array of plan rows
  if (Array.isArray(input)) {
    for (const row of input) {
      if (row?.leaid) leaids.add(row.leaid);
    }
    return leaids;
  }

  return leaids;
}

/**
 * Stable string key for a Set<string> — used to compare sets by value
 * in React dependency arrays without triggering spurious re-renders.
 */
export function leaidSetKey(s: Set<string> | null): string {
  if (!s || s.size === 0) return "";
  return [...s].sort().join(",");
}
