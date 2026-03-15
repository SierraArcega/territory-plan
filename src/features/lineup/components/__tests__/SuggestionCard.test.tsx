import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LineSuggestion } from "@/features/lineup/lib/queries";

vi.mock("@/lib/api", () => ({
  useCreateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateActivity: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useTerritoryPlans: vi.fn(() => ({ data: [] })),
  useStates: vi.fn(() => ({ data: [] })),
  useUsers: vi.fn(() => ({ data: [] })),
  useProfile: vi.fn(() => ({ data: { id: "user-1" } })),
}));

vi.mock("@/features/activities/lib/queries", () => ({
  useActivity: vi.fn(() => ({ data: null, isLoading: false })),
  useLinkActivityDistricts: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}) })),
}));

import SuggestionCard from "../SuggestionCard";

const suggestion: LineSuggestion = {
  activityType: "phone_call",
  title: "Renewal Check-in — Jeffco SD",
  districtLeaid: "0812345",
  districtName: "Jeffco School District",
  planId: "plan-1",
  planName: "Colorado Expansion Plan",
  contractValue: 180000,
  lastContactDays: 21,
  renewalWeeks: 6,
  opportunityType: "renewal",
  reasoning: "Securing this renewal closes your entire earnings gap for FY2026.",
  goalTags: ["Renewal goal", "Earnings goal"],
  riskTags: ["At risk"],
};

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("SuggestionCard", () => {
  it("renders activity type and title", () => {
    render(<SuggestionCard suggestion={suggestion} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/renewal check-in — jeffco sd/i)).toBeInTheDocument();
  });

  it("renders district and plan names", () => {
    render(<SuggestionCard suggestion={suggestion} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/jeffco school district/i)).toBeInTheDocument();
    expect(screen.getByText(/colorado expansion plan/i)).toBeInTheDocument();
  });

  it("renders metric chips with formatted values", () => {
    render(<SuggestionCard suggestion={suggestion} />, { wrapper: makeWrapper() });
    expect(screen.getByText("$180,000")).toBeInTheDocument();
    expect(screen.getByText("21 days ago")).toBeInTheDocument();
    expect(screen.getByText("6 weeks")).toBeInTheDocument();
  });

  it("renders the reasoning", () => {
    render(<SuggestionCard suggestion={suggestion} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/securing this renewal closes/i)).toBeInTheDocument();
  });

  it("renders goal and risk tags", () => {
    render(<SuggestionCard suggestion={suggestion} />, { wrapper: makeWrapper() });
    expect(screen.getByText("Renewal goal")).toBeInTheDocument();
    expect(screen.getByText("At risk")).toBeInTheDocument();
  });

  it("shows ActivityFormModal when Schedule is clicked", async () => {
    render(<SuggestionCard suggestion={suggestion} />, { wrapper: makeWrapper() });
    await userEvent.click(screen.getByRole("button", { name: /schedule/i }));
    // ActivityFormModal does not use role="dialog" — check for the modal heading instead
    expect(screen.getByRole("heading", { name: /new activity/i })).toBeInTheDocument();
  });
});
