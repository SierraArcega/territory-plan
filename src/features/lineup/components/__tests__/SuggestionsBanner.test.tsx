import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/features/lineup/lib/queries", () => ({
  useLineupSuggestions: vi.fn(),
  useSuggestionFeedback: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

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
  useLinkActivityDistricts: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useLineupSuggestions, useSuggestionFeedback } from "@/features/lineup/lib/queries";
const mockUseSuggestions = vi.mocked(useLineupSuggestions);
const mockUseFeedback = vi.mocked(useSuggestionFeedback);

import SuggestionsBanner from "../SuggestionsBanner";

const fakeSuggestions = [
  {
    activityType: "phone_call",
    title: "Renewal Check-in — Jeffco",
    districtLeaid: null,
    districtName: "Jeffco SD",
    planId: null,
    planName: null,
    contractValue: 180000,
    lastContactDays: 21,
    renewalWeeks: 6,
    opportunityType: "renewal" as const,
    reasoning: "High value renewal.",
    goalTags: ["Renewal goal"],
    riskTags: ["At risk"],
  },
];

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("SuggestionsBanner", () => {
  const TODAY = "2026-03-14";

  beforeEach(() => {
    mockUseFeedback.mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSuggestionFeedback>);
  });

  it("renders nothing when not viewing today", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: null, isLoading: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useLineupSuggestions>);
    const { container } = render(
      <SuggestionsBanner date="2026-03-13" activityCount={0} />,
      { wrapper: makeWrapper() }
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows shimmer/loading state while fetching", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: null, isLoading: true, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useLineupSuggestions>);
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });
    expect(screen.getByTestId("suggestions-banner-loading")).toBeInTheDocument();
  });

  it("shows error message and retry button on fetch error", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: null, isLoading: false, error: new Error("fail"), refetch: vi.fn() } as unknown as ReturnType<typeof useLineupSuggestions>);
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/couldn't load recommendations/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows collapsed banner with suggestion count", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: fakeSuggestions, isLoading: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useLineupSuggestions>);
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/1 recommended action/i)).toBeInTheDocument();
  });

  it("shows busy-day text when activityCount >= 4", () => {
    mockUseSuggestions.mockReturnValue({ suggestions: fakeSuggestions, isLoading: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useLineupSuggestions>);
    render(<SuggestionsBanner date={TODAY} activityCount={4} />, { wrapper: makeWrapper() });
    expect(screen.getByText(/pretty booked/i)).toBeInTheDocument();
  });

  it("opens overlay and shows suggestion cards on banner click", async () => {
    mockUseSuggestions.mockReturnValue({ suggestions: fakeSuggestions, isLoading: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useLineupSuggestions>);
    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });

    await userEvent.click(screen.getByRole("button", { name: /1 recommended action/i }));

    await waitFor(() => {
      expect(screen.getByText(/renewal check-in — jeffco/i)).toBeInTheDocument();
    });
  });

  it("shows feedback confirmation after clicking feedback button", async () => {
    const mockMutate = vi.fn((_, options) => {
      options?.onSuccess?.();
    });
    mockUseFeedback.mockReturnValue({ mutate: mockMutate, isPending: false } as unknown as ReturnType<typeof useSuggestionFeedback>);
    mockUseSuggestions.mockReturnValue({ suggestions: fakeSuggestions, isLoading: false, error: null, refetch: vi.fn() } as unknown as ReturnType<typeof useLineupSuggestions>);

    render(<SuggestionsBanner date={TODAY} activityCount={0} />, { wrapper: makeWrapper() });

    // Open the overlay
    await userEvent.click(screen.getByRole("button", { name: /1 recommended action/i }));

    // Click the feedback button
    await userEvent.click(screen.getByRole("button", { name: /want.*ai-powered/i }));

    await waitFor(() => {
      expect(screen.getByText(/thanks.*tracking interest/i)).toBeInTheDocument();
    });
  });
});
