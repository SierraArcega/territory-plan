import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  applyClientFilters,
  deriveActivitiesParams,
  getRangeForChrome,
} from "../filters-store";
import { getCategoryForType } from "@/features/activities/types";

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
});
