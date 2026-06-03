import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import StageFunnelChart from "../StageFunnelChart";
import type { FunnelStage, TargetsRow } from "@/features/home/lib/pipeline";

const stage = (p: Partial<FunnelStage>): FunnelStage => ({
  prefix: 0, name: "Meeting Booked", count: 2, min: 30000, max: 100000, teamMin: 40000, sharePct: 75, ...p,
});
const targets: TargetsRow = { count: 5, value: 120000, teamValue: 200000, sharePct: 60 };

describe("StageFunnelChart", () => {
  it("renders a row per active stage plus the Targets pre-pipe row", () => {
    const stages = [stage({}), stage({ prefix: 4, name: "Negotiation", count: 1 })];
    render(<StageFunnelChart stages={stages} targets={targets} overallSharePct={50} onStageClick={() => {}} />);
    expect(screen.getByText("Targets")).toBeInTheDocument();
    expect(screen.getByText("Meeting Booked")).toBeInTheDocument();
    expect(screen.getByText("Negotiation")).toBeInTheDocument();
    expect(screen.getByText(/pre-pipe/i)).toBeInTheDocument();
  });

  it("fires onStageClick with the stage prefix", () => {
    const onStageClick = vi.fn();
    render(<StageFunnelChart stages={[stage({})]} targets={targets} overallSharePct={50} onStageClick={onStageClick} />);
    screen.getByRole("button", { name: /Meeting Booked deals/i }).click();
    expect(onStageClick).toHaveBeenCalledWith(0);
  });
});
