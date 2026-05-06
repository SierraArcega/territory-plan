import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fetchOpportunities } from "../highergov-client";

const fetchSpy = vi.fn();

beforeEach(() => {
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
  process.env.HIGHERGOV_API_KEY = "test-key";
  delete process.env.HIGHERGOV_K12_SEARCH_ID;
  delete process.env.HIGHERGOV_K12_NAICS;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

const minimalRecord = (oppKey: string) => ({
  opp_key: oppKey, version_key: oppKey + "v",
  opp_cat: "SLED Contract Opportunity",
  title: "T", description_text: "", ai_summary: "",
  source_id: "", source_id_version: "",
  captured_date: "2026-05-04", posted_date: null, due_date: null,
  agency: { agency_key: 1, agency_name: "A", agency_abbreviation: null, agency_type: "SLED", path: null },
  naics_code: null, psc_code: null, opp_type: null,
  primary_contact_email: null, secondary_contact_email: null,
  set_aside: null, nsn: null,
  val_est_low: "", val_est_high: "",
  pop_country: "USA", pop_state: "TX", pop_city: "", pop_zip: "",
  source_type: "sled", sole_source_flag: false, product_service: "",
  dibbs_status: null, dibbs_quantity: null, dibbs_days_to_deliver: null,
  dibbs_fast_award_flag: null, dibbs_aidc_flag: null, dibbs_tech_docs_flag: null,
  path: "", source_path: "", document_path: "",
});

describe("fetchOpportunities", () => {
  it("requests with api_key, source_type=sled, default NAICS, and captured_date filter", async () => {
    fetchSpy.mockResolvedValueOnce(ok({ results: [], links: { next: null } }));
    const since = new Date("2026-05-01T00:00:00Z");
    const out: unknown[] = [];
    for await (const r of fetchOpportunities({ since })) out.push(r);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/api-external/opportunity/");
    expect(url.searchParams.get("api_key")).toBe("test-key");
    expect(url.searchParams.get("source_type")).toBe("sled");
    expect(url.searchParams.get("naics_code")).toBe("611110");
    expect(url.searchParams.get("search_id")).toBeNull();
    expect(url.searchParams.get("captured_date__gte")).toBe("2026-05-01");
    expect(url.searchParams.get("ordering")).toBe("-captured_date");
  });

  it("uses HIGHERGOV_K12_NAICS env override when set", async () => {
    process.env.HIGHERGOV_K12_NAICS = "611710";
    fetchSpy.mockResolvedValueOnce(ok({ results: [], links: { next: null } }));
    for await (const _ of fetchOpportunities({ since: new Date() })) void _;
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get("naics_code")).toBe("611710");
  });

  it("uses HIGHERGOV_K12_SEARCH_ID as the sole scope filter when set", async () => {
    process.env.HIGHERGOV_K12_SEARCH_ID = "saved-search-xyz";
    fetchSpy.mockResolvedValueOnce(ok({ results: [], links: { next: null } }));
    for await (const _ of fetchOpportunities({ since: new Date() })) void _;
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get("search_id")).toBe("saved-search-xyz");
    // The saved search owns the scope — hardcoded source_type and naics_code
    // are intentionally NOT applied so the search controls breadth.
    expect(url.searchParams.get("naics_code")).toBeNull();
    expect(url.searchParams.get("source_type")).toBeNull();
  });

  it("ignores HIGHERGOV_K12_NAICS when a saved search is configured", async () => {
    process.env.HIGHERGOV_K12_SEARCH_ID = "saved-search-xyz";
    process.env.HIGHERGOV_K12_NAICS = "611710";
    fetchSpy.mockResolvedValueOnce(ok({ results: [], links: { next: null } }));
    for await (const _ of fetchOpportunities({ since: new Date() })) void _;
    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.searchParams.get("search_id")).toBe("saved-search-xyz");
    expect(url.searchParams.get("naics_code")).toBeNull();
  });

  it("paginates by following links.next until null", async () => {
    fetchSpy
      .mockResolvedValueOnce(ok({
        results: [minimalRecord("a"), minimalRecord("b")],
        links: { next: "https://www.highergov.com/api-external/opportunity/?page=2" },
      }))
      .mockResolvedValueOnce(ok({
        results: [minimalRecord("c")],
        links: { next: null },
      }));
    const records: { opp_key: string }[] = [];
    for await (const r of fetchOpportunities({ since: new Date() })) records.push(r);
    expect(records.map((r) => r.opp_key)).toEqual(["a", "b", "c"]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("retries on 5xx with backoff", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(ok({ results: [minimalRecord("a")], links: { next: null } }));
    const records: { opp_key: string }[] = [];
    for await (const r of fetchOpportunities({ since: new Date(), retryDelayMs: 0 })) records.push(r);
    expect(records).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries on persistent 5xx", async () => {
    fetchSpy.mockResolvedValue(new Response("err", { status: 503 }));
    await expect(async () => {
      for await (const _ of fetchOpportunities({ since: new Date(), retryDelayMs: 0, maxRetries: 2 })) void _;
    }).rejects.toThrow(/HigherGov 503/);
    expect(fetchSpy).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("honors Retry-After header on 429", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response("rate limit", { status: 429, headers: { "Retry-After": "0" } }))
      .mockResolvedValueOnce(ok({ results: [], links: { next: null } }));
    const out: unknown[] = [];
    for await (const r of fetchOpportunities({ since: new Date(), retryDelayMs: 0 })) out.push(r);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws when env vars missing", async () => {
    delete process.env.HIGHERGOV_API_KEY;
    await expect(async () => {
      for await (const _ of fetchOpportunities({ since: new Date() })) void _;
    }).rejects.toThrow(/HIGHERGOV_API_KEY/);
  });
});
