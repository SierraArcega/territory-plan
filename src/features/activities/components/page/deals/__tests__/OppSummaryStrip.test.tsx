import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OppSummaryStrip from "../OppSummaryStrip";
import type { OppEvent, OpenDeal } from "@/features/shared/types/api-types";
import type { ColdDistrict } from "../ColdDistrictRow";

function evt(overrides: Partial<OppEvent>): OppEvent {
  return {
    id: "e",
    opportunityId: "o",
    opportunityName: "Opp",
    kind: "won",
    occurredAt: "2026-04-20T12:00:00.000Z",
    amount: 50000,
    stage: "Closed Won",
    districtLeaid: null,
    districtName: "District",
    salesRepId: null,
    ...overrides,
  };
}

function deal(overrides: Partial<OpenDeal>): OpenDeal {
  return {
    id: "d",
    name: "Deal",
    stage: "Proposal",
    amount: 100000,
    closeDate: "2026-04-10T00:00:00.000Z",
    districtLeaid: null,
    districtName: "District",
    salesRepId: null,
    daysToClose: -10,
    ...overrides,
  };
}

function cold(overrides: Partial<ColdDistrict>): ColdDistrict {
  return {
    leaid: "1",
    districtName: "Cold District",
    daysSinceActivity: 30,
    amount: 50000,
    stage: "Customer",
    mine: true,
    ...overrides,
  };
}

describe("OppSummaryStrip", () => {
  it("clicking the won pill calls onOpen('won') and cold pill calls onOpen('cold')", () => {
    const onOpen = vi.fn();
    render(
      <OppSummaryStrip
        events={[
          evt({ id: "1", kind: "won", amount: 80000 }),
          evt({ id: "2", kind: "lost", amount: 20000 }),
        ]}
        overdueDeals={[deal({ id: "d1" })]}
        coldList={[cold({ leaid: "c1" })]}
        onOpen={onOpen}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /closed won/i }));
    expect(onOpen).toHaveBeenCalledWith("won");

    fireEvent.click(screen.getByRole("button", { name: /going cold/i }));
    expect(onOpen).toHaveBeenCalledWith("cold");
  });
});
