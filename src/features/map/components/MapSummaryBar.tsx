"use client";

import { useMapSummary, type SummaryTotals, type VendorTotalsMap } from "@/features/map/lib/useMapSummary";
import { useMapV2Store, ALL_METRIC_IDS, type MetricId } from "@/features/map/lib/store";
import { VENDOR_CONFIGS, VENDOR_IDS, type VendorId } from "@/features/map/lib/layers";
import { getVendorPalette } from "@/features/map/lib/palettes";
import { formatCurrency, formatNumber } from "@/features/shared/lib/format";
import ViewActionsBar from "@/features/map/components/ViewActionsBar";

function Skeleton() {
  return (
    <div className="flex items-center gap-3 xl:gap-5 px-3 xl:px-5 py-2.5 xl:py-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-2.5 w-12 bg-robins-egg/20 rounded animate-pulse" />
          <div className="h-4 w-16 bg-robins-egg/15 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, compactLabel, value }: { label: string; compactLabel: string; value: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10px] xl:text-[11px] font-medium text-plum/50 uppercase tracking-wider leading-none">
        <span className="xl:hidden">{compactLabel}</span>
        <span className="hidden xl:inline">{label}</span>
      </span>
      <span className="text-[13px] xl:text-[15px] font-semibold text-plum tabular-nums leading-tight mt-0.5">
        {value}
      </span>
    </div>
  );
}

function Sep({ className = "h-5 xl:h-6" }: { className?: string }) {
  return <div className={`w-px bg-plum/10 shrink-0 ${className}`} />;
}

const METRIC_CONFIG: Record<MetricId, { label: string; compactLabel: string; format: (t: SummaryTotals) => string }> = {
  districts: { label: "Districts", compactLabel: "Dist", format: (t) => formatNumber(t.count) },
  enrollment: { label: "Enrollment", compactLabel: "Enroll", format: (t) => formatNumber(t.totalEnrollment) },
  pipeline: { label: "Pipeline", compactLabel: "Pipe", format: (t) => formatCurrency(t.openPipeline, true) },
  bookings: { label: "Bookings", compactLabel: "Book", format: (t) => formatCurrency(t.closedWonBookings, true) },
  invoicing: { label: "Invoicing", compactLabel: "Inv", format: (t) => formatCurrency(t.invoicing, true) },
  scheduledRevenue: { label: "Sched Rev", compactLabel: "Sched Rev", format: (t) => formatCurrency(t.scheduledRevenue, true) },
  deliveredRevenue: { label: "Deliv Rev", compactLabel: "Deliv Rev", format: (t) => formatCurrency(t.deliveredRevenue, true) },
  deferredRevenue: { label: "Def Rev", compactLabel: "Def Rev", format: (t) => formatCurrency(t.deferredRevenue, true) },
  totalRevenue: { label: "Total Rev", compactLabel: "Tot Rev", format: (t) => formatCurrency(t.totalRevenue, true) },
  deliveredTake: { label: "Deliv Take", compactLabel: "Deliv Take", format: (t) => formatCurrency(t.deliveredTake, true) },
  scheduledTake: { label: "Sched Take", compactLabel: "Sched Take", format: (t) => formatCurrency(t.scheduledTake, true) },
  allTake: { label: "All Take", compactLabel: "All Take", format: (t) => formatCurrency(t.allTake, true) },
};

function FinancialStats({
  t,
  unfilteredCount,
  height = "h-5 xl:h-6",
}: {
  t: SummaryTotals;
  unfilteredCount?: number;
  height?: string;
}) {
  const visibleMetrics = useMapV2Store((s) => s.visibleMetrics);
  const showOfTotal =
    unfilteredCount != null && unfilteredCount !== t.count;

  const visible = ALL_METRIC_IDS.filter((id) => visibleMetrics.has(id));

  return (
    <>
      {visible.map((id, i) => {
        const cfg = METRIC_CONFIG[id];
        const value =
          id === "districts" && showOfTotal
            ? `${formatNumber(t.count)} of ${formatNumber(unfilteredCount!)}`
            : cfg.format(t);
        return (
          <span key={id} className="contents">
            {i > 0 && <Sep className={height} />}
            <Stat label={cfg.label} compactLabel={cfg.compactLabel} value={value} />
          </span>
        );
      })}
    </>
  );
}

function VendorRow({
  vendorId,
  vendorTotals,
  unfilteredVendorTotals,
}: {
  vendorId: VendorId;
  vendorTotals: VendorTotalsMap;
  unfilteredVendorTotals: VendorTotalsMap | null;
}) {
  const vendorPalettes = useMapV2Store((s) => s.vendorPalettes);
  const entry = vendorTotals[vendorId];
  if (!entry) return null;

  const palette = getVendorPalette(vendorPalettes[vendorId]);
  const label = VENDOR_CONFIGS[vendorId].label;
  const unfilteredCount = unfilteredVendorTotals?.[vendorId]?.totals.count;

  return (
    <div className="flex items-center gap-3 xl:gap-4 px-3 xl:px-5 py-1.5 xl:py-2 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0 min-w-[80px] xl:min-w-[90px]">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: palette.dotColor }}
        />
        <span className="text-xs font-medium text-plum/70 truncate">{label}</span>
      </div>
      <FinancialStats t={entry.totals} unfilteredCount={unfilteredCount} height="h-4 xl:h-5" />
    </div>
  );
}

export default function MapSummaryBar() {
  const {
    totals,
    vendorTotals,
    unfilteredTotals,
    unfilteredVendorTotals,
    isSubFiltered,
    isLoading,
    enabled,
  } = useMapSummary();
  const activeVendors = useMapV2Store((s) => s.activeVendors);
  const summaryBarVisible = useMapV2Store((s) => s.summaryBarVisible);
  const toggleSummaryBar = useMapV2Store((s) => s.toggleSummaryBar);

  if (!enabled) return null;

  if (!summaryBarVisible) {
    return (
      <div className="absolute bottom-6 left-6 z-10">
        <button
          onClick={toggleSummaryBar}
          className="bg-off-white/85 backdrop-blur-md rounded-lg ring-1 ring-plum/[0.06] border border-white/60 px-3 py-2 text-xs font-medium text-plum/50 hover:text-plum/70 transition-colors"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)" }}
          title="Show summary bar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 012 10z" />
          </svg>
        </button>
      </div>
    );
  }

  const showVendorBreakdown = activeVendors.size >= 2 && vendorTotals != null;

  return (
    <div className="absolute bottom-6 left-6 z-10">
      <div
        className="bg-off-white/85 backdrop-blur-md rounded-xl ring-1 ring-plum/[0.06] border border-white/60"
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)" }}
      >
        <ViewActionsBar />
        {isLoading ? (
          <Skeleton />
        ) : (
          <>
            <div className="flex items-center gap-3 xl:gap-5 px-3 xl:px-5 py-2.5 xl:py-3 overflow-x-auto">
              <FinancialStats
                t={totals}
                unfilteredCount={isSubFiltered ? unfilteredTotals.count : undefined}
              />
              <button
                onClick={toggleSummaryBar}
                className="ml-auto text-plum/25 hover:text-plum/50 p-0.5 rounded transition-colors shrink-0"
                title="Hide summary bar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            {showVendorBreakdown && (
              <>
                <div className="h-px bg-plum/10 mx-3" />
                {VENDOR_IDS.filter((v) => activeVendors.has(v)).map((vendorId) => (
                  <VendorRow
                    key={vendorId}
                    vendorId={vendorId}
                    vendorTotals={vendorTotals}
                    unfilteredVendorTotals={isSubFiltered ? unfilteredVendorTotals : null}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
