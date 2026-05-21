/**
 * Per-district note summary for the Saved Views grid cell: latest entry snippet
 * (plaintext) + total count. District-scoped (no plan context). Runs only for
 * the leaids on the current page, so it scales with page size, not the table.
 */
import prisma from "@/lib/prisma";

export interface NoteSummaryRow {
  district_leaid: string;
  count: number;
  latest_text: string | null;
}

export interface NoteSummary {
  latest: string | null;
  count: number;
}

/** Pure: rows -> Map. Exported for unit testing without a DB. */
export function summarizeNoteRows(rows: NoteSummaryRow[]): Map<string, NoteSummary> {
  const m = new Map<string, NoteSummary>();
  for (const r of rows) {
    m.set(r.district_leaid, { latest: r.latest_text, count: Number(r.count) });
  }
  return m;
}

/** Query the latest snippet + count for the given leaids. */
export async function fetchDistrictNotesSummary(
  leaids: string[],
): Promise<Map<string, NoteSummary>> {
  if (leaids.length === 0) return new Map();
  // Wrapped in try/catch (not just `.catch`) so a synchronous throw — e.g. an
  // unavailable client in tests — degrades to an empty summary instead of
  // failing the whole grid request. The cell simply shows "+ Add note".
  try {
    const rows = await prisma.$queryRaw<NoteSummaryRow[]>`
      SELECT district_leaid,
             COUNT(*)::int AS count,
             (ARRAY_AGG(body_text ORDER BY created_at DESC))[1] AS latest_text
      FROM district_notes
      WHERE district_leaid = ANY(${leaids})
      GROUP BY district_leaid
    `;
    return summarizeNoteRows(rows);
  } catch {
    return new Map();
  }
}
