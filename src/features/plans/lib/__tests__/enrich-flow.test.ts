import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBulkEnrichFlow } from "../enrich-flow";
import React from "react";

const mockBulkEnrich = vi.fn();
const mockExpandRollup = vi.fn();

vi.mock("../queries", () => ({
  useBulkEnrich: () => ({ mutateAsync: mockBulkEnrich, isPending: false }),
  useExpandRollup: () => ({ mutateAsync: mockExpandRollup, isPending: false }),
  useEnrichProgress: () => ({ data: undefined }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useBulkEnrichFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts not enriching and with no toast", () => {
    const { result } = renderHook(
      () => useBulkEnrichFlow({ planId: "plan-1" }),
      { wrapper }
    );
    expect(result.current.isEnriching).toBe(false);
    expect(result.current.toast).toBeNull();
    expect(result.current.modalState).toBeNull();
  });

  it("sets isEnriching on successful enrich start", async () => {
    mockBulkEnrich.mockResolvedValueOnce({ queued: 5, skipped: 0, total: 5 });
    const { result } = renderHook(
      () => useBulkEnrichFlow({ planId: "plan-1" }),
      { wrapper }
    );
    await act(async () => {
      await result.current.handleStartEnrichment({
        targetRole: "Superintendent",
      });
    });
    expect(result.current.isEnriching).toBe(true);
    expect(result.current.toast?.type).toBe("info");
  });

  it("shows info toast when queued=0 and no skip", async () => {
    mockBulkEnrich.mockResolvedValueOnce({
      queued: 0,
      skipped: 0,
      total: 0,
      reason: "no-districts",
    });
    const { result } = renderHook(
      () => useBulkEnrichFlow({ planId: "plan-1" }),
      { wrapper }
    );
    await act(async () => {
      await result.current.handleStartEnrichment({
        targetRole: "Superintendent",
      });
    });
    expect(result.current.isEnriching).toBe(false);
    expect(result.current.toast?.type).toBe("info");
    expect(result.current.toast?.message).toMatch(/no districts/i);
  });

  it("passes leaids to useBulkEnrich when provided", async () => {
    mockBulkEnrich.mockResolvedValueOnce({ queued: 2, skipped: 0, total: 2 });
    const { result } = renderHook(
      () => useBulkEnrichFlow({ planId: "plan-1" }),
      { wrapper }
    );
    await act(async () => {
      await result.current.handleStartEnrichment({
        targetRole: "Principal",
        schoolLevels: new Set([1, 2]),
        leaids: ["0101010", "0202020"],
      });
    });
    expect(mockBulkEnrich).toHaveBeenCalledWith(
      expect.objectContaining({ leaids: ["0101010", "0202020"] })
    );
  });
});
