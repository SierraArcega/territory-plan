import { describe, expect, it, vi, beforeEach } from "vitest";

// --- Prisma mock (closure-deferred style)
const rfpUpsert = vi.fn();
const rfpIngestRunCreate = vi.fn();
const rfpIngestRunUpdate = vi.fn();
const rfpIngestRunUpdateMany = vi.fn();
const rfpIngestRunFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => {
  const client = {
    rfp: { upsert: (...a: unknown[]) => rfpUpsert(...a) },
    rfpIngestRun: {
      create: (...a: unknown[]) => rfpIngestRunCreate(...a),
      update: (...a: unknown[]) => rfpIngestRunUpdate(...a),
      updateMany: (...a: unknown[]) => rfpIngestRunUpdateMany(...a),
      findFirst: (...a: unknown[]) => rfpIngestRunFindFirst(...a),
    },
  };
  return { default: client, prisma: client };
});

// --- Mock the client + resolver
const fetchOpps = vi.fn();
vi.mock("../highergov-client", () => ({
  fetchOpportunities: (...a: unknown[]) => fetchOpps(...a),
}));
const resolveDistrict = vi.fn();
vi.mock("../district-resolver", () => ({
  resolveDistrict: (...a: unknown[]) => resolveDistrict(...a),
}));

import { syncRfps } from "../sync";

const minimalRecord = (oppKey: string, agencyKey = 1, agencyName = "A") => ({
  opp_key: oppKey, version_key: oppKey + "v",
  opp_cat: "SLED Contract Opportunity",
  title: "T", description_text: "", ai_summary: "",
  source_id: "", source_id_version: "",
  captured_date: "2026-05-04", posted_date: null, due_date: null,
  agency: { agency_key: agencyKey, agency_name: agencyName, agency_abbreviation: null, agency_type: "SLED", path: null },
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

async function* gen(records: unknown[]) {
  for (const r of records) yield r;
}

beforeEach(() => {
  for (const m of [rfpUpsert, rfpIngestRunCreate, rfpIngestRunUpdate, rfpIngestRunUpdateMany, rfpIngestRunFindFirst, fetchOpps, resolveDistrict]) m.mockReset();
  rfpUpsert.mockResolvedValue({ firstSeenAt: new Date(0), lastSeenAt: new Date(0) });
  rfpIngestRunCreate.mockResolvedValue({ id: 1 });
  rfpIngestRunUpdate.mockResolvedValue({});
  rfpIngestRunUpdateMany.mockResolvedValue({ count: 0 });
});

describe("syncRfps", () => {
  it("happy path: fetch, resolve, upsert, finalize", async () => {
    fetchOpps.mockReturnValue(gen([minimalRecord("a"), minimalRecord("b")]));
    resolveDistrict.mockResolvedValue("4849530");
    rfpIngestRunFindFirst.mockResolvedValue({ finishedAt: new Date("2026-05-01T00:00:00Z") });

    const summary = await syncRfps();

    expect(rfpIngestRunCreate).toHaveBeenCalledOnce();
    expect(rfpUpsert).toHaveBeenCalledTimes(2);
    expect(rfpIngestRunUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      data: expect.objectContaining({ status: "ok", recordsSeen: 2, recordsResolved: 2, recordsUnresolved: 0 }),
    }));
    expect(summary.status).toBe("ok");
  });

  it("dedupes resolver calls per agency_key", async () => {
    fetchOpps.mockReturnValue(gen([
      minimalRecord("a", 1, "Agency One"),
      minimalRecord("b", 1, "Agency One"),
      minimalRecord("c", 1, "Agency One"),
      minimalRecord("d", 2, "Agency Two"),
    ]));
    resolveDistrict.mockResolvedValueOnce("L1").mockResolvedValueOnce("L2");
    rfpIngestRunFindFirst.mockResolvedValue(null);

    await syncRfps();

    expect(resolveDistrict).toHaveBeenCalledTimes(2);
    expect(rfpUpsert).toHaveBeenCalledTimes(4);
  });

  it("cold-start watermark = now - 90 days when no prior ok run", async () => {
    fetchOpps.mockReturnValue(gen([]));
    rfpIngestRunFindFirst.mockResolvedValue(null);

    const before = Date.now() - 91 * 24 * 60 * 60 * 1000;
    await syncRfps();
    const after = Date.now() - 89 * 24 * 60 * 60 * 1000;

    const sinceArg = (fetchOpps.mock.calls[0][0] as { since: Date }).since;
    expect(sinceArg.getTime()).toBeGreaterThanOrEqual(before);
    expect(sinceArg.getTime()).toBeLessThanOrEqual(after);
  });

  it("orphan-sweep flips stale running rows before starting", async () => {
    fetchOpps.mockReturnValue(gen([]));
    rfpIngestRunFindFirst.mockResolvedValue(null);

    await syncRfps();

    expect(rfpIngestRunUpdateMany).toHaveBeenCalledWith({
      where: { source: "highergov", status: "running", startedAt: { lt: expect.any(Date) } },
      data: { status: "error", error: "orphaned (>10min running)", finishedAt: expect.any(Date) },
    });
  });

  it("partial failure: one record's upsert throws -> run still finalizes with seen counter", async () => {
    fetchOpps.mockReturnValue(gen([minimalRecord("a"), minimalRecord("b")]));
    resolveDistrict.mockResolvedValue(null);
    rfpIngestRunFindFirst.mockResolvedValue(null);
    rfpUpsert.mockRejectedValueOnce(new Error("constraint")).mockResolvedValueOnce({ firstSeenAt: new Date(0), lastSeenAt: new Date(0) });

    const summary = await syncRfps();

    expect(summary.recordsSeen).toBe(2);
    // recordsNew + recordsUpdated should equal the number of successful upserts (1)
    expect(summary.recordsNew + summary.recordsUpdated).toBe(1);
  });

  it("re-throws and marks run as error if fetch itself throws", async () => {
    fetchOpps.mockImplementation(() => { throw new Error("boom"); });
    rfpIngestRunFindFirst.mockResolvedValue(null);

    await expect(syncRfps()).rejects.toThrow("boom");
    expect(rfpIngestRunUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "error", error: expect.stringContaining("boom") }),
    }));
  });
});
