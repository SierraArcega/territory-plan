import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  EMPTY_FILTERS,
  applyClientFilters,
  deriveActivitiesParams,
  getRangeForChrome,
  useActivitiesChrome,
  useDefaultOwnerHydration,
} from "../filters-store";
import { getCategoryForType } from "@/features/activities/types";

// useDefaultOwnerHydration depends on useProfile() — mock the shared queries
// module to avoid hitting the network in jsdom.
vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: vi.fn(),
}));

import { useProfile } from "@/features/shared/lib/queries";
const mockedUseProfile = useProfile as unknown as ReturnType<typeof vi.fn>;

describe("filters-store", () => {
  describe("getRangeForChrome", () => {
    // Spans are derived in local time; the runner timezone affects ISO conversions.
    // We assert duration + start-day instead of full ISO strings to stay portable.
    function spanDays(startIso: string, endIso: string): number {
      return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 86400000);
    }

    it("returns a 7-day Sunday-anchored window for week grain", () => {
      // 2026-04-15 noon — the local week containing it should start on Sunday.
      const { startIso, endIso } = getRangeForChrome("2026-04-15T12:00:00.000Z", "week");
      const start = new Date(startIso);
      expect(start.getDay()).toBe(0); // Sunday
      expect(spanDays(startIso, endIso)).toBe(7);
    });

    it("returns a roughly month-long window for month grain", () => {
      const { startIso, endIso } = getRangeForChrome("2026-04-15T12:00:00.000Z", "month");
      expect(new Date(startIso).getDate()).toBe(1);
      const days = spanDays(startIso, endIso);
      expect(days).toBeGreaterThanOrEqual(30);
      expect(days).toBeLessThanOrEqual(31);
    });

    it("returns a quarter-long window for quarter grain", () => {
      const { startIso, endIso } = getRangeForChrome("2026-04-15T12:00:00.000Z", "quarter");
      const start = new Date(startIso);
      expect([0, 3, 6, 9]).toContain(start.getMonth()); // Jan/Apr/Jul/Oct
      const days = spanDays(startIso, endIso);
      expect(days).toBeGreaterThanOrEqual(91);
      expect(days).toBeLessThanOrEqual(92);
    });
  });

  describe("deriveActivitiesParams", () => {
    it("short-circuits to single-value API params when one filter is selected", () => {
      const params = deriveActivitiesParams({
        filters: {
          ...EMPTY_FILTERS,
          categories: ["meetings"],
          owners: ["user_1"],
          text: "demo",
        },
        anchorIso: "2026-04-15T12:00:00.000Z",
        grain: "week",
      });
      expect(params.category).toBe("meetings");
      expect(params.ownerId).toBe("user_1");
      expect(params.search).toBe("demo");
    });

    it("falls back to ownerId=all when no owner filter is set (team scope)", () => {
      const params = deriveActivitiesParams({
        filters: EMPTY_FILTERS,
        anchorIso: "2026-04-15T12:00:00.000Z",
        grain: "week",
      });
      expect(params.ownerId).toBe("all");
    });
  });

  describe("applyClientFilters", () => {
    const rows = [
      { type: "discovery_call", status: "planned" },
      { type: "conference", status: "completed" },
      { type: "mixmax_campaign", status: "in_progress" },
    ];

    it("keeps everything when filter sets are empty", () => {
      expect(applyClientFilters(rows, EMPTY_FILTERS, getCategoryForType)).toEqual(rows);
    });

    it("filters by category", () => {
      const out = applyClientFilters(
        rows,
        { ...EMPTY_FILTERS, categories: ["meetings"] },
        getCategoryForType
      );
      expect(out).toEqual([rows[0]]);
    });

    it("filters by status", () => {
      const out = applyClientFilters(
        rows,
        { ...EMPTY_FILTERS, statuses: ["completed"] },
        getCategoryForType
      );
      expect(out).toEqual([rows[1]]);
    });
  });

  describe("useDefaultOwnerHydration", () => {
    function wrapper() {
      const client = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
        },
      });
      return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          QueryClientProvider,
          { client },
          children as React.ReactElement
        );
    }

    beforeEach(() => {
      // Reset zustand store to a clean state between tests so persisted state
      // from a prior case doesn't leak (jsdom localStorage is shared).
      act(() => {
        useActivitiesChrome.getState().resetFilters();
      });
      mockedUseProfile.mockReset();
    });

    afterEach(() => {
      act(() => {
        useActivitiesChrome.getState().resetFilters();
      });
    });

    it("seeds owners with the current user's id once profile loads", async () => {
      mockedUseProfile.mockReturnValue({
        data: { id: "u_alex", email: "alex@x.com" },
      } as never);

      renderHook(() => useDefaultOwnerHydration(), { wrapper: wrapper() });

      await waitFor(() => {
        expect(useActivitiesChrome.getState().filters.owners).toEqual(["u_alex"]);
      });
    });

    it("does not run before profile resolves", () => {
      mockedUseProfile.mockReturnValue({ data: undefined } as never);

      renderHook(() => useDefaultOwnerHydration(), { wrapper: wrapper() });

      expect(useActivitiesChrome.getState().filters.owners).toEqual([]);
    });

    it("does not overwrite a user-chosen owner selection", async () => {
      // Simulate the user (or a saved-view click) having already chosen owners.
      act(() => {
        useActivitiesChrome.getState().patchFilters({ owners: ["u_priya"] });
      });
      mockedUseProfile.mockReturnValue({
        data: { id: "u_alex", email: "alex@x.com" },
      } as never);

      renderHook(() => useDefaultOwnerHydration(), { wrapper: wrapper() });

      await waitFor(() => {
        // give the effect a chance to fire
        expect(mockedUseProfile).toHaveBeenCalled();
      });
      expect(useActivitiesChrome.getState().filters.owners).toEqual(["u_priya"]);
    });

    it("only fires once per mount even if profile re-renders", async () => {
      mockedUseProfile.mockReturnValue({
        data: { id: "u_alex", email: "alex@x.com" },
      } as never);

      const { rerender } = renderHook(() => useDefaultOwnerHydration(), {
        wrapper: wrapper(),
      });

      await waitFor(() => {
        expect(useActivitiesChrome.getState().filters.owners).toEqual(["u_alex"]);
      });

      // User clears the filter manually after seeding…
      act(() => {
        useActivitiesChrome.getState().patchFilters({ owners: [] });
      });
      // …and the hook re-runs (e.g. because profile data refreshed).
      rerender();

      // The ref guard prevents re-seeding.
      expect(useActivitiesChrome.getState().filters.owners).toEqual([]);
    });
  });

});
