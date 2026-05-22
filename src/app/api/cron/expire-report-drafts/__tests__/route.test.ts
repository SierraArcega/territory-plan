import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const deleteManyMock = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));

vi.mock("@/lib/prisma", () => ({
  default: {
    reportDraft: { deleteMany: deleteManyMock },
  },
}));

import { GET } from "../route";

function req(secret?: string): NextRequest {
  const url = new URL("http://localhost/api/cron/expire-report-drafts");
  if (secret) url.searchParams.set("secret", secret);
  return new NextRequest(url);
}

beforeEach(() => {
  deleteManyMock.mockReset();
  deleteManyMock.mockResolvedValue({ count: 0 });
  process.env.CRON_SECRET = "shh";
});

describe("GET /api/cron/expire-report-drafts", () => {
  it("returns 401 when secret is wrong", async () => {
    const res = await GET(req("bad"));
    expect(res.status).toBe(401);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET env is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("shh"));
    expect(res.status).toBe(401);
  });

  it("deletes drafts older than 30 days and returns count", async () => {
    deleteManyMock.mockResolvedValue({ count: 3 });
    const res = await GET(req("shh"));
    expect(res.status).toBe(200);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        lastTouchedAt: { lt: expect.any(Date) },
      },
    });
    const json = await res.json();
    expect(json).toMatchObject({ deleted: 3 });
  });

  it("passes a cutoff date 30 days in the past", async () => {
    await GET(req("shh"));
    const [call] = deleteManyMock.mock.calls;
    const cutoff: Date = call[0].where.lastTouchedAt.lt;
    const diffDays = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(29.9);
    expect(diffDays).toBeLessThan(30.1);
  });
});
