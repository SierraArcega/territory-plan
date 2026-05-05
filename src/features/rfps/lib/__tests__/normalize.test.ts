import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Decimal from "decimal.js";
import { HigherGovListResponseSchema } from "../types";
import { normalizeOpportunity } from "../normalize";

const fixturePath = join(__dirname, "..", "__fixtures__", "sample-opportunity.json");
const raw = HigherGovListResponseSchema.parse(JSON.parse(readFileSync(fixturePath, "utf8"))).results[0];

describe("normalizeOpportunity", () => {
  it("maps top-level fields", () => {
    const r = normalizeOpportunity(raw);
    expect(r.externalId).toBe(raw.opp_key);
    expect(r.versionKey).toBe(raw.version_key);
    expect(r.title).toBe(raw.title);
    expect(r.solicitationNumber).toBe(raw.source_id);
    expect(r.description).toBe(raw.description_text);
    expect(r.aiSummary).toBe(raw.ai_summary);
  });

  it("extracts agency", () => {
    const r = normalizeOpportunity(raw);
    expect(r.agencyKey).toBe(raw.agency.agency_key);
    expect(r.agencyName).toBe(raw.agency.agency_name);
    expect(r.agencyPath).toBe(raw.agency.path);
  });

  it("derives stateFips from pop_state", () => {
    const r = normalizeOpportunity(raw);
    expect(r.stateAbbrev).toBe("TX");
    expect(r.stateFips).toBe("48");
  });

  it("parses dollar values as Decimal", () => {
    const r = normalizeOpportunity(raw);
    expect(r.valueLow).toEqual(new Decimal("150000"));
    expect(r.valueHigh).toEqual(new Decimal("600000"));
  });

  it("parses date strings to UTC midnight", () => {
    const r = normalizeOpportunity(raw);
    expect(r.capturedDate).toEqual(new Date("2026-05-04T00:00:00.000Z"));
    expect(r.postedDate).toEqual(new Date("2026-05-04T00:00:00.000Z"));
    expect(r.dueDate).toEqual(new Date("2026-05-20T00:00:00.000Z"));
  });

  it("flattens primary contact", () => {
    const r = normalizeOpportunity(raw);
    expect(r.primaryContactName).toBe(raw.primary_contact_email!.contact_name);
    expect(r.primaryContactEmail).toBe(raw.primary_contact_email!.contact_email);
    expect(r.primaryContactPhone).toBe(raw.primary_contact_email!.contact_phone);
  });

  it("extracts naics + psc + oppType", () => {
    const r = normalizeOpportunity(raw);
    expect(r.naicsCode).toBe("611710");
    expect(r.pscCode).toBe("6640");
    expect(r.oppType).toBe("Solicitation");
  });

  it("returns null for empty value strings", () => {
    const empty = { ...raw, val_est_low: "", val_est_high: "" };
    const r = normalizeOpportunity(empty);
    expect(r.valueLow).toBeNull();
    expect(r.valueHigh).toBeNull();
  });

  it("returns null for unknown state abbrev", () => {
    const bad = { ...raw, pop_state: "ZZ" };
    const r = normalizeOpportunity(bad);
    expect(r.stateAbbrev).toBe("ZZ");
    expect(r.stateFips).toBeNull();
  });

  it("returns null for missing posted/due dates", () => {
    const noDates = { ...raw, posted_date: null, due_date: null };
    const r = normalizeOpportunity(noDates);
    expect(r.postedDate).toBeNull();
    expect(r.dueDate).toBeNull();
  });

  it("preserves rawPayload", () => {
    const r = normalizeOpportunity(raw);
    expect(r.rawPayload).toEqual(raw);
  });
});
