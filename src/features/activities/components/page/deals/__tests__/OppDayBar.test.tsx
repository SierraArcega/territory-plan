import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OppDayBar from "../OppDayBar";
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
    districtName: "Some District",
    salesRepId: null,
    ...overrides,
  };
}

describe("OppDayBar", () => {
  it("renders null for an empty array", () => {
    const { container } = render(<OppDayBar opps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each kind's count and the formatted total amount", () => {
    render(
      <OppDayBar
        opps={[
          evt({ id: "1", kind: "won", amount: 50000 }),
          evt({ id: "2", kind: "won", amount: 25000 }),
          evt({ id: "3", kind: "lost", amount: 10000 }),
          evt({ id: "4", kind: "created", amount: 15000 }),
        ]}
      />
    );
    // 2 won, 1 lost, 1 created
    expect(screen.getByText("2")).toBeInTheDocument();
    // Two "1"s render — for lost and created — getAllByText
    expect(screen.getAllByText("1").length).toBe(2);
    // Total = 100000 → $100K
    expect(screen.getByText("$100K")).toBeInTheDocument();
  });
});
