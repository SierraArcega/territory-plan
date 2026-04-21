# Find Contacts — Principal Target Role + School-Level Export

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Principal" as a Target Role in the Find Contacts popover, fire Clay enrichment per-school (not per-district) when selected, link returned contacts to their school, and change CSV export to one row per contact with School Name / Level / Type columns.

**Architecture:** No Prisma schema changes — `School`, `SchoolContact`, and `Contact` already exist. The bulk-enrich API route branches on `targetRole`: the existing per-district path is untouched, and a new per-school path fetches `School` rows filtered by `schoolLevel`, skips schools already linked to a principal via `SchoolContact`, and fires one Clay webhook per school with `ncessch` in the payload. The Clay webhook callback upserts a `SchoolContact` whenever `ncessch` is present. The plan-contacts GET endpoint starts including `schoolContacts[].school` so the client can render per-school export rows. Frontend surfaces an inline school-level subfilter (3 checkboxes) inside the existing popover; CSV export switches to one-row-per-contact with 3 new columns.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma/PostgreSQL, TanStack Query, Vitest + Testing Library, Tailwind 4, Lucide icons.

**Spec:** `Docs/superpowers/specs/2026-04-20-find-contacts-principals-design.md`

**Branch:** `feat/find-contacts-principals` (already created, spec committed, no implementation commits yet)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/features/shared/lib/schoolLabels.ts` | Shared `SCHOOL_LEVEL_LABELS` + new `SCHOOL_TYPE_LABELS` constants (CSV export needs both, tooltip already uses level labels) |
| `src/features/shared/lib/__tests__/schoolLabels.test.ts` | Unit test for label constants |
| `src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts` | API route tests — Principal branch, school-level filter, skip already-enriched, metadata |
| `src/app/api/webhooks/clay/__tests__/route.test.ts` | Webhook test — `ncessch` payload creates both `Contact` and `SchoolContact` |
| `src/features/plans/components/__tests__/ContactsActionBar.test.tsx` | Component test — Principal popover shows checkboxes, empty selection disables Start |

### Modified Files
| File | Changes |
|------|---------|
| `src/features/shared/types/contact-types.ts` | Add `"Principal"` to `TARGET_ROLES` |
| `src/features/shared/types/api-types.ts` | Extend `Contact` with optional `schoolContacts` array |
| `src/features/map/components/MapV2Tooltip.tsx` | Import `SCHOOL_LEVEL_LABELS` from shared module instead of defining locally |
| `src/features/map/components/panels/district/SchoolsCard.tsx` | Import `SCHOOL_LEVEL_LABELS` from shared module |
| `src/features/map/components/panels/district/tabs/SchoolsTab.tsx` | Import `SCHOOL_LEVEL_LABELS` from shared module |
| `src/features/map/components/panels/district/CharterSchools.tsx` | Import `SCHOOL_LEVEL_LABELS` from shared module |
| `src/app/api/territory-plans/[id]/contacts/route.ts` | Include `schoolContacts: { include: { school } }`; return selected school fields per contact |
| `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` | Accept `schoolLevels`; branch on `targetRole === "Principal"` with per-school fetch, skip, webhook fire |
| `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts` | When the active activity is a Principal enrichment, count schools-with-principal-contacts instead of districts-with-contacts |
| `src/app/api/webhooks/clay/route.ts` | When payload includes `ncessch`, upsert `SchoolContact` after creating/updating `Contact` |
| `src/features/plans/lib/queries.ts` | Extend `useBulkEnrich` to pass `schoolLevels` |
| `src/features/plans/components/ContactsActionBar.tsx` | Render school-level subsection when `selectedRole === "Principal"`; disable Start if none checked; rewrite `handleExportCsv` to one-row-per-contact with 3 new columns |

---

## Task 1: Clay Workflow Audit (manual, non-blocking for merge)

The Clay workflow currently expects per-district fields. Before the feature produces correct results, the user must open Clay and verify the workflow accepts per-school input. The code ships and merges independently of this — the feature just won't return principal contacts until Clay is ready.

**Files:** none (manual task, log the outcome in the task PR description).

- [ ] **Step 1: Open the Clay workspace behind `CLAY_WEBHOOK_URL`**

Find the webhook URL in `.env.local` or Vercel project env vars under `CLAY_WEBHOOK_URL`. Open Clay → find the table that ingests that URL.

- [ ] **Step 2: Verify input columns**

The input table (the one Clay writes incoming `/contacts/bulk-enrich` payloads into) must accept these columns in addition to what it already has:
- `ncessch` (string)
- `school_name` (string)
- `school_level` (int)
- `school_type` (int)

If any are missing, add them as text/number columns.

- [ ] **Step 3: Verify the enrichment step targets schools, not districts**

The "Find Person" / Apollo / ZoomInfo step that finds the contact must use `school_name` (and `street`/`city`/`zip` from the school if available) as the company input when `target_role === "Principal"`. If the step is hardcoded to `district_name`, add a conditional or a second branch keyed on `target_role`.

- [ ] **Step 4: Verify the callback HTTP column includes `ncessch`**

The Clay HTTP column that POSTs results back to `/api/webhooks/clay` must include `ncessch` in the payload. Without this, the app cannot create the `SchoolContact` link and principal contacts will look like district-level contacts.

- [ ] **Step 5: Record audit result**

In the PR description, note one of:
- ✅ Clay workflow already supported per-school — no edits made.
- ✅ Edited Clay workflow (list which of the 3 items above were changed).
- ⚠️ Clay workflow not yet updated — merging code-only; will enable after workflow is ready.

---

## Task 2: Spot-Check School Data Coverage

`School.schoolType` population rate is unknown. If it's mostly null, the CSV column will be mostly blank — that's fine, but we want to know before shipping.

**Files:** none (one-off DB query, log result).

- [ ] **Step 1: Run coverage query against the dev/prod database**

```bash
npx prisma studio
# OR, using psql directly:
psql "$DATABASE_URL" -c "
  SELECT
    COUNT(*) AS total,
    COUNT(school_type) AS with_type,
    COUNT(school_level) AS with_level,
    ROUND(100.0 * COUNT(school_type) / COUNT(*), 1) AS pct_type,
    ROUND(100.0 * COUNT(school_level) / COUNT(*), 1) AS pct_level
  FROM schools
  WHERE school_status = 1;
"
```

Expected: a single row with `pct_level` and `pct_type` percentages.

- [ ] **Step 2: Record the result**

In the PR description, add a line like: `School.schoolLevel: 94% populated. School.schoolType: 62% populated.` If `schoolLevel` coverage is under ~85%, flag to the user — the school-level filter will silently exclude unlabeled schools.

---

## Task 3: Sync Local Branch

**Files:** none.

- [ ] **Step 1: Confirm you're on the feature branch**

```bash
git branch --show-current
```

Expected: `feat/find-contacts-principals`

- [ ] **Step 2: Rebase onto latest main**

```bash
git fetch origin
git rebase origin/main
```

Expected: clean rebase (spec file adds only, no conflicts). If conflicts appear, resolve in the spec file and continue.

- [ ] **Step 3: Verify tests still pass on the current tree**

```bash
npm test -- --run
```

Expected: all tests pass. If anything fails unrelated to this work, stop and fix that first on a separate branch (see `project_local_dev_broken.md` / `project_compilation_warnings.md` memory entries).

---

## Task 4: Create Shared School Labels Module

Spec §7 leaves the location of `SCHOOL_TYPE_LABELS` open. CSV export needs both label maps, and `SCHOOL_LEVEL_LABELS` is already duplicated across four map components. Create one shared source.

**Files:**
- Create: `src/features/shared/lib/schoolLabels.ts`
- Test: `src/features/shared/lib/__tests__/schoolLabels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/shared/lib/__tests__/schoolLabels.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SCHOOL_LEVEL_LABELS, SCHOOL_TYPE_LABELS } from "../schoolLabels";

describe("SCHOOL_LEVEL_LABELS", () => {
  it("maps all 4 NCES school levels", () => {
    expect(SCHOOL_LEVEL_LABELS[1]).toBe("Elementary");
    expect(SCHOOL_LEVEL_LABELS[2]).toBe("Middle");
    expect(SCHOOL_LEVEL_LABELS[3]).toBe("High");
    expect(SCHOOL_LEVEL_LABELS[4]).toBe("Other");
  });
});

describe("SCHOOL_TYPE_LABELS", () => {
  it("maps all 4 NCES school types", () => {
    expect(SCHOOL_TYPE_LABELS[1]).toBe("Regular");
    expect(SCHOOL_TYPE_LABELS[2]).toBe("Special Education");
    expect(SCHOOL_TYPE_LABELS[3]).toBe("Career & Technical");
    expect(SCHOOL_TYPE_LABELS[4]).toBe("Alternative");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --run src/features/shared/lib/__tests__/schoolLabels.test.ts
```

Expected: FAIL (module does not exist).

- [ ] **Step 3: Create the module**

Create `src/features/shared/lib/schoolLabels.ts`:

```ts
// NCES school level codes (common core of data)
export const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Elementary",
  2: "Middle",
  3: "High",
  4: "Other",
};

// NCES school type codes (common core of data)
// 1 = Regular, 2 = Special Education, 3 = Career & Technical, 4 = Alternative
export const SCHOOL_TYPE_LABELS: Record<number, string> = {
  1: "Regular",
  2: "Special Education",
  3: "Career & Technical",
  4: "Alternative",
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- --run src/features/shared/lib/__tests__/schoolLabels.test.ts
```

Expected: PASS.

- [ ] **Step 5: Replace duplicated `SCHOOL_LEVEL_LABELS` in existing consumers**

In each of these four files, delete the local `SCHOOL_LEVEL_LABELS` definition (a `Record<number, string>` with entries for 1–4) and add this import near the top:

```ts
import { SCHOOL_LEVEL_LABELS } from "@/features/shared/lib/schoolLabels";
```

Files to update:
- `src/features/map/components/MapV2Tooltip.tsx` (current definition at line 32)
- `src/features/map/components/panels/district/SchoolsCard.tsx`
- `src/features/map/components/panels/district/tabs/SchoolsTab.tsx`
- `src/features/map/components/panels/district/CharterSchools.tsx`

- [ ] **Step 6: Typecheck the whole tree**

```bash
npx tsc --noEmit
```

Expected: no new errors from the removal/import swap. (Pre-existing errors are tracked separately per `project_compilation_warnings.md`.)

- [ ] **Step 7: Commit**

```bash
git add src/features/shared/lib/schoolLabels.ts \
        src/features/shared/lib/__tests__/schoolLabels.test.ts \
        src/features/map/components/MapV2Tooltip.tsx \
        src/features/map/components/panels/district/SchoolsCard.tsx \
        src/features/map/components/panels/district/tabs/SchoolsTab.tsx \
        src/features/map/components/panels/district/CharterSchools.tsx
git commit -m "refactor: centralize SCHOOL_LEVEL_LABELS + add SCHOOL_TYPE_LABELS in shared module"
```

---

## Task 5: Add "Principal" to TARGET_ROLES

**Files:**
- Modify: `src/features/shared/types/contact-types.ts:67-75`

- [ ] **Step 1: Write the failing test**

Add to `src/features/shared/lib/__tests__/schoolLabels.test.ts` (or create a colocated test — the target-roles file has no existing test, so a new file is cleaner). Create `src/features/shared/types/__tests__/contact-types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TARGET_ROLES } from "../contact-types";

describe("TARGET_ROLES", () => {
  it("includes Principal as the 8th role", () => {
    expect(TARGET_ROLES).toContain("Principal");
  });

  it("preserves existing roles in order", () => {
    expect(TARGET_ROLES.slice(0, 7)).toEqual([
      "Superintendent",
      "Assistant Superintendent",
      "Chief Technology Officer",
      "Chief Financial Officer",
      "Curriculum Director",
      "Special Education Director",
      "HR Director",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --run src/features/shared/types/__tests__/contact-types.test.ts
```

Expected: FAIL (`TARGET_ROLES` does not contain "Principal").

- [ ] **Step 3: Add Principal to the constant**

In `src/features/shared/types/contact-types.ts`, change the `TARGET_ROLES` block from:

```ts
export const TARGET_ROLES = [
  "Superintendent",
  "Assistant Superintendent",
  "Chief Technology Officer",
  "Chief Financial Officer",
  "Curriculum Director",
  "Special Education Director",
  "HR Director",
] as const;
```

to:

```ts
export const TARGET_ROLES = [
  "Superintendent",
  "Assistant Superintendent",
  "Chief Technology Officer",
  "Chief Financial Officer",
  "Curriculum Director",
  "Special Education Director",
  "HR Director",
  "Principal",
] as const;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- --run src/features/shared/types/__tests__/contact-types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/types/contact-types.ts \
        src/features/shared/types/__tests__/contact-types.test.ts
git commit -m "feat(types): add Principal to TARGET_ROLES"
```

---

## Task 6: Include `schoolContacts` in Plan Contacts API

CSV export needs per-contact school data. Extend the plan contacts GET endpoint to pull the `SchoolContact` join and include a minimal school payload per contact.

**Files:**
- Modify: `src/app/api/territory-plans/[id]/contacts/route.ts`
- Modify: `src/features/shared/types/api-types.ts:87-101`

- [ ] **Step 1: Extend the `Contact` API type**

In `src/features/shared/types/api-types.ts`, replace lines 87–101 with:

```ts
export interface ContactSchoolLink {
  ncessch: string;
  name: string;
  schoolLevel: number | null;
  schoolType: number | null;
}

export interface Contact {
  id: number;
  leaid: string;
  salutation: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  linkedinUrl: string | null;
  persona: string | null;
  seniorityLevel: string | null;
  createdAt: string;
  lastEnrichedAt: string | null;
  /** Present when the contact is linked to one or more schools (e.g. principals). Empty array for district-level contacts. */
  schoolContacts: ContactSchoolLink[];
}
```

- [ ] **Step 2: Update the GET route to return `schoolContacts`**

In `src/app/api/territory-plans/[id]/contacts/route.ts`, change the `prisma.contact.findMany` call at lines 47–55 to include the join, and update the mapping at lines 69–85 to project the school data:

```ts
    const contacts = await prisma.contact.findMany({
      where: {
        leaid: { in: leaids },
      },
      orderBy: [
        { isPrimary: "desc" },
        { name: "asc" },
      ],
      include: {
        schoolContacts: {
          include: {
            school: {
              select: {
                ncessch: true,
                schoolName: true,
                schoolLevel: true,
                schoolType: true,
              },
            },
          },
        },
      },
    });
```

Then change the `return NextResponse.json(...)` block (lines 69–85) to:

```ts
    return NextResponse.json(
      dedupedContacts.map((c) => ({
        id: c.id,
        leaid: c.leaid,
        salutation: c.salutation,
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        isPrimary: c.isPrimary,
        linkedinUrl: c.linkedinUrl,
        persona: c.persona,
        seniorityLevel: c.seniorityLevel,
        createdAt: c.createdAt.toISOString(),
        lastEnrichedAt: c.lastEnrichedAt?.toISOString() ?? null,
        schoolContacts: c.schoolContacts.map((sc) => ({
          ncessch: sc.school.ncessch,
          name: sc.school.schoolName,
          schoolLevel: sc.school.schoolLevel,
          schoolType: sc.school.schoolType,
        })),
      }))
    );
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors. (If `ContactsActionBar.tsx` now complains about missing `schoolContacts` in constructed test/mock data, that's a real follow-up — handle it in Task 12.)

- [ ] **Step 4: Commit**

```bash
git add src/features/shared/types/api-types.ts \
        src/app/api/territory-plans/[id]/contacts/route.ts
git commit -m "feat(api): include schoolContacts in plan contacts endpoint"
```

---

## Task 7: Extend `bulk-enrich` — Principal Branch

Add `schoolLevels` to the request body, branch on `targetRole === "Principal"` to fire one Clay webhook per school.

**Files:**
- Modify: `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts`
- Test: `src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    contact: {
      groupBy: vi.fn(),
    },
    district: {
      findMany: vi.fn(),
    },
    school: {
      findMany: vi.fn(),
    },
    schoolContact: {
      findMany: vi.fn(),
    },
    activity: {
      create: vi.fn(),
    },
  },
}));

// Stub global fetch so we can assert Clay webhook calls without network I/O
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", mockFetch);

import prisma from "@/lib/prisma";
import { POST } from "../route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/territory-plans/plan-1/contacts/bulk-enrich", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLAY_WEBHOOK_URL = "https://clay.test/hook";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.test";
  mockPrisma.territoryPlan.findUnique.mockResolvedValue({
    id: "plan-1",
    enrichmentStartedAt: null,
    enrichmentQueued: null,
    districts: [
      { districtLeaid: "0100001" },
      { districtLeaid: "0100002" },
    ],
  });
  mockPrisma.territoryPlan.update.mockResolvedValue({});
  mockPrisma.activity.create.mockResolvedValue({ id: "activity-1" });
});

describe("POST /bulk-enrich — Principal", () => {
  it("queues one webhook per eligible school at the requested levels", async () => {
    mockPrisma.school.findMany.mockResolvedValue([
      { ncessch: "010000100001", schoolName: "Alpha HS", schoolLevel: 3, schoolType: 1, leaid: "0100001", streetAddress: "1 A St", city: "A", stateAbbrev: "AL", zip: "10000", phone: null },
      { ncessch: "010000100002", schoolName: "Beta HS",  schoolLevel: 3, schoolType: 4, leaid: "0100001", streetAddress: "2 B St", city: "B", stateAbbrev: "AL", zip: "10001", phone: null },
      { ncessch: "010000200001", schoolName: "Gamma HS", schoolLevel: 3, schoolType: 1, leaid: "0100002", streetAddress: "3 C St", city: "C", stateAbbrev: "AL", zip: "10002", phone: null },
    ]);
    mockPrisma.schoolContact.findMany.mockResolvedValue([]); // none already enriched
    mockPrisma.district.findMany.mockResolvedValue([
      { leaid: "0100001", name: "Alpha SD", stateAbbrev: "AL", websiteUrl: "alpha.edu" },
      { leaid: "0100002", name: "Beta SD",  stateAbbrev: "AL", websiteUrl: "beta.edu"  },
    ]);

    const res = await POST(buildRequest({ targetRole: "Principal", schoolLevels: [3] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.queued).toBe(3);

    expect(mockPrisma.school.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leaid: { in: ["0100001", "0100002"] },
          schoolLevel: { in: [3] },
          schoolStatus: 1,
        }),
      })
    );

    // Allow fire-and-forget to tick
    await new Promise((r) => setTimeout(r, 20));
    const webhookCalls = mockFetch.mock.calls.filter(([url]) => url === "https://clay.test/hook");
    expect(webhookCalls).toHaveLength(3);
    const firstPayload = JSON.parse(webhookCalls[0][1].body as string);
    expect(firstPayload.ncessch).toBe("010000100001");
    expect(firstPayload.target_role).toBe("Principal");
    expect(firstPayload.school_level).toBe(3);
  });

  it("skips schools that already have a principal SchoolContact", async () => {
    mockPrisma.school.findMany.mockResolvedValue([
      { ncessch: "S1", schoolName: "One", schoolLevel: 3, schoolType: 1, leaid: "0100001", streetAddress: "", city: "", stateAbbrev: "AL", zip: "", phone: null },
      { ncessch: "S2", schoolName: "Two", schoolLevel: 3, schoolType: 1, leaid: "0100001", streetAddress: "", city: "", stateAbbrev: "AL", zip: "", phone: null },
    ]);
    // S1 already has a principal contact
    mockPrisma.schoolContact.findMany.mockResolvedValue([{ schoolId: "S1" }]);
    mockPrisma.district.findMany.mockResolvedValue([
      { leaid: "0100001", name: "Alpha SD", stateAbbrev: "AL", websiteUrl: null },
    ]);

    const res = await POST(buildRequest({ targetRole: "Principal", schoolLevels: [3] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(data.queued).toBe(1);
    expect(data.skipped).toBe(1);
  });

  it("records targetRole, schoolLevels, schoolsQueued in Activity metadata", async () => {
    mockPrisma.school.findMany.mockResolvedValue([
      { ncessch: "S1", schoolName: "One", schoolLevel: 1, schoolType: 1, leaid: "0100001", streetAddress: "", city: "", stateAbbrev: "AL", zip: "", phone: null },
    ]);
    mockPrisma.schoolContact.findMany.mockResolvedValue([]);
    mockPrisma.district.findMany.mockResolvedValue([
      { leaid: "0100001", name: "Alpha SD", stateAbbrev: "AL", websiteUrl: null },
    ]);

    await POST(buildRequest({ targetRole: "Principal", schoolLevels: [1, 2] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });

    expect(mockPrisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            targetRole: "Principal",
            schoolLevels: [1, 2],
            schoolsQueued: 1,
          }),
        }),
      })
    );
  });

  it("returns 400 when Principal is selected with empty schoolLevels", async () => {
    const res = await POST(buildRequest({ targetRole: "Principal", schoolLevels: [] }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /bulk-enrich — non-Principal (regression)", () => {
  it("Superintendent path still fires per-district webhooks", async () => {
    mockPrisma.contact.groupBy.mockResolvedValue([]); // no districts already enriched
    mockPrisma.district.findMany.mockResolvedValue([
      { leaid: "0100001", name: "Alpha SD", stateAbbrev: "AL", cityLocation: "A", streetLocation: "1 A", zipLocation: "10000", websiteUrl: "alpha.edu" },
      { leaid: "0100002", name: "Beta SD",  stateAbbrev: "AL", cityLocation: "B", streetLocation: "2 B", zipLocation: "10001", websiteUrl: "beta.edu" },
    ]);

    const res = await POST(buildRequest({ targetRole: "Superintendent" }), {
      params: Promise.resolve({ id: "plan-1" }),
    });
    const data = await res.json();

    expect(data.queued).toBe(2);
    // School path should not have been consulted
    expect(mockPrisma.school.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.schoolContact.findMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- --run src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts
```

Expected: all four Principal tests fail (route doesn't handle `Principal` yet); the regression test may already pass — that's fine.

- [ ] **Step 3: Implement the Principal branch in the route**

Replace the entire contents of `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ENRICHMENT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * POST /api/territory-plans/[id]/contacts/bulk-enrich
 *
 * Trigger bulk Clay contact enrichment for a plan.
 *   - Non-Principal roles: one webhook per district (skipping districts that already have contacts).
 *   - Principal: one webhook per School at the requested schoolLevels (skipping schools already linked
 *     to a principal via SchoolContact).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const targetRole: string = body.targetRole ?? "Superintendent";
    const schoolLevelsRaw: unknown = body.schoolLevels;

    const isPrincipal = targetRole === "Principal";

    let schoolLevels: number[] = [];
    if (isPrincipal) {
      if (!Array.isArray(schoolLevelsRaw) || schoolLevelsRaw.length === 0) {
        return NextResponse.json(
          { error: "schoolLevels is required and must be non-empty when targetRole is Principal" },
          { status: 400 }
        );
      }
      schoolLevels = schoolLevelsRaw
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 4);
      if (schoolLevels.length === 0) {
        return NextResponse.json(
          { error: "schoolLevels must contain integers 1–4" },
          { status: 400 }
        );
      }
    }

    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: { districts: { select: { districtLeaid: true } } },
    });

    if (!plan) {
      return NextResponse.json({ error: "Territory plan not found" }, { status: 404 });
    }

    const allLeaids = plan.districts.map((d) => d.districtLeaid);

    if (allLeaids.length === 0) {
      return NextResponse.json({ total: 0, skipped: 0, queued: 0 });
    }

    const clayWebhookUrl = process.env.CLAY_WEBHOOK_URL;
    if (!clayWebhookUrl) {
      return NextResponse.json(
        { error: "Clay webhook not configured. Please add CLAY_WEBHOOK_URL to environment variables." },
        { status: 500 }
      );
    }

    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://plan.fullmindlearning.com"}/api/webhooks/clay`;

    // ---------- Concurrency guard (shared) ----------
    if (
      plan.enrichmentStartedAt &&
      plan.enrichmentQueued &&
      Date.now() - plan.enrichmentStartedAt.getTime() < ENRICHMENT_TIMEOUT_MS
    ) {
      // For district mode, the existing check against contact groupBy is correct.
      // For Principal mode, we conservatively refuse until the previous run times out.
      if (isPrincipal) {
        return NextResponse.json(
          {
            error: "Enrichment already in progress",
            enriched: 0,
            queued: plan.enrichmentQueued,
          },
          { status: 409 }
        );
      }
      const enrichedCount = await prisma.contact.groupBy({
        by: ["leaid"],
        where: { leaid: { in: allLeaids } },
      });
      if (enrichedCount.length < plan.enrichmentQueued) {
        return NextResponse.json(
          {
            error: "Enrichment already in progress",
            enriched: enrichedCount.length,
            queued: plan.enrichmentQueued,
          },
          { status: 409 }
        );
      }
    }

    // ============================================================
    // Principal path — one webhook per school
    // ============================================================
    if (isPrincipal) {
      const schools = await prisma.school.findMany({
        where: {
          leaid: { in: allLeaids },
          schoolLevel: { in: schoolLevels },
          schoolStatus: 1, // open schools only
        },
        select: {
          ncessch: true,
          schoolName: true,
          schoolLevel: true,
          schoolType: true,
          leaid: true,
          streetAddress: true,
          city: true,
          stateAbbrev: true,
          zip: true,
          phone: true,
        },
      });

      if (schools.length === 0) {
        return NextResponse.json({ total: 0, skipped: 0, queued: 0 });
      }

      // NOTE: the "already enriched as principal" heuristic matches title /principal/i.
      // If match rate is poor in production, fall back to skipping schools with ANY SchoolContact.
      const alreadyPrincipal = await prisma.schoolContact.findMany({
        where: {
          schoolId: { in: schools.map((s) => s.ncessch) },
          contact: { title: { contains: "principal", mode: "insensitive" } },
        },
        select: { schoolId: true },
      });
      const alreadyPrincipalSet = new Set(alreadyPrincipal.map((r) => r.schoolId));
      const toEnrich = schools.filter((s) => !alreadyPrincipalSet.has(s.ncessch));

      const total = schools.length;
      const skipped = alreadyPrincipalSet.size;
      const queued = toEnrich.length;

      if (queued === 0) {
        return NextResponse.json({ total, skipped, queued: 0 });
      }

      const districtRows = await prisma.district.findMany({
        where: { leaid: { in: Array.from(new Set(toEnrich.map((s) => s.leaid))) } },
        select: {
          leaid: true,
          name: true,
          stateAbbrev: true,
          websiteUrl: true,
        },
      });
      const districtByLeaid = new Map(districtRows.map((d) => [d.leaid, d]));

      const activity = await prisma.activity.create({
        data: {
          type: "contact_enrichment",
          title: `Bulk contact enrichment — Principal`,
          status: "in_progress",
          source: "system",
          createdByUserId: user.id,
          metadata: {
            targetRole: "Principal",
            schoolLevels,
            schoolsQueued: queued,
            districtCount: districtRows.length,
            skipped,
          },
          plans: { create: { planId: id } },
        },
      });

      await prisma.territoryPlan.update({
        where: { id },
        data: {
          enrichmentStartedAt: new Date(),
          enrichmentQueued: queued,
          enrichmentActivityId: activity.id,
        },
      });

      const batchSize = 10;
      const fireBatches = async () => {
        for (let i = 0; i < toEnrich.length; i += batchSize) {
          const batch = toEnrich.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (school) => {
              const district = districtByLeaid.get(school.leaid);
              try {
                await fetch(clayWebhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ncessch: school.ncessch,
                    school_name: school.schoolName,
                    school_level: school.schoolLevel,
                    school_type: school.schoolType,
                    leaid: school.leaid,
                    district_name: district?.name ?? null,
                    state: school.stateAbbrev,
                    city: school.city,
                    street: school.streetAddress,
                    zip: school.zip,
                    website_url: district?.websiteUrl ?? null,
                    target_role: "Principal",
                    callback_url: callbackUrl,
                  }),
                });
              } catch (error) {
                console.error(`Clay webhook failed for school ${school.ncessch}:`, error);
              }
            })
          );
          if (i + batchSize < toEnrich.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      };
      fireBatches().catch((error) => {
        console.error("Batch enrichment error (Principal):", error);
      });

      return NextResponse.json({ total, skipped, queued });
    }

    // ============================================================
    // Existing per-district path (unchanged behavior)
    // ============================================================
    const districtsWithContacts = await prisma.contact.groupBy({
      by: ["leaid"],
      where: { leaid: { in: allLeaids } },
    });
    const enrichedLeaids = new Set(districtsWithContacts.map((d) => d.leaid));
    const leaidsToEnrich = allLeaids.filter((l) => !enrichedLeaids.has(l));

    const total = allLeaids.length;
    const skipped = enrichedLeaids.size;
    const queued = leaidsToEnrich.length;

    if (queued === 0) {
      return NextResponse.json({ total, skipped, queued: 0 });
    }

    const districts = await prisma.district.findMany({
      where: { leaid: { in: leaidsToEnrich } },
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        cityLocation: true,
        streetLocation: true,
        zipLocation: true,
        websiteUrl: true,
      },
    });

    const activity = await prisma.activity.create({
      data: {
        type: "contact_enrichment",
        title: `Bulk contact enrichment — ${targetRole}`,
        status: "in_progress",
        source: "system",
        createdByUserId: user.id,
        metadata: { targetRole, queued, skipped },
        plans: { create: { planId: id } },
      },
    });

    await prisma.territoryPlan.update({
      where: { id },
      data: {
        enrichmentStartedAt: new Date(),
        enrichmentQueued: queued,
        enrichmentActivityId: activity.id,
      },
    });

    const batchSize = 10;
    const fireBatches = async () => {
      for (let i = 0; i < districts.length; i += batchSize) {
        const batch = districts.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (district) => {
            try {
              await fetch(clayWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  leaid: district.leaid,
                  district_name: district.name,
                  state: district.stateAbbrev,
                  city: district.cityLocation,
                  street: district.streetLocation,
                  state_full: district.stateAbbrev,
                  zip: district.zipLocation,
                  website_url: district.websiteUrl,
                  target_role: targetRole,
                  callback_url: callbackUrl,
                }),
              });
            } catch (error) {
              console.error(`Clay webhook failed for district ${district.leaid}:`, error);
            }
          })
        );
        if (i + batchSize < districts.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };
    fireBatches().catch((error) => {
      console.error("Batch enrichment error:", error);
    });

    return NextResponse.json({ total, skipped, queued });
  } catch (error) {
    console.error("Error triggering bulk enrichment:", error);
    return NextResponse.json(
      { error: "Failed to trigger bulk enrichment" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- --run src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/territory-plans/[id]/contacts/bulk-enrich/
git commit -m "feat(api): Principal branch in bulk-enrich (per-school Clay fan-out)"
```

---

## Task 8: Update `enrich-progress` to Count Schools in Principal Mode

When the active activity is a Principal enrichment, `enrichmentQueued` counts schools. The current progress route counts districts-with-contacts, which is wrong for principals. Branch on `activity.metadata.targetRole`.

**Files:**
- Modify: `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts`

- [ ] **Step 1: Extend the progress route**

Replace the contents of `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/territory-plans/[id]/contacts/enrich-progress
 *
 * Returns enrichment progress. Branches on the active enrichment Activity's
 * metadata.targetRole:
 *   - "Principal": counts schools with a principal SchoolContact.
 *   - anything else (or no active activity): counts districts with any contact.
 *
 * Also completes the Activity record when enrichment finishes or stalls.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: { districts: { select: { districtLeaid: true } } },
    });

    if (!plan) {
      return NextResponse.json({ error: "Territory plan not found" }, { status: 404 });
    }

    const allLeaids = plan.districts.map((d) => d.districtLeaid);
    const total = allLeaids.length;
    const queued = plan.enrichmentQueued ?? 0;

    if (queued === 0 || allLeaids.length === 0) {
      return NextResponse.json({ total, enriched: 0, queued: 0 });
    }

    // Read the active activity's metadata to decide counting strategy
    let targetRole: string | null = null;
    let activityMeta: Record<string, unknown> = {};
    if (plan.enrichmentActivityId) {
      const activity = await prisma.activity.findUnique({
        where: { id: plan.enrichmentActivityId },
        select: { metadata: true },
      });
      activityMeta = (activity?.metadata as Record<string, unknown>) ?? {};
      targetRole = typeof activityMeta.targetRole === "string" ? activityMeta.targetRole : null;
    }

    let enriched: number;
    let skipped: number;

    if (targetRole === "Principal") {
      // Count distinct schools (in the plan's districts) that now have a principal SchoolContact.
      const principalLinks = await prisma.schoolContact.findMany({
        where: {
          school: { leaid: { in: allLeaids } },
          contact: { title: { contains: "principal", mode: "insensitive" } },
        },
        select: { schoolId: true },
        distinct: ["schoolId"],
      });
      const schoolsWithPrincipal = principalLinks.length;
      // `skipped` was recorded at fire time; subtract it so we only count newly enriched.
      skipped = typeof activityMeta.skipped === "number" ? activityMeta.skipped : 0;
      enriched = Math.max(0, schoolsWithPrincipal - skipped);
    } else {
      const districtsWithContacts = await prisma.contact.groupBy({
        by: ["leaid"],
        where: { leaid: { in: allLeaids } },
      });
      skipped = total - queued;
      enriched = Math.max(0, districtsWithContacts.length - skipped);
    }

    const isComplete = enriched >= queued;
    const isStalled =
      plan.enrichmentStartedAt &&
      Date.now() - plan.enrichmentStartedAt.getTime() > 10 * 60 * 1000;

    if ((isComplete || isStalled) && plan.enrichmentActivityId) {
      try {
        await prisma.activity.update({
          where: { id: plan.enrichmentActivityId },
          data: {
            status: "completed",
            metadata: { ...activityMeta, queued, skipped, enriched },
            ...(isStalled && !isComplete
              ? {
                  outcome: `Partial — enrichment stalled after ${enriched} of ${queued}`,
                  outcomeType: "neutral",
                }
              : {}),
          },
        });

        await prisma.territoryPlan.update({
          where: { id },
          data: {
            enrichmentStartedAt: null,
            enrichmentQueued: null,
            enrichmentActivityId: null,
          },
        });
      } catch (error) {
        console.error("Failed to update enrichment activity:", error);
      }
    }

    return NextResponse.json({ total, enriched, queued });
  } catch (error) {
    console.error("Error fetching enrichment progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrichment progress" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Run the existing test suite to confirm no regression**

```bash
npm test -- --run
```

Expected: all tests PASS (no new tests added here; we rely on the bulk-enrich tests plus manual smoke in Task 14).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts
git commit -m "feat(api): count schools-with-principal for Principal mode in enrich-progress"
```

---

## Task 9: Clay Webhook — Create `SchoolContact` When `ncessch` Present

**Files:**
- Modify: `src/app/api/webhooks/clay/route.ts`
- Test: `src/app/api/webhooks/clay/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/webhooks/clay/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --run src/app/api/webhooks/clay/__tests__/route.test.ts
```

Expected: the first test fails (`schoolContact.upsert` not called).

- [ ] **Step 3: Pull `ncessch` off the payload type and upsert after contact creation**

In `src/app/api/webhooks/clay/route.ts`:

(a) Add `ncessch?: string;` to both `ClayContact` (line ~38) and `ClayWebhookPayload` (line ~57):

```ts
interface ClayContact {
  // ... existing fields
  ncessch?: string;
}

interface ClayWebhookPayload {
  leaid: string;
  ncessch?: string;
  contacts?: ClayContact[];
  // ... rest of existing fields
}
```

(b) After the contact processing loop (i.e., after the `for (const contact of contacts) { ... }` block ends at line ~273 and before the final `console.log(...)` at line ~275), insert:

```ts
    // If payload is a per-school enrichment (ncessch present at root OR on any sub-contact),
    // link each created/updated Contact to the School via SchoolContact.
    const rootNcessch = payload.ncessch;
    if (rootNcessch) {
      for (const c of processedContacts) {
        await prisma.schoolContact.upsert({
          where: { schoolId_contactId: { schoolId: rootNcessch, contactId: c.id } },
          create: { schoolId: rootNcessch, contactId: c.id },
          update: {},
        });
      }
    }
```

(c) To make `processedContacts` available, change each of the 4 spots in the contact loop that either `await prisma.contact.update(...)` or `await prisma.contact.create(...)` to capture the result. Introduce `const processedContacts: { id: number }[] = [];` just above the loop (at line ~167, before `for (const contact of contacts)`), and after each update/create push `processedContacts.push({ id: existing.id })` or `processedContacts.push({ id: created.id })`. Example replacement for the create branch at lines 216–230:

```ts
          const created = await prisma.contact.create({
            data: {
              leaid,
              name,
              title,
              email,
              phone,
              linkedinUrl,
              seniorityLevel,
              persona,
              isPrimary: false,
              lastEnrichedAt: new Date(),
            },
          });
          processedContacts.push({ id: created.id });
          contactsCreated++;
```

Apply the same `processedContacts.push(...)` pattern after each of the other three `prisma.contact.update(...)` / `prisma.contact.create(...)` calls in the existing file.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- --run src/app/api/webhooks/clay/__tests__/route.test.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/clay/
git commit -m "feat(api): link principal contacts to schools via SchoolContact on webhook"
```

---

## Task 10: Extend `useBulkEnrich` Mutation with `schoolLevels`

**Files:**
- Modify: `src/features/plans/lib/queries.ts:256-272`

- [ ] **Step 1: Update the mutation signature**

Replace the `useBulkEnrich` definition (lines 256–272) with:

```ts
export function useBulkEnrich() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      targetRole,
      schoolLevels,
    }: {
      planId: string;
      targetRole: string;
      schoolLevels?: number[];
    }) =>
      fetchJson<{ total: number; skipped: number; queued: number }>(
        `${API_BASE}/territory-plans/${planId}/contacts/bulk-enrich`,
        {
          method: "POST",
          body: JSON.stringify({
            targetRole,
            ...(schoolLevels ? { schoolLevels } : {}),
          }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planContacts", variables.planId] });
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/plans/lib/queries.ts
git commit -m "feat(queries): useBulkEnrich accepts optional schoolLevels"
```

---

## Task 11: ContactsActionBar — School-Level Subfilter UI

Add the Principal branch to the popover. When `selectedRole === "Principal"`, render a School Level subsection below the dropdown. All 3 checkboxes checked by default. Start disabled when the set is empty. Pass the selected levels to `useBulkEnrich`.

**Files:**
- Modify: `src/features/plans/components/ContactsActionBar.tsx`

- [ ] **Step 1: Add school-level state**

In `ContactsActionBar.tsx`, just below the existing `const [selectedRole, setSelectedRole] = useState<TargetRole>("Superintendent");` (line 35), add:

```tsx
  // School-level subfilter (only meaningful when selectedRole === "Principal")
  // Default: all 3 levels checked (1 = Primary/Elementary, 2 = Middle, 3 = High).
  const [schoolLevels, setSchoolLevels] = useState<Set<number>>(new Set([1, 2, 3]));
```

- [ ] **Step 2: Pass `schoolLevels` to the mutation in `handleStartEnrichment`**

Inside `handleStartEnrichment` (line ~114), change the `bulkEnrich.mutateAsync` call (line ~118) from:

```tsx
      const result = await bulkEnrich.mutateAsync({ planId, targetRole: selectedRole });
```

to:

```tsx
      const result = await bulkEnrich.mutateAsync({
        planId,
        targetRole: selectedRole,
        ...(selectedRole === "Principal"
          ? { schoolLevels: Array.from(schoolLevels).sort() }
          : {}),
      });
```

Also extend the dependency array on line ~144 from `[planId, selectedRole, bulkEnrich]` to `[planId, selectedRole, schoolLevels, bulkEnrich]`.

- [ ] **Step 3: Render the subsection + fix the Start button's disabled condition**

Replace the popover contents (the `{showPopover && ( ... )}` block at lines 219–249) with:

```tsx
            {showPopover && (
              <div
                className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-[#EFEDF5] p-3 z-50"
                style={{ animation: "tooltipEnter 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
              >
                <label className="block text-[11px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
                  Target Role
                </label>
                <div className="relative mb-3">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as TargetRole)}
                    className="w-full appearance-none px-3 py-2 pr-8 text-[13px] text-[#403770] bg-[#F7F5FA] border border-[#EFEDF5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
                  >
                    {TARGET_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#403770]/40 pointer-events-none" />
                </div>

                {selectedRole === "Principal" && (
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
                      School Level
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { value: 1, label: "Primary" },
                        { value: 2, label: "Middle" },
                        { value: 3, label: "High" },
                      ].map(({ value, label }) => (
                        <label
                          key={value}
                          className="flex items-center gap-2 text-[13px] text-[#403770] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={schoolLevels.has(value)}
                            onChange={(e) => {
                              setSchoolLevels((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(value);
                                else next.delete(value);
                                return next;
                              });
                            }}
                            className="w-3.5 h-3.5 accent-[#403770]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStartEnrichment}
                  disabled={
                    bulkEnrich.isPending ||
                    (selectedRole === "Principal" && schoolLevels.size === 0)
                  }
                  className="w-full px-3 py-2 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {bulkEnrich.isPending ? "Starting..." : "Start"}
                </button>
              </div>
            )}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/plans/components/ContactsActionBar.tsx
git commit -m "feat(ui): school-level subfilter for Principal in Find Contacts popover"
```

---

## Task 12: CSV Export — One Row Per Contact + School Columns

Change the existing `handleExportCsv` from one-row-per-district to one-row-per-contact. Empty districts still produce one blank row (coverage gap signal).

**Files:**
- Modify: `src/features/plans/components/ContactsActionBar.tsx` (`handleExportCsv`, lines 146–197)

- [ ] **Step 1: Add the shared-label import**

Near the top of `ContactsActionBar.tsx` (below the existing imports), add:

```tsx
import { SCHOOL_LEVEL_LABELS, SCHOOL_TYPE_LABELS } from "@/features/shared/lib/schoolLabels";
```

- [ ] **Step 2: Replace the CSV export function**

Replace `handleExportCsv` (lines 146–197) with:

```tsx
  const handleExportCsv = useCallback(() => {
    const headers = [
      "District Name",
      "Website",
      "School Name",
      "School Level",
      "School Type",
      "Contact Name",
      "Title",
      "Email",
      "Phone",
      "Department",
      "Seniority Level",
    ];

    const rows: string[][] = [];
    const seenDistricts = new Set<string>();

    // One row per contact
    for (const contact of contacts) {
      seenDistricts.add(contact.leaid);
      const districtName = districtNameMap?.get(contact.leaid) || contact.leaid;
      const websiteUrl = districtWebsiteMap?.get(contact.leaid) || "";

      const link = contact.schoolContacts?.[0];
      const schoolName = link?.name ?? "";
      const schoolLevel =
        link?.schoolLevel != null ? (SCHOOL_LEVEL_LABELS[link.schoolLevel] ?? "") : "";
      const schoolType =
        link?.schoolType != null ? (SCHOOL_TYPE_LABELS[link.schoolType] ?? "") : "";

      rows.push([
        districtName,
        websiteUrl,
        schoolName,
        schoolLevel,
        schoolType,
        contact.name || "",
        contact.title || "",
        contact.email || "",
        contact.phone || "",
        contact.persona || "",
        contact.seniorityLevel || "",
      ]);
    }

    // Preserve coverage-gap signal: one blank row per district with zero contacts
    for (const leaid of allDistrictLeaids) {
      if (seenDistricts.has(leaid)) continue;
      const districtName = districtNameMap?.get(leaid) || leaid;
      const websiteUrl = districtWebsiteMap?.get(leaid) || "";
      rows.push([districtName, websiteUrl, "", "", "", "", "", "", "", "", ""]);
    }

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = planName.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();
    link.download = `${safeName}-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [contacts, allDistrictLeaids, districtNameMap, districtWebsiteMap, planName]);
```

(Note: the dependency array adds `districtWebsiteMap`, which was missing from the original.)

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors. (`contact.schoolContacts` is now on the `Contact` type from Task 6.)

- [ ] **Step 4: Commit**

```bash
git add src/features/plans/components/ContactsActionBar.tsx
git commit -m "feat(ui): CSV export one row per contact + school columns"
```

---

## Task 13: Component Test — Popover Behavior

**Files:**
- Test: `src/features/plans/components/__tests__/ContactsActionBar.test.tsx`

- [ ] **Step 1: Write the component test**

Create `src/features/plans/components/__tests__/ContactsActionBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContactsActionBar from "../ContactsActionBar";

const mockMutateAsync = vi.fn().mockResolvedValue({ total: 3, skipped: 0, queued: 3 });

vi.mock("@/features/plans/lib/queries", () => ({
  useBulkEnrich: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useEnrichProgress: () => ({
    data: { total: 0, enriched: 0, queued: 0 },
  }),
}));

describe("ContactsActionBar — Principal popover", () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
  });

  it("shows School Level checkboxes when Principal is selected", () => {
    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["0100001"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });

    expect(screen.getByText("School Level")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary")).toBeChecked();
    expect(screen.getByLabelText("Middle")).toBeChecked();
    expect(screen.getByLabelText("High")).toBeChecked();
  });

  it("disables Start when all school-level checkboxes are cleared", () => {
    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["0100001"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });

    fireEvent.click(screen.getByLabelText("Primary"));
    fireEvent.click(screen.getByLabelText("Middle"));
    fireEvent.click(screen.getByLabelText("High"));

    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
  });

  it("passes schoolLevels to useBulkEnrich on Start", async () => {
    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["0100001"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });
    fireEvent.click(screen.getByLabelText("Middle")); // uncheck middle
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    await vi.waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        planId: "plan-1",
        targetRole: "Principal",
        schoolLevels: [1, 3],
      });
    });
  });

  it("does not pass schoolLevels for non-Principal roles", async () => {
    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["0100001"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    // Superintendent is the default — just click Start
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    await vi.waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        planId: "plan-1",
        targetRole: "Superintendent",
      });
    });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- --run src/features/plans/components/__tests__/ContactsActionBar.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/plans/components/__tests__/ContactsActionBar.test.tsx
git commit -m "test(ui): ContactsActionBar Principal popover + school-level behavior"
```

---

## Task 14: End-to-End Smoke + PR

**Files:** none.

- [ ] **Step 1: Full test suite**

```bash
npm test -- --run
```

Expected: all tests PASS, including pre-existing suites.

- [ ] **Step 2: Typecheck the whole tree**

```bash
npx tsc --noEmit
```

Expected: no new errors introduced by this branch. Pre-existing errors (see `project_compilation_warnings.md`) are out of scope.

- [ ] **Step 3: Local smoke test**

If local dev is available (see `project_local_dev_broken.md` — fix that blocker first if needed):

```bash
npm run dev
```

Then in the browser at `http://localhost:3005`:
1. Open a territory plan that has districts with known schools.
2. Click **Find Contacts**. Confirm the popover shows the role dropdown only.
3. Pick **Principal**. Confirm the School Level subsection appears with 3 checkboxes checked.
4. Uncheck all three. Confirm Start is disabled.
5. Re-check Middle + High. Click Start. Confirm the toast appears ("Contact enrichment started for N districts/schools") and the progress bar renders.
6. If Clay is not yet wired (per Task 1), the webhook fire will succeed but no contacts return — that's expected.
7. Click the Export CSV icon. Open the file and confirm headers are `District Name | Website | School Name | School Level | School Type | Contact Name | Title | Email | Phone | Department | Seniority Level`. Districts with zero contacts should still produce one blank row.

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feat/find-contacts-principals
gh pr create --title "feat: Principal target role + per-school Clay enrichment + school-level CSV export" --body "$(cat <<'EOF'
## Summary
- Adds "Principal" to the Find Contacts Target Role dropdown with an inline School Level (Primary / Middle / High) subfilter.
- Bulk-enrich API branches on \`targetRole === "Principal"\` to fire one Clay webhook per school (filtered by \`schoolLevel\`), skipping schools already linked to a principal via \`SchoolContact\`.
- Clay webhook callback now creates a \`SchoolContact\` row whenever \`ncessch\` is present in the payload.
- CSV export changes from one-row-per-district to one-row-per-contact and adds \`School Name\`, \`School Level\`, \`School Type\` columns. Districts with zero contacts still produce one blank row for coverage-gap visibility.
- No Prisma schema changes.

## Clay workflow audit
<!-- Record Task 1 outcome here: whether Clay already supported per-school, what was edited, or whether the workflow edit is still pending. -->

## School data coverage (Task 2)
<!-- Record the SQL result: pct_level / pct_type populated. -->

## Test plan
- [ ] \`npm test -- --run\` passes
- [ ] \`npx tsc --noEmit\` clean for this branch
- [ ] Popover shows School Level section only when Principal is selected
- [ ] Start button is disabled when all school-level checkboxes are cleared
- [ ] CSV has the new header row and one row per contact
- [ ] Districts with zero contacts still emit a blank row
- [ ] Clay webhook callback with \`ncessch\` creates both \`Contact\` and \`SchoolContact\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

---

## Self-Review Checklist (already run)

- **Spec coverage:**
  - §1 UI (Principal popover + School Level checkboxes) → Task 11.
  - §2 `TARGET_ROLES` constant → Task 5.
  - §3 bulk-enrich API (schoolLevels, per-school fetch, skip-already-principal, metadata, batching) → Task 7.
  - §4 Clay callback SchoolContact upsert → Task 9.
  - §5 "already enriched" heuristic (title /principal/i) → Task 7 Step 3 (comment notes fallback).
  - §6 CSV export (one row per contact, new columns, empty-district rows) → Task 12.
  - §7 `SCHOOL_TYPE_LABELS` shared location → Task 4.
  - §8 ContactsTable verification → covered by manual smoke (Task 14 Step 3), no code change needed.
  - Data dependencies: Clay audit → Task 1, schoolType coverage → Task 2.
  - Concurrency guard still applies (spec §3 last paragraph) → Task 7 preserves it; Task 8 extends progress counting for Principal mode (implicit in spec).

- **Placeholders:** none (no TBD/TODO, no "add appropriate error handling", every code step has full code).

- **Type consistency:** `schoolLevels: number[]` consistently; `ContactSchoolLink` used in Task 6 and referenced (via `Contact.schoolContacts`) in Task 12; `schoolContact.upsert` composite key is `schoolId_contactId` (Prisma's generated name from the `@@id([schoolId, contactId])` in `prisma/schema.prisma:1110`); `SCHOOL_LEVEL_LABELS` / `SCHOOL_TYPE_LABELS` same names across tasks 4, 12.
