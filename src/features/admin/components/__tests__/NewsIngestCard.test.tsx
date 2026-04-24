import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewsIngestCard from "../NewsIngestCard";
import type { NewsIngestStats } from "../../hooks/useAdminNewsStats";

vi.mock("../../hooks/useAdminNewsStats", () => ({
  useAdminNewsStats: vi.fn(),
}));

import { useAdminNewsStats } from "../../hooks/useAdminNewsStats";
const mockHook = vi.mocked(useAdminNewsStats);

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewsIngestCard />
    </QueryClientProvider>
  );
}

function baseStats(overrides: Partial<NewsIngestStats> = {}): NewsIngestStats {
  return {
    articles: { last7d: 150, prior7d: 120 },
    coverage: {
      targetDistrictCount: 200,
      green: 160,
      amber: 20,
      red: 20,
      percentGreen: 80,
    },
    lastRun: {
      finishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: "success",
      layer: "daily",
    },
    failures24h: 0,
    layerBreakdown: [
      { layer: "daily", runsLast24h: 2, lastStatus: "success" },
      { layer: "rolling", runsLast24h: 10, lastStatus: "success" },
    ],
    health: "green",
    ...overrides,
  };
}

describe("NewsIngestCard", () => {
  it("shows loading skeleton when query is pending", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true } as never);
    renderCard();
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders all four stats with data", () => {
    mockHook.mockReturnValue({
      data: baseStats(),
      isLoading: false,
    } as never);
    renderCard();
    expect(screen.getByText("News Ingest")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("160")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("renders empty state when lastRun.finishedAt is null", () => {
    mockHook.mockReturnValue({
      data: baseStats({
        lastRun: { finishedAt: null, status: null, layer: null },
        health: "red",
      }),
      isLoading: false,
    } as never);
    renderCard();
    expect(screen.getByText(/No runs yet/i)).toBeInTheDocument();
  });

  it("renders coverage '—' when targetDistrictCount is 0", () => {
    mockHook.mockReturnValue({
      data: baseStats({
        coverage: {
          targetDistrictCount: 0,
          green: 0,
          amber: 0,
          red: 0,
          percentGreen: 0,
        },
      }),
      isLoading: false,
    } as never);
    renderCard();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders up to 5 layer chips", () => {
    mockHook.mockReturnValue({
      data: baseStats({
        layerBreakdown: [
          { layer: "daily", runsLast24h: 5, lastStatus: "success" },
          { layer: "rolling", runsLast24h: 4, lastStatus: "success" },
          { layer: "weekly", runsLast24h: 3, lastStatus: "success" },
          { layer: "monthly", runsLast24h: 2, lastStatus: "success" },
          { layer: "quarterly", runsLast24h: 1, lastStatus: "success" },
        ],
      }),
      isLoading: false,
    } as never);
    renderCard();
    expect(screen.getByText("daily")).toBeInTheDocument();
    expect(screen.getByText("quarterly")).toBeInTheDocument();
  });
});
