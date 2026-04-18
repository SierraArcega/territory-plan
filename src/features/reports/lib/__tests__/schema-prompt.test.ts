import { describe, expect, it } from "vitest";
import { buildSchemaPrompt } from "../schema-prompt";

describe("buildSchemaPrompt", () => {
  const prompt = buildSchemaPrompt();

  it("anchors relative dates to a supplied current date", () => {
    const fixed = buildSchemaPrompt(new Date("2026-04-17T00:00:00Z"));
    expect(fixed).toMatch(/2026-04-17/);
  });

  it("forbids SQL expressions as filter values", () => {
    // Regression: Claude emitted `value: "date_trunc('month', CURRENT_DATE)"`
    // for filter ops, which Postgres rejected ("invalid input syntax for type
    // timestamp") because every value is bound as a parameter.
    expect(prompt).toMatch(/literal primitive/i);
    expect(prompt).toMatch(/date_trunc/);
  });

  it("includes every registered table name", () => {
    for (const t of [
      "districts",
      "district_financials",
      "district_opportunity_actuals",
      "opportunities",
      "subscriptions",
      "contacts",
      "activities",
      "tasks",
      "territory_plans",
      "user_profiles",
    ]) {
      expect(prompt).toContain(t);
    }
  });

  it("surfaces the PREFER THE MATVIEW warning", () => {
    expect(prompt).toMatch(/PREFER THE MATVIEW FOR AGGREGATES/);
  });

  it("surfaces the EK12 add-on warning", () => {
    expect(prompt).toMatch(/EK12 MASTER\/ADD-ON DATA GAP/);
  });

  it("explains the run_query tool contract", () => {
    expect(prompt).toMatch(/run_query/);
    expect(prompt).toMatch(/NEVER produce SQL/i);
  });

  it("lists concept mappings for revenue and bookings", () => {
    expect(prompt).toMatch(/"revenue"/);
    expect(prompt).toMatch(/"bookings"/);
  });
});
