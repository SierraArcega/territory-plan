import { describe, it, expect } from "vitest";
import {
  parseWindow,
  sinceCutoff,
  parseTypes,
  DATE_EXPR,
  NEWS_CONFIDENCE_LEVELS,
} from "../sql";

describe("parseWindow", () => {
  it("accepts the four valid windows", () => {
    expect(parseWindow("7d")).toBe("7d");
    expect(parseWindow("30d")).toBe("30d");
    expect(parseWindow("90d")).toBe("90d");
    expect(parseWindow("all")).toBe("all");
  });

  it("defaults to 30d for null/empty/unknown", () => {
    expect(parseWindow(null)).toBe("30d");
    expect(parseWindow("")).toBe("30d");
    expect(parseWindow("14d")).toBe("30d");
    expect(parseWindow("garbage")).toBe("30d");
  });
});

describe("sinceCutoff", () => {
  const now = new Date("2026-05-21T12:00:00.000Z");

  it("returns null for the all window (no lower bound)", () => {
    expect(sinceCutoff("all", now)).toBeNull();
  });

  it("subtracts the right number of days", () => {
    expect(sinceCutoff("7d", now)?.toISOString()).toBe(
      "2026-05-14T12:00:00.000Z",
    );
    expect(sinceCutoff("30d", now)?.toISOString()).toBe(
      "2026-04-21T12:00:00.000Z",
    );
    expect(sinceCutoff("90d", now)?.toISOString()).toBe(
      "2026-02-20T12:00:00.000Z",
    );
  });

  it("defaults the clock to the current time when omitted", () => {
    const before = Date.now();
    const cutoff = sinceCutoff("7d");
    const after = Date.now();
    expect(cutoff).not.toBeNull();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    // cutoff should be ~7 days before "now"
    expect(cutoff!.getTime()).toBeGreaterThanOrEqual(before - sevenDaysMs - 5);
    expect(cutoff!.getTime()).toBeLessThanOrEqual(after - sevenDaysMs + 5);
  });
});

describe("parseTypes", () => {
  it("defaults all-on for null/empty", () => {
    expect(parseTypes(null)).toEqual({ vac: true, news: true, rfp: true });
    expect(parseTypes("")).toEqual({ vac: true, news: true, rfp: true });
    expect(parseTypes("   ")).toEqual({ vac: true, news: true, rfp: true });
  });

  it("parses a single type", () => {
    expect(parseTypes("vac")).toEqual({ vac: true, news: false, rfp: false });
    expect(parseTypes("news")).toEqual({ vac: false, news: true, rfp: false });
    expect(parseTypes("rfp")).toEqual({ vac: false, news: false, rfp: true });
  });

  it("parses a subset", () => {
    expect(parseTypes("vac,rfp")).toEqual({ vac: true, news: false, rfp: true });
    expect(parseTypes("news,vac")).toEqual({
      vac: true,
      news: true,
      rfp: false,
    });
  });

  it("is whitespace- and case-insensitive", () => {
    expect(parseTypes(" VAC , News ")).toEqual({
      vac: true,
      news: true,
      rfp: false,
    });
  });

  it("falls back to all-on when only unknown tokens are present", () => {
    expect(parseTypes("opp,district")).toEqual({
      vac: true,
      news: true,
      rfp: true,
    });
  });

  it("ignores unknown tokens mixed with valid ones", () => {
    expect(parseTypes("vac,bogus")).toEqual({
      vac: true,
      news: false,
      rfp: false,
    });
  });
});

describe("DATE_EXPR", () => {
  it("emits the canonical chronological expression per source", () => {
    expect(DATE_EXPR.vac("v")).toBe("COALESCE(v.date_posted, v.first_seen_at)");
    expect(DATE_EXPR.news("n")).toBe("n.published_at");
    expect(DATE_EXPR.rfp("r")).toBe("r.captured_date");
  });
});

describe("NEWS_CONFIDENCE_LEVELS", () => {
  it("matches the /api/news default confidence filter", () => {
    expect(NEWS_CONFIDENCE_LEVELS).toEqual(["high", "llm", "source"]);
  });
});
