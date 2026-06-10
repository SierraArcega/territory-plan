import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import type { DbClient } from "@/features/shared/lib/service-error";
import { isServiceError } from "@/features/shared/lib/service-error";
import {
  LEAD_STATUSES,
  LEAD_TRANSITIONS,
  LEAD_OPP_STAGE_MEETING_BOOKED,
  LEAD_OPP_STAGE_DISCOVERY,
  LEAD_CREATED_OPP_SOURCE,
  OPP_ADVANCED_MESSAGE,
  pickMostRecentContact,
  createLead,
  transitionLead,
  logEngagement,
  linkOpportunity,
  serializeLead,
  type LeadStatus,
  type LeadWithRelations,
} from "../lead-service";

const USER_ID = "user-1";

function makeDb() {
  return {
    lead: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn(),
    },
    leadEvent: { create: vi.fn() },
    contact: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    school: { findUnique: vi.fn() },
    district: { findUnique: vi.fn() },
    userProfile: { findUnique: vi.fn() },
    opportunity: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    activity: {
      create: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
}
type MockDb = ReturnType<typeof makeDb>;
const asDb = (db: MockDb) => db as unknown as DbClient;

function baseLead(status: LeadStatus, overrides: Record<string, unknown> = {}) {
  return {
    id: "lead-1",
    contactId: 11,
    schoolNcessch: null,
    leaid: "0612480",
    status,
    score: 100,
    leadType: "mql",
    sequence: null,
    marketingOwner: null,
    assignedBdrId: USER_ID,
    unqualifiedReason: null,
    opportunityId: null,
    meetingAt: null,
    assignedAt: new Date("2026-06-01T10:00:00Z"),
    acceptedAt: null,
    createdAt: new Date("2026-06-01T10:00:00Z"),
    updatedAt: new Date("2026-06-01T10:00:00Z"),
    district: { leaid: "0612480", name: "East Side Union HSD" },
    ...overrides,
  };
}

async function expectServiceError(promise: Promise<unknown>, status: number) {
  try {
    await promise;
    expect.fail(`expected ServiceError(${status})`);
  } catch (e) {
    if (!isServiceError(e)) throw e;
    expect(e.status).toBe(status);
  }
}

describe("pickMostRecentContact", () => {
  it("prefers lastEnrichedAt over createdAt, then highest id", () => {
    const a = { id: 1, createdAt: new Date("2026-01-01"), lastEnrichedAt: new Date("2026-05-01") };
    const b = { id: 2, createdAt: new Date("2026-04-01"), lastEnrichedAt: null };
    const c = { id: 3, createdAt: new Date("2026-04-01"), lastEnrichedAt: null };
    expect(pickMostRecentContact([a, b, c])?.id).toBe(1);
    expect(pickMostRecentContact([b, c])?.id).toBe(3); // tie → highest id
    expect(pickMostRecentContact([])).toBeNull();
  });
});

describe("transitionLead — transition table", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    db.lead.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...baseLead("new"),
      ...args.data,
    }));
    db.lead.findUniqueOrThrow.mockResolvedValue(baseLead("new"));
    db.activity.count.mockResolvedValue(0);
    db.opportunity.create.mockResolvedValue({ id: "opp-new" });
  });

  for (const from of LEAD_STATUSES) {
    for (const to of LEAD_STATUSES) {
      if (from === to) continue;
      const legal = LEAD_TRANSITIONS[from].includes(to);
      it(`${from} -> ${to} is ${legal ? "legal" : "rejected with 422"}`, async () => {
        db.lead.findUnique.mockResolvedValue(
          baseLead(from, { opportunityId: from === "meeting_scheduled" ? "opp-1" : null }),
        );
        const promise = transitionLead(
          "lead-1",
          { status: to, reason: to === "unqualified" ? "No Response" : undefined },
          USER_ID,
          asDb(db),
        );
        if (legal) {
          await expect(promise).resolves.toBeTruthy();
        } else {
          await expectServiceError(promise, 422);
        }
      });
    }
  }

  it("same-status transition is an idempotent no-op (no event)", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("working"));
    db.lead.findUniqueOrThrow.mockResolvedValue(baseLead("working"));
    await transitionLead("lead-1", { status: "working" }, USER_ID, asDb(db));
    expect(db.lead.update).not.toHaveBeenCalled();
    expect(db.leadEvent.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown status with 400", async () => {
    await expectServiceError(
      transitionLead("lead-1", { status: "bogus" }, USER_ID, asDb(db)),
      400,
    );
  });

  it("404s when the lead does not exist", async () => {
    db.lead.findUnique.mockResolvedValue(null);
    await expectServiceError(
      transitionLead("ghost", { status: "working" }, USER_ID, asDb(db)),
      404,
    );
  });
});

describe("transitionLead — side effects", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    db.lead.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...baseLead("new"),
      ...args.data,
    }));
    db.activity.count.mockResolvedValue(0);
  });

  it("accept (new -> working) sets accepted_at and writes an 'accepted' event", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("new"));
    await transitionLead("lead-1", { status: "working" }, USER_ID, asDb(db));

    const updateData = db.lead.update.mock.calls[0][0].data;
    expect(updateData.status).toBe("working");
    expect(updateData.acceptedAt).toBeInstanceOf(Date);
    expect(db.leadEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "accepted", actorId: USER_ID }),
      }),
    );
  });

  it("meeting_scheduled creates a native Stage 0 opp and stores its id", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("working"));
    db.opportunity.create.mockImplementation(async (args: { data: { id: string } }) => args.data);

    await transitionLead("lead-1", { status: "meeting_scheduled" }, USER_ID, asDb(db));

    const oppData = db.opportunity.create.mock.calls[0][0].data;
    expect(oppData.stage).toBe(LEAD_OPP_STAGE_MEETING_BOOKED);
    expect(oppData.stage).toBe("0 - Meeting Booked");
    expect(oppData.districtLeaId).toBe("0612480");
    expect(oppData.leadSource).toBe(LEAD_CREATED_OPP_SOURCE);
    expect(oppData.id).toMatch(/^[0-9a-f-]{36}$/); // app-generated uuid
    expect(db.lead.update.mock.calls[0][0].data.opportunityId).toBe(oppData.id);

    const kinds = db.leadEvent.create.mock.calls.map((c) => c[0].data.kind);
    expect(kinds).toEqual(["restaged", "opp_created"]);
  });

  it("meeting_scheduled stores meetingAt when provided", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("working"));
    db.opportunity.create.mockResolvedValue({ id: "opp-new" });

    await transitionLead(
      "lead-1",
      { status: "meeting_scheduled", meetingAt: "2026-06-15T14:00:00Z" },
      USER_ID,
      asDb(db),
    );

    const updateData = db.lead.update.mock.calls[0][0].data;
    expect(updateData.meetingAt).toBeInstanceOf(Date);
    expect((updateData.meetingAt as Date).toISOString()).toBe("2026-06-15T14:00:00.000Z");
  });

  it("meeting_scheduled without meetingAt leaves the field untouched", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("working"));
    db.opportunity.create.mockResolvedValue({ id: "opp-new" });

    await transitionLead("lead-1", { status: "meeting_scheduled" }, USER_ID, asDb(db));
    expect(db.lead.update.mock.calls[0][0].data).not.toHaveProperty("meetingAt");
  });

  it("rejects a garbage meetingAt with 400", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("working"));
    await expectServiceError(
      transitionLead(
        "lead-1",
        { status: "meeting_scheduled", meetingAt: "not-a-date" },
        USER_ID,
        asDb(db),
      ),
      400,
    );
  });

  it("leaving meeting_scheduled keeps the meetingAt timestamp (history)", async () => {
    db.lead.findUnique.mockResolvedValue(
      baseLead("meeting_scheduled", {
        opportunityId: "opp-1",
        meetingAt: new Date("2026-06-15T14:00:00Z"),
      }),
    );
    await transitionLead("lead-1", { status: "working" }, USER_ID, asDb(db));
    // No clearing write — the column simply isn't part of the update.
    expect(db.lead.update.mock.calls[0][0].data).not.toHaveProperty("meetingAt");
  });

  it("meeting_scheduled does NOT create a second opp when one is already linked", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("working", { opportunityId: "opp-1" }));
    await transitionLead("lead-1", { status: "meeting_scheduled" }, USER_ID, asDb(db));
    expect(db.opportunity.create).not.toHaveBeenCalled();
  });

  it("sales_qualified advances the opp to Stage 1 Discovery — never won", async () => {
    db.lead.findUnique.mockResolvedValue(
      baseLead("meeting_scheduled", { opportunityId: "opp-1" }),
    );
    await transitionLead("lead-1", { status: "sales_qualified" }, USER_ID, asDb(db));

    expect(db.opportunity.update).toHaveBeenCalledWith({
      where: { id: "opp-1" },
      data: { stage: LEAD_OPP_STAGE_DISCOVERY },
    });
    expect(db.opportunity.update.mock.calls[0][0].data.stage).toBe("1 - Discovery");
    expect(db.opportunity.update.mock.calls[0][0].data.stage).not.toContain("Closed");

    const advanced = db.leadEvent.create.mock.calls.find(
      (c) => c[0].data.kind === "opp_advanced",
    );
    expect(advanced?.[0].data.payload.message).toBe(OPP_ADVANCED_MESSAGE);
    expect(advanced?.[0].data.payload.message).toBe(
      "Opportunity advanced to Stage 1 · Discovery",
    );
  });

  it("disqualify requires a reason", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("working"));
    await expectServiceError(
      transitionLead("lead-1", { status: "unqualified" }, USER_ID, asDb(db)),
      400,
    );
    await expectServiceError(
      transitionLead("lead-1", { status: "unqualified", reason: "   " }, USER_ID, asDb(db)),
      400,
    );
  });

  it("disqualify stores the reason and a preserved-activity-count note, and never touches engagement", async () => {
    db.lead.findUnique.mockResolvedValue(baseLead("working"));
    db.activity.count.mockResolvedValue(7);

    await transitionLead(
      "lead-1",
      { status: "unqualified", reason: "No Response" },
      USER_ID,
      asDb(db),
    );

    expect(db.lead.update.mock.calls[0][0].data.unqualifiedReason).toBe("No Response");
    const event = db.leadEvent.create.mock.calls[0][0].data;
    expect(event.kind).toBe("disqualified");
    expect(event.payload.preservedActivityCount).toBe(7);
    expect(event.payload.message).toBe("7 activities preserved on contact + district");

    // The invariant: no engagement data deleted or modified by any transition.
    expect(db.activity.delete).not.toHaveBeenCalled();
    expect(db.activity.deleteMany).not.toHaveBeenCalled();
    expect(db.activity.update).not.toHaveBeenCalled();
    expect(db.activity.updateMany).not.toHaveBeenCalled();
  });
});

describe("createLead", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    db.userProfile.findUnique.mockResolvedValue({ id: USER_ID });
    db.district.findUnique.mockResolvedValue({ leaid: "0612480" });
    db.lead.findFirst.mockResolvedValue(null);
    db.lead.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...baseLead("new"),
      ...args.data,
      id: "lead-new",
    }));
  });

  it("creates a new contact (with school + district links) when none matches", async () => {
    db.school.findUnique.mockResolvedValue({ ncessch: "061248006448", leaid: "0612480" });
    db.contact.findMany.mockResolvedValue([]);
    db.contact.create.mockResolvedValue({ id: 42 });

    await createLead(
      {
        schoolNcessch: "061248006448",
        contactName: "Renee Alvarado",
        contactTitle: "Principal",
        email: "ralvarado@esuhsd.org",
        phone: "(408) 555-0155",
        leadType: "conference",
      },
      USER_ID,
      asDb(db),
    );

    expect(db.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaid: "0612480", // resolved from the school's NCES id
          name: "Renee Alvarado",
          schoolNcessch: "061248006448",
        }),
      }),
    );
    const leadData = db.lead.create.mock.calls[0][0].data;
    expect(leadData.contactId).toBe(42);
    expect(leadData.assignedBdrId).toBe(USER_ID); // defaults to current user
    expect(db.leadEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ leadId: "lead-new", kind: "created" }),
      }),
    );
  });

  it("reuses the most recent existing contact matched by email", async () => {
    db.contact.findMany.mockResolvedValue([
      { id: 1, createdAt: new Date("2025-01-01"), lastEnrichedAt: null, schoolNcessch: null },
      { id: 2, createdAt: new Date("2026-01-01"), lastEnrichedAt: null, schoolNcessch: null },
    ]);

    await createLead(
      { leaid: "0612480", email: "ralvarado@esuhsd.org", contactName: "Renee" },
      USER_ID,
      asDb(db),
    );

    expect(db.contact.create).not.toHaveBeenCalled();
    expect(db.lead.create.mock.calls[0][0].data.contactId).toBe(2);
  });

  it("409s when the contact already has an active lead", async () => {
    db.contact.findMany.mockResolvedValue([
      { id: 5, createdAt: new Date(), lastEnrichedAt: null, schoolNcessch: null },
    ]);
    db.lead.findFirst.mockResolvedValue({ id: "existing-lead" });

    await expectServiceError(
      createLead({ leaid: "0612480", email: "x@y.org", contactName: "X" }, USER_ID, asDb(db)),
      409,
    );
  });

  it("400s on unknown district / unknown school / missing contact name", async () => {
    db.district.findUnique.mockResolvedValue(null);
    await expectServiceError(
      createLead({ leaid: "9999999", contactName: "X" }, USER_ID, asDb(db)),
      400,
    );

    db.district.findUnique.mockResolvedValue({ leaid: "0612480" });
    db.school.findUnique.mockResolvedValue(null);
    await expectServiceError(
      createLead({ schoolNcessch: "000000000000", contactName: "X" }, USER_ID, asDb(db)),
      400,
    );

    db.contact.findMany.mockResolvedValue([]);
    await expectServiceError(
      createLead({ leaid: "0612480", email: "new@x.org" }, USER_ID, asDb(db)),
      400,
    );
  });
});

describe("logEngagement", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    db.lead.findUnique.mockResolvedValue(baseLead("working", { schoolNcessch: "061248006448" }));
    db.lead.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...baseLead("working"),
      ...args.data,
    }));
    db.lead.findUniqueOrThrow.mockResolvedValue(baseLead("working"));
    db.activity.create.mockResolvedValue({ id: "act-1" });
    db.opportunity.create.mockResolvedValue({ id: "opp-new" });
  });

  it("creates a real activity with contact + district + school junctions", async () => {
    await logEngagement(
      "lead-1",
      { type: "cold_call", title: "Connected — intro call", points: 0 },
      USER_ID,
      asDb(db),
    );

    const data = db.activity.create.mock.calls[0][0].data;
    expect(data.contacts).toEqual({ create: [{ contactId: 11 }] });
    expect(data.districts).toEqual({ create: [{ districtLeaid: "0612480" }] });
    expect(data.schools).toEqual({ create: [{ ncessch: "061248006448" }] });
    expect(data.status).toBe("completed");
    expect(data.createdByUserId).toBe(USER_ID);
    // points = 0 → no score write
    expect(db.lead.update).not.toHaveBeenCalled();
  });

  it("increments the lead score by the given points", async () => {
    await logEngagement(
      "lead-1",
      { type: "email", title: "Replied to outreach", points: 25 },
      USER_ID,
      asDb(db),
    );
    expect(db.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { score: { increment: 25 } } }),
    );
    // …and records what THIS activity carried for the timeline readout.
    expect(db.activity.create.mock.calls[0][0].data.metadata).toEqual({
      leadPoints: 25,
    });
  });

  it("persists outcome fields structurally and omits metadata at 0 points", async () => {
    await logEngagement(
      "lead-1",
      {
        type: "cold_call",
        title: "Connected",
        points: 0,
        rating: 4,
        outcomeType: "positive_progress",
      },
      USER_ID,
      asDb(db),
    );
    const data = db.activity.create.mock.calls[0][0].data;
    expect(data.rating).toBe(4);
    expect(data.outcomeType).toBe("positive_progress");
    expect(data.metadata).toBeUndefined();
  });

  it("applies an optional resulting status transition in the same flow", async () => {
    await logEngagement(
      "lead-1",
      {
        type: "discovery_call",
        title: "Booked discovery call",
        points: 10,
        resultingStatus: "meeting_scheduled",
      },
      USER_ID,
      asDb(db),
    );
    // transition fired: Stage 0 opp created + restaged/opp_created events
    expect(db.opportunity.create).toHaveBeenCalled();
    const kinds = db.leadEvent.create.mock.calls.map((c) => c[0].data.kind);
    expect(kinds).toContain("restaged");
    expect(kinds).toContain("opp_created");
  });

  it("rejects invalid activity types and non-integer points", async () => {
    await expectServiceError(
      logEngagement("lead-1", { type: "carrier_pigeon", title: "x" }, USER_ID, asDb(db)),
      400,
    );
    await expectServiceError(
      logEngagement("lead-1", { type: "email", title: "x", points: 1.5 }, USER_ID, asDb(db)),
      400,
    );
  });
});

describe("linkOpportunity", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    db.lead.findUnique.mockResolvedValue(baseLead("working"));
    db.lead.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...baseLead("working"),
      ...args.data,
    }));
  });

  it("links an existing open opportunity", async () => {
    db.opportunity.findUnique.mockResolvedValue({ id: "opp-9", stage: "1 - Discovery" });
    await linkOpportunity("lead-1", { opportunityId: "opp-9" }, USER_ID, asDb(db));
    expect(db.lead.update.mock.calls[0][0].data.opportunityId).toBe("opp-9");
    expect(db.leadEvent.create.mock.calls[0][0].data.payload.mode).toBe("linked");
  });

  it("rejects closed opportunities", async () => {
    db.opportunity.findUnique.mockResolvedValue({ id: "opp-9", stage: "Closed Won" });
    await expectServiceError(
      linkOpportunity("lead-1", { opportunityId: "opp-9" }, USER_ID, asDb(db)),
      400,
    );
  });

  it("creates a Stage 0 opp when no id is given", async () => {
    db.opportunity.create.mockImplementation(async (args: { data: { id: string } }) => args.data);
    await linkOpportunity("lead-1", { name: "ESUHSD — Virtual Instruction" }, USER_ID, asDb(db));
    expect(db.opportunity.create.mock.calls[0][0].data.stage).toBe(
      LEAD_OPP_STAGE_MEETING_BOOKED,
    );
    expect(db.leadEvent.create.mock.calls[0][0].data.payload.mode).toBe("created");
  });
});

describe("serializeLead", () => {
  function fullLead(overrides: Record<string, unknown> = {}) {
    return {
      ...baseLead("meeting_scheduled"),
      contact: { id: 11, name: "Renee Alvarado", title: null, email: null, phone: null },
      school: null,
      district: {
        leaid: "0612480",
        name: "East Side Union HSD",
        cityLocation: "San Jose",
        stateAbbrev: "CA",
      },
      assignedBdr: null,
      opportunity: null,
      ...overrides,
    } as unknown as LeadWithRelations;
  }

  it("includes meetingAt as an ISO string", () => {
    const json = serializeLead(fullLead({ meetingAt: new Date("2026-06-15T14:00:00Z") }));
    expect(json.meetingAt).toBe("2026-06-15T14:00:00.000Z");
  });

  it("serializes meetingAt as null when unset", () => {
    expect(serializeLead(fullLead()).meetingAt).toBeNull();
  });
});
