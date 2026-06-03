import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCardShell from "../StatCardShell";

describe("StatCardShell", () => {
  it("renders label, headline value, YoY chip, and the secondary 7d line", () => {
    render(
      <StatCardShell
        label="Open Pipeline"
        value="$840K"
        deltaPct={18}
        priorFyLabel="FY26"
        wowPct={4}
        footerRight={<span>rank</span>}
      >
        <div>body</div>
      </StatCardShell>,
    );
    expect(screen.getByText("Open Pipeline")).toBeInTheDocument();
    expect(screen.getByText("$840K")).toBeInTheDocument();
    expect(screen.getByText("+18%")).toBeInTheDocument();
    expect(screen.getByText(/vs FY26 same day/)).toBeInTheDocument();
    expect(screen.getByText(/\+4% · last 7d/)).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("rank")).toBeInTheDocument();
  });

  it("omits the delta chip and secondary line when no deltas are given", () => {
    render(<StatCardShell label="Targets" value="103"><div>b</div></StatCardShell>);
    expect(screen.getByText("Targets")).toBeInTheDocument();
    expect(screen.queryByText(/same day/)).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("renders the minMaxLine slot when provided", () => {
    render(
      <StatCardShell label="Open Pipeline" value="$840K" minMaxLine={<span>max budget $1.6M</span>}>
        <div>b</div>
      </StatCardShell>,
    );
    expect(screen.getByText("max budget $1.6M")).toBeInTheDocument();
  });
});
