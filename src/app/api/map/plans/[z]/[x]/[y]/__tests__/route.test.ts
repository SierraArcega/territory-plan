import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockQuery = vi.fn();
const mockRelease = vi.fn();
vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(() =>
      Promise.resolve({ query: mockQuery, release: mockRelease })
    ),
  },
}));

import { GET } from "../route";
import pool from "@/lib/db";

function buildRequest(
  z: string,
  x: string,
  y: string,
  searchParams?: Record<string, string>
) {
  const url = new URL(`http://localhost/api/map/plans/${z}/${x}/${y}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

async function callGET(
  z: string,
  x: string,
  y: string,
  searchParams?: Record<string, string>
) {
  const request = buildRequest(z, x, y, searchParams);
  return GET(request, { params: Promise.resolve({ z, x, y }) });
}

describe("GET /api/map/plans/[z]/[x]/[y]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("parameter validation", () => {
    it("returns 400 for invalid z coordinate", async () => {
      const res = await callGET("abc", "1", "2.mvt");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid tile coordinates");
    });

    it("returns 400 for invalid x coordinate", async () => {
      const res = await callGET("5", "xyz", "2.mvt");
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid y coordinate", async () => {
      const res = await callGET("5", "1", "abc.mvt");
      expect(res.status).toBe(400);
    });

    it("strips .mvt suffix from y parameter", async () => {
      mockQuery.mockResolvedValue({ rows: [{ mvt: Buffer.from("tile") }] });
      await callGET("7", "10", "20.mvt");
      const [, queryParams] = mockQuery.mock.calls[0];
      expect(queryParams[0]).toBe(7);
      expect(queryParams[1]).toBe(10);
      expect(queryParams[2]).toBe(20);
    });
  });
});
