import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BulkActionsMenu } from "../BulkActionsMenu";
import React from "react";

vi.mock("@/features/plans/lib/queries", () => ({
  useBulkRemoveDistrictsFromPlan: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ removed: 2 }),
    isPending: false,
  }),
}));

// FindContactsPopover may not exist yet; stub it so the import doesn't fail
vi.mock("../FindContactsPopover", () => ({
  FindContactsPopover: () => null,
}));

// Stub AnchoredPopover to render children directly so menu items are visible
vi.mock("../AnchoredPopover", () => ({
  AnchoredPopover: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? React.createElement("div", null, children) : null,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const explicitProps = {
  planId: "plan-1",
  planLeaids: ["A", "B"],
  selection: { mode: "explicit" as const, leaids: new Set(["A"]) },
  layout: { filters: { kind: "and" as const, children: [] }, sort: [], columns: [] },
  onSelectionCleared: vi.fn(),
};

describe("BulkActionsMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the trigger button", () => {
    render(<BulkActionsMenu {...explicitProps} />, { wrapper });
    expect(screen.getByRole("button", { name: /bulk actions/i })).toBeInTheDocument();
  });

  it("shows three menu items when open", async () => {
    render(<BulkActionsMenu {...explicitProps} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /bulk actions/i }));
    expect(await screen.findByRole("menuitem", { name: /find contacts/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /export.*csv/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /remove from plan/i })).toBeInTheDocument();
  });

  it("shows remove confirm dialog after clicking Remove from plan", async () => {
    render(<BulkActionsMenu {...explicitProps} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /bulk actions/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /remove from plan/i }));
    expect(await screen.findByText(/remove 1 district/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm remove/i })).toBeInTheDocument();
  });

  it("closes the confirm on Cancel", async () => {
    render(<BulkActionsMenu {...explicitProps} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /bulk actions/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /remove from plan/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^cancel$/i }));
    await waitFor(() =>
      expect(screen.queryByText(/remove 1 district/i)).not.toBeInTheDocument()
    );
  });
});
