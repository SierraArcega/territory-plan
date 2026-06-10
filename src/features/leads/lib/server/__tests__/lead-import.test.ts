import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import type { DbClient } from "@/features/shared/lib/service-error";
import {
  normalizeLeaid,
  normalizeNcessch,
  nameFromEmail,
  activityTypeForRow,
  resolveActivityRows,
  summarizeActivityResolutions,
  applyActivityImport,
  resolveLeadRows,
  summarizeLeadResolutions,
  applyLeadImport,
} from "../lead-import";

const USER_ID = "user-1";

const DISTRICT = { leaid: "0612480", name: "East Side Union HSD" };
const SCHOOL = {
  ncessch: "061248006448",
  schoolName: "Independence High School",
  leaid: "0612480",
};
const EXISTING_CONTACT = {
  id: 5,
  name: "Renee Alvarado",
  email: "renee@esuhsd.org",
  leaid: "0612480",
  schoolNcessch: null,
  createdAt: new Date("2026-01-01"),
  lastEnrichedAt: null,
};
const DUPE_OLD = {
  id: 1,
  name: "Old Dupe",
  email: "dupe@esuhsd.org",
  leaid: "0612480",
  schoolNcessch: null,
  createdAt: new Date("2025-01-01"),
  lastEnrichedAt: null,
};
const DUPE_NEW = {
  id: 2,
  name: "New Dupe",
  email: "dupe@esuhsd.org",
  leaid: "0612480",
  schoolNcessch: null,
  createdAt: new Date("2025-02-01"),
  lastEnrichedAt: new Date("2026-05-01"),
};

function makeDb() {
  return {
    contact: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    school: { findMany: vi.fn().mockResolvedValue([]) },
    district: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    lead: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "lead-new" }),
    },
    leadEvent: { create: vi.fn() },
    activity: { create: vi.fn() },
    userProfile: { findMany: vi.fn().mockResolvedValue([]) },
  };
}
type MockDb = ReturnType<typeof makeDb>;
const asDb = (db: MockDb) => db as unknown as DbClient;

function seedWorld(db: MockDb) {
  db.contact.findMany.mockResolvedValue([EXISTING_CONTACT, DUPE_OLD, DUPE_NEW]);
  db.school.findMany.mockResolvedValue([SCHOOL]);
  db.district.findMany.mockResolvedValue([DISTRICT]);
  db.lead.findMany.mockResolvedValue([{ id: "lead-5", contactId: 5 }]);
}

describe("normalizers", () => {
  it("zero-fills leaid to 7 and ncessch to 12 digits (ETL semantics)", () => {
    expect(normalizeLeaid("612480")).toBe("0612480");
    expect(normalizeLeaid("0612480")).toBe("0612480");
    expect(normalizeLeaid("")).toBeNull();
    expect(normalizeNcessch("61248006448")).toBe("061248006448");
  });

  it("derives a fallback contact name from the email", () => {
    expect(nameFromEmail("karen.whitfield@mvusd51.org")).toBe("Karen Whitfield");
    expect(nameFromEmail("tbecker@beaverton.k12.or.us")).toBe("Tbecker");
  });

  it("maps prototype kinds to existing activity types, never minting new ones", () => {
    expect(activityTypeForRow({ kind: "call" })).toBe("cold_call");
    expect(activityTypeForRow({ kind: "meeting" })).toBe("discovery_call");
    expect(activityTypeForRow({ kind: "webform" })).toBe("email"); // fallback
    expect(activityTypeForRow({ type: "webinar" })).toBe("webinar"); // explicit wins
  });
});

describe("resolveActivityRows", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    seedWorld(db);
  });

  it("matches the contact by email; duplicates pick the most recent with a warning", async () => {
    const [r] = await resolveActivityRows([{ email: "DUPE@esuhsd.org", kind: "email" }], asDb(db));
    expect(r.ok).toBe(true);
    expect(r.contact).toMatchObject({ id: 2, willCreate: false }); // most recently enriched
    expect(r.warnings).toContain("duplicate_email");
    expect(r.district).toMatchObject({ leaid: "0612480", willCreate: false });
  });

  it("resolves the district FROM the school's NCES id for new contacts (viaNces)", async () => {
    const [r] = await resolveActivityRows(
      [{ email: "new@esuhsd.org", schoolNcessch: "61248006448", kind: "call" }],
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.school).toEqual({ ncessch: "061248006448", name: "Independence High School" });
    expect(r.district).toMatchObject({ leaid: "0612480", name: DISTRICT.name, willCreate: false });
    expect(r.contact).toMatchObject({ id: null, willCreate: true });
  });

  it("degrades gracefully when the school NCES does not resolve", async () => {
    const [r] = await resolveActivityRows(
      [{ email: "new@x.org", schoolNcessch: "999999999999", leaid: "0612480" }],
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.school).toBeNull();
    expect(r.warnings).toContain("school_not_found");
    expect(r.district).toMatchObject({ leaid: "0612480", willCreate: false });
    expect(r.viaNces).toBe(false);
  });

  it("plans a district stub when the row's leaid is unknown", async () => {
    const [r] = await resolveActivityRows(
      [{ email: "new@y.org", leaid: "9912345", districtName: "Frontier SD" }],
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.district).toEqual({ leaid: "9912345", name: "Frontier SD", willCreate: true });
  });

  it("fails rows with no resolvable district and rows without an email", async () => {
    const rows = await resolveActivityRows(
      [{ email: "new@z.org" }, { kind: "email" }],
      asDb(db),
    );
    expect(rows[0]).toMatchObject({ ok: false, error: "unresolved_district" });
    expect(rows[1]).toMatchObject({ ok: false, error: "invalid_email" });
  });

  it("attaches points to the contact's active lead; others are retained", async () => {
    const rows = await resolveActivityRows(
      [
        { email: "renee@esuhsd.org", kind: "email", points: 12 },
        { email: "new@esuhsd.org", leaid: "0612480", kind: "email", points: 40 },
      ],
      asDb(db),
    );
    expect(rows[0]).toMatchObject({ leadId: "lead-5", points: 12 });
    expect(rows[1]).toMatchObject({ leadId: null, points: 40 });
    expect(summarizeActivityResolutions(rows)).toEqual({
      total: 2,
      toActiveLeads: 1,
      retained: 1,
      failed: 0,
    });
  });
});

describe("applyActivityImport — dry/wet parity on the same fixture", () => {
  let db: MockDb;
  const rows = [
    { email: "renee@esuhsd.org", kind: "call", title: "Connected", points: 12 },
    { email: "paula@esuhsd.org", schoolNcessch: "061248006448", kind: "webinar", points: 40 },
    { email: "frontier@new.org", leaid: "9912345", districtName: "Frontier SD", kind: "email" },
    { kind: "email" }, // invalid: no email
  ];

  beforeEach(() => {
    db = makeDb();
    seedWorld(db);
    db.contact.create.mockResolvedValueOnce({ id: 101 }).mockResolvedValueOnce({ id: 102 });
    db.activity.create.mockResolvedValue({ id: "act-x" });
  });

  it("writes exactly what the dry-run plan promised", async () => {
    const resolutions = await resolveActivityRows(rows, asDb(db));
    const drySummary = summarizeActivityResolutions(resolutions);

    const result = await applyActivityImport(rows, resolutions, USER_ID, asDb(db));

    // Counts: wet result matches the dry-run summary
    expect(result.summary.toActiveLeads).toBe(drySummary.toActiveLeads);
    expect(result.summary.retained).toBe(drySummary.retained);
    expect(result.summary.imported).toBe(drySummary.total - drySummary.failed);
    expect(result.failed).toEqual([{ index: 3, reason: "invalid_email" }]);

    // District stub created exactly for the one willCreate district, ETL-style
    expect(db.district.create).toHaveBeenCalledTimes(1);
    expect(db.district.create).toHaveBeenCalledWith({
      data: { leaid: "9912345", name: "Frontier SD", stateFips: "99" },
    });

    // New contacts created with school + district links
    const contactCreates = db.contact.create.mock.calls.map((c) => c[0].data);
    expect(contactCreates).toHaveLength(2);
    expect(contactCreates[0]).toMatchObject({
      leaid: "0612480",
      email: "paula@esuhsd.org",
      schoolNcessch: "061248006448",
    });

    // Activities carry contact/district junctions (+ school when resolved)
    const activityCreates = db.activity.create.mock.calls.map((c) => c[0].data);
    expect(activityCreates).toHaveLength(3);
    expect(activityCreates[0].type).toBe("cold_call");
    expect(activityCreates[0].contacts).toEqual({ create: [{ contactId: 5 }] });
    expect(activityCreates[1].schools).toEqual({
      create: [{ ncessch: "061248006448" }],
    });

    // Score increment lands on the active lead only
    expect(db.lead.update).toHaveBeenCalledTimes(1);
    expect(db.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-5" },
      data: { score: { increment: 12 } },
    });
  });

  it("creates a shared new contact only once across rows with the same email", async () => {
    const dupRows = [
      { email: "paula@esuhsd.org", leaid: "0612480", kind: "email" },
      { email: "paula@esuhsd.org", leaid: "0612480", kind: "call" },
    ];
    const resolutions = await resolveActivityRows(dupRows, asDb(db));
    await applyActivityImport(dupRows, resolutions, USER_ID, asDb(db));
    expect(db.contact.create).toHaveBeenCalledTimes(1);
    expect(db.activity.create).toHaveBeenCalledTimes(2);
  });
});

describe("resolveLeadRows / applyLeadImport", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    seedWorld(db);
    db.userProfile.findMany.mockResolvedValue([{ id: "bdr-2" }]);
    db.contact.create.mockResolvedValue({ id: 201 });
  });

  it("rejects contacts that already hold an active lead, and in-batch duplicates", async () => {
    const rows = await resolveLeadRows(
      [
        { email: "renee@esuhsd.org", leaid: "0612480" },
        { email: "new@esuhsd.org", leaid: "0612480", name: "New Person" },
        { email: "new@esuhsd.org", leaid: "0612480", name: "New Person Again" },
      ],
      USER_ID,
      asDb(db),
    );
    expect(rows[0]).toMatchObject({ ok: false, error: "contact_has_active_lead" });
    expect(rows[1].ok).toBe(true);
    expect(rows[2]).toMatchObject({ ok: false, error: "duplicate_in_batch" });
    expect(summarizeLeadResolutions(rows)).toMatchObject({ total: 3, toCreate: 1, failed: 2 });
  });

  it("validates leadType and assigned BDR leniently (warning + fallback)", async () => {
    const rows = await resolveLeadRows(
      [
        { email: "a@x.org", leaid: "0612480", leadType: "smoke_signal", assignedBdrId: "ghost" },
        { email: "b@x.org", leaid: "0612480", leadType: "mql", assignedBdrId: "bdr-2" },
      ],
      USER_ID,
      asDb(db),
    );
    expect(rows[0].warnings).toEqual(expect.arrayContaining(["invalid_lead_type", "invalid_bdr"]));
    expect(rows[0]).toMatchObject({ leadType: null, assignedBdrId: USER_ID });
    expect(rows[1]).toMatchObject({ leadType: "mql", assignedBdrId: "bdr-2" });
  });

  it("wet run creates contact, lead, and 'created' event per the plan", async () => {
    const importRows = [
      {
        email: "karen@frontier.org",
        first: "Karen",
        last: "Whitfield",
        title: "Director of Special Education",
        leaid: "9912345",
        districtName: "Frontier SD",
        leadType: "mql",
        score: 138,
      },
    ];
    const resolutions = await resolveLeadRows(importRows, USER_ID, asDb(db));
    const result = await applyLeadImport(importRows, resolutions, USER_ID, asDb(db));

    expect(result.succeeded).toEqual([0]);
    expect(db.district.create).toHaveBeenCalledWith({
      data: { leaid: "9912345", name: "Frontier SD", stateFips: "99" },
    });
    expect(db.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leaid: "9912345",
          name: "Karen Whitfield",
          title: "Director of Special Education",
        }),
      }),
    );
    expect(db.lead.create.mock.calls[0][0].data).toMatchObject({
      contactId: 201,
      leaid: "9912345",
      leadType: "mql",
      score: 138,
      assignedBdrId: USER_ID,
    });
    expect(db.leadEvent.create.mock.calls[0][0].data).toMatchObject({
      leadId: "lead-new",
      kind: "created",
    });
  });
});
