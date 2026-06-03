import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StageFunnelChart from "../StageFunnelChart";
import type { FunnelStage, TargetsRow } from "@/features/home/lib/pipeline";

const stage = (p: Partial<FunnelStage>): FunnelStage => ({
  prefix: 0, name: "Meeting Booked", count: 2, min: 30000, max: 100000, teamMin: 40000, sharePct: 75, ...p,
});
const targets: TargetsRow = { count: 5, value: 120000, teamValue: 200000, sharePct: 60 };
const noWon: FunnelStage = { prefix: 6, name: "Closed Won", count: 0, min: 0, max: 0, teamMin: 0, sharePct: 0 };

describe("StageFunnelChart", () => {
  it("renders a row per active stage plus the Targets pre-pipe row", () => {
    const stages = [stage({}), stage({ prefix: 4, name: "Negotiation", count: 1 })];
    render(<StageFunnelChart stages={stages} targets={targets} won={noWon} overallSharePct={50} onStageClick={() => {}} />);
    expect(screen.getByText("Targets")).toBeInTheDocument();
    expect(screen.getByText("Meeting Booked")).toBeInTheDocument();
    expect(screen.getByText("Negotiation")).toBeInTheDocument();
    expect(screen.getByText(/pre-pipe/i)).toBeInTheDocument();
  });

  it("fires onStageClick with the stage prefix", () => {
    const onStageClick = vi.fn();
    render(<StageFunnelChart stages={[stage({})]} targets={targets} won={noWon} overallSharePct={50} onStageClick={onStageClick} />);
    screen.getByRole("button", { name: /Meeting Booked deals/i }).click();
    expect(onStageClick).toHaveBeenCalledWith(0);
  });

  it("renders a greyed-out ghost funnel of all stages when nothing is in pipeline", () => {
    const empty = [
      stage({ prefix: 0, name: "Meeting Booked", count: 0 }),
      stage({ prefix: 3, name: "Proposal", count: 0 }),
    ];
    render(
      <StageFunnelChart
        stages={empty}
        targets={{ count: 0, value: 0, teamValue: 0, sharePct: 0 }}
        won={noWon}
        overallSharePct={0}
        onStageClick={() => {}}
      />,
    );
    // Stage bands still render (not the bare empty message)…
    expect(screen.getByText("Meeting Booked")).toBeInTheDocument();
    expect(screen.getByText("Proposal")).toBeInTheDocument();
    expect(screen.getByText(/no open pipeline yet/i)).toBeInTheDocument();
    // …and they are non-interactive (no drill-in buttons in the ghost state).
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the Closed Won tip with real data even when open pipeline is empty", () => {
    const empty = [stage({ prefix: 0, name: "Meeting Booked", count: 0 })];
    const won: FunnelStage = { prefix: 6, name: "Closed Won", count: 52, min: 3120000, max: 1330000, teamMin: 8000000, sharePct: 39 };
    render(
      <StageFunnelChart
        stages={empty}
        targets={{ count: 0, value: 0, teamValue: 0, sharePct: 0 }}
        won={won}
        overallSharePct={0}
        onStageClick={() => {}}
      />,
    );
    expect(screen.getByText("Closed Won")).toBeInTheDocument(); // green tip renders
    expect(screen.getByText("52 won")).toBeInTheDocument();
    expect(screen.getByText("$3.1M")).toBeInTheDocument(); // booked floor
    expect(screen.getByText(/no open pipeline yet/i)).toBeInTheDocument(); // open stages still ghosted
  });
});
