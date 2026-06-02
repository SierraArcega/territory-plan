import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FunnelCard from "../FunnelCard";
import type { OppView } from "@/features/home/lib/pipeline";

const view = (p: Partial<OppView>): OppView => ({
  account: null, state: null, source: "return", stageName: "", stagePrefix: 0,
  netBooking: 0, minPurchase: 0, maxBudget: 0, weighted: 0, closeDate: null,
  daysInStage: 0, health: "on", ...p,
});

const opps = [
  view({ account: "Brookfield CSD", source: "return", stagePrefix: 4, minPurchase: 80, maxBudget: 200 }),
  view({ account: "Pinecrest", source: "new", stagePrefix: 1, minPurchase: 10, maxBudget: 60 }),
];

describe("FunnelCard", () => {
  it("renders the funnel with a band per active stage", () => {
    const { container } = render(<FunnelCard opps={opps} />);
    expect(screen.getByText("Stage funnel")).toBeTruthy();
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("Negotiation")).toBeTruthy();
    expect(screen.getByText("Discovery")).toBeTruthy();
  });

  it("opens the stage-deals modal listing that stage's deals on click", () => {
    render(<FunnelCard opps={opps} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Negotiation deals/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(screen.getByText("Brookfield CSD")).toBeTruthy(); // Negotiation deal
    expect(screen.queryByText("Pinecrest")).toBeNull(); // Discovery deal not shown
  });

  it("filters the funnel to a single source", () => {
    render(<FunnelCard opps={opps} />);
    fireEvent.click(screen.getByRole("button", { name: /New biz/i }));
    // Only the New-biz opp (Discovery) remains; Negotiation band is gone
    expect(screen.getByText("Discovery")).toBeTruthy();
    expect(screen.queryByText("Negotiation")).toBeNull();
  });
});
