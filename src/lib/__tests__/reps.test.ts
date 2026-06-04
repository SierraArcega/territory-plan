import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { userProfile: { findMany: vi.fn() } },
}));

import { getActiveReps } from "../reps";
import prisma from "@/lib/prisma";

const mockFindMany = vi.mocked(prisma.userProfile.findMany);

describe("getActiveReps", () => {
  beforeEach(() => vi.resetAllMocks());

  it("queries reps only (role = 'rep'), excluding managers and admins", async () => {
    mockFindMany.mockResolvedValue([] as never);

    await getActiveReps();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { role: "rep" },
      select: { id: true, email: true, fullName: true, avatarUrl: true },
      orderBy: { fullName: "asc" },
    });
  });

  it("returns the mapped rep roster", async () => {
    mockFindMany.mockResolvedValue([
      { id: "u1", email: "alice@x.com", fullName: "Alice Rep", avatarUrl: null },
      { id: "u2", email: "bob@x.com", fullName: "Bob Rep", avatarUrl: "a.png" },
    ] as never);

    const reps = await getActiveReps();

    expect(reps).toEqual([
      { id: "u1", email: "alice@x.com", fullName: "Alice Rep", avatarUrl: null },
      { id: "u2", email: "bob@x.com", fullName: "Bob Rep", avatarUrl: "a.png" },
    ]);
  });
});
