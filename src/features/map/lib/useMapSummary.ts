import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { useMapV2Store } from "@/features/map/lib/store";

/** Shape of each category row and the overall totals */
export interface SummaryTotals {
  count: number;
  totalEnrollment: number;
  sessionsRevenue: number;
  netInvoicing: number;
  closedWonBookings: number;
  openPipeline: number;
  weightedPipeline: number;
}

interface SummaryResponse extends SummaryTotals {
  byCategory: Record<string, SummaryTotals>;
}

const EMPTY_TOTALS: SummaryTotals = {
  count: 0,
  totalEnrollment: 0,
  sessionsRevenue: 0,
  netInvoicing: 0,
  closedWonBookings: 0,
  openPipeline: 0,
  weightedPipeline: 0,
};

/**
 * Maps UI engagement filter values to the raw Fullmind category values
 * stored in the materialized view.
 * The UI shows "pipeline" but the DB has "new_pipeline", "renewal_pipeline", "expansion_pipeline".
 */
const ENGAGEMENT_TO_CATEGORIES: Record<string, string[]> = {
  target: ["target"],
  pipeline: ["new_pipeline", "renewal_pipeline", "expansion_pipeline"],
  first_year: ["new"],
  multi_year: ["multi_year"],
  lapsed: ["lapsed"],
};

function sumCategories(
  byCategory: Record<string, SummaryTotals>,
  allowedCategories: Set<string>
): SummaryTotals {
  const totals = { ...EMPTY_TOTALS };
  for (const [cat, data] of Object.entries(byCategory)) {
    if (allowedCategories.has(cat)) {
      totals.count += data.count;
      totals.totalEnrollment += data.totalEnrollment;
      totals.sessionsRevenue += data.sessionsRevenue;
      totals.netInvoicing += data.netInvoicing;
      totals.closedWonBookings += data.closedWonBookings;
      totals.openPipeline += data.openPipeline;
      totals.weightedPipeline += data.weightedPipeline;
    }
  }
  return totals;
}

export function useMapSummary() {
  // Major filters (trigger API re-fetch)
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const filterStates = useMapV2Store((s) => s.filterStates);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const activeVendors = useMapV2Store((s) => s.activeVendors);

  // Sub-filters (client-side re-computation only)
  const fullmindEngagement = useMapV2Store((s) => s.fullmindEngagement);

  // Build query params
  const vendorsCsv = [...activeVendors].sort().join(",");
  const statesCsv = [...filterStates].sort().join(",");
  const accountTypesCsv = [...filterAccountTypes].sort().join(",");

  const enabled = activeVendors.size > 0;

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "districtSummary",
      selectedFiscalYear,
      statesCsv,
      filterOwner,
      filterPlanId,
      accountTypesCsv,
      vendorsCsv,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("fy", selectedFiscalYear);
      if (statesCsv) params.set("states", statesCsv);
      if (filterOwner) params.set("owner", filterOwner);
      if (filterPlanId) params.set("planId", filterPlanId);
      if (accountTypesCsv) params.set("accountTypes", accountTypesCsv);
      if (vendorsCsv) params.set("vendors", vendorsCsv);
      return fetchJson<SummaryResponse>(
        `${API_BASE}/districts/summary?${params.toString()}`
      );
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Derive visible totals from byCategory, applying engagement sub-filters client-side
  const totals = useMemo<SummaryTotals>(() => {
    if (!data) return EMPTY_TOTALS;

    // If no engagement filter is active, use the raw totals (all categories)
    if (fullmindEngagement.length === 0) {
      return {
        count: data.count,
        totalEnrollment: data.totalEnrollment,
        sessionsRevenue: data.sessionsRevenue,
        netInvoicing: data.netInvoicing,
        closedWonBookings: data.closedWonBookings,
        openPipeline: data.openPipeline,
        weightedPipeline: data.weightedPipeline,
      };
    }

    // Map engagement filter values to raw category names
    const allowedCategories = new Set<string>();
    for (const eng of fullmindEngagement) {
      const cats = ENGAGEMENT_TO_CATEGORIES[eng];
      if (cats) cats.forEach((c) => allowedCategories.add(c));
    }

    return sumCategories(data.byCategory, allowedCategories);
  }, [data, fullmindEngagement]);

  return { totals, isLoading: isLoading && enabled, error, enabled };
}
