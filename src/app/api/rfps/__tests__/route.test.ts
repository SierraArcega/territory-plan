import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => {
  const c = { rfp: { findMany: (...a: unknown[]) => findMany(...a) } };
  return { default: c, prisma: c };
});

import { GET } from "../route";

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

function get(qs: Record<string, string> = {}): Promise<Response> {
  const url = new URL("http://localhost/api/rfps");
  for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
  return GET(new NextRequest(url));
}

describe("GET /api/rfps", () => {
  it("returns items + nextCursor=null when no records", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ items: [], nextCursor: null });
  });

  it("filters by leaid", async () => {
    await get({ leaid: "4849530" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ leaid: "4849530" }),
    }));
  });

  it("filters by stateFips", async () => {
    await get({ stateFips: "48" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stateFips: "48" }),
    }));
  });

  it("translates state (USPS) to stateFips", async () => {
    await get({ state: "TX" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ stateFips: "48" }),
    }));
  });

  it("ignores invalid USPS state", async () => {
    await get({ state: "ZZ" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ stateFips: expect.anything() }),
    }));
  });

  it("does q via OR over title + agencyName", async () => {
    await get({ q: "technology" });
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where.OR).toEqual([
      { title: { contains: "technology", mode: "insensitive" } },
      { agencyName: { contains: "technology", mode: "insensitive" } },
    ]);
  });

  it("clamps limit to 50", async () => {
    await get({ limit: "9999" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
  });

  it("returns nextCursor when more rows than limit", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      id: i, capturedDate: new Date(2026, 4, 4 - i), title: `T${i}`,
    }));
    findMany.mockResolvedValueOnce(rows);
    const res = await get({ limit: "50" });
    const body = await res.json();
    expect(body.items).toHaveLength(50);
    expect(body.nextCursor).toBeTypeOf("string");
  });

  it("decodes cursor to apply (capturedDate, id) condition", async () => {
    const cursor = Buffer.from(JSON.stringify({ capturedDate: "2026-05-04T00:00:00.000Z", id: 100 })).toString("base64url");
    await get({ cursor });
    const where = (findMany.mock.calls[0][0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({
      OR: expect.arrayContaining([
        { capturedDate: { lt: new Date("2026-05-04T00:00:00.000Z") } },
        { capturedDate: new Date("2026-05-04T00:00:00.000Z"), id: { lt: 100 } },
      ]),
    });
  });
});
