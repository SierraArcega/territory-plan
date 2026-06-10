import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ default: {} }));

import type { DbClient } from "@/features/shared/lib/service-error";
import { parseCsv } from "@/features/shared/lib/csv";
import {
  LEAD_FIELD_DEFS,
  buildHeaderMapping,
  toLeadImportRows,
} from "../../import";
import { orgNameSimilarity } from "@/features/shared/lib/district-name-match";
import {
  GENERIC_ROW_FAILURE,
  NCES_NAME_AGREE_THRESHOLD,
  classifyNcesId,
  emailDomain,
  looksLikeSchoolName,
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

  it("classifies the mixed NCES ID column by digit count", () => {
    expect(classifyNcesId("4807590")).toEqual({ kind: "leaid", value: "4807590" });
    expect(classifyNcesId("612480")).toEqual({ kind: "leaid", value: "0612480" });
    expect(classifyNcesId("481431000921")).toEqual({ kind: "ncessch", value: "481431000921" });
    expect(classifyNcesId("48143100092")).toEqual({ kind: "ncessch", value: "048143100092" });
    expect(classifyNcesId("N/A")).toEqual({ kind: "invalid" });
    expect(classifyNcesId("4814310009211")).toEqual({ kind: "invalid" }); // 13 digits
    expect(classifyNcesId(" ")).toBeNull();
    expect(classifyNcesId(undefined)).toBeNull();
  });

  it("flags school-looking names but not district-looking ones", () => {
    expect(looksLikeSchoolName("A P Solis Middle School")).toBe(true);
    expect(looksLikeSchoolName("Alternative Learning Center")).toBe(true);
    expect(looksLikeSchoolName("Alamo Heights Independent School District")).toBe(false);
    expect(looksLikeSchoolName("Donna ISD")).toBe(false);
    expect(looksLikeSchoolName("Alpha Public Schools")).toBe(false);
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

    // Points the row carried land in metadata for the timeline's "+N pts";
    // 0-point rows write no metadata.
    expect(activityCreates[0].metadata).toEqual({ leadPoints: 12 });
    expect(activityCreates[1].metadata).toEqual({ leadPoints: 40 });
    expect(activityCreates[2].metadata).toBeUndefined();

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

  it("refuses to write a district stub for a non-7-digit leaid (hard guard)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const importRows = [{ email: "x@frontier.org", leaid: "9912345" }];
    const resolutions = await resolveLeadRows(importRows, USER_ID, asDb(db));
    // Simulate a corrupted plan that slipped a school-shaped id into a stub.
    resolutions[0].district = { leaid: "481431000921", name: "Junk", willCreate: true };
    const result = await applyLeadImport(importRows, resolutions, USER_ID, asDb(db));
    expect(db.district.create).not.toHaveBeenCalled();
    expect(db.lead.create).not.toHaveBeenCalled();
    expect(result.failed).toEqual([{ index: 0, reason: GENERIC_ROW_FAILURE }]);
    consoleError.mockRestore();
  });

  it("maps unexpected per-row write errors to the generic reason and logs the real one", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const prismaError = new Error(
      "Invalid `prisma.lead.create()` invocation: Foreign key constraint failed",
    );
    db.lead.create.mockRejectedValue(prismaError);

    const importRows = [{ email: "karen@frontier.org", leaid: "9912345" }];
    const resolutions = await resolveLeadRows(importRows, USER_ID, asDb(db));
    const result = await applyLeadImport(importRows, resolutions, USER_ID, asDb(db));

    // The raw Prisma message never reaches failed[].reason…
    expect(result.failed).toEqual([{ index: 0, reason: GENERIC_ROW_FAILURE }]);
    // …but it is logged server-side.
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), prismaError);
    consoleError.mockRestore();
  });
});

// ---- Mixed NCES ID disambiguation + name fallback ---------------------------------
//
// Synthetic world mirroring the real MQL export quirks: one "NCES ID" column
// holding 12-digit school ids AND 7-digit district leaids AND blanks/junk,
// full state names, and company-name cells that are really school names.
// (All names/emails synthetic — no real-export rows.)

const TX_DISTRICTS = [
  { leaid: "4807590", name: "Alamo Heights Independent School District", stateFips: "48" },
  { leaid: "4814310", name: "Donna ISD", stateFips: "48" },
  { leaid: "4839990", name: "Springfield ISD", stateFips: "48" },
  { leaid: "4839991", name: "Springfield Public Schools", stateFips: "48" },
];
const TX_SCHOOLS = [
  {
    ncessch: "481431000921",
    schoolName: "A P Solis Middle School",
    leaid: "4814310",
    stateFips: "48",
  },
];

type DistrictWhere = { leaid?: { in: string[] }; stateFips?: { in: string[] } };
type SchoolWhere = {
  ncessch?: { in: string[] };
  stateFips?: { in: string[] };
  leaid?: { in: string[] };
};
type ContactWhere = {
  email?: { in: string[] };
  OR?: Array<{ email: { endsWith: string } }>;
};

function seedTexasWorld(db: MockDb) {
  db.district.findMany.mockImplementation(async (args: { where: DistrictWhere }) => {
    if (args.where.leaid) {
      return TX_DISTRICTS.filter((d) => args.where.leaid!.in.includes(d.leaid)).map(
        ({ leaid, name }) => ({ leaid, name }),
      );
    }
    if (args.where.stateFips) {
      return TX_DISTRICTS.filter((d) => args.where.stateFips!.in.includes(d.stateFips));
    }
    return [];
  });
  db.school.findMany.mockImplementation(async (args: { where: SchoolWhere }) => {
    if (args.where.ncessch) {
      return TX_SCHOOLS.filter((s) => args.where.ncessch!.in.includes(s.ncessch)).map(
        ({ ncessch, schoolName, leaid }) => ({ ncessch, schoolName, leaid }),
      );
    }
    if (args.where.stateFips) {
      return TX_SCHOOLS.filter((s) => args.where.stateFips!.in.includes(s.stateFips));
    }
    return [];
  });
}

describe("mixed NCES ID disambiguation", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    seedTexasWorld(db);
  });

  it("treats an 8–12 digit value in the leaid column as a school id (viaNces)", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "p@donna.example.org", leaid: "481431000921" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.viaName).toBe(false);
    expect(r.school).toEqual({ ncessch: "481431000921", name: "A P Solis Middle School" });
    expect(r.district).toMatchObject({ leaid: "4814310", name: "Donna ISD", willCreate: false });
  });

  it("same disambiguation applies to activity rows", async () => {
    const [r] = await resolveActivityRows(
      [{ email: "p@donna.example.org", leaid: "481431000921", kind: "email" }],
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.district).toMatchObject({ leaid: "4814310" });
  });

  it("an explicit schoolNcessch wins over a school-shaped leaid-column value", async () => {
    db.school.findMany.mockResolvedValue([
      { ncessch: "061248006448", schoolName: "Independence High School", leaid: "0612480" },
    ]);
    db.district.findMany.mockResolvedValue([{ leaid: "0612480", name: "East Side Union HSD" }]);
    const [r] = await resolveLeadRows(
      [
        {
          email: "p@esuhsd.example.org",
          leaid: "481431000921",
          schoolNcessch: "061248006448",
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.district).toMatchObject({ leaid: "0612480" });
    expect(r.school).toMatchObject({ ncessch: "061248006448" });
  });

  it("a ≤7-digit value stays a district leaid (zfill 7)", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "f@alamo.example.org", leaid: "4807590" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(false);
    expect(r.district).toMatchObject({ leaid: "4807590", willCreate: false });
  });

  it("a school-shaped id that misses the schools table never plans a stub", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "x@nowhere.example.org", leaid: "99999999" }], // 8 digits, unknown
      USER_ID,
      asDb(db),
    );
    expect(r).toMatchObject({ ok: false, error: "unresolved_district", district: null });
    expect(r.warnings).toContain("school_not_found");
  });

  it("junk in the NCES column warns and fails the row instead of stubbing", async () => {
    const rows = await resolveLeadRows(
      [
        { email: "a@junk.example.org", leaid: "N/A" },
        { email: "b@junk.example.org", leaid: "4814310009211" }, // 13 digits
      ],
      USER_ID,
      asDb(db),
    );
    for (const r of rows) {
      expect(r).toMatchObject({ ok: false, error: "unresolved_district", district: null });
      expect(r.warnings).toContain("invalid_nces_id");
    }
  });

  it("a non-12-digit explicit school id warns and is ignored", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "c@alamo.example.org", leaid: "4807590", schoolNcessch: "not-a-school" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.warnings).toContain("invalid_school_nces");
    expect(r.school).toBeNull();
    expect(r.district).toMatchObject({ leaid: "4807590" });
  });
});

describe("name + state district fallback", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    seedTexasWorld(db);
  });

  it("resolves an unambiguous district name with a full state name (viaName)", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "d@donna.example.org", districtName: "Donna ISD", state: "Texas" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.viaNces).toBe(false);
    expect(r.district).toEqual({ leaid: "4814310", name: "Donna ISD", willCreate: false });
  });

  it("matches stop-word variants ('Alamo Heights ISD') via the shared matcher", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "f@alamo.example.org", districtName: "Alamo Heights ISD", state: "TX" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.district).toMatchObject({ leaid: "4807590", willCreate: false });
  });

  it("fails ambiguous names with ambiguous_district instead of guessing", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "s@springfield.example.org", districtName: "Springfield", state: "Texas" }],
      USER_ID,
      asDb(db),
    );
    expect(r).toMatchObject({ ok: false, error: "ambiguous_district", district: null });
  });

  it("resolves a school-looking company name through the schools table", async () => {
    const [r] = await resolveLeadRows(
      [
        {
          email: "m@solis.example.org",
          districtName: "A P Solis Middle School",
          state: "Texas",
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.school).toEqual({ ncessch: "481431000921", name: "A P Solis Middle School" });
    expect(r.district).toMatchObject({ leaid: "4814310", willCreate: false });
  });

  it("skips the fallback without a usable state", async () => {
    const rows = await resolveLeadRows(
      [
        { email: "n@donna.example.org", districtName: "Donna ISD" },
        { email: "o@donna.example.org", districtName: "Donna ISD", state: "Atlantis" },
      ],
      USER_ID,
      asDb(db),
    );
    for (const r of rows) {
      expect(r).toMatchObject({ ok: false, error: "unresolved_district" });
    }
  });

  it("applies to activity rows too", async () => {
    const [r] = await resolveActivityRows(
      [{ email: "d@donna.example.org", districtName: "Donna ISD", state: "Texas", kind: "email" }],
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.district).toMatchObject({ leaid: "4814310" });
  });
});

// ---- NCES id ↔ school-name cross-check ---------------------------------------------
//
// Mirrors the verified real-export bug: a Donna ISD row ("A P Solis Middle
// School", Texas) carrying an NCES id that actually belongs to "AD WHEAT
// MIDDLE" in Cleburne ISD. Names are reliable; ids are not.

const XCHECK_DISTRICTS = [
  { leaid: "4810950", name: "Cleburne ISD", stateFips: "48" },
  { leaid: "4814310", name: "Donna ISD", stateFips: "48" },
];
const XCHECK_SCHOOLS = [
  { ncessch: "481095000921", schoolName: "AD WHEAT MIDDLE", leaid: "4810950", stateFips: "48" },
  {
    ncessch: "481431017037",
    schoolName: "A P Solis Middle School",
    leaid: "4814310",
    stateFips: "48",
  },
  // Same normalized name twice → school-by-name is ambiguous.
  { ncessch: "481095000001", schoolName: "Lakeside Elementary", leaid: "4810950", stateFips: "48" },
  { ncessch: "481431000001", schoolName: "Lakeside Elementary", leaid: "4814310", stateFips: "48" },
];

function seedCrossCheckWorld(db: MockDb) {
  db.district.findMany.mockImplementation(async (args: { where: DistrictWhere }) => {
    if (args.where.leaid) {
      return XCHECK_DISTRICTS.filter((d) => args.where.leaid!.in.includes(d.leaid)).map(
        ({ leaid, name }) => ({ leaid, name }),
      );
    }
    if (args.where.stateFips) {
      return XCHECK_DISTRICTS.filter((d) => args.where.stateFips!.in.includes(d.stateFips));
    }
    return [];
  });
  db.school.findMany.mockImplementation(async (args: { where: SchoolWhere }) => {
    if (args.where.ncessch) {
      return XCHECK_SCHOOLS.filter((s) => args.where.ncessch!.in.includes(s.ncessch)).map(
        ({ ncessch, schoolName, leaid }) => ({ ncessch, schoolName, leaid }),
      );
    }
    if (args.where.stateFips) {
      return XCHECK_SCHOOLS.filter((s) => args.where.stateFips!.in.includes(s.stateFips));
    }
    return [];
  });
}

/** The "wrong NCES id" row from the real export, synthetic emails. */
const WRONG_ID_ROW = {
  email: "principal@donna.example.org",
  leaid: "481095000921", // resolves to AD WHEAT MIDDLE / Cleburne ISD
  districtName: "A P Solis Middle School",
  state: "Texas",
};

describe("NCES_NAME_AGREE_THRESHOLD — borderline pairs", () => {
  const agrees = (a: string, b: string) => orgNameSimilarity(a, b) >= NCES_NAME_AGREE_THRESHOLD;

  it("MUST agree: export name vs the NCES rendering of the same school", () => {
    expect(agrees("A P Solis Middle School", "A P SOLIS MIDDLE")).toBe(true);
  });

  it("MUST conflict: the verified wrong-id pair", () => {
    expect(agrees("A P Solis Middle School", "AD WHEAT MIDDLE")).toBe(false);
  });

  it("borderline agrees: same school with extra honorific/suffix words", () => {
    expect(agrees("Truman High School", "Harry S Truman High School")).toBe(true);
    expect(agrees("Memorial High School", "Memorial Senior High School")).toBe(true);
  });

  it("borderline conflicts: different schools sharing a generic suffix", () => {
    expect(agrees("Riverside High School", "Lakeside High School")).toBe(false);
    expect(agrees("Jefferson Elementary", "Jackson Elementary")).toBe(false);
  });
});

describe("NCES id ↔ name cross-check", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    seedCrossCheckWorld(db);
  });

  it("agreement: keeps the NCES match silently and skips the state prefetch", async () => {
    const [r] = await resolveLeadRows(
      [
        {
          email: "p@cleburne.example.org",
          leaid: "481095000921",
          districtName: "AD Wheat Middle School", // normalizes to the NCES name
          state: "Texas",
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.viaName).toBe(false);
    expect(r.warnings).toEqual([]);
    expect(r.district).toMatchObject({ leaid: "4810950", name: "Cleburne ISD" });
    // No conflict → no state-scoped school/district prefetch.
    const stateQueries = [
      ...db.school.findMany.mock.calls,
      ...db.district.findMany.mock.calls,
    ].filter((c) => c[0].where.stateFips);
    expect(stateQueries).toEqual([]);
  });

  it("conflict + unambiguous name: overrides to the named school (viaName + warning)", async () => {
    const [r] = await resolveLeadRows([WRONG_ID_ROW], USER_ID, asDb(db));
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.viaNces).toBe(false);
    expect(r.warnings).toContain("nces_name_conflict");
    expect(r.school).toEqual({ ncessch: "481431017037", name: "A P Solis Middle School" });
    expect(r.district).toEqual({ leaid: "4814310", name: "Donna ISD", willCreate: false });
    // The cross-check prefetched the state's schools (batched, by stateFips).
    expect(
      db.school.findMany.mock.calls.some((c) => c[0].where.stateFips),
    ).toBe(true);
  });

  it("conflict + name miss: keeps the NCES match with nces_name_mismatch", async () => {
    const [r] = await resolveLeadRows(
      [{ ...WRONG_ID_ROW, districtName: "Totally Unknown Middle School" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.viaName).toBe(false);
    expect(r.warnings).toContain("nces_name_mismatch");
    expect(r.warnings).not.toContain("nces_name_conflict");
    expect(r.school).toEqual({ ncessch: "481095000921", name: "AD WHEAT MIDDLE" });
    expect(r.district).toMatchObject({ leaid: "4810950", name: "Cleburne ISD" });
  });

  it("conflict + ambiguous name: keeps the NCES match with nces_name_mismatch", async () => {
    const [r] = await resolveLeadRows(
      [{ ...WRONG_ID_ROW, districtName: "Lakeside Elementary School" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.warnings).toContain("nces_name_mismatch");
    expect(r.district).toMatchObject({ leaid: "4810950" });
  });

  it("conflict without a usable state: keeps the NCES match with nces_name_mismatch", async () => {
    const [r] = await resolveLeadRows(
      [{ ...WRONG_ID_ROW, state: undefined }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.warnings).toContain("nces_name_mismatch");
    expect(r.district).toMatchObject({ leaid: "4810950" });
  });

  it("no name on the row: behaves as today (no cross-check, no warning)", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "p@donna.example.org", leaid: "481095000921", state: "Texas" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.district).toMatchObject({ leaid: "4810950" });
  });

  it("district-ish name: no cross-check (school↔district names never compare)", async () => {
    const [r] = await resolveLeadRows(
      [{ ...WRONG_ID_ROW, districtName: "Donna ISD" }],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.district).toMatchObject({ leaid: "4810950" });
  });

  it("applies identically to activity rows", async () => {
    const [r] = await resolveActivityRows([{ ...WRONG_ID_ROW, kind: "email" }], asDb(db));
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.viaNces).toBe(false);
    expect(r.warnings).toContain("nces_name_conflict");
    expect(r.school).toMatchObject({ ncessch: "481431017037" });
    expect(r.district).toMatchObject({ leaid: "4814310" });
  });

  it("dry/wet parity: the wet run writes the overridden school + district and surfaces the warning", async () => {
    db.contact.create.mockResolvedValue({ id: 401 });
    const rows = [WRONG_ID_ROW];
    const resolutions = await resolveLeadRows(rows, USER_ID, asDb(db));
    const result = await applyLeadImport(rows, resolutions, USER_ID, asDb(db));

    expect(result.succeeded).toEqual([0]);
    expect(result.warnings).toEqual([{ index: 0, warning: "nces_name_conflict" }]);
    expect(db.district.create).not.toHaveBeenCalled(); // real district, never a stub
    expect(db.contact.create.mock.calls[0][0].data).toMatchObject({
      leaid: "4814310",
      schoolNcessch: "481431017037",
    });
    expect(db.lead.create.mock.calls[0][0].data).toMatchObject({
      leaid: "4814310",
      schoolNcessch: "481431017037",
    });
  });
});

// ---- School-abbreviation awareness + email-domain → district inference -------------
//
// Synthetic world for the two real-export failure modes: (1) NCES abbreviated
// school names ("MANVEL H S") false-flagging rows whose id was RIGHT, and
// (2) rows whose school email domain pins the district when the name alone is
// ambiguous statewide or the state column is unusable.

const DOMAIN_DISTRICTS = [
  { leaid: "4801620", name: "Alvin ISD", stateFips: "48" },
  { leaid: "4810950", name: "Cleburne ISD", stateFips: "48" },
  { leaid: "4839990", name: "Springfield ISD", stateFips: "48" },
  { leaid: "4839991", name: "Springfield Public Schools", stateFips: "48" },
];
const DOMAIN_SCHOOLS = [
  { ncessch: "480162000001", schoolName: "MANVEL H S", leaid: "4801620", stateFips: "48" },
  { ncessch: "480162000002", schoolName: "JOWELL EL", leaid: "4801620", stateFips: "48" },
  { ncessch: "481095000921", schoolName: "AD WHEAT MIDDLE", leaid: "4810950", stateFips: "48" },
  // Normalizes identically to JOWELL EL → school-by-name is ambiguous
  // STATEWIDE, but unique within the domain-implied district.
  {
    ncessch: "483999000003",
    schoolName: "Jowell Elementary",
    leaid: "4839990",
    stateFips: "48",
  },
];
/** Contacts our DB holds per email domain: [leaid, count][]. */
const DOMAIN_CONTACTS: Record<string, Array<[string, number]>> = {
  "alvinisd.example.net": [
    ["4801620", 4],
    ["4810950", 1],
  ], // 4/5 = 80% → dominant
  "springfield1.example.org": [["4839990", 3]], // 100% → dominant
  "split.example.org": [
    ["4839990", 2],
    ["4839991", 2],
  ], // 50/50 → no inference (regional co-op shape)
  "solo.example.org": [["4839990", 1]], // 1 contact → below DOMAIN_MIN_CONTACTS
};

function seedDomainWorld(db: MockDb) {
  db.district.findMany.mockImplementation(async (args: { where: DistrictWhere }) => {
    if (args.where.leaid) {
      return DOMAIN_DISTRICTS.filter((d) => args.where.leaid!.in.includes(d.leaid)).map(
        ({ leaid, name }) => ({ leaid, name }),
      );
    }
    if (args.where.stateFips) {
      return DOMAIN_DISTRICTS.filter((d) => args.where.stateFips!.in.includes(d.stateFips));
    }
    return [];
  });
  db.school.findMany.mockImplementation(async (args: { where: SchoolWhere }) => {
    if (args.where.ncessch) {
      return DOMAIN_SCHOOLS.filter((s) => args.where.ncessch!.in.includes(s.ncessch)).map(
        ({ ncessch, schoolName, leaid }) => ({ ncessch, schoolName, leaid }),
      );
    }
    if (args.where.leaid) {
      return DOMAIN_SCHOOLS.filter((s) => args.where.leaid!.in.includes(s.leaid)).map(
        ({ ncessch, schoolName, leaid }) => ({ ncessch, schoolName, leaid }),
      );
    }
    if (args.where.stateFips) {
      return DOMAIN_SCHOOLS.filter((s) => args.where.stateFips!.in.includes(s.stateFips));
    }
    return [];
  });
  db.contact.findMany.mockImplementation(async (args: { where: ContactWhere }) => {
    if (args.where.OR) {
      const domains = args.where.OR.map((c) => c.email.endsWith.slice(1));
      return domains.flatMap((domain) =>
        (DOMAIN_CONTACTS[domain] ?? []).flatMap(([leaid, count]) =>
          Array.from({ length: count }, (_, i) => ({
            email: `c${i}.${leaid}@${domain}`,
            leaid,
          })),
        ),
      );
    }
    return []; // email lookup — every import row is a new contact
  });
}

describe("emailDomain", () => {
  it("returns the lowercased domain of an org email", () => {
    expect(emailDomain("jane@killeenisd.org")).toBe("killeenisd.org");
    expect(emailDomain("jane@DonnaISD.NET")).toBe("donnaisd.net");
  });

  it("returns null for free-mail and junk", () => {
    expect(emailDomain("jane@gmail.com")).toBeNull();
    expect(emailDomain("jane@yahoo.com")).toBeNull();
    expect(emailDomain("jane@icloud.com")).toBeNull();
    expect(emailDomain("not-an-email")).toBeNull();
  });
});

describe("school-abbreviation cross-check (false-flag fix)", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    seedDomainWorld(db);
  });

  it("a CORRECT NCES id whose school is abbreviated no longer flags", async () => {
    const [r] = await resolveLeadRows(
      [
        {
          email: "p@alvinisd.example.net",
          leaid: "480162000001", // MANVEL H S — the id is RIGHT
          districtName: "Manvel High School",
          state: "Texas",
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.viaName).toBe(false);
    expect(r.warnings).toEqual([]);
    expect(r.district).toMatchObject({ leaid: "4801620", name: "Alvin ISD" });
    // Agreement → no name-disambiguation prefetch of any kind fires.
    expect(db.contact.findMany).toHaveBeenCalledTimes(1); // email lookup only
    const stateQueries = [
      ...db.school.findMany.mock.calls,
      ...db.district.findMany.mock.calls,
    ].filter((c) => c[0].where.stateFips);
    expect(stateQueries).toEqual([]);
  });
});

describe("email-domain → district inference", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    seedDomainWorld(db);
  });

  it("cross-check conflict: overrides via the domain-implied district even without a state", async () => {
    const [r] = await resolveLeadRows(
      [
        {
          email: "p@alvinisd.example.net",
          leaid: "481095000921", // wrong id → AD WHEAT MIDDLE / Cleburne ISD
          districtName: "Jowell Elementary",
          // no state — the statewide fallback is impossible
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.viaNces).toBe(false);
    expect(r.warnings).toContain("nces_name_conflict");
    expect(r.school).toEqual({ ncessch: "480162000002", name: "JOWELL EL" });
    expect(r.district).toEqual({ leaid: "4801620", name: "Alvin ISD", willCreate: false });
  });

  it("cross-check conflict: domain scope beats a statewide-AMBIGUOUS school name", async () => {
    // "Jowell Elementary School" normalizes onto BOTH Jowells statewide
    // (tier-2 ambiguous); the alvinisd domain pins JOWELL EL in Alvin ISD.
    const [r] = await resolveLeadRows(
      [
        {
          email: "p@alvinisd.example.net",
          leaid: "481095000921",
          districtName: "Jowell Elementary School",
          state: "Texas",
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.warnings).toContain("nces_name_conflict");
    expect(r.district).toMatchObject({ leaid: "4801620" });
    expect(r.school).toMatchObject({ ncessch: "480162000002" });
  });

  it("cross-check conflict without a domain hit keeps today's mismatch flag", async () => {
    const [r] = await resolveLeadRows(
      [
        {
          email: "p@solo.example.org", // 1 contact → no inference
          leaid: "481095000921",
          districtName: "Jowell Elementary School",
          state: "Texas", // statewide: tier-2 ambiguous (two Jowells) → no override
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaNces).toBe(true);
    expect(r.warnings).toContain("nces_name_mismatch");
    expect(r.district).toMatchObject({ leaid: "4810950" });
  });

  it("no-id row: school name + dominant domain resolve without a state", async () => {
    const [r] = await resolveLeadRows(
      [
        {
          email: "t@alvinisd.example.net",
          districtName: "Manvel High School", // ← abbreviation-aware in-district match
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.warnings).toContain("domain_inferred_district");
    expect(r.school).toEqual({ ncessch: "480162000001", name: "MANVEL H S" });
    expect(r.district).toEqual({ leaid: "4801620", name: "Alvin ISD", willCreate: false });
  });

  it("no-id row: district name + dominant domain rescue a statewide-ambiguous name", async () => {
    const rows = await resolveLeadRows(
      [
        // Dominant domain → "Springfield" corroborates Springfield ISD.
        { email: "d@springfield1.example.org", districtName: "Springfield", state: "Texas" },
        // Split 50/50 domain → no inference → still ambiguous statewide.
        { email: "e@split.example.org", districtName: "Springfield", state: "Texas" },
        // Single-contact domain → below DOMAIN_MIN_CONTACTS → still ambiguous.
        { email: "f@solo.example.org", districtName: "Springfield", state: "Texas" },
      ],
      USER_ID,
      asDb(db),
    );
    expect(rows[0].ok).toBe(true);
    expect(rows[0].viaName).toBe(true);
    expect(rows[0].warnings).toContain("domain_inferred_district");
    expect(rows[0].district).toEqual({
      leaid: "4839990",
      name: "Springfield ISD",
      willCreate: false,
    });
    expect(rows[1]).toMatchObject({ ok: false, error: "ambiguous_district", district: null });
    expect(rows[2]).toMatchObject({ ok: false, error: "ambiguous_district", district: null });
  });

  it("never trusts the domain ALONE — an uncorroborated name keeps failing", async () => {
    const [r] = await resolveLeadRows(
      [
        {
          email: "v@alvinisd.example.net", // dominant domain…
          districtName: "Wholly Unknown Organization", // …but the name matches nothing in it
          state: "Texas",
        },
      ],
      USER_ID,
      asDb(db),
    );
    expect(r).toMatchObject({ ok: false, error: "unresolved_district", district: null });
    expect(r.warnings).not.toContain("domain_inferred_district");
  });

  it("free-mail domains are never looked up", async () => {
    const [r] = await resolveLeadRows(
      [{ email: "g@gmail.com", districtName: "Springfield", state: "Texas" }],
      USER_ID,
      asDb(db),
    );
    expect(r).toMatchObject({ ok: false, error: "ambiguous_district" });
    // Only the email lookup ran — no domain OR-query for a free-mail row.
    expect(db.contact.findMany).toHaveBeenCalledTimes(1);
    expect(db.contact.findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it("applies identically to activity rows", async () => {
    const [r] = await resolveActivityRows(
      [{ email: "t@alvinisd.example.net", districtName: "Manvel High School", kind: "email" }],
      asDb(db),
    );
    expect(r.ok).toBe(true);
    expect(r.viaName).toBe(true);
    expect(r.warnings).toContain("domain_inferred_district");
    expect(r.school).toMatchObject({ ncessch: "480162000001" });
    expect(r.district).toMatchObject({ leaid: "4801620" });
  });

  it("dry/wet parity: the wet run writes the domain-resolved district and surfaces the warning", async () => {
    db.contact.create.mockResolvedValue({ id: 501 });
    const rows = [{ email: "t@alvinisd.example.net", districtName: "Manvel High School" }];
    const resolutions = await resolveLeadRows(rows, USER_ID, asDb(db));
    const result = await applyLeadImport(rows, resolutions, USER_ID, asDb(db));

    expect(result.succeeded).toEqual([0]);
    expect(result.warnings).toEqual([{ index: 0, warning: "domain_inferred_district" }]);
    expect(db.district.create).not.toHaveBeenCalled(); // implied district is real — never a stub
    expect(db.contact.create.mock.calls[0][0].data).toMatchObject({
      leaid: "4801620",
      schoolNcessch: "480162000001",
    });
    expect(db.lead.create.mock.calls[0][0].data).toMatchObject({
      leaid: "4801620",
      schoolNcessch: "480162000001",
    });
  });

  it("stays batched: a whole multi-domain batch costs a fixed number of queries", async () => {
    const rows = await resolveLeadRows(
      [
        { email: "a@alvinisd.example.net", districtName: "Manvel High School", state: "Texas" },
        { email: "b@springfield1.example.org", districtName: "Springfield", state: "Texas" },
        { email: "c@split.example.org", districtName: "Springfield", state: "Texas" },
        { email: "d@alvinisd.example.net", districtName: "Jowell Elementary", state: "Texas" },
      ],
      USER_ID,
      asDb(db),
    );
    expect(rows.filter((r) => r.ok)).toHaveLength(3);
    // contact: email lookup + ONE grouped domain query — never per-row.
    expect(db.contact.findMany).toHaveBeenCalledTimes(2);
    // school: stateFips prefetch + implied-leaid prefetch (no ncessch rows).
    expect(db.school.findMany.mock.calls.length).toBeLessThanOrEqual(2);
    // district: stateFips prefetch + missing implied districts.
    expect(db.district.findMany.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

// ---- End-to-end: synthetic marketing-export fixture (parse → map → resolve → apply)

const MQL_FIXTURE_CSV = [
  // Real export header shape: empty header, duplicate Phone Number, the
  // near-duplicate Company Name/Company name, full state names.
  "First Name,Last Name,Job Title,Combined Fit & Engagement Score,Last marketing email name,Email,Company Name,NCES ID,,State,Phone Number,Company name,Phone Number,City,Country/Region",
  // 12-digit school id in the mixed NCES column → district via school (viaNces)
  "Mona,Vega,Principal,109,Persona Nurture Touch 3,mvega@solis.example.org,A P Solis Middle School,481431000921,drop-me,Texas,(956) 555-0101,Example Org,(956) 555-0102,Donna,United States",
  // 7-digit district leaid → direct match
  "Frank,Stone,Assistant Superintendent,99,Event Touch 2,fstone@alamo.example.org,Alamo Heights Independent School District,4807590,drop-me,Texas,(210) 555-0101,Alamo Heights ISD,(210) 555-0102,San Antonio,United States",
  // blank NCES + unambiguous name + full state name → viaName
  "Daisy,Nguyen,Chief School Officer,118,Persona Nurture Touch 3,dnguyen@donna.example.org,Donna ISD,,drop-me,Texas,(956) 555-0103,Donna ISD,(956) 555-0104,Donna,United States",
  // blank NCES + ambiguous name → ambiguous_district
  "Ravi,Patel,Principal,103,Persona Nurture Touch 3,rpatel@springfield.example.org,Springfield,,drop-me,Texas,(972) 555-0105,Springfield,(972) 555-0106,Springfield,United States",
  // junk NCES + unmatched name → unresolved_district (and NEVER a stub)
  "Lena,Ortiz,Director,95,Event Touch 1,lortiz@nowhere.example.org,Wholly Unknown Org,N/A,drop-me,Texas,(512) 555-0107,Wholly Unknown Org,(512) 555-0108,Austin,United States",
].join("\n");

describe("synthetic MQL export — end to end", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
    seedTexasWorld(db);
    db.contact.create
      .mockResolvedValueOnce({ id: 301 })
      .mockResolvedValueOnce({ id: 302 })
      .mockResolvedValueOnce({ id: 303 });
  });

  it("parses, maps, resolves, and imports with dry/wet parity and zero junk records", async () => {
    const parsed = parseCsv(MQL_FIXTURE_CSV);
    // Empty header skipped; duplicate columns suffixed, both surviving.
    expect(parsed.headers).not.toContain("");
    expect(parsed.headers).toContain("Phone Number");
    expect(parsed.headers).toContain("Phone Number (2)");
    expect(parsed.headers).toContain("Company name"); // case-distinct, no suffix needed
    expect(parsed.rows[0]["Phone Number"]).toBe("(956) 555-0101");
    expect(parsed.rows[0]["Phone Number (2)"]).toBe("(956) 555-0102");
    expect(Object.values(parsed.rows[0])).not.toContain("drop-me");

    const mapping = buildHeaderMapping(parsed.headers, LEAD_FIELD_DEFS);
    expect(mapping.missingRequired).toEqual([]);
    const importRows = toLeadImportRows(parsed, mapping, USER_ID);
    expect(importRows[0]).toMatchObject({
      email: "mvega@solis.example.org",
      leaid: "481431000921",
      districtName: "A P Solis Middle School",
      state: "Texas",
      phone: "(956) 555-0101",
      score: 109,
    });

    // Dry run (the preview the user approves)…
    const resolutions = await resolveLeadRows(importRows, USER_ID, asDb(db));
    expect(resolutions[0]).toMatchObject({
      ok: true,
      viaNces: true,
      viaName: false,
      district: { leaid: "4814310", name: "Donna ISD" },
      school: { ncessch: "481431000921" },
    });
    expect(resolutions[1]).toMatchObject({
      ok: true,
      viaNces: false,
      viaName: false,
      district: { leaid: "4807590", willCreate: false },
    });
    expect(resolutions[2]).toMatchObject({
      ok: true,
      viaName: true,
      district: { leaid: "4814310", name: "Donna ISD", willCreate: false },
    });
    expect(resolutions[3]).toMatchObject({ ok: false, error: "ambiguous_district" });
    expect(resolutions[4]).toMatchObject({ ok: false, error: "unresolved_district" });
    const drySummary = summarizeLeadResolutions(resolutions);
    expect(drySummary).toMatchObject({ total: 5, toCreate: 3, newDistricts: 0, failed: 2 });

    // …and the wet run writes exactly what it promised.
    const result = await applyLeadImport(importRows, resolutions, USER_ID, asDb(db));
    expect(result.summary.imported).toBe(drySummary.toCreate);
    expect(result.succeeded).toEqual([0, 1, 2]);
    expect(result.failed).toEqual([
      { index: 3, reason: "ambiguous_district" },
      { index: 4, reason: "unresolved_district" },
    ]);
    // Every row matched a REAL district — no stubs, no junk records.
    expect(db.district.create).not.toHaveBeenCalled();
    const leadCreates = db.lead.create.mock.calls.map((c) => c[0].data);
    expect(leadCreates.map((d) => d.leaid)).toEqual(["4814310", "4807590", "4814310"]);
    expect(leadCreates[0].schoolNcessch).toBe("481431000921");
  });
});
