# District Notes Log — Phase 1 Implementation Plan (Rich-Text Log, no mentions)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text Notes column in the Saved Views districts grid with a district-scoped, rich-text note log: clicking the Notes cell opens a popover showing a chronological feed of timestamped, authored entries with a TipTap WYSIWYG composer.

**Architecture:** A new `district_notes` table (one row per entry, keyed by `district_leaid` + author) backs a CRUD API under `/api/districts/[leaid]/notes`. The grid's `/api/views/data` route enriches each district row with a latest-entry snippet + count for the cell. The cell opens a `NotesPopover` that owns its own TanStack query and a TipTap editor. Entries store the ProseMirror doc as `body_json` (source of truth) plus a flattened `body_text` (cell snippet). Mentions, clickable chips, and latest-note sort are **Phase 2** (separate plan).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + raw SQL, TanStack Query, TipTap (`@tiptap/react`), Tailwind 4, Vitest + Testing Library.

**Reference spec:** `Docs/superpowers/specs/2026-05-21-district-notes-log-design.md`

**Working directory:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar`

**Git identity (worktree has none):** prefix every commit with
`git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega ...`
and end every message with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

**Test command:** `npx vitest run <path>` (single file) / `npx vitest run` (all). Typecheck: `npx tsc --noEmit`.

---

## File Inventory

**Create:**
- `prisma/migrations/<timestamp>_district_notes/migration.sql`
- `src/app/api/districts/[leaid]/notes/route.ts` — GET (list) + POST (create)
- `src/app/api/districts/[leaid]/notes/__tests__/route.test.ts`
- `src/app/api/districts/[leaid]/notes/[noteId]/route.ts` — PATCH + DELETE
- `src/app/api/districts/[leaid]/notes/[noteId]/__tests__/route.test.ts`
- `src/app/api/views/data/district-notes-summary.ts` — per-leaid latest+count helper
- `src/app/api/views/data/__tests__/district-notes-summary.test.ts`
- `src/features/views/components/notes/NoteComposer.tsx`
- `src/features/views/components/notes/NoteBody.tsx`
- `src/features/views/components/notes/NoteEntry.tsx`
- `src/features/views/components/notes/NotesPopover.tsx`
- `src/features/views/components/notes/tiptap-extensions.ts` — shared extension list
- `src/features/views/components/notes/__tests__/NoteComposer.test.tsx`
- `src/features/views/components/notes/__tests__/NoteEntry.test.tsx`
- `src/features/views/components/notes/__tests__/NotesPopover.test.tsx`
- `src/features/views/components/grid/cells/DistrictNotesCell.tsx`
- `src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx`

**Modify:**
- `prisma/schema.prisma` — add `DistrictNote` model + back-relations on `District` and `UserProfile`
- `src/app/api/views/data/route.ts` — call the notes-summary helper, merge `notes_latest`/`notes_count` onto district rows
- `src/features/views/lib/queries.ts` — `useDistrictNotes` + 3 mutation hooks
- `src/features/views/components/grid/GridView.tsx` — dispatch `DistrictNotesCell` for `c.id === "plan_notes"` (drop `PlanNotesCell` import)
- `package.json` — add TipTap deps

**Delete (end of Phase 1):**
- `src/features/views/components/grid/cells/PlanNotesCell.tsx` + its test (superseded)

**Deferred to Phase 2 (NOT in this plan):** the four `@`/`/`/`*`/`#` mention extensions, `district_note_mentions` table, clickable chips, activities `?search=` param, and the latest-note virtual grid sort.

---

## Task 1: `DistrictNote` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma` (add model; add back-relations on `District` ~line 55 area and `UserProfile` ~line 982 area)
- Create: `prisma/migrations/<timestamp>_district_notes/migration.sql`

- [ ] **Step 1: Add the model to `schema.prisma`**

Add this model (place it near the other note model, after `ActivityNote`):

```prisma
// District-scoped rich-text note log. One row per author entry, shown as a
// chronological feed in the Saved Views grid popover. body_json is the TipTap
// ProseMirror document (source of truth); body_text is the flattened plaintext
// used for the grid cell snippet. Mentions land in Phase 2.
model DistrictNote {
  id            String   @id @default(uuid())
  districtLeaid String   @map("district_leaid") @db.VarChar(7)
  authorId      String   @map("author_id") @db.Uuid
  bodyJson      Json     @map("body_json")
  bodyText      String   @default("") @map("body_text")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  district District    @relation(fields: [districtLeaid], references: [leaid], onDelete: Cascade)
  author   UserProfile @relation("DistrictNoteAuthor", fields: [authorId], references: [id])

  @@index([districtLeaid, createdAt])
  @@index([authorId])
  @@map("district_notes")
}
```

- [ ] **Step 2: Add back-relations**

In `model District` (after the `updatedAt` field block, near line 37) add:

```prisma
  districtNotes DistrictNote[]
```

In `model UserProfile` (in the relations section, after `savedMapViews`) add:

```prisma
  authoredDistrictNotes DistrictNote[] @relation("DistrictNoteAuthor")
```

- [ ] **Step 3: Generate the migration (create-only)**

Run:
```bash
npx prisma migrate dev --name district_notes --create-only
```
Expected: a new dir `prisma/migrations/<timestamp>_district_notes/` with a `migration.sql`. Note the printed dir name.

- [ ] **Step 4: Verify the generated SQL, add the DESC index**

Open the new `migration.sql`. It should `CREATE TABLE "district_notes"` with the FKs and the two indexes. Replace the plain `(district_leaid, created_at)` index with a DESC one so newest-first listing is index-served. The file should read:

```sql
-- CreateTable
CREATE TABLE "district_notes" (
    "id" TEXT NOT NULL,
    "district_leaid" VARCHAR(7) NOT NULL,
    "author_id" UUID NOT NULL,
    "body_json" JSONB NOT NULL,
    "body_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "district_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "district_notes_district_leaid_created_at_idx" ON "district_notes" ("district_leaid", "created_at" DESC);

-- CreateIndex
CREATE INDEX "district_notes_author_id_idx" ON "district_notes" ("author_id");

-- AddForeignKey
ALTER TABLE "district_notes" ADD CONSTRAINT "district_notes_district_leaid_fkey" FOREIGN KEY ("district_leaid") REFERENCES "districts" ("leaid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_notes" ADD CONSTRAINT "district_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

(If the Prisma-generated names differ slightly, keep its names — only ensure the `created_at` index is `DESC`.)

- [ ] **Step 5: Apply the migration + regenerate the client**

Run:
```bash
npx prisma migrate dev
```
Expected: applies cleanly; "Generated Prisma Client". No errors mentioning `district_notes`.

- [ ] **Step 6: Smoke-check the table exists**

Run:
```bash
psql "$DATABASE_URL" -c "\d district_notes" 2>&1 | grep -E "body_json|district_leaid|author_id"
```
Expected: three lines naming those columns.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): add district_notes table

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: GET + POST `/api/districts/[leaid]/notes`

District-scoped + team-visible: any signed-in user may read and add. Mirrors the
`activities/[id]/notes` route minus the per-activity access gate.

**Files:**
- Create: `src/app/api/districts/[leaid]/notes/route.ts`
- Create: `src/app/api/districts/[leaid]/notes/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/districts/[leaid]/notes/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => mockGetUser(...a),
  isAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    districtNote: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;
import { GET, POST } from "../route";

const user = { id: "11111111-1111-1111-1111-111111111111", email: "rep@fm.com" };
const now = new Date("2026-05-21T12:00:00Z");

function req(url: string, body?: unknown) {
  const init: RequestInit = body
    ? { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
    : { method: "GET" };
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

const authorSel = { id: user.id, fullName: "Rep", email: "rep@fm.com", avatarUrl: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(user);
});

describe("GET /api/districts/[leaid]/notes", () => {
  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(req("http://localhost/api/districts/3601234/notes"), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns notes newest-first with author + bodyJson", async () => {
    mockPrisma.districtNote.findMany.mockResolvedValue([
      { id: "n1", bodyJson: { type: "doc" }, bodyText: "hi", createdAt: now, updatedAt: now, author: authorSel },
    ]);
    const res = await GET(req("http://localhost/api/districts/3601234/notes"), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.notes[0]).toMatchObject({ id: "n1", bodyText: "hi", author: { id: user.id } });
    expect(mockPrisma.districtNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });
});

describe("POST /api/districts/[leaid]/notes", () => {
  it("400s when bodyText is empty", async () => {
    const res = await POST(req("http://localhost/api/districts/3601234/notes", { bodyJson: { type: "doc" }, bodyText: "  " }), {
      params: Promise.resolve({ leaid: "3601234" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a note and returns it", async () => {
    mockPrisma.districtNote.create.mockResolvedValue({
      id: "n2", bodyJson: { type: "doc" }, bodyText: "called", createdAt: now, updatedAt: now, author: authorSel,
    });
    const res = await POST(
      req("http://localhost/api/districts/3601234/notes", { bodyJson: { type: "doc" }, bodyText: "called" }),
      { params: Promise.resolve({ leaid: "3601234" }) },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toMatchObject({ id: "n2", bodyText: "called" });
    expect(mockPrisma.districtNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ districtLeaid: "3601234", authorId: user.id, bodyText: "called" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npx vitest run src/app/api/districts/[leaid]/notes/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/districts/[leaid]/notes/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const AUTHOR_SELECT = { id: true, fullName: true, email: true, avatarUrl: true } as const;

function serialize(n: {
  id: string;
  bodyJson: unknown;
  bodyText: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; fullName: string | null; email: string; avatarUrl: string | null };
}) {
  return {
    id: n.id,
    bodyJson: n.bodyJson,
    bodyText: n.bodyText,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    author: n.author,
  };
}

// GET /api/districts/[leaid]/notes — newest-first feed
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notes = await prisma.districtNote.findMany({
    where: { districtLeaid: leaid },
    orderBy: { createdAt: "desc" },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return NextResponse.json({ notes: notes.map(serialize) });
}

// POST /api/districts/[leaid]/notes — append an entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const bodyText = typeof body?.bodyText === "string" ? body.bodyText.trim() : "";
  const bodyJson = body?.bodyJson;
  if (!bodyText || bodyJson == null || typeof bodyJson !== "object") {
    return NextResponse.json({ error: "bodyJson + non-empty bodyText required" }, { status: 400 });
  }

  const note = await prisma.districtNote.create({
    data: { districtLeaid: leaid, authorId: user.id, bodyJson, bodyText },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return NextResponse.json(serialize(note));
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/app/api/districts/[leaid]/notes/__tests__/route.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/districts/[leaid]/notes/route.ts" "src/app/api/districts/[leaid]/notes/__tests__/route.test.ts"
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): GET/POST district notes route

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: PATCH + DELETE `/api/districts/[leaid]/notes/[noteId]`

Author-only (or admin) edit/delete.

**Files:**
- Create: `src/app/api/districts/[leaid]/notes/[noteId]/route.ts`
- Create: `src/app/api/districts/[leaid]/notes/[noteId]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/districts/[leaid]/notes/[noteId]/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockIsAdmin = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...a: unknown[]) => mockGetUser(...a),
  isAdmin: (...a: unknown[]) => mockIsAdmin(...a),
}));
vi.mock("@/lib/prisma", () => ({
  default: { districtNote: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;
import { PATCH, DELETE } from "../route";

const user = { id: "author-1", email: "rep@fm.com" };
const now = new Date("2026-05-21T12:00:00Z");
const authorSel = { id: "author-1", fullName: "Rep", email: "rep@fm.com", avatarUrl: null };

function req(method: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body) { init.body = JSON.stringify(body); init.headers = { "Content-Type": "application/json" }; }
  return new NextRequest(new URL("http://localhost/api/districts/3601234/notes/n1"), init as never);
}
const ctx = { params: Promise.resolve({ leaid: "3601234", noteId: "n1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(user);
  mockIsAdmin.mockResolvedValue(false);
});

describe("PATCH note", () => {
  it("403s when editing another author's note", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ id: "n1", districtLeaid: "3601234", authorId: "someone-else" });
    const res = await PATCH(req("PATCH", { bodyJson: { type: "doc" }, bodyText: "x" }), ctx);
    expect(res.status).toBe(403);
  });

  it("updates own note", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ id: "n1", districtLeaid: "3601234", authorId: "author-1" });
    mockPrisma.districtNote.update.mockResolvedValue({
      id: "n1", bodyJson: { type: "doc" }, bodyText: "edited", createdAt: now, updatedAt: now, author: authorSel,
    });
    const res = await PATCH(req("PATCH", { bodyJson: { type: "doc" }, bodyText: "edited" }), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).bodyText).toBe("edited");
  });
});

describe("DELETE note", () => {
  it("404s when note missing or wrong district", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue(null);
    const res = await DELETE(req("DELETE"), ctx);
    expect(res.status).toBe(404);
  });

  it("deletes own note", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ id: "n1", districtLeaid: "3601234", authorId: "author-1" });
    mockPrisma.districtNote.delete.mockResolvedValue({});
    const res = await DELETE(req("DELETE"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npx vitest run "src/app/api/districts/[leaid]/notes/[noteId]/__tests__/route.test.ts"`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/districts/[leaid]/notes/[noteId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const AUTHOR_SELECT = { id: true, fullName: true, email: true, avatarUrl: true } as const;

// PATCH /api/districts/[leaid]/notes/[noteId] — edit own entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string; noteId: string }> },
) {
  const { leaid, noteId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.districtNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.districtLeaid !== leaid) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  if (existing.authorId !== user.id && !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const bodyText = typeof body?.bodyText === "string" ? body.bodyText.trim() : "";
  const bodyJson = body?.bodyJson;
  if (!bodyText || bodyJson == null || typeof bodyJson !== "object") {
    return NextResponse.json({ error: "bodyJson + non-empty bodyText required" }, { status: 400 });
  }

  const note = await prisma.districtNote.update({
    where: { id: noteId },
    data: { bodyJson, bodyText },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return NextResponse.json({
    id: note.id,
    bodyJson: note.bodyJson,
    bodyText: note.bodyText,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    author: note.author,
  });
}

// DELETE /api/districts/[leaid]/notes/[noteId] — delete own entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string; noteId: string }> },
) {
  const { leaid, noteId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.districtNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.districtLeaid !== leaid) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  if (existing.authorId !== user.id && !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.districtNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run "src/app/api/districts/[leaid]/notes/[noteId]/__tests__/route.test.ts"`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/districts/[leaid]/notes/[noteId]/"
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): PATCH/DELETE district note (author-only)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Notes-summary enrichment on the views/data route

Adds `notes_latest` (snippet) + `notes_count` to each district row so the cell can
render without a per-row fetch. District-scoped — runs whenever `source==="districts"`,
independent of `planId` (like the global customer-rank labels).

**Files:**
- Create: `src/app/api/views/data/district-notes-summary.ts`
- Create: `src/app/api/views/data/__tests__/district-notes-summary.test.ts`
- Modify: `src/app/api/views/data/route.ts` (the `typedSource === "districts"` enrichment block, near where global labels are merged ~line 290-320)

- [ ] **Step 1: Write the failing test for the helper**

Create `src/app/api/views/data/__tests__/district-notes-summary.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { summarizeNoteRows, type NoteSummaryRow } from "../district-notes-summary";

describe("summarizeNoteRows", () => {
  it("maps each leaid to its latest snippet + count", () => {
    const rows: NoteSummaryRow[] = [
      { district_leaid: "A", count: 3, latest_text: "newest A" },
      { district_leaid: "B", count: 1, latest_text: "only B" },
    ];
    const m = summarizeNoteRows(rows);
    expect(m.get("A")).toEqual({ latest: "newest A", count: 3 });
    expect(m.get("B")).toEqual({ latest: "only B", count: 1 });
    expect(m.get("C")).toBeUndefined();
  });

  it("coerces a bigint/string count to a number", () => {
    const m = summarizeNoteRows([{ district_leaid: "A", count: "5" as unknown as number, latest_text: "x" }]);
    expect(m.get("A")).toEqual({ latest: "x", count: 5 });
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npx vitest run src/app/api/views/data/__tests__/district-notes-summary.test.ts`
Expected: FAIL — `Cannot find module '../district-notes-summary'`.

- [ ] **Step 3: Implement the helper**

Create `src/app/api/views/data/district-notes-summary.ts`:

```typescript
/**
 * Per-district note summary for the Saved Views grid cell: latest entry snippet
 * (plaintext) + total count. District-scoped (no plan context). Runs only for
 * the leaids on the current page, so it scales with page size, not the table.
 */
import prisma from "@/lib/prisma";

export interface NoteSummaryRow {
  district_leaid: string;
  count: number;
  latest_text: string | null;
}

export interface NoteSummary {
  latest: string | null;
  count: number;
}

/** Pure: rows -> Map. Exported for unit testing without a DB. */
export function summarizeNoteRows(rows: NoteSummaryRow[]): Map<string, NoteSummary> {
  const m = new Map<string, NoteSummary>();
  for (const r of rows) {
    m.set(r.district_leaid, { latest: r.latest_text, count: Number(r.count) });
  }
  return m;
}

/** Query the latest snippet + count for the given leaids. */
export async function fetchDistrictNotesSummary(
  leaids: string[],
): Promise<Map<string, NoteSummary>> {
  if (leaids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<NoteSummaryRow[]>`
    SELECT district_leaid,
           COUNT(*)::int AS count,
           (ARRAY_AGG(body_text ORDER BY created_at DESC))[1] AS latest_text
    FROM district_notes
    WHERE district_leaid = ANY(${leaids})
    GROUP BY district_leaid
  `.catch(() => [] as NoteSummaryRow[]);
  return summarizeNoteRows(rows);
}
```

- [ ] **Step 4: Run the helper test, verify pass**

Run: `npx vitest run src/app/api/views/data/__tests__/district-notes-summary.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Wire it into the route**

In `src/app/api/views/data/route.ts`, add the import near the other enrichment imports (top of file, alongside `getGlobalCustomerLabels`):

```typescript
import { fetchDistrictNotesSummary } from "./district-notes-summary";
```

Find the `if (typedSource === "districts" && rows.length > 0) { ... }` enrichment block (where `labels`/`enrichment` are computed and merged onto rows). Inside it, after `labels` is resolved and before the `rows = rows.map(...)`, add:

```typescript
      const notesSummary = leaids.length > 0
        ? await fetchDistrictNotesSummary(leaids)
        : new Map();
```

Then inside the `rows.map((r) => { ... return { ...r, ... } })` return object, add two fields (alongside `customer_rank` / `plan_notes`):

```typescript
          notes_latest: notesSummary.get(leaid)?.latest ?? null,
          notes_count: notesSummary.get(leaid)?.count ?? 0,
```

(`leaid` is already computed in that map callback. `camelizeRow` downstream converts these to `notesLatest` / `notesCount`.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `route.ts` or `district-notes-summary.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/views/data/district-notes-summary.ts src/app/api/views/data/__tests__/district-notes-summary.test.ts src/app/api/views/data/route.ts
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): enrich district rows with latest note snippet + count

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: TanStack hooks for district notes

**Files:**
- Modify: `src/features/views/lib/queries.ts` (append at bottom; helpers `API_BASE`, `fetchJson` already imported from `@/features/shared/lib/api-client`, and `useQuery`/`useMutation`/`useQueryClient` are already imported)

- [ ] **Step 1: Write the failing test**

Create `src/features/views/lib/__tests__/district-notes-queries.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useDistrictNotes, useCreateDistrictNote } from "../queries";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => vi.restoreAllMocks());

describe("useDistrictNotes", () => {
  it("fetches the leaid's notes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ notes: [{ id: "n1", bodyText: "hi" }] }), { status: 200 }),
    ));
    const { result } = renderHook(() => useDistrictNotes("3601234"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe("n1");
    vi.unstubAllGlobals();
  });
});

describe("useCreateDistrictNote", () => {
  it("POSTs bodyJson + bodyText", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "n2", bodyText: "x" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCreateDistrictNote(), { wrapper: wrapper() });
    await result.current.mutateAsync({ leaid: "3601234", bodyJson: { type: "doc" }, bodyText: "x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/districts/3601234/notes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ bodyJson: { type: "doc" }, bodyText: "x" });
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npx vitest run src/features/views/lib/__tests__/district-notes-queries.test.tsx`
Expected: FAIL — `useDistrictNotes` / `useCreateDistrictNote` not exported.

- [ ] **Step 3: Append the hooks**

At the bottom of `src/features/views/lib/queries.ts`:

```typescript
// ── District notes log ──────────────────────────────────────────────────────

export interface DistrictNoteEntry {
  id: string;
  bodyJson: unknown;
  bodyText: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; fullName: string | null; email: string; avatarUrl: string | null };
}

export function useDistrictNotes(leaid: string | null) {
  return useQuery({
    queryKey: ["district-notes", leaid],
    queryFn: () =>
      fetchJson<{ notes: DistrictNoteEntry[] }>(`${API_BASE}/districts/${leaid}/notes`).then((r) => r.notes),
    enabled: !!leaid,
    staleTime: 30 * 1000,
  });
}

interface CreateArgs { leaid: string; bodyJson: unknown; bodyText: string }
interface UpdateArgs { leaid: string; noteId: string; bodyJson: unknown; bodyText: string }
interface DeleteArgs { leaid: string; noteId: string }

/** Invalidate the leaid's note list AND the grid data (cell snippet/count). */
function invalidateNotes(qc: ReturnType<typeof useQueryClient>, leaid: string) {
  qc.invalidateQueries({ queryKey: ["district-notes", leaid] });
  qc.invalidateQueries({ queryKey: ["views", "data"] });
}

export function useCreateDistrictNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leaid, bodyJson, bodyText }: CreateArgs) =>
      fetchJson<DistrictNoteEntry>(`${API_BASE}/districts/${leaid}/notes`, {
        method: "POST",
        body: JSON.stringify({ bodyJson, bodyText }),
      }),
    onSuccess: (_d, v) => invalidateNotes(qc, v.leaid),
  });
}

export function useUpdateDistrictNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leaid, noteId, bodyJson, bodyText }: UpdateArgs) =>
      fetchJson<DistrictNoteEntry>(`${API_BASE}/districts/${leaid}/notes/${noteId}`, {
        method: "PATCH",
        body: JSON.stringify({ bodyJson, bodyText }),
      }),
    onSuccess: (_d, v) => invalidateNotes(qc, v.leaid),
  });
}

export function useDeleteDistrictNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leaid, noteId }: DeleteArgs) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/districts/${leaid}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => invalidateNotes(qc, v.leaid),
  });
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/features/views/lib/__tests__/district-notes-queries.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/lib/queries.ts src/features/views/lib/__tests__/district-notes-queries.test.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): TanStack hooks for district notes CRUD

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: TipTap deps + shared extensions + `NoteComposer`

**Files:**
- Modify: `package.json`
- Create: `src/features/views/components/notes/tiptap-extensions.ts`
- Create: `src/features/views/components/notes/NoteComposer.tsx`
- Create: `src/features/views/components/notes/__tests__/NoteComposer.test.tsx`

- [ ] **Step 1: Install TipTap**

Run:
```bash
npm install @tiptap/react@^2 @tiptap/pm@^2 @tiptap/starter-kit@^2 @tiptap/extension-link@^2
```
Expected: four packages added to `package.json` dependencies; lockfile updates; no peer-dep errors against React 19.

- [ ] **Step 2: Create the shared extension list**

Create `src/features/views/components/notes/tiptap-extensions.ts`:

```typescript
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { Extensions } from "@tiptap/react";

/**
 * Shared TipTap extension set for the note composer + read-only renderer.
 * Phase 1: bold / italic / lists / links. Link only accepts http(s)/mailto so
 * the read-only render is safe without a separate sanitizer. Mention extensions
 * arrive in Phase 2 (we'll also disable the `#`/`*` input rules then).
 */
export const noteExtensions: Extensions = [
  StarterKit.configure({
    heading: false,
    horizontalRule: false,
    codeBlock: false,
    blockquote: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    protocols: ["http", "https", "mailto"],
    HTMLAttributes: { rel: "noopener noreferrer nofollow", class: "text-[#403770] underline" },
  }),
];
```

- [ ] **Step 3: Write the failing composer test**

Create `src/features/views/components/notes/__tests__/NoteComposer.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ProseMirror doesn't run in jsdom, so we mock @tiptap/react with a controllable
// fake editor to test the composer's submit/disable wiring deterministically.
// `h.empty` flips the editor's empty state between tests.
const h = vi.hoisted(() => ({ empty: true }));
const chainStub = {
  focus: () => chainStub,
  toggleBold: () => chainStub,
  toggleItalic: () => chainStub,
  toggleBulletList: () => chainStub,
  toggleOrderedList: () => chainStub,
  setLink: () => chainStub,
  run: () => {},
};
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    isEmpty: h.empty,
    isActive: () => false,
    chain: () => chainStub,
    getJSON: () => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "called the front office" }] }] }),
    getText: () => "called the front office",
    commands: { clearContent: () => {} },
  }),
  EditorContent: () => null,
}));

import { NoteComposer } from "../NoteComposer";

beforeEach(() => { h.empty = true; });

describe("NoteComposer", () => {
  it("renders a toolbar and disables Add while empty", () => {
    h.empty = true;
    render(<NoteComposer onSubmit={vi.fn()} pending={false} />);
    expect(screen.getByLabelText(/bold/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add note/i })).toBeDisabled();
  });

  it("calls onSubmit with bodyJson + bodyText once non-empty", () => {
    h.empty = false;
    const onSubmit = vi.fn();
    render(<NoteComposer onSubmit={onSubmit} pending={false} />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      bodyJson: expect.objectContaining({ type: "doc" }),
      bodyText: "called the front office",
    });
  });
});
```

> Note: the real rich-text round-trip (actually typing, formatting, and serializing a ProseMirror doc) cannot be exercised in jsdom — it is covered by the manual smoke in Task 11. These unit tests verify the component's wiring (toolbar present, Add disabled when empty, `onSubmit` receives `getJSON()`/`getText()`).

- [ ] **Step 4: Run it, verify failure**

Run: `npx vitest run src/features/views/components/notes/__tests__/NoteComposer.test.tsx`
Expected: FAIL — `Cannot find module '../NoteComposer'`.

- [ ] **Step 5: Implement the composer**

Create `src/features/views/components/notes/NoteComposer.tsx`:

```typescript
"use client";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Bold, Italic, List, ListOrdered, Link2 } from "lucide-react";
import { noteExtensions } from "./tiptap-extensions";

export interface NoteDraft {
  bodyJson: unknown;
  bodyText: string;
}

interface Props {
  onSubmit: (draft: NoteDraft) => void;
  pending: boolean;
  /** Optional initial doc when editing an existing entry. */
  initialContent?: unknown;
  submitLabel?: string;
}

function ToolbarButton({
  editor, label, active, onClick, children,
}: {
  editor: Editor | null; label: string; active: boolean;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={!editor}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`w-7 h-7 inline-flex items-center justify-center rounded-md text-[#544A78] hover:bg-[#F7F5FA] ${
        active ? "bg-[#EFEDF5] text-[#403770]" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function NoteComposer({ onSubmit, pending, initialContent, submitLabel = "Add note" }: Props) {
  const editor = useEditor({
    extensions: noteExtensions,
    content: initialContent ?? "",
    editorProps: {
      attributes: {
        class: "min-h-[88px] px-3 py-2.5 text-sm leading-relaxed text-[#403770] focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  const isEmpty = !editor || editor.isEmpty;

  function submit() {
    if (!editor || editor.isEmpty) return;
    onSubmit({ bodyJson: editor.getJSON(), bodyText: editor.getText().trim() });
    editor.commands.clearContent();
  }

  function setLink() {
    if (!editor) return;
    const url = window.prompt("Link URL");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="rounded-[10px] border border-[#D4CFE2] bg-white overflow-hidden focus-within:border-[#403770]">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#E2DEEC] bg-[#FBFAFE]">
        <ToolbarButton editor={editor} label="Bold" active={!!editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton editor={editor} label="Italic" active={!!editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton editor={editor} label="Bullet list" active={!!editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton editor={editor} label="Numbered list" active={!!editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton editor={editor} label="Link" active={!!editor?.isActive("link")}
          onClick={setLink}><Link2 className="w-3.5 h-3.5" /></ToolbarButton>
      </div>

      <div
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
        }}
      >
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between px-2.5 py-2 border-t border-[#E2DEEC] bg-[#FFFCFA]">
        <span className="text-[10px] text-[#A69DC0] font-medium">⌘↵ to save</span>
        <button
          type="button"
          onClick={submit}
          disabled={isEmpty || pending}
          className="px-3 py-1 text-xs font-semibold text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests, verify pass**

Run: `npx vitest run src/features/views/components/notes/__tests__/NoteComposer.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/views/components/notes/tiptap-extensions.ts src/features/views/components/notes/NoteComposer.tsx src/features/views/components/notes/__tests__/NoteComposer.test.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): TipTap rich-text NoteComposer + shared extensions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `NoteBody` read-only renderer

Renders a stored `body_json` doc read-only via TipTap (no `dangerouslySetInnerHTML`).

**Files:**
- Create: `src/features/views/components/notes/NoteBody.tsx`

- [ ] **Step 1: Implement the renderer**

Create `src/features/views/components/notes/NoteBody.tsx`:

```typescript
"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "./tiptap-extensions";

/**
 * Read-only render of a stored TipTap doc. Mounts a non-editable editor so the
 * exact same extension set (and future mention node-views) renders identically
 * to the composer, with no HTML injection. Bounded by popover pagination.
 */
export function NoteBody({ doc }: { doc: unknown }) {
  const editor = useEditor({
    extensions: noteExtensions,
    content: (doc as object) ?? "",
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-sm text-[#544A78] leading-relaxed [&_a]:text-[#403770] [&_a]:underline" },
    },
  });
  return <EditorContent editor={editor} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors mentioning `NoteBody.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/features/views/components/notes/NoteBody.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): read-only TipTap NoteBody renderer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `NoteEntry` — one feed item

Author avatar + name + relative time + "edited" marker + body; author-only
delete (edit handled inline in Phase 1 via delete+re-add to keep scope tight —
inline edit-in-place is a Phase 2 nicety; we expose only delete here).

**Files:**
- Create: `src/features/views/components/notes/NoteEntry.tsx`
- Create: `src/features/views/components/notes/__tests__/NoteEntry.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/views/components/notes/__tests__/NoteEntry.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteEntry } from "../NoteEntry";
import type { DistrictNoteEntry } from "../../../lib/queries";

const base: DistrictNoteEntry = {
  id: "n1",
  bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] },
  bodyText: "hello",
  createdAt: "2026-05-21T12:00:00Z",
  updatedAt: "2026-05-21T12:00:00Z",
  author: { id: "me", fullName: "Sierra A.", email: "s@fm.com", avatarUrl: null },
};

describe("NoteEntry", () => {
  it("shows author name and an edited marker only when updatedAt > createdAt", () => {
    const { rerender } = render(<NoteEntry note={base} currentUserId="me" onDelete={vi.fn()} />);
    expect(screen.getByText("Sierra A.")).toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).toBeNull();
    rerender(<NoteEntry note={{ ...base, updatedAt: "2026-05-21T13:00:00Z" }} currentUserId="me" onDelete={vi.fn()} />);
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it("shows delete only for the author and fires onDelete", () => {
    const onDelete = vi.fn();
    const { rerender } = render(<NoteEntry note={base} currentUserId="someone-else" onDelete={onDelete} />);
    expect(screen.queryByRole("button", { name: /delete note/i })).toBeNull();
    rerender(<NoteEntry note={base} currentUserId="me" onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete note/i }));
    expect(onDelete).toHaveBeenCalledWith("n1");
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npx vitest run src/features/views/components/notes/__tests__/NoteEntry.test.tsx`
Expected: FAIL — `Cannot find module '../NoteEntry'`.

- [ ] **Step 3: Implement**

Create `src/features/views/components/notes/NoteEntry.tsx`:

```typescript
"use client";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { NoteBody } from "./NoteBody";
import type { DistrictNoteEntry } from "../../../lib/queries";

interface Props {
  note: DistrictNoteEntry;
  currentUserId: string | null;
  onDelete: (noteId: string) => void;
}

export function NoteEntry({ note, currentUserId, onDelete }: Props) {
  const mine = currentUserId != null && note.author.id === currentUserId;
  const edited = new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 1000;
  const initial = (note.author.fullName || note.author.email).slice(0, 1).toUpperCase();

  return (
    <article className="p-3 rounded-[10px] border border-[#E2DEEC] bg-[#FFFCFA] group">
      <div className="flex items-center gap-2 text-[11px] text-[#8A80A8] mb-1.5">
        <span aria-hidden className="w-[22px] h-[22px] rounded-full bg-[#403770] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
          {initial}
        </span>
        <span className="font-semibold text-[#403770] whitespace-nowrap">{note.author.fullName || note.author.email}</span>
        <span className="whitespace-nowrap">· {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}</span>
        {edited && <span className="whitespace-nowrap italic">· edited</span>}
        {mine && (
          <button
            type="button"
            aria-label="Delete note"
            onClick={() => onDelete(note.id)}
            className="ml-auto opacity-0 group-hover:opacity-100 text-[#A69DC0] hover:text-[#F37167] transition-opacity"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <NoteBody doc={note.bodyJson} />
    </article>
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/features/views/components/notes/__tests__/NoteEntry.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/notes/NoteEntry.tsx src/features/views/components/notes/__tests__/NoteEntry.test.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): NoteEntry feed item with author + edited marker + delete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `NotesPopover` — composer + feed

Owns the `useDistrictNotes` query; composer on top, newest-first feed below.

**Files:**
- Create: `src/features/views/components/notes/NotesPopover.tsx`
- Create: `src/features/views/components/notes/__tests__/NotesPopover.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/views/components/notes/__tests__/NotesPopover.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock TipTap so the embedded NoteComposer/NoteBody don't depend on ProseMirror
// in jsdom. We assert on NoteEntry's own DOM (author, header, empty state),
// which renders outside the editor.
const chainStub = {
  focus: () => chainStub, toggleBold: () => chainStub, toggleItalic: () => chainStub,
  toggleBulletList: () => chainStub, toggleOrderedList: () => chainStub, setLink: () => chainStub, run: () => {},
};
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({ isEmpty: true, isActive: () => false, chain: () => chainStub, getJSON: () => ({}), getText: () => "", commands: { clearContent: () => {} } }),
  EditorContent: () => null,
}));
vi.mock("@/lib/api", () => ({ useProfile: () => ({ data: { id: "me" } }) }));

import { NotesPopover } from "../NotesPopover";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.restoreAllMocks());

describe("NotesPopover", () => {
  it("loads and lists the district's notes (author + header)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      notes: [{
        id: "n1", bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "newest" }] }] },
        bodyText: "newest", createdAt: "2026-05-21T13:00:00Z", updatedAt: "2026-05-21T13:00:00Z",
        author: { id: "me", fullName: "Sierra", email: "s@fm.com", avatarUrl: null },
      }],
    }), { status: 200 })));
    wrap(<NotesPopover leaid="3601234" districtName="Lincoln Elem SD" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Sierra")).toBeInTheDocument());
    expect(screen.getByText(/Lincoln Elem SD · Notes/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("renders an empty state when there are no notes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ notes: [] }), { status: 200 })));
    wrap(<NotesPopover leaid="3601234" districtName="Lincoln Elem SD" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no notes yet/i)).toBeInTheDocument());
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npx vitest run src/features/views/components/notes/__tests__/NotesPopover.test.tsx`
Expected: FAIL — `Cannot find module '../NotesPopover'`.

- [ ] **Step 3: Implement**

Create `src/features/views/components/notes/NotesPopover.tsx`:

```typescript
"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useProfile } from "@/lib/api";
import {
  useDistrictNotes,
  useCreateDistrictNote,
  useDeleteDistrictNote,
} from "../../../lib/queries";
import { NoteComposer, type NoteDraft } from "./NoteComposer";
import { NoteEntry } from "./NoteEntry";

interface Props {
  leaid: string;
  districtName: string;
  onClose: () => void;
}

export function NotesPopover({ leaid, districtName, onClose }: Props) {
  const { data: profile } = useProfile();
  const { data: notes = [], isLoading } = useDistrictNotes(leaid);
  const create = useCreateDistrictNote();
  const remove = useDeleteDistrictNote();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function submit(draft: NoteDraft) {
    create.mutate({ leaid, bodyJson: draft.bodyJson, bodyText: draft.bodyText });
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Notes for ${districtName}`}
      className="w-[480px] max-w-[92vw] rounded-[14px] border border-[#D4CFE2] bg-white shadow-[0_16px_40px_rgba(64,55,112,0.22)] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#E2DEEC]">
        <span className="text-[12px] font-bold text-[#403770] uppercase tracking-[0.04em] whitespace-nowrap truncate">
          {districtName} · Notes {notes.length > 0 ? `(${notes.length})` : ""}
        </span>
        <button type="button" aria-label="Close" onClick={onClose} className="text-[#A69DC0] hover:text-[#403770]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3.5">
        <NoteComposer onSubmit={submit} pending={create.isPending} />
      </div>

      <div className="px-3.5 pb-3.5 flex flex-col gap-2.5 max-h-[300px] overflow-auto" style={{ touchAction: "pan-y" }}>
        {isLoading ? (
          <div className="text-xs text-[#A69DC0]">Loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="text-xs text-[#A69DC0] italic">No notes yet — add the first one above.</div>
        ) : (
          notes.map((n) => (
            <NoteEntry
              key={n.id}
              note={n}
              currentUserId={profile?.id ?? null}
              onDelete={(noteId) => remove.mutate({ leaid, noteId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/features/views/components/notes/__tests__/NotesPopover.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/notes/NotesPopover.tsx src/features/views/components/notes/__tests__/NotesPopover.test.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): NotesPopover (composer + newest-first feed)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `DistrictNotesCell` + grid dispatch swap

**Files:**
- Create: `src/features/views/components/grid/cells/DistrictNotesCell.tsx`
- Create: `src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx`
- Modify: `src/features/views/components/grid/GridView.tsx` (imports ~line 28; dispatch block ~line 259-266)

- [ ] **Step 1: Write the failing cell test**

Create `src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock TipTap (popover embeds the editor) and useProfile so clicking the cell
// can mount NotesPopover in jsdom without ProseMirror or a real session.
const chainStub = {
  focus: () => chainStub, toggleBold: () => chainStub, toggleItalic: () => chainStub,
  toggleBulletList: () => chainStub, toggleOrderedList: () => chainStub, setLink: () => chainStub, run: () => {},
};
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({ isEmpty: true, isActive: () => false, chain: () => chainStub, getJSON: () => ({}), getText: () => "", commands: { clearContent: () => {} } }),
  EditorContent: () => null,
}));
vi.mock("@/lib/api", () => ({ useProfile: () => ({ data: { id: "me" } }) }));

import { DistrictNotesCell } from "../DistrictNotesCell";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ notes: [] }), { status: 200 })));
});

describe("DistrictNotesCell", () => {
  it("shows '+ Add note' when empty", () => {
    wrap(<DistrictNotesCell leaid="3601234" districtName="Lincoln" latest={null} count={0} />);
    expect(screen.getByText(/add note/i)).toBeInTheDocument();
  });

  it("shows snippet + count badge when notes exist", () => {
    wrap(<DistrictNotesCell leaid="3601234" districtName="Lincoln" latest="Sent renewal proposal" count={3} />);
    expect(screen.getByText(/Sent renewal proposal/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("opens the popover on click", () => {
    wrap(<DistrictNotesCell leaid="3601234" districtName="Lincoln" latest="hi" count={1} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /notes/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it, verify failure**

Run: `npx vitest run src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx`
Expected: FAIL — `Cannot find module '../DistrictNotesCell'`.

- [ ] **Step 3: Implement the cell**

Create `src/features/views/components/grid/cells/DistrictNotesCell.tsx`:

```typescript
"use client";
import { useState } from "react";
import { NotesPopover } from "../../notes/NotesPopover";

interface Props {
  leaid: string;
  districtName: string;
  latest: string | null;
  count: number;
}

export function DistrictNotesCell({ leaid, districtName, latest, count }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notes${count ? ` (${count})` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 max-w-[260px] text-left rounded focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
      >
        {latest ? (
          <>
            <span className="text-sm text-[#544A78] truncate whitespace-nowrap">{latest}</span>
            <span className="flex-shrink-0 bg-[#EFEBF7] text-[#6F4C8C] text-[11px] font-bold px-[7px] rounded-full">{count}</span>
          </>
        ) : (
          <span className="text-sm text-[#A69DC0] whitespace-nowrap">+ Add note</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50">
          <NotesPopover leaid={leaid} districtName={districtName} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Swap the dispatch in `GridView.tsx`**

Change the import (line ~28): remove
```typescript
import { PlanNotesCell } from "./cells/PlanNotesCell";
```
and add
```typescript
import { DistrictNotesCell } from "./cells/DistrictNotesCell";
```

Replace the existing `plan_notes` dispatch block (lines ~259-266):
```typescript
        if (c.id === "plan_notes" && leaid) {
          return (
            <PlanNotesCell
              value={typeof v === "string" ? v : null}
              planId={planId}
              leaid={leaid}
              disabled={planId == null}
            />
          );
        }
```
with:
```typescript
        if (c.id === "plan_notes" && leaid) {
          return (
            <DistrictNotesCell
              leaid={leaid}
              districtName={typeof row.name === "string" ? row.name : leaid}
              latest={typeof row.notesLatest === "string" ? row.notesLatest : null}
              count={typeof row.notesCount === "number" ? row.notesCount : 0}
            />
          );
        }
```

(The `plan_notes` ColumnDef in `columns.ts` is unchanged — id/header "Notes" stay; it is now district-scoped. `row.notesLatest` / `row.notesCount` come from Task 4. `row.name` is the district name already on the row.)

- [ ] **Step 5: Run the cell test + typecheck**

Run:
```bash
npx vitest run src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx
npx tsc --noEmit
```
Expected: cell tests PASS (3); no type errors mentioning `GridView.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/features/views/components/grid/cells/DistrictNotesCell.tsx src/features/views/components/grid/cells/__tests__/DistrictNotesCell.test.tsx src/features/views/components/grid/GridView.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): DistrictNotesCell + grid dispatch swap

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Mobile bottom-sheet, delete legacy cell, full verification

**Files:**
- Modify: `src/features/views/components/notes/NotesPopover.tsx` (responsive shell)
- Delete: `src/features/views/components/grid/cells/PlanNotesCell.tsx` + `src/features/views/components/grid/cells/__tests__/PlanNotesCell.test.tsx`

- [ ] **Step 1: Make the popover a bottom sheet under 640px**

In `NotesPopover.tsx`, change the root container `className` so it docks to the
bottom on narrow viewports while staying a floating card on desktop. Replace the
root `<div ref={ref} ... className="w-[480px] ...">` className with:

```
"w-[480px] max-w-[92vw] rounded-[14px] border border-[#D4CFE2] bg-white shadow-[0_16px_40px_rgba(64,55,112,0.22)] overflow-hidden max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-[16px]"
```

(No `overflow:hidden` is added to `html`/`body`; the feed already uses
`touch-action: pan-y`. Per CLAUDE.md mobile rules.)

- [ ] **Step 2: Delete the superseded PlanNotesCell**

Run:
```bash
git rm src/features/views/components/grid/cells/PlanNotesCell.tsx src/features/views/components/grid/cells/__tests__/PlanNotesCell.test.tsx
```
Expected: both files removed. (Task 10 already removed the only import.)

- [ ] **Step 3: Confirm nothing else references PlanNotesCell**

Run:
```bash
grep -rn "PlanNotesCell" src || echo "clean — no references"
```
Expected: `clean — no references`.

- [ ] **Step 4: Full test suite + typecheck + build**

Run:
```bash
npx vitest run
npx tsc --noEmit
npm run build
```
Expected: vitest all green (the pre-existing ~28 typecheck warnings in `features/rfps/__tests__` and `lib/__tests__/states.test.ts` noted in the worktree handoff are not introduced here — ignore those only); `tsc` clean; build succeeds.

- [ ] **Step 5: Manual smoke test (dev server on :3005)**

With `npx next dev -p 3005` running and logged in:
1. Open a plan's Table view: `http://localhost:3005/views/plans/<planId>/table` (or any districts grid).
2. The Notes column shows "+ Add note" on empty districts.
3. Click a Notes cell → popover opens. Type **bold** (⌘B) + a bullet list, click **Add note**.
4. Entry appears newest-first with your name + "just now"; the cell now shows the snippet + a `1` badge.
5. Add a second note → badge reads `2`, newest is on top.
6. Hover your entry → trash icon; delete it → it disappears and the badge decrements.
7. Open the same district from a *different* plan's grid → the same notes are there (district-scoped).
8. Narrow the window < 640px (or Responsive Design Mode) → popover docks as a bottom sheet and the feed scrolls.

- [ ] **Step 6: Commit**

```bash
git add -A
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "feat(notes): mobile bottom-sheet + remove legacy PlanNotesCell

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1 Done — Definition of Done

- Notes column opens a popover with a TipTap rich-text composer and a newest-first
  feed of authored, timestamped entries.
- Notes are district-scoped (same log across every plan the district is in).
- Authors can delete their own entries; "edited" marker shows on edited entries.
- Cell shows latest snippet + count; empty shows "+ Add note".
- All new tests green; `tsc` clean; build passes; mobile bottom-sheet verified.

## Deferred to Phase 2 (separate plan)

- `@`/`/`/`*`/`#` mention extensions + typeahead + `district_note_mentions` table +
  clickable chips + activities `?search=` param.
- Disabling the `#`/`*` markdown input rules (only needed once they're triggers).
- Inline edit-in-place of an existing entry (Phase 1 ships delete-only).
- Latest-note **grid sort** (the `__notes_cte` + `buildOrderBy` virtual-field work).
