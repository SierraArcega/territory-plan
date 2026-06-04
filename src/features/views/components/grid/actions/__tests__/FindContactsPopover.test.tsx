import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FindContactsPopover } from "../FindContactsPopover";
import React, { useRef } from "react";

const mockHandleStart = vi.fn();

vi.mock("@/features/plans/lib/enrich-flow", () => ({
  useBulkEnrichFlow: () => ({
    isEnriching: false,
    toast: null,
    setToast: vi.fn(),
    modalState: null,
    setModalState: vi.fn(),
    progressPercent: 0,
    progress: undefined,
    handleStartEnrichment: mockHandleStart,
    bulkEnrich: { isPending: false },
    expandRollup: { isPending: false },
  }),
}));

vi.mock("@/features/plans/components/ExistingContactsModal", () => ({
  default: () => null,
}));

// Stub AnchoredPopover — path is relative to the component file, resolved via alias
vi.mock("../../AnchoredPopover", () => ({
  AnchoredPopover: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? React.createElement("div", null, children) : null,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const selection = { mode: "explicit" as const, leaids: new Set(["A", "B"]) };
const layout = { filters: { kind: "and" as const, children: [] }, sort: [], columns: [] };

function Harness({ open = true, onClose = vi.fn() } = {}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef}>anchor</button>
      <FindContactsPopover
        planId="plan-1"
        selection={selection}
        layout={layout}
        anchorRef={anchorRef}
        open={open}
        onClose={onClose}
      />
    </>
  );
}

describe("FindContactsPopover", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the role dropdown and a scope badge", () => {
    render(<Harness />, { wrapper });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText(/2 districts/i)).toBeInTheDocument();
  });

  it("calls handleStartEnrichment with explicit leaids on Start", async () => {
    mockHandleStart.mockResolvedValue(undefined);
    render(<Harness />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /start enrichment/i }));
    await waitFor(() =>
      expect(mockHandleStart).toHaveBeenCalledWith(
        expect.objectContaining({ leaids: ["A", "B"] })
      )
    );
  });

  it("shows school level checkboxes when Principal is selected", () => {
    render(<Harness />, { wrapper });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });
    expect(screen.getByLabelText(/primary/i)).toBeInTheDocument();
  });
});
