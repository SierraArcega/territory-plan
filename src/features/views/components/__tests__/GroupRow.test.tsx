import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import GroupRow from "../GroupRow";
import { useViewsStore } from "../../lib/store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/views",
  useSearchParams: () => new URLSearchParams(),
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

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
    const Wrapper = makeWrapper();
    const { container, getByText } = render(
      <Wrapper>
        <GroupRow
          kind="plan"
          id="p1"
          label="Northeast Pod"
          progress={62}
          target="$1.2M"
          fiscal="FY26"
        />
      </Wrapper>,
    );
    expect(getByText("Northeast Pod")).toBeTruthy();
    // Plan rows have an accent bar (3px wide div) — confirm SVG ring renders
    const svg = container.querySelector("svg[role='img']");
    expect(svg).not.toBeNull();
  });

  it("toggles expansion when header button is clicked", () => {
    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <GroupRow
          kind="plan"
          id="p2"
          label="Mid-Atlantic"
          progress={45}
          target="$800K"
          fiscal="FY26"
        />
      </Wrapper>,
    );
    // Initially collapsed — no view children present
    expect(container.querySelector("ul")).toBeNull();
    // Click header → expands. The first button in DOM order is the row
    // toggle (⋯ trigger is rendered after but only visible on hover).
    const btn = container.querySelector("button");
    fireEvent.click(btn!);
    // Store should be updated
    expect(useViewsStore.getState().expandedGroups["plan:p2"]).toBe(true);
  });

  it("shows the expanded meta line for plans", () => {
    useViewsStore.setState({ expandedGroups: { "plan:p3": true } });
    const Wrapper = makeWrapper();
    const { getByText, container } = render(
      <Wrapper>
        <GroupRow
          kind="plan"
          id="p3"
          label="Renewals"
          progress={78}
          target="$320K"
          fiscal="FY26 Q2"
        />
      </Wrapper>,
    );
    expect(getByText("78%")).toBeTruthy();
    expect(getByText(/of \$320K/)).toBeTruthy();
    expect(getByText("FY26 Q2")).toBeTruthy();
    // 6 view rows render when expanded (Signals replaced Vacancies/News/RFPs)
    const viewButtons = container.querySelectorAll("ul button");
    expect(viewButtons.length).toBe(6);
  });

  it("renders list rows with filter count badge", () => {
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <GroupRow
          kind="list"
          id="l1"
          label="High-priority prospects"
          filterCount={3}
        />
      </Wrapper>,
    );
    expect(getByText("High-priority prospects")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });

  it("renders the ⋯ trigger as a row-actions button", () => {
    const Wrapper = makeWrapper();
    const { getByLabelText } = render(
      <Wrapper>
        <GroupRow
          kind="plan"
          id="p4"
          label="Western Pod"
          progress={20}
        />
      </Wrapper>,
    );
    // The trigger is opacity:0 by default but still present in the DOM —
    // accessible by its aria-label.
    expect(getByLabelText(/row actions/i)).toBeTruthy();
  });

  it("opens the context menu when ⋯ is clicked", () => {
    const Wrapper = makeWrapper();
    const { getByLabelText, getByText } = render(
      <Wrapper>
        <GroupRow
          kind="plan"
          id="p5"
          label="South Pod"
          progress={30}
        />
      </Wrapper>,
    );
    fireEvent.click(getByLabelText(/row actions/i));
    expect(useViewsStore.getState().menuGroupId).toBe("plan:p5");
    expect(getByText("Pin to top")).toBeTruthy();
    expect(getByText("Rename")).toBeTruthy();
    expect(getByText("Hide from sidebar")).toBeTruthy();
    expect(getByText("Archive plan")).toBeTruthy();
  });

  it("shows 'Delete list' for list kind instead of Archive", () => {
    const Wrapper = makeWrapper();
    const { getByLabelText, getByText, queryByText } = render(
      <Wrapper>
        <GroupRow
          kind="list"
          id="l2"
          label="Engaged contacts"
          filterCount={2}
        />
      </Wrapper>,
    );
    fireEvent.click(getByLabelText(/row actions/i));
    expect(getByText("Delete list")).toBeTruthy();
    expect(queryByText("Archive plan")).toBeNull();
  });

  it("renders an Unhide affordance when the row is hidden", () => {
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <GroupRow
          kind="plan"
          id="p6"
          label="Stashed plan"
          progress={10}
          hidden
        />
      </Wrapper>,
    );
    expect(getByText("Unhide")).toBeTruthy();
  });
});
