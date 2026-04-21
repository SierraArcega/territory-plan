import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    district: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    contact: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    schoolContact: {
      upsert: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { POST } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/webhooks/clay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.district.findUnique.mockResolvedValue({ leaid: "0100001" });
  mockPrisma.contact.findFirst.mockResolvedValue(null);
  mockPrisma.contact.create.mockResolvedValue({ id: 42 });
  mockPrisma.schoolContact.upsert.mockResolvedValue({});
});

describe("POST /api/webhooks/clay", () => {
  it("creates a SchoolContact when payload includes ncessch", async () => {
    const res = await POST(buildRequest({
      leaid: "0100001",
      ncessch: "010000100001",
      name: "Jane Principal",
      title: "Principal",
      email: "jane@alpha.edu",
    }));

    expect(res.status).toBe(200);
    expect(mockPrisma.contact.create).toHaveBeenCalled();
    expect(mockPrisma.schoolContact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId_contactId: { schoolId: "010000100001", contactId: 42 } },
        create: { schoolId: "010000100001", contactId: 42 },
        update: {},
      })
    );
  });

  it("does NOT call schoolContact.upsert when payload has no ncessch", async () => {
    const res = await POST(buildRequest({
      leaid: "0100001",
      name: "Super Intendent",
      title: "Superintendent",
      email: "super@alpha.edu",
    }));

    expect(res.status).toBe(200);
    expect(mockPrisma.schoolContact.upsert).not.toHaveBeenCalled();
  });
});
