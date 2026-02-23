"use client";

import { useMapSummary, type SummaryTotals, type VendorTotalsMap } from "@/features/map/lib/useMapSummary";
import { useMapV2Store } from "@/features/map/lib/store";
import { VENDOR_CONFIGS, VENDOR_IDS, type VendorId } from "@/features/map/lib/layers";
import { getVendorPalette } from "@/features/map/lib/palettes";
import { formatCurrency, formatNumber } from "@/features/shared/lib/format";
import ViewActionsBar from "@/features/map/components/ViewActionsBar";

function Skeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-2 w-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-3.5 w-14 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider leading-none">
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-700 tabular-nums leading-tight mt-0.5">
        {value}
      </span>
    </div>
  );
}

function Sep({ className = "h-6" }: { className?: string }) {
  return <div className={`w-px bg-gray-200/60 shrink-0 ${className}`} />;
}

function FinancialStats({
  t,
  unfilteredCount,
  height = "h-6",
}: {
  t: SummaryTotals;
  unfilteredCount?: number;
  height?: string;
}) {
  const showOfTotal =
    unfilteredCount != null && unfilteredCount !== t.count;
  return (
    <>
      <Stat
        label="Districts"
        value={
          showOfTotal
            ? `${formatNumber(t.count)} of ${formatNumber(unfilteredCount)}`
            : formatNumber(t.count)
        }
      />
      <Sep className={height} />
      <Stat label="Enrollment" value={formatNumber(t.totalEnrollment)} />
      <Sep className={height} />
      <Stat label="Pipeline" value={formatCurrency(t.openPipeline, true)} />
      <Sep className={height} />
      <Stat label="Bookings" value={formatCurrency(t.closedWonBookings, true)} />
      <Sep className={height} />
      <Stat label="Invoicing" value={formatCurrency(t.invoicing, true)} />
      <Sep className={height} />
      <Stat label="Sched Rev" value={formatCurrency(t.scheduledRevenue, true)} />
      <Sep className={height} />
      <Stat label="Deliv Rev" value={formatCurrency(t.deliveredRevenue, true)} />
      <Sep className={height} />
      <Stat label="Def Rev" value={formatCurrency(t.deferredRevenue, true)} />
      <Sep className={height} />
      <Stat label="Total Rev" value={formatCurrency(t.totalRevenue, true)} />
      <Sep className={height} />
      <Stat label="Deliv Take" value={formatCurrency(t.deliveredTake, true)} />
      <Sep className={height} />
      <Stat label="Sched Take" value={formatCurrency(t.scheduledTake, true)} />
      <Sep className={height} />
      <Stat label="All Take" value={formatCurrency(t.allTake, true)} />
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
    <div className="flex items-center gap-3 px-4 py-1.5 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0 min-w-[90px]">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: palette.dotColor }}
        />
        <span className="text-xs font-medium text-gray-600 truncate">{label}</span>
      </div>
      <FinancialStats t={entry.totals} unfilteredCount={unfilteredCount} height="h-5" />
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

  if (!enabled) return null;

  const showVendorBreakdown = activeVendors.size >= 2 && vendorTotals != null;

  return (
    <div className="absolute bottom-6 left-6 z-10">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 overflow-hidden">
        <ViewActionsBar />
        {isLoading ? (
          <Skeleton />
        ) : (
          <>
            <div className="flex items-center gap-4 px-4 py-2.5 overflow-x-auto">
              <FinancialStats
                t={totals}
                unfilteredCount={isSubFiltered ? unfilteredTotals.count : undefined}
              />
            </div>
            {showVendorBreakdown && (
              <>
                <div className="h-px bg-gray-200/80 mx-3" />
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
