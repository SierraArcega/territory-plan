import { describe, it, expect } from "vitest";
import { buildToplineCards } from "../topline";
import type { RepActuals } from "@/lib/opportunity-actuals";

const SY = "2025-26";

function actuals(p: Partial<RepActuals>): RepActuals {
  return {
    totalRevenue: 0, totalTake: 0, completedTake: 0, scheduledTake: 0,
    weightedPipeline: 0, openPipeline: 0, bookings: 0, minPurchaseBookings: 0,
    invoiced: 0, ...p,
  };
}

function batch(map: Record<string, Partial<RepActuals>>): Map<string, Map<string, RepActuals>> {
  const outer = new Map<string, Map<string, RepActuals>>();
  for (const [email, p] of Object.entries(map)) outer.set(email, new Map([[SY, actuals(p)]]));
  return outer;
}

const reps = [
  { id: "me", email: "me@x" },
  { id: "u2", email: "u2@x" },
  { id: "u3", email: "u3@x" },
];

describe("buildToplineCards", () => {
  it("returns the four financial cards with the caller's value + rank per metric", () => {
    const cards = buildToplineCards(
      reps,
      batch({
        "me@x": { openPipeline: 200, bookings: 50, completedTake: 10, scheduledTake: 5, totalRevenue: 100 },
        "u2@x": { openPipeline: 300, bookings: 10, completedTake: 1, scheduledTake: 1, totalRevenue: 500 },
        "u3@x": { openPipeline: 100, bookings: 90, completedTake: 50, scheduledTake: 50, totalRevenue: 50 },
      }),
      SY,
      "me",
      [],
    );
    const byKey = Object.fromEntries(cards.map((c) => [c.metricKey, c]));

    expect(cards.map((c) => c.metricKey)).toEqual(["openPipeline", "bookings", "revenue", "take"]);
    // open pipeline: u2(300) > me(200) > u3(100)
    expect(byKey.openPipeline).toMatchObject({ value: 200, rank: 2, totalReps: 3, label: "Open Pipeline" });
    // bookings: u3(90) > me(50) > u2(10)
    expect(byKey.bookings).toMatchObject({ value: 50, rank: 2 });
    // take = completed + scheduled: u3(100) > me(15) > u2(2)
    expect(byKey.take).toMatchObject({ value: 15, rank: 2 });
    // revenue = blended totalRevenue: u2(500) > me(100) > u3(50)
    expect(byKey.revenue).toMatchObject({ value: 100, rank: 2 });
  });

  it("treats a rep with no actuals as zero", () => {
    const cards = buildToplineCards(reps, batch({ "u2@x": { openPipeline: 300 } }), SY, "me", []);
    const op = cards.find((c) => c.metricKey === "openPipeline")!;
    expect(op.value).toBe(0);
    expect(op.rank).toBe(2); // me(0) & u3(0) tie behind u2(300)
  });

  it("attaches the caller's per-category segments (Return/New/Win-back/Expansion), non-zero only, in order", () => {
    const cards = buildToplineCards(reps, batch({}), SY, "me", [
      { category: "renewal", openPipeline: 280, bookings: 0, take: 0, revenue: 0 },
      { category: "new_business", openPipeline: 140, bookings: 0, take: 0, revenue: 0 },
      { category: "winback", openPipeline: 60, bookings: 0, take: 0, revenue: 0 },
      { category: "expansion", openPipeline: 0, bookings: 0, take: 0, revenue: 0 },
    ]);
    const op = cards.find((c) => c.metricKey === "openPipeline")!;
    expect(op.segments).toEqual([
      { key: "return", label: "Return", value: 280 },
      { key: "new", label: "New biz", value: 140 },
      { key: "winback", label: "Win-back", value: 60 },
    ]); // expansion (0) dropped; order Return→New→Win-back→Expansion
  });

  it("attaches open-pipeline detail (min commit / max budget / counts) to the openPipeline card only", () => {
    const detail = { minCommit: 840000, maxBudget: 1600000, oppCount: 12, accountCount: 9 };
    const cards = buildToplineCards(reps, batch({ "me@x": { openPipeline: 200 } }), SY, "me", [], detail);
    const op = cards.find((c) => c.metricKey === "openPipeline")!;
    expect(op.pipelineDetail).toEqual(detail);
    // No other card carries it.
    for (const c of cards.filter((c) => c.metricKey !== "openPipeline")) {
      expect(c.pipelineDetail).toBeUndefined();
    }
  });

  it("omits pipelineDetail when none is provided (backwards compatible)", () => {
    const cards = buildToplineCards(reps, batch({}), SY, "me", []);
    expect(cards.every((c) => c.pipelineDetail === undefined)).toBe(true);
  });
});

const twoReps = [
  { id: "me", email: "me@x" },
  { id: "u2", email: "u2@x" },
];
const twoRepActuals = batch({
  "me@x": { openPipeline: 100 },
  "u2@x": { openPipeline: 300 },
});

describe("buildToplineCards team mode", () => {
  it("sums all reps and reports null rank", () => {
    const cards = buildToplineCards(twoReps, twoRepActuals, SY, "me", [], null, "team");
    const openPipe = cards.find((c) => c.metricKey === "openPipeline")!;
    expect(openPipe.value).toBe(400);
    expect(openPipe.rank).toBeNull();
    expect(openPipe.inRoster).toBe(true);
    expect(openPipe.totalReps).toBe(2);
  });

  it("rep mode is unchanged (caller value + rank)", () => {
    const cards = buildToplineCards(twoReps, twoRepActuals, SY, "me", [], null, "rep");
    const openPipe = cards.find((c) => c.metricKey === "openPipeline")!;
    expect(openPipe.value).toBe(100);
    expect(openPipe.rank).toBe(2);
  });
});
