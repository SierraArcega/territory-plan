import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DealChip from "../DealChip";
import type { OppEvent } from "@/features/shared/types/api-types";

function makeEvent(overrides: Partial<OppEvent> = {}): OppEvent {
  return {
    id: "evt-1",
    opportunityId: "opp-1",
    opportunityName: "Test Opp",
    kind: "won",
    occurredAt: "2026-04-20T12:00:00.000Z",
    amount: 82000,
    stage: "Closed Won",
    districtLeaid: "0900330",
    districtName: "Hartford Public Schools",
    salesRepId: "user-1",
    ...overrides,
  };
}

describe("DealChip", () => {
  it("pip variant renders a 14×14 element with the kind icon", () => {
    const { container } = render(
      <DealChip deal={makeEvent({ kind: "won" })} density="pip" />
    );
    const span = container.querySelector("span[role='img']") as HTMLElement;
    expect(span).toBeTruthy();
    expect(span.style.width).toBe("14px");
    expect(span.style.height).toBe("14px");
    // lucide icons render as <svg>
    expect(span.querySelector("svg")).toBeTruthy();
  });

  it("compact density renders the district name and formatted amount", () => {
    render(
      <DealChip
        deal={makeEvent({
          districtName: "Westport Public",
          amount: 52000,
        })}
        density="compact"
      />
    );
    expect(screen.getByText("Westport Public")).toBeInTheDocument();
    expect(screen.getByText("$52K")).toBeInTheDocument();
  });

  it("row density renders the stage transition for a progressed deal with fromStage", () => {
    render(
      <DealChip
        deal={makeEvent({
          kind: "progressed",
          stage: "Proposal",
          districtName: "Mapleton ISD",
        })}
        density="row"
        fromStage="Discovery"
      />
    );
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("Proposal")).toBeInTheDocument();
    // arrow glyph appears between stages
    expect(screen.getByText("→")).toBeInTheDocument();
  });
});
