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
    userProfile: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
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

// The route does a SQL pre-filter ($queryRaw) for candidate opp IDs and then
// findMany on those IDs. In tests we wire both mocks: $queryRaw returns the
// fixtures' IDs, findMany returns the fixtures themselves.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setOppFixtures(opps: any[]) {
  mockPrisma.$queryRaw.mockResolvedValue(opps.map((o) => ({ id: o.id })));
  mockPrisma.opportunity.findMany.mockResolvedValue(opps);
}

describe("GET /api/deals/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no candidates, no fixtures. Tests override per-case.
    mockPrisma.$queryRaw.mockResolvedValue([]);
    setOppFixtures([]);
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
    setOppFixtures([
      {
        id: "opp-1",
        name: "Pilot — Acme USD",
        stage: "Discovery",
        createdAt: new Date("2026-04-15T10:00:00Z"),
        closeDate: null,
        netBookingAmount: "10000.00",
        districtLeaId: "1234567",
        districtName: "Acme USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    const created = body.events.filter((e: { kind: string }) => e.kind === "created");
    expect(created).toHaveLength(1);
    expect(created[0].opportunityId).toBe("opp-1");
    expect(created[0].amount).toBe(10000);
    expect(created[0].occurredAt).toBe("2026-04-15T10:00:00.000Z");
  });

  it("filters opps by salesRepId OR salesRepEmail when scoped to the current user", async () => {
    // Newly-synced Salesforce opps land with sales_rep_email populated but
    // sales_rep_id NULL — the UUID backfill is async. We need to match on
    // either column so brand-new deals don't disappear from Your-pipeline.
    // The filter is applied at the SQL pre-filter ($queryRaw) layer.
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    await getDealEvents(req);

    const sqlArg = mockPrisma.$queryRaw.mock.calls[0][0];
    // Prisma.sql produces an object whose .values array carries every
    // interpolated parameter. We just need both the user's id and email to
    // be present so an OR match against either column is possible.
    expect(sqlArg.values).toEqual(
      expect.arrayContaining([TEST_USER.id, TEST_USER.email])
    );
  });

  it("does NOT emit a 'created' event for opps with createdAt before the April 15, 2026 cutoff", async () => {
    // opportunity.created_at is polluted by bulk migration imports for any
    // deal created before April 15, 2026. Suppress 'created' events from
    // those rows so the calendar isn't flooded by import-batch dates.
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-pre-cutoff",
        name: "Old import — November USD",
        stage: "Discovery",
        createdAt: new Date("2026-04-10T10:00:00Z"),
        closeDate: null,
        netBookingAmount: "10000.00",
        districtLeaId: "1234567",
        districtName: "November USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    expect(body.events.some((e: { kind: string }) => e.kind === "created")).toBe(false);
  });

  it("emits a 'created' event for opps with createdAt on or after April 15, 2026", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-post-cutoff",
        name: "Fresh post-migration — Oscar USD",
        stage: "Discovery",
        createdAt: new Date("2026-04-20T10:00:00Z"),
        closeDate: null,
        netBookingAmount: "8000.00",
        districtLeaId: "2345678",
        districtName: "Oscar USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    const created = body.events.filter((e: { kind: string }) => e.kind === "created");
    expect(created).toHaveLength(1);
    expect(created[0].opportunityId).toBe("opp-post-cutoff");
  });

  it("emits a 'closing' event when an open opp's closeDate is in window, normalized to noon UTC of the calendar day", async () => {
    // closeDate is conceptually a calendar date, stored as midnight UTC.
    // We emit occurredAt at noon UTC of the same calendar day so that the
    // event buckets onto the intended date in any US timezone (midnight UTC
    // would otherwise drift to the previous calendar day in PT/MT/CT/ET).
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-closing",
        name: "Pilot — Echo USD",
        stage: "Negotiation",
        createdAt: new Date("2026-01-15T00:00:00Z"),
        closeDate: new Date("2026-04-22T00:00:00Z"),
        netBookingAmount: "30000.00",
        districtLeaId: "5556667",
        districtName: "Echo USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    const closing = body.events.filter((e: { kind: string }) => e.kind === "closing");
    expect(closing).toHaveLength(1);
    expect(closing[0].opportunityId).toBe("opp-closing");
    expect(closing[0].occurredAt).toBe("2026-04-22T12:00:00.000Z");
    expect(closing[0].amount).toBe(30000);
  });

  it("does NOT emit 'closing' for already-won opps even if closeDate is in window", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-already-won",
        name: "Won — Fox USD",
        stage: "Closed Won",
        createdAt: new Date("2026-01-15T00:00:00Z"),
        closeDate: new Date("2026-04-22T00:00:00Z"),
        netBookingAmount: "30000.00",
        districtLeaId: "5556668",
        districtName: "Fox USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    expect(body.events.some((e: { kind: string }) => e.kind === "closing")).toBe(false);
  });

  it("emits a 'won' event timestamped from stage_history.changed_at, not snapshot capture", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-2",
        name: "Renewal — Beta USD",
        stage: "Closed Won",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        closeDate: null,
        netBookingAmount: "50000.00",
        districtLeaId: "9876543",
        districtName: "Beta USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [
          { stage: "Discovery", changed_at: "2026-01-01T00:00:00Z" },
          { stage: "Negotiation", changed_at: "2026-03-01T00:00:00Z" },
          { stage: "Closed Won", changed_at: "2026-04-15T14:30:00Z" },
        ],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    const won = body.events.filter((e: { kind: string }) => e.kind === "won");
    expect(won).toHaveLength(1);
    expect(won[0].opportunityId).toBe("opp-2");
    expect(won[0].occurredAt).toBe("2026-04-15T14:30:00.000Z");
    expect(won[0].amount).toBe(50000);
  });

  it("emits a 'lost' event from stage_history when stage transitions to Closed Lost", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-3",
        name: "Pilot — Charlie USD",
        stage: "Closed Lost",
        createdAt: new Date("2026-01-10T00:00:00Z"),
        closeDate: null,
        netBookingAmount: "20000.00",
        districtLeaId: "1112223",
        districtName: "Charlie USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "TX" },
        stageHistory: [
          { stage: "Discovery", changed_at: "2026-01-10T00:00:00Z" },
          { stage: "Proposal", changed_at: "2026-02-15T00:00:00Z" },
          { stage: "Closed Lost", changed_at: "2026-04-08T09:00:00Z" },
        ],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    const lost = body.events.filter((e: { kind: string }) => e.kind === "lost");
    expect(lost).toHaveLength(1);
    expect(lost[0].opportunityId).toBe("opp-3");
    expect(lost[0].occurredAt).toBe("2026-04-08T09:00:00.000Z");
  });

  it("emits 'progressed' for non-closed stage changes from stage_history", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-4",
        name: "Expansion — Delta USD",
        stage: "Negotiation",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        closeDate: null,
        netBookingAmount: "15000.00",
        districtLeaId: "4445556",
        districtName: "Delta USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "NY" },
        stageHistory: [
          { stage: "Discovery", changed_at: "2026-01-01T00:00:00Z" },
          { stage: "Negotiation", changed_at: "2026-04-12T00:00:00Z" },
        ],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    const progressed = body.events.filter((e: { kind: string }) => e.kind === "progressed");
    expect(progressed).toHaveLength(1);
    expect(progressed[0].occurredAt).toBe("2026-04-12T00:00:00.000Z");
  });

  it("emits multiple events when an opp has multiple stage transitions in window", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-multi",
        name: "Multi-step — Golf USD",
        stage: "Closed Won",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        closeDate: null,
        netBookingAmount: "75000.00",
        districtLeaId: "7778889",
        districtName: "Golf USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [
          { stage: "Discovery", changed_at: "2026-01-01T00:00:00Z" },
          { stage: "Negotiation", changed_at: "2026-04-05T00:00:00Z" },
          { stage: "Closed Won", changed_at: "2026-04-20T00:00:00Z" },
        ],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    const forOpp = body.events.filter(
      (e: { opportunityId: string }) => e.opportunityId === "opp-multi"
    );
    const kinds = forOpp.map((e: { kind: string }) => e.kind).sort();
    expect(kinds).toEqual(["progressed", "won"]);
  });

  it("collapses multiple same-day 'progressed' transitions for one opp into the latest one", async () => {
    // Reps often correct stage assignments mid-day, leaving stage_history with
    // back-and-forth entries that all happened in the same calendar day.
    // Surfacing each as its own event spams the calendar; we keep only the
    // latest per (opportunity, day).
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-flippy",
        name: "Flippy — Browning USD",
        stage: "Negotiation",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        closeDate: null,
        netBookingAmount: "256000.00",
        districtLeaId: "3334445",
        districtName: "Browning USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "MT" },
        stageHistory: [
          { stage: "Discovery", changed_at: "2026-01-01T00:00:00Z" },
          { stage: "Proposal", changed_at: "2026-04-15T09:00:00Z" },
          { stage: "Negotiation", changed_at: "2026-04-15T11:00:00Z" },
          { stage: "Proposal", changed_at: "2026-04-15T14:00:00Z" },
          { stage: "Negotiation", changed_at: "2026-04-15T17:00:00Z" },
        ],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    const progressed = body.events.filter((e: { kind: string }) => e.kind === "progressed");
    expect(progressed).toHaveLength(1);
    expect(progressed[0].occurredAt).toBe("2026-04-15T17:00:00.000Z");
    expect(progressed[0].stage).toBe("Negotiation");
  });

  it("keeps separate 'progressed' events on different days for the same opp", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-multiday",
        name: "Multiday — India USD",
        stage: "Negotiation",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        closeDate: null,
        netBookingAmount: "40000.00",
        districtLeaId: "1010101",
        districtName: "India USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [
          { stage: "Discovery", changed_at: "2026-01-01T00:00:00Z" },
          { stage: "Proposal", changed_at: "2026-04-05T10:00:00Z" },
          { stage: "Negotiation", changed_at: "2026-04-20T10:00:00Z" },
        ],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    const progressed = body.events.filter((e: { kind: string }) => e.kind === "progressed");
    expect(progressed).toHaveLength(2);
    const days = progressed.map((e: { occurredAt: string }) => e.occurredAt.slice(0, 10)).sort();
    expect(days).toEqual(["2026-04-05", "2026-04-20"]);
  });

  it("does not emit a 'progressed' event for the opp's initial stage (first stage_history entry)", async () => {
    // A deal created in-window has its initial stage as the first stage_history
    // entry. That's not a transition — it's the starting state. The 'created'
    // event already covers the moment the deal was born.
    mockGetUser.mockResolvedValue(TEST_USER);
    setOppFixtures([
      {
        id: "opp-fresh",
        name: "Fresh — Hotel USD",
        stage: "Discovery",
        createdAt: new Date("2026-04-20T00:00:00Z"),
        closeDate: null,
        netBookingAmount: "5000.00",
        districtLeaId: "9990001",
        districtName: "Hotel USD",
        salesRepId: "user-1",
        district: { stateAbbrev: "CA" },
        stageHistory: [
          { stage: "Discovery", changed_at: "2026-04-20T00:00:00Z" },
        ],
      },
    ]);

    const req = makeRequest(
      "/api/deals/events?from=2026-04-01&to=2026-04-30"
    );
    const res = await getDealEvents(req);
    const body = await res.json();

    expect(body.events.some((e: { kind: string }) => e.kind === "progressed")).toBe(false);
    expect(body.events.some((e: { kind: string }) => e.kind === "created")).toBe(true);
  });
});
