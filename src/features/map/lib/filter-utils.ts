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

/** Extract unique leaid values from a GeoJSON FeatureCollection */
export function extractLeaids(geojson: any): Set<string> {
  const leaids = new Set<string>();
  if (!geojson?.features) return leaids;
  for (const f of geojson.features) {
    const id = f.properties?.leaid;
    if (id) leaids.add(id);
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
