import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import PortfolioView from "../PortfolioView";
import type { PlanWithStats } from "../../lib/queries";

// The component reads URL state (bucket) via useViewsRouter. Each test can
// override the active bucket by mutating `routerState.bucket` before render.
const goToPortfolio = vi.fn();
const routerState: { bucket: "mine" | "team" | "archived" } = { bucket: "mine" };
vi.mock("../../hooks/useViewsRouter", () => ({
  useViewsRouter: () => ({
    isPortfolio: true,
    groupKind: null,
    groupId: null,
    viewId: null,
    detail: null,
    bucket: routerState.bucket,
    goToGroup: vi.fn(),
    goToPortfolio,
    openDetail: vi.fn(),
    closeDetail: vi.fn(),
  }),
}));

// PortfolioView reads the current user id via useProfile() to split mine/team.
// Mock returns the same id (u1) the test fixture's owner uses by default, so a
// stock `plan()` is owned-by-me unless an override flips it.
vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: { id: "u1" } }),
}));

// The card mutation uses the territory-plans update hook — stub to avoid
// pulling that whole module's deps into the test.
vi.mock("@/features/plans/lib/queries", () => ({
  useUpdateTerritoryPlan: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Next.js Link works fine in jsdom but mock to plain anchor for stability.
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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

function plan(overrides: Partial<PlanWithStats> = {}): PlanWithStats {
  return {
    id: "plan-1",
    name: "Mountain West FY26",
    color: null,
    status: "working",
    fiscalYear: 2026,
    districtCount: 12,
    districtLeaids: ["0100005", "0100006"],
    owner: { id: "u1", fullName: "Sierra Arcega", avatarUrl: null },
    collaborators: [],
    hidden: false,
    renewalRollup: 0,
    expansionRollup: 0,
    winbackRollup: 0,
    newBusinessRollup: 0,
    pipelineTotal: 0,
    progress: 62,
    pipelineValue: 622000,
    contactsCount: 84,
    oppsCount: 14,
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  goToPortfolio.mockReset();
  routerState.bucket = "mine";
});

describe("PortfolioView", () => {
  it("renders the FY26 Portfolio header by default", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [plan()],
      headers: new Headers({ "content-type": "application/json" }),
    });
    const Wrapper = makeWrapper();
    const { getByText } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    expect(getByText(/FY26 Portfolio/i)).toBeTruthy();
    expect(getByText(/All plans/i)).toBeTruthy();
  });

  it("renders one card per plan with the plan name", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [plan(), plan({ id: "plan-2", name: "Northeast FY26" })],
      headers: new Headers({ "content-type": "application/json" }),
    });
    const Wrapper = makeWrapper();
    const { findByText } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    expect(await findByText("Mountain West FY26")).toBeTruthy();
    expect(await findByText("Northeast FY26")).toBeTruthy();
  });

  it("computes header aggregates from active plans only", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        plan({ pipelineValue: 1_000_000, contactsCount: 50, oppsCount: 10 }),
        plan({
          id: "p2",
          status: "archived",
          // Archived plan must NOT contribute to portfolio totals.
          pipelineValue: 9_000_000,
          contactsCount: 999,
          oppsCount: 999,
        }),
      ],
      headers: new Headers({ "content-type": "application/json" }),
    });
    const Wrapper = makeWrapper();
    const { findAllByText, queryByText } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    // 1_000_000 active → $1.0M; archived 9M must NOT contribute to totals.
    // Two instances show up in the DOM (header total + card pipeline value)
    // because the only active plan also has $1.0M pipeline.
    const matches = await findAllByText("$1.0M");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(queryByText("$10.0M")).toBeNull();
  });

  it("renders the My / Team / Archived tab strip with counts", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        // mine (owned by u1)
        plan(),
        // team (owned by someone else, not a collaborator on it either)
        plan({
          id: "p2",
          owner: { id: "u2", fullName: "Teammate", avatarUrl: null },
          collaborators: [],
        }),
        // archived counts regardless of ownership
        plan({ id: "p3", status: "archived" }),
        plan({ id: "p4", status: "archived" }),
      ],
      headers: new Headers({ "content-type": "application/json" }),
    });
    const Wrapper = makeWrapper();
    const { findByText } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    expect(await findByText(/My plans · 1/)).toBeTruthy();
    expect(await findByText(/Team plans · 1/)).toBeTruthy();
    expect(await findByText(/Archived plans · 2/)).toBeTruthy();
  });

  it("counts a plan as mine when the user is a collaborator (not owner)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        plan({
          id: "p1",
          owner: { id: "u2", fullName: "Owner", avatarUrl: null },
          collaborators: [{ id: "u1", fullName: "Sierra", avatarUrl: null }],
        }),
      ],
      headers: new Headers({ "content-type": "application/json" }),
    });
    const Wrapper = makeWrapper();
    const { findByText } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    expect(await findByText(/My plans · 1/)).toBeTruthy();
    expect(await findByText(/Team plans · 0/)).toBeTruthy();
  });

  it("renders a New plan card on the My plans tab", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [plan()],
      headers: new Headers({ "content-type": "application/json" }),
    });
    const Wrapper = makeWrapper();
    const { findByText } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    expect(await findByText(/New plan/i)).toBeTruthy();
  });

  it("does not render the New plan card on the Team tab", async () => {
    routerState.bucket = "team";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        plan({
          id: "p2",
          owner: { id: "u2", fullName: "Other", avatarUrl: null },
          collaborators: [],
        }),
      ],
      headers: new Headers({ "content-type": "application/json" }),
    });
    const Wrapper = makeWrapper();
    const { findByText, queryByText } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    // Wait for the team-owned plan card to render before asserting absence.
    expect(await findByText("Mountain West FY26")).toBeTruthy();
    expect(queryByText(/New plan/i)).toBeNull();
  });

  it("renders an empty state on the Team tab when no team plans exist", async () => {
    routerState.bucket = "team";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [plan()], // owned by u1 → goes to mine, not team
      headers: new Headers({ "content-type": "application/json" }),
    });
    const Wrapper = makeWrapper();
    const { findByText } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    expect(await findByText(/No team plans/i)).toBeTruthy();
  });

  it("shows skeletons while loading", async () => {
    // Never-resolving fetch keeps loading state observable.
    fetchMock.mockImplementation(() => new Promise(() => undefined));
    const Wrapper = makeWrapper();
    const { container } = render(
      <Wrapper>
        <PortfolioView />
      </Wrapper>,
    );
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });
  });
});
