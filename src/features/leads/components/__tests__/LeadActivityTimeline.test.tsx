import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TimelineList, lifecycleText } from "../LeadActivityTimeline";
import { RENDER_PAGE_SIZE } from "@/features/leads/lib/queries";
import type {
  EngagementTimelineItem,
  LifecycleTimelineItem,
} from "@/features/leads/lib/types";

const NOW = new Date("2026-06-10T12:00:00");

function engagement(
  overrides: Partial<EngagementTimelineItem> = {},
): EngagementTimelineItem {
  return {
    itemType: "engagement",
    id: "a1",
    type: "email",
    title: "Replied to Q2 outreach",
    notes: null,
    outcome: null,
    outcomeType: null,
    rating: null,
    points: 0,
    mixmaxSequenceName: null,
    mixmaxSequenceStep: null,
    mixmaxSequenceTotal: null,
    mixmaxOpenCount: null,
    mixmaxClickCount: null,
    source: "manual",
    createdByUserId: null,
    attribution: "own_contact",
    attributionName: null,
    ts: new Date("2026-06-09T10:00:00").toISOString(),
    ...overrides,
  };
}

function lifecycle(
  overrides: Partial<LifecycleTimelineItem> = {},
): LifecycleTimelineItem {
  return {
    itemType: "lifecycle",
    id: "e1",
    kind: "accepted",
    payload: null,
    actorId: null,
    ts: new Date("2026-06-09T09:00:00").toISOString(),
    ...overrides,
  };
}

describe("TimelineList attribution → chip mapping", () => {
  it("leaves the lead's own contact activity unlabeled", () => {
    render(<TimelineList items={[engagement()]} now={NOW} />);
    expect(screen.getByText("Replied to Q2 outreach")).toBeInTheDocument();
    expect(screen.queryByText("District-wide")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Logged on another contact/)).not.toBeInTheDocument();
  });

  it("shows the contact-name chip (purple tint) for other_contact items", () => {
    render(
      <TimelineList
        items={[
          engagement({ attribution: "other_contact", attributionName: "Paula Reyes" }),
        ]}
        now={NOW}
      />,
    );
    const chip = screen.getByText("Paula Reyes");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveStyle({ background: "#EFECFB", color: "#5A4F9E" });
  });

  it("shows the District-wide chip (steel tint) for district_wide items", () => {
    render(
      <TimelineList
        items={[engagement({ attribution: "district_wide", attributionName: null })]}
        now={NOW}
      />,
    );
    const chip = screen.getByText("District-wide");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveStyle({ background: "#E8F1F5", color: "#4D7285" });
  });

  it("honors the chip-label override (e.g. School-wide on the school record)", () => {
    render(
      <TimelineList
        items={[
          engagement({ attribution: "district_wide", attributionName: "School-wide" }),
        ]}
        now={NOW}
      />,
    );
    expect(screen.getByText("School-wide")).toBeInTheDocument();
  });
});

describe("TimelineList engagement card readouts", () => {
  it("renders the logged outcome pill with the star-rating readout", () => {
    render(
      <TimelineList
        items={[engagement({ outcomeType: "positive_progress", rating: 4 })]}
        now={NOW}
      />,
    );
    const pill = screen.getByText("Moved Forward");
    expect(pill.closest("span")).toHaveStyle({ background: "#EFF5F0", color: "#56792F" });
    expect(screen.getByLabelText("Rated 4 of 5")).toHaveTextContent("★★★★★");
  });

  it("omits the outcome row when nothing was logged", () => {
    render(<TimelineList items={[engagement()]} now={NOW} />);
    expect(screen.queryByText("Moved Forward")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Rated/)).not.toBeInTheDocument();
  });

  it("shows a right-aligned +N pts only when the activity carried points", () => {
    const { rerender } = render(
      <TimelineList items={[engagement({ points: 12 })]} now={NOW} />,
    );
    expect(screen.getByText("+12 pts")).toBeInTheDocument();
    rerender(<TimelineList items={[engagement({ points: 0 })]} now={NOW} />);
    expect(screen.queryByText(/pts/)).not.toBeInTheDocument();
  });

  it("renders Mixmax sequence badge and open/click stats only when populated", () => {
    render(
      <TimelineList
        items={[
          engagement({
            mixmaxSequenceName: "Superintendent — Special Ed",
            mixmaxSequenceStep: 2,
            mixmaxSequenceTotal: 5,
            mixmaxOpenCount: 3,
            mixmaxClickCount: 1,
          }),
        ]}
        now={NOW}
      />,
    );
    expect(
      screen.getByText("Step 2/5 · Superintendent — Special Ed"),
    ).toBeInTheDocument();
    expect(screen.getByText("Opened 3x")).toBeInTheDocument();
    expect(screen.getByText("Clicked 1x")).toBeInTheDocument();
  });

  it("never fabricates Mixmax stats on plain activities", () => {
    render(<TimelineList items={[engagement()]} now={NOW} />);
    expect(screen.queryByText(/Opened/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sequence/)).not.toBeInTheDocument();
  });
});

describe("TimelineList lifecycle rows", () => {
  it("renders lead_events with system styling and derived copy", () => {
    render(
      <TimelineList
        items={[
          lifecycle({
            kind: "restaged",
            payload: { from: "working", to: "meeting_scheduled" },
          }),
        ]}
        now={NOW}
      />,
    );
    const row = screen.getByTestId("timeline-lifecycle");
    expect(row).toHaveTextContent("Moved to Meeting Scheduled");
  });

  it("derives copy for every lifecycle kind", () => {
    expect(lifecycleText(lifecycle({ kind: "created" }))).toBe("Lead created");
    expect(lifecycleText(lifecycle({ kind: "accepted" }))).toBe(
      "Lead accepted · status → Working",
    );
    expect(
      lifecycleText(lifecycle({ kind: "opp_created", payload: { mode: "linked" } })),
    ).toBe("Linked to opportunity");
    expect(lifecycleText(lifecycle({ kind: "opp_created", payload: {} }))).toBe(
      "Stage 0 opportunity created",
    );
    expect(lifecycleText(lifecycle({ kind: "opp_advanced", payload: {} }))).toBe(
      "Opportunity advanced to Stage 1 · Discovery",
    );
    expect(
      lifecycleText(
        lifecycle({
          kind: "disqualified",
          payload: {
            reason: "No Response",
            message: "4 activities preserved on contact + district",
          },
        }),
      ),
    ).toBe("Lead disqualified · No Response · 4 activities preserved on contact + district");
  });

  it("renders the empty state when there are no items", () => {
    render(<TimelineList items={[]} now={NOW} emptyText="No activity yet." />);
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });
});

describe("TimelineList pagination", () => {
  const manyItems = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      engagement({ id: `a-${i}`, title: `Touch ${i}` }),
    );

  it("renders at most RENDER_PAGE_SIZE rows with a Show-more button", () => {
    render(<TimelineList items={manyItems(RENDER_PAGE_SIZE + 10)} now={NOW} />);
    expect(screen.getAllByTestId("timeline-engagement")).toHaveLength(RENDER_PAGE_SIZE);
    expect(screen.getByRole("button", { name: "Show 10 more" })).toBeInTheDocument();
  });

  it("reveals the next page on Show more and hides the button when exhausted", () => {
    render(<TimelineList items={manyItems(RENDER_PAGE_SIZE + 10)} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Show 10 more" }));
    expect(screen.getAllByTestId("timeline-engagement")).toHaveLength(
      RENDER_PAGE_SIZE + 10,
    );
    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();
  });

  it("shows no pagination button at or under the page size", () => {
    render(<TimelineList items={manyItems(RENDER_PAGE_SIZE)} now={NOW} />);
    expect(screen.getAllByTestId("timeline-engagement")).toHaveLength(RENDER_PAGE_SIZE);
    expect(screen.queryByRole("button", { name: /Show .* more/ })).not.toBeInTheDocument();
  });
});
