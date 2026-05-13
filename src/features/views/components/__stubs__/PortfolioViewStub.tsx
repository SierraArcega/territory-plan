"use client";

/**
 * Phase B placeholder for the All-Plans portfolio dashboard.
 *
 * The real PortfolioView (with card grid, archived tab, new-plan card) lands
 * in Phase F. Until then this stub renders a minimal scaffold so the
 * /views route is wired end-to-end without blocking on later phases.
 */
export default function PortfolioViewStub() {
  return (
    <section className="flex-1 min-w-0 px-6 py-8 bg-[#FFFCFA] overflow-y-auto">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
          FY26 Portfolio
        </p>
        <h1 className="text-[22px] font-bold text-[#403770] tracking-tight whitespace-nowrap">
          All plans
        </h1>
      </header>
      <div className="rounded-lg border border-[#D4CFE2] bg-white p-6 text-sm text-[#6E6390]">
        <p className="whitespace-nowrap">Portfolio view is coming in a later phase.</p>
        <p className="mt-2 text-[#8A80A8]">
          The real PortfolioView (card grid + Active/Archived tabs + + New plan
          card) lands in Phase F. For now this stub confirms the /views entry
          route is wired end-to-end.
        </p>
      </div>
    </section>
  );
}
