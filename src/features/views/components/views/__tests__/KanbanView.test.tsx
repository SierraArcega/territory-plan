import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/features/shared/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/shared/lib/api-client")>();
  return { ...actual, fetchJson: vi.fn() };
});

import KanbanView from "../KanbanView";
import { fetchJson } from "@/features/shared/lib/api-client";

function wrap(c: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{c}</QueryClientProvider>;
}

function col(over: Record<string, unknown>) {
  return { count: 0, totalBookings: 0, cards: [], hasMore: false, ...over };
}

const fixture = {
  schoolYr: "2025-26",
  columns: [
    col({ id: "meeting_booked", label: "Meeting Booked" }),
    col({
      id: "discovery", label: "Discovery", count: 3, totalBookings: 175000, hasMore: true,
      cards: [{
        id: "opp-1", name: "Acme Renewal", districtName: "Acme District",
        contractType: "Tier 1", netBookingAmount: 45000, minimumPurchaseAmount: 20000,
        maximumBudget: null, closeDate: "2026-06-01T00:00:00.000Z", salesRepName: "Alice Smith",
      }],
    }),
    col({
      id: "presentation", label: "Presentation", count: 1, totalBookings: 90000,
      cards: [{
        id: "opp-2", name: "Beta Expansion", districtName: "Beta School",
        contractType: null, netBookingAmount: 90000, minimumPurchaseAmount: 30000,
        maximumBudget: 120000, closeDate: null, salesRepName: null,
      }],
    }),
    col({ id: "proposal", label: "Proposal" }),
    col({ id: "negotiation", label: "Negotiation" }),
    col({ id: "commitment", label: "Commitment" }),
    col({ id: "closed_won", label: "Closed Won" }),
    col({ id: "closed_lost", label: "Closed Lost" }),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("KanbanView", () => {
  it("shows the list-scope empty state and never fetches when leaids is null", () => {
    render(wrap(<KanbanView leaids={null} fiscalYear={2026} />));
    expect(screen.getByText("List scoping not wired yet")).toBeInTheDocument();
    expect(fetchJson as Mock).not.toHaveBeenCalled();
  });

  it("renders opportunity cards with their district and amount", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    expect(await screen.findByText("Acme Renewal")).toBeInTheDocument();
    expect(screen.getByText("Beta Expansion")).toBeInTheDocument();
    expect(screen.getByText("Acme District")).toBeInTheDocument();
  });

  it("shows the contract-type badge only when present", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(screen.getByText("Tier 1")).toBeInTheDocument(); // opp-1
    expect(screen.queryByText("null")).toBeNull();
  });

  it("renders a Max budget row only for cards that have one", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(screen.getAllByText("Max budget")).toHaveLength(1);
  });

  it("shows the per-column summed bookings in the header", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(screen.getByText("$175K")).toBeInTheDocument();
  });

  it("shows a '+N more' footer when a column has more than the rendered cards", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("marks cards for detail-panel routing", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    const { container } = render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(
      container.querySelector('[data-row-kind="opp"][data-row-id="opp-1"]'),
    ).not.toBeNull();
  });
});
