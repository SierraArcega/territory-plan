import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/features/home/lib/trajectory-source", () => ({ fetchTrajectoryRows: vi.fn(), fetchWowSnapshots: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { fetchTrajectoryRows, fetchWowSnapshots } from "@/features/home/lib/trajectory-source";
import { getActiveReps } from "@/lib/reps";

const mockGetUser = vi.mocked(getUser);
const mockFetchRows = vi.mocked(fetchTrajectoryRows);
const mockWow = vi.mocked(fetchWowSnapshots);
const mockGetActiveReps = vi.mocked(getActiveReps);

const d = (iso: string) => new Date(iso + "T12:00:00Z");
type Rows = Record<string, { email: string; date: Date; value: number }[]>;
const empty = (): Rows => ({ targets: [], openPipeline: [], bookings: [], revenue: [], take: [] });

const REPS = [
  { id: "rep-a", email: "a@x", fullName: "Rep A", avatarUrl: null },
  { id: "rep-b", email: "b@x", fullName: "Rep B", avatarUrl: null },
];

const req = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return new Request(`http://localhost/api/home/dashboard/sparklines${qs}`);
};

describe("GET /api/home/dashboard/sparklines", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET(req({ fy: "2026" }))).status).toBe(401);
  });

  it("rejects a non-numeric fy param", async () => {
    mockGetUser.mockResolvedValue({ id: "rep-a", email: "a@x" } as never);
    mockGetActiveReps.mockResolvedValue(REPS);
    expect((await GET(req({ fy: "abc" }))).status).toBe(400);
  });

  it("returns 400 for an unknown rep id", async () => {
    mockGetUser.mockResolvedValue({ id: "rep-a", email: "a@x" } as never);
    mockGetActiveReps.mockResolvedValue(REPS);
    expect((await GET(req({ fy: "2026", rep: "unknown-id" }))).status).toBe(400);
  });

  it("returns caller sparklines (current + prior FY) per metric with a YoY delta (rep mode, default)", async () => {
    mockGetUser.mockResolvedValue({ id: "rep-a", email: "a@x" } as never);
    mockGetActiveReps.mockResolvedValue(REPS);
    const current = empty();
    current.bookings = [{ email: "a@x", date: d("2025-08-01"), value: 100 }];
    const prior = empty();
    prior.bookings = [{ email: "a@x", date: d("2024-08-01"), value: 50 }];
    mockFetchRows.mockResolvedValueOnce(current as never).mockResolvedValueOnce(prior as never);
    mockWow.mockResolvedValue([
      { date: "2026-05-22", openPipeline: 400, bookings: 500 },
      { date: "2026-05-29", openPipeline: 480, bookings: 500 },
    ]);

    const res = await GET(req({ fy: "2026" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fy).toBe(2026);
    expect(body.mode).toBe("rep");
    expect(body.sparklines.bookings.current[12]).toBe(100);
    expect(body.sparklines.bookings.prior[12]).toBe(50);
    expect(body.sparklines.bookings.yoy).toBeCloseTo(1, 5); // (100-50)/50
    expect(body.wow.openPipeline).toBeCloseTo(0.2, 5); // (480-400)/400
    expect(body.wow.bookings).toBe(0); // unchanged
    // scoped to the caller for both years
    expect(mockFetchRows).toHaveBeenCalledWith("2025-26", 2026, "a@x");
    expect(mockFetchRows).toHaveBeenCalledWith("2024-25", 2025, "a@x");
  });

  it("team mode fetches all-reps rows (no email) and sums WoW across the team", async () => {
    mockGetUser.mockResolvedValue({ id: "rep-a", email: "a@x" } as never);
    mockGetActiveReps.mockResolvedValue(REPS);

    const current = empty();
    // rep-a: 100 in Aug; rep-b: 200 in Aug — team sum at col 2+ = 300
    current.openPipeline = [
      { email: "a@x", date: d("2025-08-01"), value: 100 },
      { email: "b@x", date: d("2025-08-01"), value: 200 },
    ];
    const prior = empty();
    mockFetchRows.mockResolvedValueOnce(current as never).mockResolvedValueOnce(prior as never);

    // WoW: rep-a has 2 snapshots, rep-b has 2 snapshots — team sums by date
    mockWow
      .mockResolvedValueOnce([
        { date: "2026-05-22", openPipeline: 100, bookings: 50 },
        { date: "2026-05-29", openPipeline: 120, bookings: 60 },
      ])
      .mockResolvedValueOnce([
        { date: "2026-05-22", openPipeline: 200, bookings: 100 },
        { date: "2026-05-29", openPipeline: 240, bookings: 110 },
      ]);

    const res = await GET(req({ fy: "2026", rep: "team" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mode).toBe("team");
    // sparklines for team: rows fetched with no email (undefined → all reps)
    expect(mockFetchRows).toHaveBeenCalledWith("2025-26", 2026, undefined);
    expect(mockFetchRows).toHaveBeenCalledWith("2024-25", 2025, undefined);
    // team openPipeline col 2 = 300 (100+200)
    expect(body.sparklines.openPipeline.current[2]).toBe(300);
    // WoW: team sums by date: 2026-05-22 → {openPipeline:300, bookings:150}, 2026-05-29 → {openPipeline:360, bookings:170}
    // openPipeline WoW: (360-300)/300 = 0.2
    expect(body.wow.openPipeline).toBeCloseTo(0.2, 5);
    // bookings WoW: (170-150)/150 ≈ 0.1333
    expect(body.wow.bookings).toBeCloseTo((170 - 150) / 150, 5);
    // fetchWowSnapshots called once per rep (2 reps)
    expect(mockWow).toHaveBeenCalledTimes(2);
  });
});
