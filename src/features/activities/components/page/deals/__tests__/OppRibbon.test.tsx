import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OppRibbon from "../OppRibbon";
import type { OppEvent } from "@/features/shared/types/api-types";

function evt(overrides: Partial<OppEvent>): OppEvent {
  return {
    id: "e",
    opportunityId: "o",
    opportunityName: "Opp",
    kind: "won",
    occurredAt: "2026-04-20T12:00:00.000Z",
    amount: 0,
    stage: null,
    districtLeaid: null,
    districtName: "District",
    salesRepId: null,
    ...overrides,
  };
}

function startOfDayIso(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}

describe("OppRibbon", () => {
  it("renders content only on days with opps and shows the day's total amount", () => {
    // 7 consecutive days starting 2026-04-20
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 3, 20 + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }

    const map = new Map<string, OppEvent[]>();
    // Day 0 (2026-04-20): two events totalling $75K
    map.set(startOfDayIso(days[0]), [
      evt({ id: "a", kind: "won", amount: 50000 }),
      evt({ id: "b", kind: "created", amount: 25000 }),
    ]);
    // Day 3 (2026-04-23): one event $120K
    map.set(startOfDayIso(days[3]), [
      evt({ id: "c", kind: "progressed", amount: 120000 }),
    ]);

    const { container } = render(
      <OppRibbon days={days} oppsByDay={map} />
    );

    // Two days with opps → totals appear in DOM
    expect(screen.getByText("$75K")).toBeInTheDocument();
    expect(screen.getByText("$120K")).toBeInTheDocument();

    // 7 columns total. Empty days render an empty placeholder div.
    const grid = container.firstChild as HTMLElement;
    expect(grid.childElementCount).toBe(7);
  });
});
