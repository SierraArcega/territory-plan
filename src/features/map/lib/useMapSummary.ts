import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import { useMapV2Store } from "@/features/map/lib/store";
import type { VendorId } from "@/features/map/lib/layers";

/** Unified shape for per-vendor and combined totals — 10 financial metrics */
export interface SummaryTotals {
  count: number;
  totalEnrollment: number;
  openPipeline: number;
  closedWonBookings: number;
  invoicing: number;
  scheduledRevenue: number;
  deliveredRevenue: number;
  deferredRevenue: number;
  totalRevenue: number;
  deliveredTake: number;
  scheduledTake: number;
  allTake: number;
}

interface SummaryResponse extends SummaryTotals {
  byCategory: Record<string, SummaryTotals>;
  byVendor?: Record<string, SummaryTotals & { byCategory: Record<string, SummaryTotals> }>;
}

const EMPTY_TOTALS: SummaryTotals = {
  count: 0,
  totalEnrollment: 0,
  openPipeline: 0,
  closedWonBookings: 0,
  invoicing: 0,
  scheduledRevenue: 0,
  deliveredRevenue: 0,
  deferredRevenue: 0,
  totalRevenue: 0,
  deliveredTake: 0,
  scheduledTake: 0,
  allTake: 0,
};

/**
 * Maps UI engagement filter values to the raw Fullmind category values
 * stored in the materialized view.
 */
const ENGAGEMENT_TO_CATEGORIES: Record<string, string[]> = {
  target: ["target"],
  renewal_pipeline: ["renewal_pipeline"],
  expansion_pipeline: ["expansion_pipeline"],
  new_business_pipeline: ["new_business_pipeline"],
  winback_pipeline: ["winback_pipeline"],
  first_year: ["new"],
  multi_year_growing: ["multi_year_growing"],
  multi_year_flat: ["multi_year_flat"],
  multi_year_shrinking: ["multi_year_shrinking"],
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
      totals.openPipeline += data.openPipeline;
      totals.closedWonBookings += data.closedWonBookings;
      totals.invoicing += data.invoicing;
      totals.scheduledRevenue += data.scheduledRevenue;
      totals.deliveredRevenue += data.deliveredRevenue;
      totals.deferredRevenue += data.deferredRevenue;
      totals.totalRevenue += data.totalRevenue;
      totals.deliveredTake += data.deliveredTake;
      totals.scheduledTake += data.scheduledTake;
      totals.allTake += data.allTake;
    }
  }
  return totals;
}

/**
 * Returns the set of allowed categories for a vendor given active engagement
 * filters, or null if no sub-filter is active for that vendor.
 */
function getAllowedCategories(
  vendor: string,
  fullmindEngagement: string[],
  competitorEngagement: Record<string, string[]>
): Set<string> | null {
  if (vendor === "fullmind") {
    if (fullmindEngagement.length === 0) return null;
    const allowed = new Set<string>();
    for (const eng of fullmindEngagement) {
      const cats = ENGAGEMENT_TO_CATEGORIES[eng];
      if (cats) cats.forEach((c) => allowed.add(c));
    }
    return allowed;
  }

  // Competitor vendors: expand through ENGAGEMENT_TO_CATEGORIES when available,
  // otherwise map 1:1 to category names
  const eng = competitorEngagement[vendor];
  if (!eng || eng.length === 0) return null;
  const allowed = new Set<string>();
  for (const e of eng) {
    const cats = ENGAGEMENT_TO_CATEGORIES[e];
    if (cats) cats.forEach((c) => allowed.add(c));
    else allowed.add(e);
  }
  return allowed;
}

/** Per-vendor totals — all vendors use the same SummaryTotals shape */
export type VendorTotalsMap = Partial<Record<VendorId, { totals: SummaryTotals }>>;

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
  const competitorEngagement = useMapV2Store((s) => s.competitorEngagement);

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

  // Check if any engagement sub-filter is active across any vendor
  const hasAnyEngagementFilter =
    fullmindEngagement.length > 0 ||
    Object.values(competitorEngagement).some((eng) => eng.length > 0);

  // Derive visible totals from byCategory, applying engagement sub-filters client-side
  const totals = useMemo<SummaryTotals>(() => {
    if (!data) return EMPTY_TOTALS;

    // If no engagement filter is active, use the raw totals (all categories)
    if (!hasAnyEngagementFilter) {
      return {
        count: data.count,
        totalEnrollment: data.totalEnrollment,
        openPipeline: data.openPipeline,
        closedWonBookings: data.closedWonBookings,
        invoicing: data.invoicing,
        scheduledRevenue: data.scheduledRevenue,
        deliveredRevenue: data.deliveredRevenue,
        deferredRevenue: data.deferredRevenue,
        totalRevenue: data.totalRevenue,
        deliveredTake: data.deliveredTake,
        scheduledTake: data.scheduledTake,
        allTake: data.allTake,
      };
    }

    // When byVendor is present, sum filtered per-vendor totals so each vendor
    // respects its own engagement filter independently.
    if (data.byVendor) {
      const combined = { ...EMPTY_TOTALS };
      for (const [vendor, vendorData] of Object.entries(data.byVendor)) {
        const allowed = getAllowedCategories(vendor, fullmindEngagement, competitorEngagement);
        const vt = allowed
          ? sumCategories(vendorData.byCategory, allowed)
          : vendorData;
        combined.count += vt.count;
        combined.totalEnrollment += vt.totalEnrollment;
        combined.openPipeline += vt.openPipeline;
        combined.closedWonBookings += vt.closedWonBookings;
        combined.invoicing += vt.invoicing;
        combined.scheduledRevenue += vt.scheduledRevenue;
        combined.deliveredRevenue += vt.deliveredRevenue;
        combined.deferredRevenue += vt.deferredRevenue;
        combined.totalRevenue += vt.totalRevenue;
        combined.deliveredTake += vt.deliveredTake;
        combined.scheduledTake += vt.scheduledTake;
        combined.allTake += vt.allTake;
      }
      return combined;
    }

    // Single vendor — filter combined byCategory directly
    const singleVendor = [...activeVendors][0];
    const allowed = singleVendor
      ? getAllowedCategories(singleVendor, fullmindEngagement, competitorEngagement)
      : null;
    if (!allowed) return data;
    return sumCategories(data.byCategory, allowed);
  }, [data, fullmindEngagement, competitorEngagement, hasAnyEngagementFilter, activeVendors]);

  // Per-vendor totals (only present when 2+ vendors active)
  const vendorTotals = useMemo<VendorTotalsMap | null>(() => {
    if (!data?.byVendor) return null;

    const result: VendorTotalsMap = {};

    for (const [vendor, vendorData] of Object.entries(data.byVendor)) {
      const allowed = getAllowedCategories(vendor, fullmindEngagement, competitorEngagement);
      if (allowed) {
        result[vendor as VendorId] = {
          totals: sumCategories(vendorData.byCategory, allowed),
        };
      } else {
        result[vendor as VendorId] = {
          totals: {
            count: vendorData.count,
            totalEnrollment: vendorData.totalEnrollment,
            openPipeline: vendorData.openPipeline,
            closedWonBookings: vendorData.closedWonBookings,
            invoicing: vendorData.invoicing,
            scheduledRevenue: vendorData.scheduledRevenue,
            deliveredRevenue: vendorData.deliveredRevenue,
            deferredRevenue: vendorData.deferredRevenue,
            totalRevenue: vendorData.totalRevenue,
            deliveredTake: vendorData.deliveredTake,
            scheduledTake: vendorData.scheduledTake,
            allTake: vendorData.allTake,
          },
        };
      }
    }

    return result;
  }, [data, fullmindEngagement, competitorEngagement]);

  // Unfiltered totals – always the raw API response totals (before engagement sub-filter)
  const unfilteredTotals = useMemo<SummaryTotals>(() => {
    if (!data) return EMPTY_TOTALS;
    return {
      count: data.count,
      totalEnrollment: data.totalEnrollment,
      openPipeline: data.openPipeline,
      closedWonBookings: data.closedWonBookings,
      invoicing: data.invoicing,
      scheduledRevenue: data.scheduledRevenue,
      deliveredRevenue: data.deliveredRevenue,
      deferredRevenue: data.deferredRevenue,
      totalRevenue: data.totalRevenue,
      deliveredTake: data.deliveredTake,
      scheduledTake: data.scheduledTake,
      allTake: data.allTake,
    };
  }, [data]);

  const unfilteredVendorTotals = useMemo<VendorTotalsMap | null>(() => {
    if (!data?.byVendor) return null;
    const result: VendorTotalsMap = {};
    for (const [vendor, vendorData] of Object.entries(data.byVendor)) {
      result[vendor as VendorId] = {
        totals: {
          count: vendorData.count,
          totalEnrollment: vendorData.totalEnrollment,
          openPipeline: vendorData.openPipeline,
          closedWonBookings: vendorData.closedWonBookings,
          invoicing: vendorData.invoicing,
          scheduledRevenue: vendorData.scheduledRevenue,
          deliveredRevenue: vendorData.deliveredRevenue,
          deferredRevenue: vendorData.deferredRevenue,
          totalRevenue: vendorData.totalRevenue,
          deliveredTake: vendorData.deliveredTake,
          scheduledTake: vendorData.scheduledTake,
          allTake: vendorData.allTake,
        },
      };
    }
    return result;
  }, [data]);

  const isSubFiltered = hasAnyEngagementFilter;

  return {
    totals,
    vendorTotals,
    unfilteredTotals,
    unfilteredVendorTotals,
    isSubFiltered,
    isLoading: isLoading && enabled,
    error,
    enabled,
  };
}
