import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type {
  IncreaseTarget,
  IncreaseTargetsResponse,
} from "../../lib/types";

// Mock list query — controlled per test via the object we return.
interface MockListQuery {
  data: IncreaseTargetsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
}

const mockListQuery: MockListQuery = {
  data: undefined,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

// Keep references to actual queryClient.setQueryData calls.
const mockSetQueryData = vi.fn();

vi.mock("../../lib/queries", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../../lib/queries",
  );
  return {
    ...actual,
    useIncreaseTargetsList: () => mockListQuery,
    // The popover imports these from the same module — stub them so no
    // network call happens when a user opens the Add popover in a test.
    useMyPlans: () => ({ data: [], isLoading: false }),
    useAddDistrictToPlanMutation: () => ({
      mutateAsync: vi.fn().mockResolvedValue({ added: 1, planId: "plan-1" }),
      isPending: false,
    }),
  };
});

import IncreaseTargetsTab from "../IncreaseTargetsTab";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDistrict(overrides: Partial<IncreaseTarget> = {}): IncreaseTarget {
  return {
    leaid: "0601234",
    districtName: "Alpha USD",
    state: "CA",
    enrollment: 1000,
    fy26Revenue: 50000,
    fy26CompletedRevenue: 30000,
    fy26ScheduledRevenue: 20000,
    fy26SessionCount: 100,
    fy26SubscriptionCount: 5,
    lastClosedWon: null,
    productTypes: ["Tutoring"],
    subProducts: [],
    ...overrides,
  };
}

function renderTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Intercept setQueryData so we can assert the optimistic update without
  // relying on internal React Query state.
  const originalSet = queryClient.setQueryData.bind(queryClient);
  queryClient.setQueryData = ((key: unknown, updater: unknown) => {
    mockSetQueryData(key, updater);
    return originalSet(
      key as Parameters<typeof originalSet>[0],
      updater as Parameters<typeof originalSet>[1],
    );
  }) as typeof queryClient.setQueryData;

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <IncreaseTargetsTab />
      </QueryClientProvider>,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("IncreaseTargetsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListQuery.data = undefined;
    mockListQuery.isLoading = false;
    mockListQuery.isError = false;
    mockListQuery.refetch = vi.fn();
    mockSetQueryData.mockClear();
  });

  it("renders the summary strip with the district count and formatted currency", () => {
    mockListQuery.data = {
      districts: [
        makeDistrict({ leaid: "1", fy26Revenue: 1_200_000 }),
        makeDistrict({ leaid: "2", fy26Revenue: 800_000 }),
      ],
      totalRevenueAtRisk: 2_000_000,
    };

    renderTab();

    // Count + compact currency (from formatCurrency(x, true)): $2M
    expect(
      screen.getByText(/2 districts • \$2M FY26 revenue at renewal risk/i),
    ).toBeInTheDocument();
  });

  it("renders one DataGrid row per district", () => {
    mockListQuery.data = {
      districts: [
        makeDistrict({ leaid: "1", districtName: "Alpha USD" }),
        makeDistrict({ leaid: "2", districtName: "Beta USD" }),
        makeDistrict({ leaid: "3", districtName: "Gamma USD" }),
      ],
      totalRevenueAtRisk: 150_000,
    };

    renderTab();

    expect(screen.getByText("Alpha USD")).toBeInTheDocument();
    expect(screen.getByText("Beta USD")).toBeInTheDocument();
    expect(screen.getByText("Gamma USD")).toBeInTheDocument();
  });

  it("shows a loading spinner when the list query is loading", () => {
    mockListQuery.isLoading = true;
    mockListQuery.data = undefined;

    const { container } = renderTab();

    // Spinner is a bordered div with animate-spin; no accessible name.
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).not.toBeNull();
  });

  it("shows the empty state when the list is empty", () => {
    mockListQuery.data = { districts: [], totalRevenueAtRisk: 0 };

    renderTab();

    expect(
      screen.getByText(/nothing at risk right now/i),
    ).toBeInTheDocument();
  });

  it("shows an error banner with Retry that triggers refetch on click", () => {
    mockListQuery.isError = true;
    mockListQuery.data = undefined;

    renderTab();

    expect(screen.getByText(/couldn't load the list/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(mockListQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it("toggles the expanded row panel when a row is clicked", async () => {
    const district = makeDistrict({
      leaid: "1",
      districtName: "Expandable USD",
      productTypes: ["Tutoring", "Mentoring"],
    });
    mockListQuery.data = {
      districts: [district],
      totalRevenueAtRisk: district.fy26Revenue,
    };

    renderTab();

    // The expanded panel shows this label — not present before click.
    expect(screen.queryByText(/products purchased/i)).not.toBeInTheDocument();

    // Click the district name cell to trigger row click.
    fireEvent.click(screen.getByText("Expandable USD"));

    await waitFor(() => {
      expect(screen.getByText(/products purchased/i)).toBeInTheDocument();
    });
  });

  it("optimistically removes a row via queryClient.setQueryData on add success", async () => {
    // Use the real mutation hook for this test so we exercise the onSuccess
    // cache update. Re-mock the module override for this single test.
    const { useAddDistrictToPlanMutation } = await vi.importActual<
      typeof import("../../lib/queries")
    >("../../lib/queries");

    // Replace only the mutation hook — keep the list hook stub in place.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = await import("../../lib/queries");
    const originalHook = mod.useAddDistrictToPlanMutation;
    (mod as unknown as Record<string, unknown>).useAddDistrictToPlanMutation =
      useAddDistrictToPlanMutation;

    // Fake fetch: the real mutation hits POST /api/territory-plans/:id/districts.
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        new Response(JSON.stringify({ added: 1, planId: "plan-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const districts = [
      makeDistrict({ leaid: "a", districtName: "Alpha USD", fy26Revenue: 100 }),
      makeDistrict({ leaid: "b", districtName: "Beta USD", fy26Revenue: 200 }),
    ];
    mockListQuery.data = { districts, totalRevenueAtRisk: 300 };

    const { queryClient } = renderTab();

    // Seed the cache with the current list so the mutation's optimistic
    // setter has something to reduce from.
    queryClient.setQueryData(
      ["leaderboard", "increase-targets"],
      { districts, totalRevenueAtRisk: 300 },
    );
    mockSetQueryData.mockClear();

    // Use the React Query client directly to run the mutation's logic. This
    // avoids driving the popover form and keeps the test focused on the
    // cache-update behavior.
    const { useAddDistrictToPlanMutation: hook } = mod as unknown as {
      useAddDistrictToPlanMutation: typeof useAddDistrictToPlanMutation;
    };

    // Invoke the hook's mutation directly via a rendered test harness.
    const Harness = () => {
      const m = hook();
      return (
        <button
          type="button"
          onClick={() =>
            m.mutate({
              planId: "plan-1",
              leaid: "a",
              bucket: "renewal",
              targetAmount: 500,
            })
          }
        >
          RunMutation
        </button>
      );
    };
    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "RunMutation" }));

    await waitFor(() => {
      expect(mockSetQueryData).toHaveBeenCalled();
    });

    // Find the call for the increase-targets key.
    const call = mockSetQueryData.mock.calls.find((c) => {
      const key = c[0] as unknown;
      return (
        Array.isArray(key) &&
        key.length === 2 &&
        key[0] === "leaderboard" &&
        key[1] === "increase-targets"
      );
    });
    expect(call).toBeDefined();
    const updater = call?.[1] as (
      prev: IncreaseTargetsResponse,
    ) => IncreaseTargetsResponse;
    const next = updater({ districts, totalRevenueAtRisk: 300 });
    expect(next.districts).toHaveLength(1);
    expect(next.districts[0].leaid).toBe("b");
    expect(next.totalRevenueAtRisk).toBe(200);

    // Restore
    (mod as unknown as Record<string, unknown>).useAddDistrictToPlanMutation =
      originalHook;
    fetchMock.mockRestore();
  });
});
