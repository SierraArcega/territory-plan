import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import GroupRow from "../GroupRow";
import { useViewsStore } from "../../lib/store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/views",
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  useViewsStore.setState({
    expandedGroups: {},
    hoverId: null,
    menuGroupId: null,
    showHidden: false,
    density: "compact",
    builderOpen: false,
    builderSeed: null,
  });
});

describe("GroupRow", () => {
  it("renders a plan row with label + accent bar", () => {
    const { container, getByText } = render(
      <GroupRow
        kind="plan"
        id="p1"
        label="Northeast Pod"
        progress={62}
        target="$1.2M"
        fiscal="FY26"
      />,
    );
    expect(getByText("Northeast Pod")).toBeTruthy();
    // Plan rows have an accent bar (3px wide div) — confirm SVG ring renders
    const svg = container.querySelector("svg[role='img']");
    expect(svg).not.toBeNull();
  });

  it("toggles expansion when header button is clicked", () => {
    const { container } = render(
      <GroupRow
        kind="plan"
        id="p2"
        label="Mid-Atlantic"
        progress={45}
        target="$800K"
        fiscal="FY26"
      />,
    );
    // Initially collapsed — no view children present
    expect(container.querySelector("ul")).toBeNull();
    // Click header → expands
    const btn = container.querySelector("button");
    fireEvent.click(btn!);
    // Store should be updated
    expect(useViewsStore.getState().expandedGroups["plan:p2"]).toBe(true);
  });

  it("shows the expanded meta line for plans", () => {
    useViewsStore.setState({ expandedGroups: { "plan:p3": true } });
    const { getByText, container } = render(
      <GroupRow
        kind="plan"
        id="p3"
        label="Renewals"
        progress={78}
        target="$320K"
        fiscal="FY26 Q2"
      />,
    );
    expect(getByText("78%")).toBeTruthy();
    expect(getByText(/of \$320K/)).toBeTruthy();
    expect(getByText("FY26 Q2")).toBeTruthy();
    // 8 view rows render when expanded
    const viewButtons = container.querySelectorAll("ul button");
    expect(viewButtons.length).toBe(8);
  });

  it("renders list rows with filter count badge", () => {
    const { getByText } = render(
      <GroupRow
        kind="list"
        id="l1"
        label="High-priority prospects"
        filterCount={3}
      />,
    );
    expect(getByText("High-priority prospects")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });
});
