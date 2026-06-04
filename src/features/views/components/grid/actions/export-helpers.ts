import { API_BASE } from "@/features/shared/lib/api-client";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

export interface ExportRow {
  leaid: string;
  name: string;
  state_abbrev: string;
  enrollment: number | null;
  renewal_target: number | null;
  winback_target: number | null;
  expansion_target: number | null;
  new_business_target: number | null;
}

/** Fetch all matching district rows from the export endpoint (no pagination). */
export async function fetchExportRows(
  planId: string,
  layout: GridViewLayout
): Promise<ExportRow[]> {
  const params = new URLSearchParams();
  if (layout.filters.children.length > 0) {
    params.set("filters", JSON.stringify(layout.filters));
  }
  const res = await fetch(
    `${API_BASE}/territory-plans/${planId}/districts/export?${params.toString()}`
  );
  if (!res.ok) throw new Error("Failed to fetch districts from export endpoint");
  const data = (await res.json()) as { rows: ExportRow[] };
  return data.rows;
}

/** Resolve all leaids matching current filters (for all-filtered selection mode). */
export async function resolvePlanLeaids(
  planId: string,
  layout: GridViewLayout
): Promise<string[]> {
  const rows = await fetchExportRows(planId, layout);
  return rows.map((r) => r.leaid);
}
