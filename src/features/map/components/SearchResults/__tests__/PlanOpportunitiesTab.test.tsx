import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlanOpportunitiesTab from "../PlanOpportunitiesTab";
import type { PlanOpportunityRow } from "@/features/shared/types/api-types";

vi.mock("@/lib/api", () => ({
  usePlanOpportunities: vi.fn(),
}));

import { usePlanOpportunities } from "@/lib/api";

function makeOpp(overrides: Partial<PlanOpportunityRow> = {}): PlanOpportunityRow {
  return {
    id: "opp-1",
    name: "Linked Opp",
    districtName: "Some District",
    districtLeaId: "0123456",
    stage: "2 - Presentation",
    contractType: "New Business",
    netBookingAmount: 1000,
    totalRevenue: 1000,
    totalTake: 500,
    completedRevenue: 0,
    scheduledRevenue: 1000,
    closeDate: null,
    minimumPurchaseAmount: null,
    maximumBudget: null,
    detailsLink: null,
    stageHistory: [],
    startDate: null,
    expiration: null,
    ...overrides,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("PlanOpportunitiesTab", () => {
  it("renders Name as an external link when detailsLink is present", () => {
    vi.mocked(usePlanOpportunities).mockReturnValue({
      data: [makeOpp({ name: "Linked Opp", detailsLink: "https://lms.example.com/opps/1" })],
      isLoading: false,
      error: null,
    } as never);

    renderWithQuery(<PlanOpportunitiesTab planId="plan-1" />);
    const link = screen.getByRole("link", { name: /Linked Opp/ });
    expect(link).toHaveAttribute("href", "https://lms.example.com/opps/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders Name as plain text when detailsLink is null", () => {
    vi.mocked(usePlanOpportunities).mockReturnValue({
      data: [makeOpp({ name: "Plain Opp", detailsLink: null })],
      isLoading: false,
      error: null,
    } as never);

    renderWithQuery(<PlanOpportunitiesTab planId="plan-1" />);
    expect(screen.getByText("Plain Opp")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Plain Opp/ })).toBeNull();
  });
});
