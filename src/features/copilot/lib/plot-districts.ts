import { fipsToAbbrev } from "@/lib/states";

/** Max districts to plot from one answer (keeps the MapLibre `in` filter + the
 *  camera fit cheap; the chat warns when the result is larger). */
export const MAX_PLOTTED_DISTRICTS = 200;

/** Pull distinct district leaids out of an answer's result rows, capped. */
export function extractDistrictLeaids(
  columns: string[],
  rows: Array<Record<string, unknown>>,
): { leaids: string[]; truncated: boolean } {
  if (!columns.includes("leaid")) return { leaids: [], truncated: false };
  const all = [
    ...new Set(
      rows
        .map((r) => r.leaid)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];
  return {
    leaids: all.slice(0, MAX_PLOTTED_DISTRICTS),
    truncated: all.length > MAX_PLOTTED_DISTRICTS,
  };
}

/** Distinct USPS state abbrevs for a set of leaids (first 2 chars = FIPS). */
export function statesForLeaids(leaids: string[]): string[] {
  return [
    ...new Set(
      leaids
        .map((l) => fipsToAbbrev(l.slice(0, 2)))
        .filter((a): a is string => !!a),
    ),
  ];
}
