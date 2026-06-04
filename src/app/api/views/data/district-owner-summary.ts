/**
 * Per-district owner for the Saved Views grid cell. Resolves districts.owner_id
 * (the app owner — distinct from the CRM sales_executive_id) to a renderable
 * person. District-scoped (no plan context). Runs only for the leaids on the
 * current page, so it scales with page size, not the whole table.
 */
import prisma from "@/lib/prisma";

export interface OwnerSummaryRow {
  leaid: string;
  owner_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface OwnerSummary {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

/** Pure: rows -> Map. Exported for unit testing without a DB. */
export function summarizeOwnerRows(rows: OwnerSummaryRow[]): Map<string, OwnerSummary> {
  const m = new Map<string, OwnerSummary>();
  for (const r of rows) {
    if (!r.owner_id) continue;
    m.set(r.leaid, { id: r.owner_id, fullName: r.full_name, avatarUrl: r.avatar_url });
  }
  return m;
}

/** Query the owner (if any) for the given leaids. */
export async function fetchDistrictOwners(
  leaids: string[],
): Promise<Map<string, OwnerSummary>> {
  if (leaids.length === 0) return new Map();
  // Wrapped in try/catch so an unavailable client (e.g. in tests) degrades to
  // no owners rather than failing the whole grid request.
  try {
    const rows = await prisma.$queryRaw<OwnerSummaryRow[]>`
      SELECT d.leaid, d.owner_id, up.full_name, up.avatar_url
      FROM districts d
      LEFT JOIN user_profiles up ON up.id = d.owner_id
      WHERE d.leaid = ANY(${leaids}) AND d.owner_id IS NOT NULL
    `;
    return summarizeOwnerRows(rows);
  } catch {
    return new Map();
  }
}
