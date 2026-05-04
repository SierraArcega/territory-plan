import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VacancyScanCard from "../VacancyScanCard";

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as never;
});

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <VacancyScanCard />
    </QueryClientProvider>,
  );
}

function mockStats(overrides: Record<string, unknown> = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      totalVacancies: 100,
      verifiedVacancies: 95,
      districtsWithVacancies: 40,
      totalDistrictsWithUrl: 1000,
      districtsScanned: 450,
      coveragePct: 45,
      adjustedCoveragePct: 47,
      tarpit: { total: 50, byPlatform: [{ platform: "claude", count: 38 }] },
      topFailureReason7d: { reason: "claude_fallback_failed", pct: 75 },
      scansLast7d: 100,
      failedLast24h: 0,
      lastScanAt: new Date().toISOString(),
      byPlatform: [],
      ...overrides,
    }),
  });
}

describe("VacancyScanCard row 2 — diagnostics", () => {
  it("renders Tarpit, Adjusted Coverage, and Top Failure Reason", async () => {
    mockStats();
    renderCard();

    expect(await screen.findByText("Tarpit")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText(/claude \(38\)/)).toBeInTheDocument();

    expect(screen.getByText("Adjusted Coverage")).toBeInTheDocument();
    expect(screen.getByText("47%")).toBeInTheDocument();

    expect(screen.getByText("Top Failure Reason")).toBeInTheDocument();
    expect(screen.getByText("claude_fallback_failed")).toBeInTheDocument();
    expect(screen.getByText("75% of failures (7d)")).toBeInTheDocument();
  });

  it("renders dash for top failure reason when null", async () => {
    mockStats({ topFailureReason7d: null });
    renderCard();
    await screen.findByText("Top Failure Reason");
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("no failures")).toBeInTheDocument();
  });

  it("renders no sub-line when tarpit is empty", async () => {
    mockStats({ tarpit: { total: 0, byPlatform: [] } });
    renderCard();
    expect(await screen.findByText("Tarpit")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    // platform sub-line should not appear when total is 0
    expect(screen.queryByText(/claude \(/)).toBeNull();
  });
});
