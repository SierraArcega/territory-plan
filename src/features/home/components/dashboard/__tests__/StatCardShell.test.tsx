import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("reveals the definition popover on hovering the labelled metric", () => {
    render(<StatCardShell label="Open Pipeline" labelTooltip="Open opps you're working." value="$840K"><div>b</div></StatCardShell>);
    expect(screen.getByText("Open Pipeline")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseEnter(screen.getByText("Open Pipeline").parentElement!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Open opps you're working.");
  });

  it("omits the (i) affordance when no labelTooltip is given", () => {
    render(<StatCardShell label="Targets" value="103"><div>b</div></StatCardShell>);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("ⓘ")).toBeNull();
  });

  it("is inert (not a button) when onExpand is absent", () => {
    render(<StatCardShell label="Targets" value="103"><div>b</div></StatCardShell>);
    expect(screen.queryByRole("button", { name: /expand/i })).toBeNull();
  });

  it("makes the whole card a single clickable button when onExpand is set", () => {
    const onExpand = vi.fn();
    render(<StatCardShell label="Open Pipeline" value="$840K" onExpand={onExpand}><div>b</div></StatCardShell>);
    // exactly one control with the expand name (no duplicate glyph button)
    const cards = screen.getAllByRole("button", { name: "Expand Open Pipeline details" });
    expect(cards).toHaveLength(1);
    fireEvent.click(cards[0]);
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("opens on Enter/Space when the card is focused", () => {
    const onExpand = vi.fn();
    render(<StatCardShell label="Bookings" value="$1.2M" onExpand={onExpand}><div>b</div></StatCardShell>);
    const card = screen.getByRole("button", { name: "Expand Bookings details" });
    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    expect(onExpand).toHaveBeenCalledTimes(2);
  });
});
