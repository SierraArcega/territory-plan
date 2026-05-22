import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GridView from "../GridView";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const layout: GridViewLayout = { columns: [], sort: [], filters: { kind: "and", children: [] } };
const rows = [{ leaid: "0601234", name: "Tedesco USD" }];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ rows, total: 1 }), {
      status: 200, headers: { "Content-Type": "application/json" } }))));
});
afterEach(() => vi.unstubAllGlobals());

describe("GridView row actions column", () => {
  it("shows the kebab for plan + districts", async () => {
    render(<GridView source="districts" leaids={["0601234"]} listId={null}
      parentKind="plan" parentId="plan-1" viewType="table" layout={layout} onLayoutChange={() => {}} />,
      { wrapper });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /actions for tedesco usd/i })).toBeInTheDocument());
  });

  it("hides the kebab for a list scope", async () => {
    render(<GridView source="districts" leaids={["0601234"]} listId={null}
      parentKind="list" parentId="list-1" viewType="table" layout={layout} onLayoutChange={() => {}} />,
      { wrapper });
    await waitFor(() => expect(screen.getByText("Tedesco USD")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /actions for/i })).not.toBeInTheDocument();
  });
});
