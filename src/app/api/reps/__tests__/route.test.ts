import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/reps", () => ({ getActiveReps: vi.fn() }));

import { GET } from "../route";
import { getUser } from "@/lib/supabase/server";
import { getActiveReps } from "@/lib/reps";

const mockGetUser = vi.mocked(getUser);
const mockGetActiveReps = vi.mocked(getActiveReps);

describe("GET /api/reps", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("returns the active rep roster without emails", async () => {
    mockGetUser.mockResolvedValue({ id: "me" } as never);
    mockGetActiveReps.mockResolvedValue([
      { id: "u2", email: "u2@x", fullName: "Bob", avatarUrl: "a.png" },
      { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([
      { id: "u2", fullName: "Bob", avatarUrl: "a.png" },
      { id: "me", fullName: "Me", avatarUrl: null },
    ]);
    expect(JSON.stringify(body)).not.toContain("@x"); // emails must not leak
  });
});
