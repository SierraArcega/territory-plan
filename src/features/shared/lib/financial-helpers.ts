import type { DistrictFinancial } from "@/features/shared/types/api-types";

/**
 * Financial data from the DistrictFinancials relation.
 * Matches the shape returned by Prisma select on the model.
 */
interface FinancialRecord {
  fiscalYear: string;
  vendor: string;
  totalRevenue: unknown; // Prisma Decimal
  totalTake: unknown;
  sessionCount: number | null;
  subscriptionCount: number | null;
  closedWonOppCount: number | null;
  closedWonBookings: unknown;
  invoicing: unknown;
  openPipeline: unknown;
  openPipelineOppCount: number | null;
  weightedPipeline: unknown;
}

/** Convert Prisma Decimal or number to plain number */
function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "toNumber" in (v as Record<string, unknown>)) {
    return Number(v);
  }
  return Number(v) || 0;
}

/**
 * Select fields needed from districtFinancials for the helper.
 * Use this in Prisma `include` to get the right shape.
 */
export const FULLMIND_FINANCIALS_SELECT = {
  fiscalYear: true,
  vendor: true,
  totalRevenue: true,
  totalTake: true,
  sessionCount: true,
  subscriptionCount: true,
  closedWonOppCount: true,
  closedWonBookings: true,
  invoicing: true,
  openPipeline: true,
  openPipelineOppCount: true,
  weightedPipeline: true,
} as const;

/**
 * Get a single financial metric from a DistrictFinancial[] array.
 * Returns null if no matching record or if the field is null.
 */
export function getFinancial(
  financials: DistrictFinancial[],
  vendor: string,
  fiscalYear: string,
  field: keyof Omit<DistrictFinancial, "vendor" | "fiscalYear">
): number | null {
  const record = financials.find(
    (f) => f.vendor === vendor && f.fiscalYear === fiscalYear
  );
  if (!record) return null;
  return record[field];
}

/**
 * Get a single financial metric for a given vendor and fiscal year.
 * Useful for routes that need one specific value (e.g., pipeline for a plan's FY).
 */
export function getFinancialValue(
  financials: FinancialRecord[],
  vendor: string,
  fiscalYear: string,
  field: keyof Omit<FinancialRecord, "fiscalYear" | "vendor">
): number {
  const record = financials.find(
    (f) => f.vendor === vendor && f.fiscalYear === fiscalYear
  );
  if (!record) return 0;
  const value = record[field];
  return typeof value === "number" ? value : toNum(value);
}

/** Convert Prisma Decimal or number to plain number | null */
function toNumOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && "toNumber" in (v as Record<string, unknown>)) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || null;
}

/**
 * Convert Prisma districtFinancials relation data to plain DistrictFinancial[].
 * Handles Decimal → number conversion and renames totalTake → allTake.
 */
export function serializeFinancials(
  prismaRecords: Array<{
    vendor: string;
    fiscalYear: string;
    totalRevenue: unknown;
    totalTake: unknown;
    sessionCount: number | null;
    subscriptionCount?: number | null;
    closedWonOppCount: number | null;
    closedWonBookings: unknown;
    invoicing: unknown;
    openPipelineOppCount: number | null;
    openPipeline: unknown;
    weightedPipeline: unknown;
    poCount?: number | null;
  }>
): DistrictFinancial[] {
  return prismaRecords.map((r) => ({
    vendor: r.vendor,
    fiscalYear: r.fiscalYear,
    totalRevenue: toNumOrNull(r.totalRevenue),
    allTake: toNumOrNull(r.totalTake),
    sessionCount: r.sessionCount,
    subscriptionCount: r.subscriptionCount ?? null,
    closedWonOppCount: r.closedWonOppCount,
    closedWonBookings: toNumOrNull(r.closedWonBookings),
    invoicing: toNumOrNull(r.invoicing),
    openPipelineOppCount: r.openPipelineOppCount,
    openPipeline: toNumOrNull(r.openPipeline),
    weightedPipeline: toNumOrNull(r.weightedPipeline),
    poCount: r.poCount ?? null,
  }));
}
