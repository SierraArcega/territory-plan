import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OppSummaryStrip from "../deals/OppSummaryStrip";
import UpcomingRail from "../UpcomingRail";
import ScopeToggle from "../ScopeToggle";
import type { OppEvent, OpenDeal } from "@/features/shared/types/api-types";
import type { ColdDistrict } from "../deals/ColdDistrictRow";
import type { ActivityListItem } from "@/features/shared/types/api-types";

function evt(over: Partial<OppEvent> = {}): OppEvent {
  return {
    id: "e1",
    leaid: "0900330",
    districtName: "Hartford",
    kind: "won",
    amount: 100000,
    stage: "Customer",
    mine: true,
    occurredAt: "2026-01-01T00:00:00Z",
    ...over,
  } as OppEvent;
}

function deal(over: Partial<OpenDeal> = {}): OpenDeal {
  return {
    id: "d1",
    leaid: "0900330",
    districtName: "Hartford",
    amount: 100000,
    stage: "Proposal",
    mine: true,
    closeDate: "2025-12-01",
    ...over,
  } as OpenDeal;
}

function cold(over: Partial<ColdDistrict> = {}): ColdDistrict {
  return {
    leaid: "0900330",
    districtName: "Hartford",
    daysSinceActivity: 30,
    amount: 200000,
    stage: "Customer",
    mine: true,
    ...over,
  };
}

function activity(over: Partial<ActivityListItem> = {}): ActivityListItem {
  return {
    id: "a1",
    type: "discovery_call",
    category: "meetings",
    title: "Sync with Hartford",
    startDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    status: "planned",
    source: "manual",
    outcomeType: null,
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    planCount: 1,
    districtCount: 1,
    stateAbbrevs: ["CT"],
    ...over,
  };
}

describe("Activities page — accessibility", () => {
  describe("OppSummaryStrip", () => {
    it("enriches stat-pill aria-label with count, kind, and amount", () => {
      render(
        <OppSummaryStrip
          events={[evt({ kind: "won", amount: 50000 }), evt({ id: "e2", kind: "won", amount: 25000 })]}
          overdueDeals={[]}
          coldList={[]}
          onOpen={() => {}}
        />
      );
      const wonBtn = screen.getByRole("button", { name: /see 2 closed won deals totaling/i });
      expect(wonBtn).toBeInTheDocument();
      expect(wonBtn).not.toBeDisabled();
    });

    it("describes empty kinds as 'No X in range' instead of just the kind name", () => {
      render(
        <OppSummaryStrip
          events={[]}
          overdueDeals={[]}
          coldList={[]}
          onOpen={() => {}}
        />
      );
      expect(
        screen.getByRole("button", { name: /no closed won in range/i })
      ).toBeDisabled();
    });

    it("gives the past-due pill a count-aware aria-label", () => {
      render(
        <OppSummaryStrip
          events={[]}
          overdueDeals={[deal()]}
          coldList={[]}
          onOpen={() => {}}
        />
      );
      const overdue = screen.getByRole("button", {
        name: /see 1 past-due open deal totaling/i,
      });
      expect(overdue).toBeInTheDocument();
    });

    it("gives the cold pill a count-aware aria-label", () => {
      render(
        <OppSummaryStrip
          events={[]}
          overdueDeals={[]}
          coldList={[cold(), cold({ leaid: "x", districtName: "Bridgeport" })]}
          onOpen={() => {}}
        />
      );
      const coldBtn = screen.getByRole("button", {
        name: /see 2 districts going cold totaling/i,
      });
      expect(coldBtn).toBeInTheDocument();
    });

    it("attaches the fm-focus-ring utility to interactive pills", () => {
      const { container } = render(
        <OppSummaryStrip
          events={[evt({ kind: "won" })]}
          overdueDeals={[]}
          coldList={[]}
          onOpen={() => {}}
        />
      );
      const buttons = container.querySelectorAll("button");
      buttons.forEach((b) => {
        expect(b.className).toMatch(/fm-focus-ring/);
      });
    });
  });

  describe("UpcomingRail", () => {
    it("exposes a labelled Log activity button when onNewActivity is provided", () => {
      render(
        <UpcomingRail
          activities={[activity()]}
          onActivityClick={() => {}}
          scope="mine"
          onNewActivity={() => {}}
        />
      );
      expect(screen.getByRole("button", { name: /log activity/i })).toBeInTheDocument();
    });

    it("omits the Log activity button when onNewActivity is not provided", () => {
      render(
        <UpcomingRail
          activities={[]}
          onActivityClick={() => {}}
          scope="mine"
        />
      );
      expect(screen.queryByRole("button", { name: /log activity/i })).toBeNull();
    });

    it("labels the collapse and expand buttons", () => {
      render(
        <UpcomingRail
          activities={[]}
          onActivityClick={() => {}}
          scope="mine"
        />
      );
      expect(screen.getByRole("button", { name: /collapse upcoming rail/i })).toBeInTheDocument();
    });
  });

  describe("ScopeToggle", () => {
    it("uses radiogroup semantics with checked state on the active option", () => {
      render(<ScopeToggle scope="mine" onChange={() => {}} />);
      const group = screen.getByRole("radiogroup", { name: /activity scope/i });
      expect(group).toBeInTheDocument();
      const mine = screen.getByRole("radio", { name: /my activities/i });
      expect(mine).toHaveAttribute("aria-checked", "true");
    });
  });

});
