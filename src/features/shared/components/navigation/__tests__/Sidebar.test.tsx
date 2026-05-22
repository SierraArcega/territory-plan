import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Sidebar from "../Sidebar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/leaderboard/components/LeaderboardNavWidget", () => ({
  default: () => <div data-testid="leaderboard-widget" />,
}));
vi.mock("@/features/leaderboard/components/LeaderboardModal", () => ({
  default: () => null,
}));

const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("Sidebar (legacy + MyViewsSection)", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/territory-plans")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/lists")) {
        return new Response(JSON.stringify({ lists: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  it("renders MyViewsSection content when expanded", async () => {
    const Wrapper = makeWrapper();
    render(
      <Sidebar
        activeTab="home"
        onTabChange={vi.fn()}
        collapsed={false}
        onCollapsedChange={vi.fn()}
      />,
      { wrapper: Wrapper }
    );
    expect(await screen.findByText(/my views/i)).toBeInTheDocument();
  });

  it("does NOT render MyViewsSection content when collapsed", () => {
    const Wrapper = makeWrapper();
    render(
      <Sidebar
        activeTab="home"
        onTabChange={vi.fn()}
        collapsed={true}
        onCollapsedChange={vi.fn()}
      />,
      { wrapper: Wrapper }
    );
    expect(screen.queryByText(/my views/i)).not.toBeInTheDocument();
  });
});
