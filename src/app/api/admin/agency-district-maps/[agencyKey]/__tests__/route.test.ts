import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const transaction = vi.fn();
const deleteMap = vi.fn();
const updateRfp = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: (...a: unknown[]) => transaction(...a),
    agencyDistrictMap: { delete: (...a: unknown[]) => deleteMap(...a) },
    rfp: { updateMany: (...a: unknown[]) => updateRfp(...a) },
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => getUser(...a),
}));

import { DELETE } from "../route";

beforeEach(() => {
  transaction.mockReset();
  deleteMap.mockReset();
  updateRfp.mockReset();
  getUser.mockResolvedValue({ id: "user-1" });
  transaction.mockImplementation(async (fn) => fn({
    agencyDistrictMap: { delete: deleteMap },
    rfp: { updateMany: updateRfp },
  }));
});

function makeReq() {
  return new NextRequest(new URL("http://x/api/admin/agency-district-maps/29140"), { method: "DELETE" });
}

describe("DELETE /api/admin/agency-district-maps/[agencyKey]", () => {
  it("401 unauthenticated", async () => {
    getUser.mockResolvedValue(null);
    const res = await DELETE(makeReq(), { params: Promise.resolve({ agencyKey: "29140" }) });
    expect(res.status).toBe(401);
  });

  it("400 when agencyKey not numeric", async () => {
    const res = await DELETE(makeReq(), { params: Promise.resolve({ agencyKey: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("removes map row + nulls Rfp.leaid for that agency_key", async () => {
    deleteMap.mockResolvedValue({});
    updateRfp.mockResolvedValue({ count: 4 });
    const res = await DELETE(makeReq(), { params: Promise.resolve({ agencyKey: "29140" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ removedRfpLeaidCount: 4 });
    expect(deleteMap).toHaveBeenCalledWith({ where: { agencyKey: 29140 } });
    expect(updateRfp).toHaveBeenCalledWith({
      where: { agencyKey: 29140 },
      data: { leaid: null },
    });
  });
});
