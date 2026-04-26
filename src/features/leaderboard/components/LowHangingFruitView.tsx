"use client";

import { useMemo, useState } from "react";
import { useLowHangingFruitList } from "../lib/queries";
import type { IncreaseTarget, IncreaseTargetCategory } from "../lib/types";
import { formatCurrency } from "@/features/shared/lib/format";
import {
  DEFAULT_FILTERS,
  applyFilters,
  type LHFFilters,
} from "../lib/filters";
import LowHangingFruitCard from "./LowHangingFruitCard";
import LowHangingFruitFilterBar from "./LowHangingFruitFilterBar";
import LowHangingFruitDetailDrawer from "./LowHangingFruitDetailDrawer";
import BulkAddWizard from "./BulkAddWizard";

type SortKey = "revenue" | "lastSale" | "category";

function sortRows(rows: IncreaseTarget[], sort: SortKey): IncreaseTarget[] {
  const copy = [...rows];
  if (sort === "revenue") {
    copy.sort((a, b) => {
      const av = a.category === "missing_renewal" ? a.fy26Revenue : a.priorYearRevenue;
      const bv = b.category === "missing_renewal" ? b.fy26Revenue : b.priorYearRevenue;
      return bv - av;
    });
  } else if (sort === "lastSale") {
    copy.sort((a, b) => {
      const ad = a.lastClosedWon?.closeDate ? Date.parse(a.lastClosedWon.closeDate) : 0;
      const bd = b.lastClosedWon?.closeDate ? Date.parse(b.lastClosedWon.closeDate) : 0;
      return bd - ad;
    });
  } else {
    const priority: Record<IncreaseTargetCategory, number> = {
      missing_renewal: 0, fullmind_winback: 1, ek12_winback: 2,
    };
    copy.sort((a, b) => priority[a.category] - priority[b.category]);
  }
  return copy;
}

export default function LowHangingFruitView() {
  const query = useLowHangingFruitList();
  const [filters, setFilters] = useState<LHFFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("revenue");
  const [selectedLeaids, setSelectedLeaids] = useState<Set<string>>(new Set());
  const [drawerRow, setDrawerRow] = useState<IncreaseTarget | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const allRows = query.data?.districts ?? [];

  const facets = useMemo(() => {
    const categoryCounts: Record<IncreaseTargetCategory, number> = {
      missing_renewal: 0, fullmind_winback: 0, ek12_winback: 0,
    };
    const states = new Set<string>();
    const products = new Set<string>();
    for (const r of allRows) {
      categoryCounts[r.category]++;
      if (r.state) states.add(r.state);
      for (const p of r.productTypes) products.add(p);
    }
    return {
      categoryCounts,
      states: [...states].sort(),
      products: [...products].sort(),
    };
  }, [allRows]);

  const filtered = useMemo(() => sortRows(applyFilters(allRows, filters), sort), [allRows, filters, sort]);

  const selectedRows = useMemo(
    () => allRows.filter((r) => selectedLeaids.has(r.leaid)),
    [allRows, selectedLeaids],
  );

  const toggleSelect = (leaid: string) => {
    setSelectedLeaids((prev) => {
      const next = new Set(prev);
      if (next.has(leaid)) next.delete(leaid);
      else next.add(leaid);
      return next;
    });
  };

  const totalSelectedRevenue = selectedRows.reduce(
    (s, r) => s + (r.category === "missing_renewal" ? r.fy26Revenue : r.priorYearRevenue),
    0,
  );

  return (
    <div className="flex flex-col h-full bg-[#FFFCFA] overflow-hidden">
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC] bg-white">
        <div>
          <h1 className="text-xl font-bold text-[#403770]">Low Hanging Fruit</h1>
          <p className="text-xs text-[#6E6390]">
            {allRows.length} {allRows.length === 1 ? "district" : "districts"}
            {" · "}
            {formatCurrency(query.data?.totalRevenueAtRisk ?? 0, true)} FY26 revenue unclaimed
          </p>
        </div>
      </header>

      <LowHangingFruitFilterBar filters={filters} facets={facets} onChange={setFilters} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <main className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-shrink-0 px-6 py-3 flex items-center justify-between border-b border-[#E2DEEC] bg-white">
            <div className="text-xs text-[#6E6390]">
              Showing {filtered.length} of {allRows.length}
            </div>
            <label className="text-xs text-[#6E6390]">
              Sort:{" "}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="ml-1 border border-[#C2BBD4] rounded px-1.5 py-0.5 bg-white text-[#403770]"
              >
                <option value="revenue">Revenue (high → low)</option>
                <option value="lastSale">Last sale (recent → old)</option>
                <option value="category">Category</option>
              </select>
            </label>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
          {query.isLoading ? (
            <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[180px] bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="m-6 px-3 py-2 rounded-md bg-[#fef1f0] border border-[#f58d85] flex items-center justify-between gap-3">
              <span className="text-xs text-[#544A78]">Couldn&apos;t load the list.</span>
              <button className="text-xs font-semibold text-[#403770] hover:underline" onClick={() => query.refetch()}>
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-center">
              <div>
                <p className="text-sm text-[#6E6390] mb-2">
                  {allRows.length === 0
                    ? "Every FY26 customer has FY27 activity. Nothing to claim right now."
                    : "No districts match these filters."}
                </p>
                {allRows.length > 0 && (
                  <button
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="text-xs font-semibold text-[#403770] hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((row) => (
                <LowHangingFruitCard
                  key={row.leaid}
                  row={row}
                  selected={selectedLeaids.has(row.leaid)}
                  onToggleSelect={toggleSelect}
                  onOpenDetail={setDrawerRow}
                  onAddSuccess={(name) => setToast(`Added to ${name}`)}
                />
              ))}
            </div>
          )}
          </div>
        </main>
      </div>

      {selectedLeaids.size > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 bg-[#403770] text-white shadow-lg">
          <span className="text-sm">
            {selectedLeaids.size} selected · {formatCurrency(totalSelectedRevenue, true)} total
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedLeaids(new Set())}
              className="text-xs hover:underline"
            >
              Clear
            </button>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold bg-white text-[#403770] hover:bg-[#EFEDF5]"
            >
              Add selected to plan →
            </button>
          </div>
        </div>
      )}

      <LowHangingFruitDetailDrawer
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
        onAddSuccess={(name) => {
          setDrawerRow(null);
          setToast(`Added to ${name}`);
        }}
      />

      {wizardOpen && selectedRows.length > 0 && (
        <BulkAddWizard
          rows={selectedRows}
          onClose={() => setWizardOpen(false)}
          onFinish={(count, plan) => {
            setWizardOpen(false);
            setSelectedLeaids(new Set());
            if (count > 0) setToast(`Added ${count} ${count === 1 ? "district" : "districts"}${plan ? ` to ${plan}` : ""}`);
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed top-4 right-4 z-50 px-3 py-2 rounded-md bg-[#EDFFE3] border border-[#8AC670] text-xs text-[#544A78] shadow-lg"
          onAnimationEnd={() => setToast(null)}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
