import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock the mutation hooks before importing the component
vi.mock("@/features/views/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/views/lib/queries")>();
  return {
    ...actual,
    useUpdatePlanLayout: vi.fn(),
    useUpdateListLayout: vi.fn(),
  };
});

// Mock GridView so we don't trigger real fetches.
// Path is relative to the component's location (views/components/grid/GridView),
// using the same module specifier the component itself uses.
vi.mock("../../grid/GridView", () => ({
  default: () => <div data-testid="grid-view-news" />,
}));

import NewsView from "../NewsView";
import { useUpdatePlanLayout, useUpdateListLayout } from "@/features/views/lib/queries";

const mutateMock = vi.fn();

function wrap(c: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{c}</QueryClientProvider>;
}

describe("NewsView toggle", () => {
  beforeEach(() => {
    mutateMock.mockClear();
    (useUpdatePlanLayout as Mock).mockReturnValue({ mutate: mutateMock, isPending: false });
    (useUpdateListLayout as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it("defaults to cards when savedLayouts.news.mode is absent", () => {
    render(
      wrap(
        <NewsView leaids={["lea1"]} parentKind="plan" parentId="p1" savedLayouts={null} />,
      ),
    );
    // In cards mode, GridView should not be rendered
    expect(screen.queryByTestId("grid-view-news")).toBeNull();
    // Cards button should appear active
    expect(screen.getByText("Cards")).toBeInTheDocument();
    expect(screen.getByText("Table")).toBeInTheDocument();
  });

  it("renders GridView when mode is table", () => {
    const savedLayouts = {
      news: {
        columns: [],
        sort: [],
        filters: { kind: "and" as const, children: [] },
        mode: "table" as const,
      },
    };
    render(
      wrap(
        <NewsView leaids={["lea1"]} parentKind="plan" parentId="p1" savedLayouts={savedLayouts} />,
      ),
    );
    expect(screen.getByTestId("grid-view-news")).toBeInTheDocument();
  });

  it("clicking Table fires the mutation with mode=table", () => {
    render(
      wrap(
        <NewsView leaids={["lea1"]} parentKind="plan" parentId="p1" savedLayouts={null} />,
      ),
    );
    fireEvent.click(screen.getByText("Table"));
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ news: expect.objectContaining({ mode: "table" }) }),
    );
  });

  it("clicking Cards after Table persists mode=cards", () => {
    const savedLayouts = {
      news: {
        columns: [],
        sort: [],
        filters: { kind: "and" as const, children: [] },
        mode: "table" as const,
      },
    };
    render(
      wrap(
        <NewsView leaids={["lea1"]} parentKind="plan" parentId="p1" savedLayouts={savedLayouts} />,
      ),
    );
    // Currently in table mode — switch back to cards
    fireEvent.click(screen.getByText("Cards"));
    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ news: expect.objectContaining({ mode: "cards" }) }),
    );
    expect(screen.queryByTestId("grid-view-news")).toBeNull();
  });
});
