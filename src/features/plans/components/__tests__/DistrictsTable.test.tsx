import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DistrictsTable from "../DistrictsTable";
import type { TerritoryPlanDistrict } from "@/features/shared/types/api-types";

function makeDistrict(overrides: Partial<TerritoryPlanDistrict> = {}): TerritoryPlanDistrict {
  return {
    leaid: "d1",
    addedAt: "2026-01-01T00:00:00Z",
    name: "Default District",
    stateAbbrev: "CA",
    enrollment: null,
    owner: null,
    renewalTarget: null,
    winbackTarget: null,
    expansionTarget: null,
    newBusinessTarget: null,
    notes: null,
    returnServices: [],
    newServices: [],
    tags: [],
    ...overrides,
  };
}

function renderTable(districts: TerritoryPlanDistrict[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DistrictsTable
        districts={districts}
        planId="p1"
        onRemove={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe("DistrictsTable sorting", () => {
  it("clicking District header sorts by name ascending", () => {
    const districts = [
      makeDistrict({ leaid: "1", name: "Zeta USD" }),
      makeDistrict({ leaid: "2", name: "Alpha USD" }),
    ];
    renderTable(districts);
    fireEvent.click(screen.getByRole("columnheader", { name: /^district$/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha USD");
    expect(rows[1]).toHaveTextContent("Zeta USD");
  });

  it("clicking District again sorts descending", () => {
    const districts = [
      makeDistrict({ leaid: "1", name: "Zeta USD" }),
      makeDistrict({ leaid: "2", name: "Alpha USD" }),
    ];
    renderTable(districts);
    const th = screen.getByRole("columnheader", { name: /^district$/i });
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zeta USD");
    expect(rows[1]).toHaveTextContent("Alpha USD");
  });

  it("third click restores original order", () => {
    const districts = [
      makeDistrict({ leaid: "1", name: "Charlie USD" }),
      makeDistrict({ leaid: "2", name: "Alpha USD" }),
      makeDistrict({ leaid: "3", name: "Beta USD" }),
    ];
    renderTable(districts);
    const th = screen.getByRole("columnheader", { name: /^district$/i });
    fireEvent.click(th);  // asc: Alpha, Beta, Charlie
    fireEvent.click(th);  // desc: Charlie, Beta, Alpha
    fireEvent.click(th);  // reset: Charlie, Alpha, Beta (original)
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Charlie USD"); // original first
    expect(rows[1]).toHaveTextContent("Alpha USD");   // original second
    expect(rows[2]).toHaveTextContent("Beta USD");    // original third
  });

  it("Services column header has no sort", () => {
    renderTable([makeDistrict()]);
    const servicesHeader = screen.queryByRole("columnheader", { name: /services/i });
    if (servicesHeader) expect(servicesHeader).not.toHaveAttribute("aria-sort");
  });

  it("Revenue column sorts by actuals.totalRevenue ascending, nulls last", () => {
    const makeActuals = (totalRevenue: number) => ({
      totalRevenue,
      completedRevenue: 0,
      scheduledRevenue: 0,
      totalTake: 0,
      completedTake: 0,
      scheduledTake: 0,
      takeRate: null,
      openPipeline: 0,
      weightedPipeline: 0,
      invoiced: 0,
      credited: 0,
      oppCount: 0,
      priorFyRevenue: 0,
      priorFyTake: 0,
      yoyRevenueChange: null,
    });
    const districts = [
      makeDistrict({ leaid: "1", name: "A", actuals: makeActuals(100) }),
      makeDistrict({ leaid: "2", name: "B" }), // no actuals → null last
      makeDistrict({ leaid: "3", name: "C", actuals: makeActuals(50) }),
    ];
    renderTable(districts);
    // The Revenue header now includes tooltip text in its accessible name; match on the prefix only
    fireEvent.click(screen.getByRole("columnheader", { name: /^revenue/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("C"); // 50 < 100
    expect(rows[2]).toHaveTextContent("B"); // null last
  });
});
