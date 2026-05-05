import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HigherGovListResponseSchema, HigherGovOpportunitySchema } from "../types";

const fixturePath = join(__dirname, "..", "__fixtures__", "sample-opportunity.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

describe("HigherGovOpportunitySchema", () => {
  it("parses the captured sample without throwing", () => {
    const parsed = HigherGovListResponseSchema.parse(fixture);
    expect(parsed.results).toHaveLength(1);
    const r = parsed.results[0];
    expect(r.opp_key).toMatch(/^[a-f0-9]+$/);
    expect(r.agency.agency_key).toEqual(expect.any(Number));
    expect(r.agency.agency_name).toBe("United Independent School District");
    expect(r.pop_state).toBe("TX");
  });

  it("accepts missing nullable nested fields", () => {
    const minimal = {
      opp_key: "x", version_key: "y", title: "T",
      captured_date: "2026-05-04",
      agency: { agency_key: 1, agency_name: "A", agency_abbreviation: null, agency_type: null, path: null },
      pop_country: "USA", pop_state: "TX", pop_city: "", pop_zip: "",
      source_id: "", source_id_version: "",
      val_est_low: "", val_est_high: "",
      naics_code: null, psc_code: null, opp_type: null,
      primary_contact_email: null, secondary_contact_email: null,
      set_aside: null, nsn: null,
      source_type: "sled", sole_source_flag: false, product_service: "",
      dibbs_status: null, dibbs_quantity: null, dibbs_days_to_deliver: null,
      dibbs_fast_award_flag: null, dibbs_aidc_flag: null, dibbs_tech_docs_flag: null,
      path: "", source_path: "", document_path: "",
      opp_cat: "SLED Contract Opportunity",
      description_text: "", ai_summary: "",
      posted_date: null, due_date: null,
    };
    expect(() => HigherGovOpportunitySchema.parse(minimal)).not.toThrow();
  });
});
