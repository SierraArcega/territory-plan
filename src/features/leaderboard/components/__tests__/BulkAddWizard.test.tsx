import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BulkAddWizard from "../BulkAddWizard";
import type { IncreaseTarget } from "../../lib/types";

vi.mock("../../lib/queries", () => ({
  useMyPlans: () => ({ data: [{ id: "p1", name: "FY27 West", owner: { id: "u1" } }], isLoading: false }),
  useAddDistrictToPlanMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ added: 1 }), isPending: false }),
}));

const makeRow = (overrides: Partial<IncreaseTarget>): IncreaseTarget =>
  ({
    leaid: "1", districtName: "Test", state: "CA", enrollment: null, lmsId: null,
    category: "missing_renewal", fy26Revenue: 100000, fy26CompletedRevenue: 0,
    fy26ScheduledRevenue: 0, fy26SessionCount: null, fy26SubscriptionCount: null,
    fy26OppBookings: 0, fy26MinBookings: 0, priorYearRevenue: 0, priorYearVendor: null,
    priorYearFy: null, inFy27Plan: false, planIds: [], hasFy27Target: false,
    hasFy27Pipeline: false, fy27OpenPipeline: 0, inPlan: false, lastClosedWon: null,
    productTypes: [], subProducts: [],
    revenueTrend: { fy24: null, fy25: null, fy26: 100000, fy27: null },
    suggestedTarget: 105000,
    ...overrides,
  }) as IncreaseTarget;

function renderWizard(rows: IncreaseTarget[]) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <BulkAddWizard rows={rows} onClose={() => {}} onFinish={() => {}} />
    </QueryClientProvider>,
  );
}

describe("BulkAddWizard", () => {
  it("renders current district name and step indicator", () => {
    renderWizard([
      makeRow({ leaid: "1", districtName: "Pasadena USD" }),
      makeRow({ leaid: "2", districtName: "Katy ISD" }),
    ]);
    expect(screen.getByText("Pasadena USD")).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument();
  });

  it("pre-fills target with suggestedTarget", () => {
    renderWizard([makeRow({ suggestedTarget: 335000 })]);
    const input = screen.getByLabelText(/Target/i) as HTMLInputElement;
    expect(input.value).toBe("335000");
  });

  it("disables Add & continue until plan and target are set", () => {
    renderWizard([makeRow({ suggestedTarget: null })]);
    expect(screen.getByRole("button", { name: /Add & continue|Add & finish/ })).toBeDisabled();
  });
});
