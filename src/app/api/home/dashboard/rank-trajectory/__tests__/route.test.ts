import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));
vi.mock("@/features/home/lib/trajectory-source", () => ({ fetchTrajectoryRows: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";
import { fetchTrajectoryRows } from "@/features/home/lib/trajectory-source";

const mockGetUser = vi.mocked(getUser);
const mockGetActiveReps = vi.mocked(getActiveReps);
const mockFetchRows = vi.mocked(fetchTrajectoryRows);

const d = (iso: string) => new Date(iso + "T12:00:00Z");

function req(fy?: string): Request {
  return new Request(`http://localhost/api/home/dashboard/rank-trajectory${fy != null ? `?fy=${fy}` : ""}`);
}

describe("GET /api/home/dashboard/rank-trajectory", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req("2026"))).status).toBe(401);
  });

  it("rejects a non-numeric fy param", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    expect((await GET(req("abc"))).status).toBe(400);
  });

  it("returns the assembled trajectory payload with the caller's per-metric ranks", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    mockGetActiveReps.mockResolvedValue([
      { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
      { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
    ]);
    mockFetchRows.mockResolvedValue({
      targets: [],
      openPipeline: [],
      bookings: [
        { email: "me@x", date: d("2025-08-01"), value: 100, category: "renewal" },
        { email: "u2@x", date: d("2025-08-01"), value: 300, category: "renewal" },
      ],
      revenue: [],
      take: [],
    });

    const res = await GET(req("2026"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe(2026);
    expect(body.schoolYr).toBe("2025-26");
    expect(body.columns).toHaveLength(13);
    expect(body.metrics.map((m: { metricKey: string }) => m.metricKey)).toEqual([
      "targets", "openPipeline", "bookings", "revenue", "take",
    ]);
    const bookings = body.metrics.find((m: { metricKey: string }) => m.metricKey === "bookings");
    expect(bookings.caller.values[12]).toBe(100);
    expect(bookings.caller.ranks[12]).toBe(2); // u2(300) > me(100)
    expect(mockFetchRows).toHaveBeenCalledWith("2025-26", 2026);
  });
});
