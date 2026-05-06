import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const queryRaw = vi.fn();
const getUser = vi.fn();

const upsertMany = vi.fn();
const updateRfp = vi.fn();
const transaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    $queryRawUnsafe: (...a: unknown[]) => queryRaw(...a),
    $transaction: (...a: unknown[]) => transaction(...a),
    agencyDistrictMap: { upsert: (...a: unknown[]) => upsertMany(...a) },
    rfp: { updateMany: (...a: unknown[]) => updateRfp(...a) },
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => getUser(...a),
}));

import { GET, POST } from "../route";

beforeEach(() => {
  queryRaw.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ id: "user-1", email: "rep@example.com" });
});

function makeReq(qs: string) {
  return new NextRequest(new URL(`http://x/api/admin/agency-district-maps?${qs}`));
}

// Helper: get the .sql text from the last queryRaw call's first argument.
// The route calls prisma.$queryRaw(Prisma.sql`...`) so the first arg is a Prisma Sql
// object; String() on it returns "[object Object]", so we use .sql instead.
function lastSql(): string {
  const lastCall = queryRaw.mock.calls.at(-1)!;
  const arg = lastCall[0] as { sql: string };
  return arg.sql.toLowerCase();
}

describe("GET /api/admin/agency-district-maps", () => {
  it("returns 401 when unauthenticated", async () => {
    getUser.mockResolvedValue(null);
    const res = await GET(makeReq(""));
    expect(res.status).toBe(401);
  });

  it("default status=untriaged filters to map.kind IS NULL", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]); // count query
    queryRaw.mockResolvedValueOnce([]);                    // rows query
    await GET(makeReq(""));
    expect(lastSql()).toContain("m.kind is null");
  });

  it("status=district filters to m.kind = 'district'", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);
    queryRaw.mockResolvedValueOnce([]);
    await GET(makeReq("status=district"));
    expect(lastSql()).toContain("m.kind =");
  });

  it("returns shaped items with mapping=null for untriaged rows", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(1) }]);
    queryRaw.mockResolvedValueOnce([{
      agency_key: 29140,
      agency_name: "United ISD",
      agency_path: "https://...",
      state_abbrev: "TX",
      unresolved_rfp_count: BigInt(3),
      total_rfp_count: BigInt(7),
      latest_captured: new Date("2026-05-03"),
      soonest_open_due: new Date("2026-06-15"),
      total_value_low: "100000.00",
      total_value_high: "500000.00",
      kind: null,
      leaid: null,
      state_fips: null,
      notes: null,
      resolved_at: null,
      resolved_by: null,
      resolved_district_name: null,
    }]);
    const res = await GET(makeReq(""));
    const body = await res.json();
    expect(body.items[0]).toMatchObject({
      agencyKey: 29140,
      agencyName: "United ISD",
      stateAbbrev: "TX",
      unresolvedRfpCount: 3,
      totalRfpCount: 7,
      mapping: null,
    });
    expect(body.pagination).toEqual({ page: 1, pageSize: 50, total: 1 });
  });

  it("returns mapping object when row has a map", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(1) }]);
    queryRaw.mockResolvedValueOnce([{
      agency_key: 29140,
      agency_name: "United ISD",
      agency_path: null,
      state_abbrev: "TX",
      unresolved_rfp_count: BigInt(0),
      total_rfp_count: BigInt(7),
      latest_captured: null,
      soonest_open_due: null,
      total_value_low: "0",
      total_value_high: "0",
      kind: "district",
      leaid: "4849530",
      state_fips: null,
      notes: null,
      resolved_at: new Date("2026-05-04"),
      resolved_by: "user-1",
      resolved_district_name: "United Independent School District",
    }]);
    const res = await GET(makeReq("status=district"));
    const body = await res.json();
    expect(body.items[0].mapping).toMatchObject({
      kind: "district",
      leaid: "4849530",
      districtName: "United Independent School District",
      resolvedBy: "user-1",
    });
  });

  it("page_size capped at 50", async () => {
    queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);
    queryRaw.mockResolvedValueOnce([]);
    const res = await GET(makeReq("page_size=999"));
    const body = await res.json();
    expect(body.pagination.pageSize).toBe(50);
  });
});

function makePost(body: unknown) {
  return new NextRequest(new URL("http://x/api/admin/agency-district-maps"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/admin/agency-district-maps", () => {
  beforeEach(() => {
    upsertMany.mockReset();
    updateRfp.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        agencyDistrictMap: { upsert: upsertMany },
        rfp: { updateMany: updateRfp },
      })
    );
    upsertMany.mockResolvedValue({});
    updateRfp.mockResolvedValue({ count: 0 });
  });

  it("returns 401 unauthenticated", async () => {
    getUser.mockResolvedValue(null);
    const res = await POST(makePost({ agencyKeys: [1], kind: "non_lea" }));
    expect(res.status).toBe(401);
  });

  it("kind=district: writes one upsert per agencyKey + one cascade update", async () => {
    updateRfp.mockResolvedValue({ count: 5 });
    const res = await POST(makePost({ agencyKeys: [29140, 29141], kind: "district", leaid: "4849530" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ mappedAgencyCount: 2, cascadedRfpCount: 5 });
    expect(upsertMany).toHaveBeenCalledTimes(2);
    expect(updateRfp).toHaveBeenCalledWith({
      where: { agencyKey: { in: [29140, 29141] } },
      data: { leaid: "4849530" },
    });
  });

  it("kind=state: no cascade leaid update (leaid stays null)", async () => {
    const res = await POST(makePost({ agencyKeys: [99], kind: "state", stateFips: "36" }));
    expect(res.status).toBe(200);
    expect(upsertMany).toHaveBeenCalledTimes(1);
    // For state: clears any prior leaid back to null (handles district→state switch).
    expect(updateRfp).toHaveBeenCalledWith({
      where: { agencyKey: { in: [99] } },
      data: { leaid: null },
    });
  });

  it("kind=non_lea: clears leaid", async () => {
    const res = await POST(makePost({ agencyKeys: [99], kind: "non_lea" }));
    expect(res.status).toBe(200);
    expect(updateRfp).toHaveBeenCalledWith({
      where: { agencyKey: { in: [99] } },
      data: { leaid: null },
    });
  });

  it("400 when kind=district missing leaid", async () => {
    const res = await POST(makePost({ agencyKeys: [1], kind: "district" }));
    expect(res.status).toBe(400);
  });

  it("400 when kind=state missing stateFips (single-agency case)", async () => {
    const res = await POST(makePost({ agencyKeys: [1], kind: "state" }));
    // Single-agency means UI must supply stateFips.
    expect(res.status).toBe(400);
  });

  it("kind=state, multi-agency: server derives stateFips per row from rfps.state_fips", async () => {
    queryRaw.mockResolvedValueOnce([
      { agency_key: 1, state_fips: "36" },
      { agency_key: 2, state_fips: "06" },
    ]);
    const res = await POST(makePost({ agencyKeys: [1, 2], kind: "state" }));
    expect(res.status).toBe(200);
    expect(upsertMany).toHaveBeenCalledTimes(2);
    // Per-row stateFips derived from each agency's RFPs.
    const upsertArgs = upsertMany.mock.calls.map((c) => c[0].create);
    expect(upsertArgs).toContainEqual(expect.objectContaining({ agencyKey: 1, stateFips: "36" }));
    expect(upsertArgs).toContainEqual(expect.objectContaining({ agencyKey: 2, stateFips: "06" }));
  });

  it("400 when leaid set on kind=state", async () => {
    const res = await POST(makePost({ agencyKeys: [1], kind: "state", stateFips: "36", leaid: "4849530" }));
    expect(res.status).toBe(400);
  });

  it("400 when agencyKeys empty", async () => {
    const res = await POST(makePost({ agencyKeys: [], kind: "non_lea" }));
    expect(res.status).toBe(400);
  });

  it("populates resolvedBy from session", async () => {
    await POST(makePost({ agencyKeys: [1], kind: "non_lea" }));
    expect(upsertMany.mock.calls[0][0].create.resolvedBy).toBe("user-1");
  });
});
