import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const syncMock = vi.hoisted(() =>
  vi.fn(async () => ({ filled: 0, districts: [] as { leaid: string; ownerId: string }[] }))
);

vi.mock("@/lib/district-owner-sync", () => ({
  syncDistrictOwners: syncMock,
}));

import { GET } from "../route";

function req(secret?: string): NextRequest {
  const url = new URL("http://localhost/api/cron/sync-district-owners");
  if (secret) url.searchParams.set("secret", secret);
  return new NextRequest(url);
}

beforeEach(() => {
  syncMock.mockReset();
  syncMock.mockResolvedValue({ filled: 0, districts: [] });
  process.env.CRON_SECRET = "shh";
});

describe("GET /api/cron/sync-district-owners", () => {
  it("returns 401 when secret is wrong", async () => {
    const res = await GET(req("bad"));
    expect(res.status).toBe(401);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET env is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("shh"));
    expect(res.status).toBe(401);
    expect(syncMock).not.toHaveBeenCalled();
  });

  it("accepts the secret via Authorization: Bearer header", async () => {
    const url = new URL("http://localhost/api/cron/sync-district-owners");
    const res = await GET(new NextRequest(url, { headers: { authorization: "Bearer shh" } }));
    expect(res.status).toBe(200);
    expect(syncMock).toHaveBeenCalledOnce();
  });

  it("fills owners and returns the count + districts", async () => {
    syncMock.mockResolvedValue({
      filled: 2,
      districts: [
        { leaid: "0600001", ownerId: "u1" },
        { leaid: "3620580", ownerId: "u2" },
      ],
    });
    const res = await GET(req("shh"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      filled: 2,
      districts: [
        { leaid: "0600001", ownerId: "u1" },
        { leaid: "3620580", ownerId: "u2" },
      ],
    });
  });
});
