import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock date utils to control "today"
vi.mock("@/features/shared/lib/date-utils", () => ({
  getToday: vi.fn(() => "2026-03-14"),
}));

vi.mock("@/features/shared/lib/api-client", () => ({
  fetchJson: vi.fn(),
  API_BASE: "/api",
}));

import { fetchJson } from "@/features/shared/lib/api-client";
const mockFetch = vi.mocked(fetchJson);

import { useLineupSuggestions, useSuggestionFeedback } from "../queries";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useLineupSuggestions", () => {
  beforeEach(() => mockFetch.mockReset());

  it("returns null immediately when date is not today", () => {
    const { result } = renderHook(() => useLineupSuggestions("2026-03-13"), {
      wrapper: makeWrapper(),
    });
    expect(result.current.suggestions).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches from /api/lineup/suggestions when date is today", async () => {
    const fakeSuggestions = [{ activityType: "call", title: "Test", opportunityType: "renewal" }];
    mockFetch.mockResolvedValue({ suggestions: fakeSuggestions });

    const { result } = renderHook(() => useLineupSuggestions("2026-03-14"), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.suggestions).toEqual(fakeSuggestions);
    expect(mockFetch).toHaveBeenCalledWith("/api/lineup/suggestions");
  });
});

describe("useSuggestionFeedback", () => {
  beforeEach(() => mockFetch.mockReset());

  it("POSTs to /api/lineup/suggestions/feedback on mutate", async () => {
    mockFetch.mockResolvedValue({});

    const { result } = renderHook(() => useSuggestionFeedback(), {
      wrapper: makeWrapper(),
    });

    result.current.mutate();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/lineup/suggestions/feedback",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
