import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    opportunity: {
      findMany: vi.fn(),
    },
    opportunitySnapshot: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET as getDealEvents } from "../route";

const TEST_USER = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

describe("GET /api/deals/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when from/to missing", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    const req = makeRequest("/api/deals/events");
    const res = await getDealEvents(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid dates", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    const req = makeRequest("/api/deals/events?from=banana&to=2026-04-30");
    const res = await getDealEvents(req);
    expect(res.status).toBe(400);
  });

  it("emits a 'created' event when opportunity.createdAt is in window", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.opportunity.findMany.mockResolvedValue([
      {
        id: "opp-1",
        name: "Pilot — Acme USD",
        stage: "Discovery",
        createdAt: new Date("2026-04-15T10:00:00Z"),
        netBookingAmount: "10000.00",
        districtLeaId: "1234567",
        districtName: "Acme USD",
        salesRepId: "user-1",
      },
    ]);
    mockPrisma.opportunitySnapshot.findMany.mockResolvedValue([]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0].kind).toBe("created");
    expect(body.events[0].opportunityId).toBe("opp-1");
    expect(body.events[0].amount).toBe(10000);
  });

  it("emits a 'won' event when stage transitions to Closed Won", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.opportunity.findMany.mockResolvedValue([]);
    mockPrisma.opportunitySnapshot.findMany.mockResolvedValue([
      {
        opportunityId: "opp-2",
        stage: "Closed Won",
        capturedAt: new Date("2026-04-22T00:00:00Z"),
        snapshotDate: new Date("2026-04-22"),
        netBookingAmount: "50000.00",
        salesRepId: "user-1",
        districtLeaId: "9876543",
      },
    ]);
    // Prior snapshot was Negotiation
    mockPrisma.opportunitySnapshot.findFirst.mockResolvedValue({
      opportunityId: "opp-2",
      stage: "Negotiation",
    });
    // Opp metadata lookup
    (mockPrisma.opportunity.findMany as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where }: { where: { id?: { in?: string[] } } }) => {
        if (where?.id?.in) {
          return Promise.resolve([
            {
              id: "opp-2",
              name: "Renewal — Beta USD",
              districtLeaId: "9876543",
              districtName: "Beta USD",
              district: { stateAbbrev: "CA" },
            },
          ]);
        }
        return Promise.resolve([]);
      }
    );

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    const wonEvents = body.events.filter((e: { kind: string }) => e.kind === "won");
    expect(wonEvents).toHaveLength(1);
    expect(wonEvents[0].opportunityId).toBe("opp-2");
    expect(wonEvents[0].amount).toBe(50000);
  });

  it("emits a 'lost' event when stage transitions to Closed Lost", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.opportunitySnapshot.findMany.mockResolvedValue([
      {
        opportunityId: "opp-3",
        stage: "Closed Lost",
        capturedAt: new Date("2026-04-15T00:00:00Z"),
        snapshotDate: new Date("2026-04-15"),
        netBookingAmount: "20000.00",
        salesRepId: "user-1",
        districtLeaId: "1112223",
      },
    ]);
    mockPrisma.opportunitySnapshot.findFirst.mockResolvedValue({
      opportunityId: "opp-3",
      stage: "Proposal",
    });
    (mockPrisma.opportunity.findMany as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where }: { where: { id?: { in?: string[] } } }) => {
        if (where?.id?.in) {
          return Promise.resolve([
            {
              id: "opp-3",
              name: "Pilot — Charlie USD",
              districtLeaId: "1112223",
              districtName: "Charlie USD",
              district: { stateAbbrev: "TX" },
            },
          ]);
        }
        return Promise.resolve([]);
      }
    );

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();
    expect(body.events.some((e: { kind: string }) => e.kind === "lost")).toBe(true);
  });

  it("emits 'progressed' for non-closed stage changes", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.opportunitySnapshot.findMany.mockResolvedValue([
      {
        opportunityId: "opp-4",
        stage: "Negotiation",
        capturedAt: new Date("2026-04-10T00:00:00Z"),
        snapshotDate: new Date("2026-04-10"),
        netBookingAmount: "15000.00",
        salesRepId: "user-1",
        districtLeaId: "4445556",
      },
    ]);
    mockPrisma.opportunitySnapshot.findFirst.mockResolvedValue({
      opportunityId: "opp-4",
      stage: "Discovery",
    });
    (mockPrisma.opportunity.findMany as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      ({ where }: { where: { id?: { in?: string[] } } }) => {
        if (where?.id?.in) {
          return Promise.resolve([
            {
              id: "opp-4",
              name: "Expansion — Delta USD",
              districtLeaId: "4445556",
              districtName: "Delta USD",
              district: { stateAbbrev: "NY" },
            },
          ]);
        }
        return Promise.resolve([]);
      }
    );

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();
    expect(body.events.some((e: { kind: string }) => e.kind === "progressed")).toBe(true);
  });
});
