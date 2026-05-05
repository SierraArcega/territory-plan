import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const syncRfps = vi.fn();
vi.mock("@/features/rfps/lib/sync", () => ({
  syncRfps: (...a: unknown[]) => syncRfps(...a),
}));

import { GET } from "../route";

beforeEach(() => {
  syncRfps.mockReset();
  process.env.CRON_SECRET = "shh";
});

function reqWith(opts: { auth?: string; secret?: string } = {}): NextRequest {
  const url = new URL("http://localhost/api/cron/ingest-rfps");
  if (opts.secret) url.searchParams.set("secret", opts.secret);
  return new NextRequest(url, { headers: opts.auth ? { authorization: opts.auth } : undefined });
}

describe("GET /api/cron/ingest-rfps", () => {
  it("401 when neither auth header nor secret matches", async () => {
    const res = await GET(reqWith({ secret: "wrong" }));
    expect(res.status).toBe(401);
    expect(syncRfps).not.toHaveBeenCalled();
  });

  it("200 with summary when ?secret matches", async () => {
    syncRfps.mockResolvedValue({ runId: 1, status: "ok", recordsSeen: 5 });
    const res = await GET(reqWith({ secret: "shh" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ runId: 1, status: "ok", recordsSeen: 5 });
    expect(syncRfps).toHaveBeenCalledOnce();
  });

  it("200 when Bearer header matches", async () => {
    syncRfps.mockResolvedValue({ runId: 2, status: "ok" });
    const res = await GET(reqWith({ auth: "Bearer shh" }));
    expect(res.status).toBe(200);
  });

  it("500 when sync throws", async () => {
    syncRfps.mockRejectedValue(new Error("kaboom"));
    const res = await GET(reqWith({ secret: "shh" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("kaboom");
  });
});
