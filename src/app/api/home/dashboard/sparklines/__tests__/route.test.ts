import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/features/home/lib/trajectory-source", () => ({ fetchTrajectoryRows: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { fetchTrajectoryRows } from "@/features/home/lib/trajectory-source";

const mockGetUser = vi.mocked(getUser);
const mockFetchRows = vi.mocked(fetchTrajectoryRows);
const d = (iso: string) => new Date(iso + "T12:00:00Z");
const empty = () => ({ targets: [], openPipeline: [], bookings: [], revenue: [], take: [] });
const req = (fy?: string) => new Request(`http://localhost/api/home/dashboard/sparklines${fy != null ? `?fy=${fy}` : ""}`);

describe("GET /api/home/dashboard/sparklines", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req("2026"))).status).toBe(401);
  });

  it("rejects a non-numeric fy param", async () => {
    mockGetUser.mockResolvedValue({ id: "me", email: "me@x" } as never);
    expect((await GET(req("abc"))).status).toBe(400);
  });

  it("returns caller sparklines (current + prior FY) per metric with a YoY delta", async () => {
    mockGetUser.mockResolvedValue({ id: "me", email: "me@x" } as never);
    const current = empty();
    current.bookings = [{ email: "me@x", date: d("2025-08-01"), value: 100 }];
    const prior = empty();
    prior.bookings = [{ email: "me@x", date: d("2024-08-01"), value: 50 }];
    mockFetchRows.mockResolvedValueOnce(current).mockResolvedValueOnce(prior);

    const res = await GET(req("2026"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe(2026);
    expect(body.sparklines.bookings.current[12]).toBe(100);
    expect(body.sparklines.bookings.prior[12]).toBe(50);
    expect(body.sparklines.bookings.yoy).toBeCloseTo(1, 5); // (100-50)/50
    // scoped to the caller for both years
    expect(mockFetchRows).toHaveBeenCalledWith("2025-26", 2026, "me@x");
    expect(mockFetchRows).toHaveBeenCalledWith("2024-25", 2025, "me@x");
  });
});
