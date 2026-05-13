import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import ViewsSidebar from "../ViewsSidebar";
import { useViewsStore } from "../../lib/store";

// Mock router + queries used inside the tree. We render the full sidebar so
// the test catches accidental imports / broken composition.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/views",
  useSearchParams: () => new URLSearchParams(),
}));

// Stub the leaderboard widgets — they have their own queries we don't need
// to wire up here.
vi.mock("@/features/leaderboard/components/LeaderboardNavWidget", () => ({
  default: () => <div data-testid="leaderboard-widget" />,
}));
vi.mock("@/features/leaderboard/components/LeaderboardModal", () => ({
  default: () => null,
}));

const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  // Default: never-resolving fetch so the loading state is observable.
  fetchMock.mockImplementation(() => new Promise(() => undefined));
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

describe("ViewsSidebar shell", () => {
  it("renders at 252px (compact) by default", () => {
    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <ViewsSidebar />
      </Wrapper>,
    );
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain("w-[252px]");
  });

  it("widens to 268px in comfortable density", () => {
    useViewsStore.setState({ density: "comfortable" });
    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <ViewsSidebar />
      </Wrapper>,
    );
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("w-[268px]");
  });

  it("renders the My Views eyebrow", () => {
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <ViewsSidebar />
      </Wrapper>,
    );
    expect(getByText(/my views/i)).toBeTruthy();
  });

  it("renders the All plans row pointing at /views", () => {
    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <ViewsSidebar />
      </Wrapper>,
    );
    const link = container.querySelector("a[href='/views']");
    expect(link).not.toBeNull();
    expect(link?.textContent).toMatch(/all plans/i);
  });

  it("shows loading skeleton rows while plans/lists are pending", () => {
    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <ViewsSidebar />
      </Wrapper>,
    );
    // Per CLAUDE.md: loading state must be rendered, not hidden. We assert
    // aria-busy lists exist for both subsections.
    const busy = container.querySelectorAll('[aria-busy="true"]');
    expect(busy.length).toBeGreaterThanOrEqual(2);
  });

  it("renders a New list affordance (subsection header + footer)", () => {
    const Wrapper = makeWrapper();
    const { getAllByRole } = render(
      <Wrapper>
        <ViewsSidebar />
      </Wrapper>,
    );
    // The Lists subsection header carries an icon-only "+ new list" button
    // (aria-label="New list"); the footer surfaces the dashed CTA with the
    // same accessible name. Both should be present.
    const buttons = getAllByRole("button", { name: /new list/i });
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
