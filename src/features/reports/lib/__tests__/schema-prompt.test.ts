import { describe, expect, it } from "vitest";
import { buildSchemaPrompt } from "../schema-prompt";

describe("buildSchemaPrompt", () => {
  const prompt = buildSchemaPrompt();

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
