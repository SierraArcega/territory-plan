import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StageFunnelCard from "../StageFunnelCard";
import type { FunnelData, OppView } from "@/features/home/lib/pipeline";

const funnel: FunnelData = {
  stages: [
    { prefix: 0, name: "Meeting Booked", count: 2, min: 30000, max: 100000, teamMin: 40000, sharePct: 75 },
    { prefix: 4, name: "Negotiation", count: 1, min: 80000, max: 200000, teamMin: 80000, sharePct: 100 },
    ...[1, 2, 3, 5].map((p) => ({ prefix: p, name: `S${p}`, count: 0, min: 0, max: 0, teamMin: 0, sharePct: 0 })),
  ],
  sources: [
    { key: "return", label: "Return", color: "#403770", you: 30000, team: 40000, pct: 75 },
    { key: "new", label: "New biz", color: "#F37167", you: 80000, team: 80000, pct: 100 },
    { key: "winback", label: "Win-back", color: "#6EA3BE", you: 0, team: 0, pct: 0 },
    { key: "expansion", label: "Expansion", color: "#FFCF70", you: 0, team: 0, pct: 0 },
  ],
  openCount: 3, totalMin: 110000, totalMax: 300000, spread: 190000,
  teamMinTotal: 120000, overallSharePct: 92, rank: 1, totalReps: 12,
  targets: { count: 5, value: 120000, teamValue: 200000, sharePct: 60 },
};
const opps: OppView[] = [];

describe("StageFunnelCard", () => {
  it("renders the summary strip, rank, funnel and source shares", () => {
    render(<StageFunnelCard funnel={funnel} opps={opps} />);
    expect(screen.getByText("Stage funnel")).toBeInTheDocument();
    expect(screen.getByText("Open opps")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/#1\/12/)).toBeInTheDocument();
    expect(screen.getByText("Targets")).toBeInTheDocument();
    expect(screen.getByText("Share by deal source")).toBeInTheDocument();
    expect(screen.getAllByText("Return").length).toBeGreaterThanOrEqual(2);
  });

  it("renders a source-filter pill per segment plus All", () => {
    render(<StageFunnelCard funnel={funnel} opps={opps} />);
    expect(screen.getByRole("button", { name: "All sources" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New biz" })).toBeInTheDocument();
  });
});
