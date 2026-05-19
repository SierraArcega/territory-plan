# Report Draft Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Autosave report builder sessions to the database after each AI turn, then restore them on return — silently if within 8 hours, via a banner if older — with draft rows visible in the library and 30-day expiry via cron.

**Architecture:** The existing `report_drafts` table is migrated to a composite PK `(user_id, report_id)` where `report_id = 0` is the sentinel for a fresh/unsaved session. A new `/api/reports/draft` endpoint handles CRUD. `ReportsBuilder` upserts after each turn and reads on mount to decide whether to auto-restore or show a banner. `ReportsTab` shows a library-level banner and a navigate-away toast. `LibraryRow` renders draft rows with expiry countdown styling.

**Tech Stack:** Next.js 15 App Router, Prisma/PostgreSQL, TanStack Query v5, React 19, Tailwind 4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-19-report-draft-recovery-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/migrations/20260519_report_drafts_composite_pk/migration.sql` | Create | Alter table: drop PK, add report_id col, new composite PK |
| `prisma/schema.prisma` | Modify | Update `ReportDraft` model + `UserProfile.reportDraft` relation |
| `src/app/api/reports/draft/route.ts` | Create | GET + PUT + DELETE for draft CRUD |
| `src/app/api/reports/draft/__tests__/route.test.ts` | Create | Tests for draft API |
| `src/app/api/cron/expire-report-drafts/route.ts` | Create | Daily cron to delete 30-day-old drafts |
| `src/app/api/cron/expire-report-drafts/__tests__/route.test.ts` | Create | Tests for expire cron |
| `src/app/api/reports/route.ts` | Modify | GET: left-join drafts into `mine` array |
| `src/app/api/reports/__tests__/route.test.ts` | Modify | Add draft-inclusion test |
| `vercel.json` | Modify | Add expire-report-drafts cron schedule |
| `src/features/reports/lib/queries.ts` | Modify | Add 3 hooks + extend `ReportListItem` type |
| `src/features/reports/components/builder/ReportsBuilder.tsx` | Modify | Autosave effect, beforeunload, delete-on-save, recovery flow |
| `src/features/reports/components/ReportsTab.tsx` | Modify | Navigate-away toast, library banner, id=0 onOpen handling |
| `src/features/reports/components/library/LibraryRow.tsx` | Modify | Draft row rendering with DRAFT badge + expiry countdown |
| `src/features/reports/components/library/LibraryList.tsx` | Modify | Sort draft rows to top of Mine list |

---

## Task 1: Schema migration — composite PK on report_drafts

**Files:**
- Create: `prisma/migrations/20260519_report_drafts_composite_pk/migration.sql`
- Modify: `prisma/schema.prisma` (lines ~938, ~1793–1804)

- [ ] **Step 1: Write the migration SQL**

Create file `prisma/migrations/20260519_report_drafts_composite_pk/migration.sql`:

```sql
-- Replace user_id-only PK with composite (user_id, report_id).
-- report_id = 0 is the sentinel for a fresh/unsaved session (no FK — see spec).
-- Existing rows (if any) keep report_id = 0 via the DEFAULT.

ALTER TABLE "report_drafts" DROP CONSTRAINT "report_drafts_pkey";

ALTER TABLE "report_drafts"
  ADD COLUMN "report_id" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "report_drafts"
  ADD CONSTRAINT "report_drafts_pkey" PRIMARY KEY ("user_id", "report_id");
```

- [ ] **Step 2: Update `prisma/schema.prisma`**

Find the `UserProfile` model (around line 938) and change the relation field from:
```prisma
reportDraft         ReportDraft?                @relation("UserReportDraft")
```
to:
```prisma
reportDrafts        ReportDraft[]               @relation("UserReportDraft")
```

Find the `ReportDraft` model (around line 1793) and replace the entire block:
```prisma
model ReportDraft {
  userId         String   @id @map("user_id") @db.Uuid
  params         Json
  conversationId String?  @map("conversation_id") @db.Uuid
  chatHistory    Json?    @map("chat_history")
  lastTouchedAt  DateTime @updatedAt @map("last_touched_at")
  createdAt      DateTime @default(now()) @map("created_at")

  user UserProfile @relation("UserReportDraft", fields: [userId], references: [id], onDelete: Cascade)

  @@map("report_drafts")
}
```
with:
```prisma
model ReportDraft {
  userId         String   @map("user_id") @db.Uuid
  reportId       Int      @default(0) @map("report_id")
  params         Json
  conversationId String?  @map("conversation_id") @db.Uuid
  chatHistory    Json?    @map("chat_history")
  lastTouchedAt  DateTime @updatedAt @map("last_touched_at")
  createdAt      DateTime @default(now()) @map("created_at")

  user UserProfile @relation("UserReportDraft", fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, reportId])
  @@map("report_drafts")
}
```

- [ ] **Step 3: Apply migration and regenerate Prisma client**

```bash
npx prisma migrate dev --name report_drafts_composite_pk
npx prisma generate
```

Expected: migration applied, client regenerated with no errors.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/20260519_report_drafts_composite_pk/migration.sql prisma/schema.prisma
git commit -m "feat(reports): migrate report_drafts to composite PK (user_id, report_id)"
```

---

## Task 2: Draft API route — GET + PUT + DELETE (TDD)

**Files:**
- Create: `src/app/api/reports/draft/__tests__/route.test.ts`
- Create: `src/app/api/reports/draft/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/reports/draft/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUserMock = vi.hoisted(() => vi.fn(async () => ({ id: "user-1" })));
const upsertMock = vi.hoisted(() => vi.fn());
const findUniqueMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ getUser: getUserMock }));
vi.mock("@/lib/prisma", () => ({
  default: {
    reportDraft: {
      upsert: upsertMock,
      findUnique: findUniqueMock,
      delete: deleteMock,
    },
  },
}));

import { GET, PUT, DELETE } from "../route";

function makeReq(method: string, body?: object, search?: string): NextRequest {
  const url = new URL(`http://localhost/api/reports/draft${search ?? ""}`);
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  upsertMock.mockReset();
  findUniqueMock.mockReset();
  deleteMock.mockReset();
  getUserMock.mockResolvedValue({ id: "user-1" });
});

describe("GET /api/reports/draft", () => {
  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue(null);
    const res = await GET(makeReq("GET", undefined, "?reportId=0"));
    expect(res.status).toBe(401);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns null draft when none exists", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await GET(makeReq("GET", undefined, "?reportId=0"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ draft: null });
  });

  it("returns draft when found", async () => {
    const draft = {
      userId: "user-1",
      reportId: 0,
      params: { sql: "SELECT 1" },
      conversationId: null,
      chatHistory: [],
      lastTouchedAt: new Date("2026-05-19T10:00:00Z"),
      createdAt: new Date("2026-05-19T09:00:00Z"),
    };
    findUniqueMock.mockResolvedValue(draft);
    const res = await GET(makeReq("GET", undefined, "?reportId=0"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.draft).toMatchObject({
      userId: "user-1",
      reportId: 0,
      lastTouchedAt: "2026-05-19T10:00:00.000Z",
    });
  });
});

describe("PUT /api/reports/draft", () => {
  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue(null);
    const res = await PUT(
      makeReq("PUT", { reportId: 0, params: {}, chatHistory: [] }),
    );
    expect(res.status).toBe(401);
  });

  it("upserts and returns 200", async () => {
    upsertMock.mockResolvedValue({ userId: "user-1", reportId: 0 });
    const res = await PUT(
      makeReq("PUT", {
        reportId: 0,
        params: { sql: "SELECT 1", summary: {}, columns: [], rows: [], rowCount: 0, executionTimeMs: 100, n: 1, createdAt: 0 },
        conversationId: "conv-abc",
        chatHistory: [{ id: "t1", userMessage: "show me districts" }],
      }),
    );
    expect(res.status).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_reportId: { userId: "user-1", reportId: 0 } },
        create: expect.objectContaining({ userId: "user-1", reportId: 0 }),
        update: expect.objectContaining({ conversationId: "conv-abc" }),
      }),
    );
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });
});

describe("DELETE /api/reports/draft", () => {
  it("returns 401 when unauthenticated", async () => {
    getUserMock.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE", undefined, "?reportId=0"));
    expect(res.status).toBe(401);
  });

  it("deletes the draft and returns 200", async () => {
    deleteMock.mockResolvedValue({});
    const res = await DELETE(makeReq("DELETE", undefined, "?reportId=0"));
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith({
      where: { userId_reportId: { userId: "user-1", reportId: 0 } },
    });
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("returns 200 even if draft did not exist (idempotent)", async () => {
    deleteMock.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "P2025" }),
    );
    const res = await DELETE(makeReq("DELETE", undefined, "?reportId=0"));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (route file doesn't exist yet)**

```bash
npx vitest run src/app/api/reports/draft/__tests__/route.test.ts
```

Expected: fails with "Cannot find module '../route'".

- [ ] **Step 3: Implement the draft route**

Create `src/app/api/reports/draft/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reportId = Number(request.nextUrl.searchParams.get("reportId") ?? "0");

  const draft = await prisma.reportDraft.findUnique({
    where: { userId_reportId: { userId: user.id, reportId } },
  });

  if (!draft) return NextResponse.json({ draft: null });

  return NextResponse.json({
    draft: {
      ...draft,
      lastTouchedAt: draft.lastTouchedAt.toISOString(),
      createdAt: draft.createdAt.toISOString(),
    },
  });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    reportId: number;
    params: object;
    conversationId?: string | null;
    chatHistory: unknown[];
  };

  await prisma.reportDraft.upsert({
    where: { userId_reportId: { userId: user.id, reportId: body.reportId } },
    create: {
      userId: user.id,
      reportId: body.reportId,
      params: body.params,
      conversationId: body.conversationId ?? null,
      chatHistory: body.chatHistory as object[],
    },
    update: {
      params: body.params,
      conversationId: body.conversationId ?? null,
      chatHistory: body.chatHistory as object[],
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reportId = Number(request.nextUrl.searchParams.get("reportId") ?? "0");

  try {
    await prisma.reportDraft.delete({
      where: { userId_reportId: { userId: user.id, reportId } },
    });
  } catch (e) {
    // P2025 = record not found — deletion is idempotent
    if ((e as { code?: string }).code !== "P2025") throw e;
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/app/api/reports/draft/__tests__/route.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reports/draft/route.ts src/app/api/reports/draft/__tests__/route.test.ts
git commit -m "feat(reports): add /api/reports/draft CRUD route"
```

---

## Task 3: Expire-drafts cron route (TDD) + vercel.json

**Files:**
- Create: `src/app/api/cron/expire-report-drafts/__tests__/route.test.ts`
- Create: `src/app/api/cron/expire-report-drafts/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write the failing tests**

Create `src/app/api/cron/expire-report-drafts/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const deleteManyMock = vi.hoisted(() => vi.fn(async () => ({ count: 0 })));

vi.mock("@/lib/prisma", () => ({
  default: {
    reportDraft: { deleteMany: deleteManyMock },
  },
}));

import { GET } from "../route";

function req(secret?: string): NextRequest {
  const url = new URL("http://localhost/api/cron/expire-report-drafts");
  if (secret) url.searchParams.set("secret", secret);
  return new NextRequest(url);
}

beforeEach(() => {
  deleteManyMock.mockReset();
  deleteManyMock.mockResolvedValue({ count: 0 });
  process.env.CRON_SECRET = "shh";
});

describe("GET /api/cron/expire-report-drafts", () => {
  it("returns 401 when secret is wrong", async () => {
    const res = await GET(req("bad"));
    expect(res.status).toBe(401);
    expect(deleteManyMock).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET env is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("shh"));
    expect(res.status).toBe(401);
  });

  it("deletes drafts older than 30 days and returns count", async () => {
    deleteManyMock.mockResolvedValue({ count: 3 });
    const res = await GET(req("shh"));
    expect(res.status).toBe(200);
    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        lastTouchedAt: { lt: expect.any(Date) },
      },
    });
    const json = await res.json();
    expect(json).toMatchObject({ deleted: 3 });
  });

  it("passes a cutoff date 30 days in the past", async () => {
    await GET(req("shh"));
    const [call] = deleteManyMock.mock.calls;
    const cutoff: Date = call[0].where.lastTouchedAt.lt;
    const diffDays = (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(29.9);
    expect(diffDays).toBeLessThan(30.1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/app/api/cron/expire-report-drafts/__tests__/route.test.ts
```

Expected: fails with "Cannot find module '../route'".

- [ ] **Step 3: Implement the cron route**

Create `src/app/api/cron/expire-report-drafts/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    searchParams.get("secret");

  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { count } = await prisma.reportDraft.deleteMany({
    where: { lastTouchedAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: count });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/app/api/cron/expire-report-drafts/__tests__/route.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Add cron entry to vercel.json**

In `vercel.json`, add to the `"crons"` array:
```json
{
  "path": "/api/cron/expire-report-drafts?secret=${CRON_SECRET}",
  "schedule": "0 3 * * *"
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/expire-report-drafts/route.ts \
        src/app/api/cron/expire-report-drafts/__tests__/route.test.ts \
        vercel.json
git commit -m "feat(reports): add expire-report-drafts cron (30-day retention)"
```

---

## Task 4: Include draft rows in GET /api/reports (TDD)

**Files:**
- Modify: `src/app/api/reports/route.ts`
- Modify: `src/app/api/reports/__tests__/route.test.ts`

- [ ] **Step 1: Add mocks for reportDraft to the existing test file**

In `src/app/api/reports/__tests__/route.test.ts`, add `reportDraftFindManyMock` alongside the existing mocks. Find the `vi.mock("@/lib/prisma"...)` block and extend it:

```ts
// Add at top with other hoisted mocks:
const reportDraftFindManyMock = vi.hoisted(() => vi.fn(async () => []));

// In the vi.mock("@/lib/prisma") block, add reportDraft:
vi.mock("@/lib/prisma", () => ({
  default: {
    savedReport: {
      findMany: findManyMock,
      create: createMock,
      findUnique: findUniqueMock,
      update: updateMock,
      delete: deleteMock,
    },
    userProfile: { findUnique: userProfileFindUniqueMock },
    reportDraft: { findMany: reportDraftFindManyMock },   // <-- add this
  },
}));
```

Also add to `beforeEach`:
```ts
reportDraftFindManyMock.mockReset();
reportDraftFindManyMock.mockResolvedValue([]);
```

- [ ] **Step 2: Add a test for draft row inclusion**

Add this test to the `GET /api/reports` describe block in the same file:

```ts
it("includes draft rows with isDraft=true at start of mine array", async () => {
  // findMany for saved reports returns one mine report
  findManyMock.mockResolvedValue([
    {
      id: 1,
      title: "Saved report",
      description: null,
      question: "q1",
      lastRunAt: null,
      runCount: 0,
      rowCount: null,
      isTeamPinned: false,
      updatedAt: new Date("2026-05-01T00:00:00Z"),
      userId: "user-1",
      user: { id: "user-1", fullName: "Me", avatarUrl: null },
    },
  ]);

  // A fresh-session draft (reportId=0)
  reportDraftFindManyMock.mockResolvedValue([
    {
      userId: "user-1",
      reportId: 0,
      params: {},
      conversationId: null,
      chatHistory: [{ userMessage: "show me open vacancies" }],
      lastTouchedAt: new Date("2026-05-18T08:00:00Z"),
      createdAt: new Date("2026-05-18T07:00:00Z"),
    },
  ]);

  const { GET } = await import("../route");
  const res = await GET();
  const json = await res.json();

  expect(json.mine[0]).toMatchObject({
    id: 0,
    isDraft: true,
    title: "show me open vacancies",
    lastTouchedAt: "2026-05-18T08:00:00.000Z",
  });
  expect(json.mine[1]).toMatchObject({ id: 1, isDraft: undefined });
});
```

- [ ] **Step 3: Run the new test — expect FAIL**

```bash
npx vitest run src/app/api/reports/__tests__/route.test.ts -t "includes draft rows"
```

Expected: test fails because the GET handler doesn't query reportDraft yet.

- [ ] **Step 4: Update the GET handler in `src/app/api/reports/route.ts`**

First, extend the `ReportListItem` interface (near the top of the file):

```ts
interface ReportListItem {
  id: number;
  title: string;
  description: string | null;
  question: string;
  lastRunAt: string | null;
  runCount: number;
  rowCount: number | null;
  isTeamPinned: boolean;
  updatedAt: string;
  owner: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  isDraft?: true;
  lastTouchedAt?: string;
}
```

Then, in the `GET` function body, after the `prisma.savedReport.findMany(...)` call and before building the lists, add:

```ts
const drafts = await prisma.reportDraft.findMany({
  where: { userId: user.id },
  orderBy: { lastTouchedAt: "desc" },
});

const draftItems: ReportListItem[] = drafts.map((d) => {
  const history = (d.chatHistory as { userMessage?: string }[] | null) ?? [];
  const firstMessage = history[0]?.userMessage;
  return {
    id: d.reportId,
    title: firstMessage ? firstMessage.slice(0, 80) : "Unsaved report",
    description: null,
    question: firstMessage ?? "",
    lastRunAt: null,
    runCount: 0,
    rowCount: null,
    isTeamPinned: false,
    updatedAt: d.lastTouchedAt.toISOString(),
    owner: null,
    isDraft: true,
    lastTouchedAt: d.lastTouchedAt.toISOString(),
  };
});
```

Then change the final return statement to prepend draft items to `mine`:

```ts
return NextResponse.json({ mine: [...draftItems, ...mine], starred, team });
```

- [ ] **Step 5: Run all reports route tests — expect PASS**

```bash
npx vitest run src/app/api/reports/__tests__/route.test.ts
```

Expected: all tests pass including the new draft inclusion test.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/reports/route.ts src/app/api/reports/__tests__/route.test.ts
git commit -m "feat(reports): include draft rows in GET /api/reports mine list"
```

---

## Task 5: TanStack Query hooks + type update

**Files:**
- Modify: `src/features/reports/lib/queries.ts`

- [ ] **Step 1: Extend `ReportListItem` with draft fields**

In `src/features/reports/lib/queries.ts`, update the `ReportListItem` interface (around line 4):

```ts
export interface ReportListItem {
  id: number;
  title: string;
  description: string | null;
  question: string;
  lastRunAt: string | null;
  runCount: number;
  rowCount: number | null;
  isTeamPinned: boolean;
  updatedAt: string;
  owner: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  } | null;
  isDraft?: true;
  lastTouchedAt?: string;
}
```

- [ ] **Step 2: Add draft response type and 3 new hooks**

Add after the existing `useDeleteReport` function (after line ~70):

```ts
export interface ReportDraft {
  userId: string;
  reportId: number;
  params: unknown;
  conversationId: string | null;
  chatHistory: unknown[] | null;
  lastTouchedAt: string;
  createdAt: string;
}

const DRAFT_KEY = (reportId: number) => ["report-draft", reportId] as const;

export function useReportDraft(reportId: number) {
  return useQuery<ReportDraft | null>({
    queryKey: DRAFT_KEY(reportId),
    queryFn: async () => {
      const res = await fetch(`/api/reports/draft?reportId=${reportId}`);
      if (!res.ok) throw new Error("Failed to load draft");
      const json = (await res.json()) as { draft: ReportDraft | null };
      return json.draft;
    },
    staleTime: 60_000,
  });
}

export function useUpsertReportDraft() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    {
      reportId: number;
      params: object;
      conversationId?: string | null;
      chatHistory: object[];
    }
  >({
    mutationFn: async (body) => {
      const res = await fetch("/api/reports/draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save draft");
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: DRAFT_KEY(vars.reportId) });
      qc.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
  });
}

export function useDeleteReportDraft() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (reportId) => {
      const res = await fetch(`/api/reports/draft?reportId=${reportId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete draft");
    },
    onSuccess: (_, reportId) => {
      qc.invalidateQueries({ queryKey: DRAFT_KEY(reportId) });
      qc.invalidateQueries({ queryKey: LIBRARY_KEY });
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/reports/lib/queries.ts
git commit -m "feat(reports): add useReportDraft/useUpsertReportDraft/useDeleteReportDraft hooks"
```

---

## Task 6: Autosave + delete-on-save in ReportsBuilder

**Files:**
- Modify: `src/features/reports/components/builder/ReportsBuilder.tsx`

- [ ] **Step 1: Import the new hooks**

Add `useUpsertReportDraft` and `useDeleteReportDraft` to the import from `../../lib/queries`:

```ts
import {
  useCreateSavedReport,
  useDeleteReport,
  useUpdateReportDetails,
  useUpdateReportSql,
  useUpsertReportDraft,
  useDeleteReportDraft,
} from "../../lib/queries";
```

- [ ] **Step 2: Instantiate hooks in the component body**

After the existing `const deleteReport = useDeleteReport();` line, add:

```ts
const upsertDraft = useUpsertReportDraft();
const deleteDraft = useDeleteReportDraft();
```

- [ ] **Step 3: Add the autosave effect**

Add this effect after the existing `useEffect` for the toast auto-clear (around line 83):

```ts
// Autosave: upsert draft after each completed turn that produced a version.
// Turns take seconds to complete, so this never fires back-to-back.
useEffect(() => {
  const lastTurn = turns[turns.length - 1];
  if (!lastTurn || lastTurn.inFlight || !lastTurn.version) return;
  upsertDraft.mutate({
    reportId: reportId ?? 0,
    params: lastTurn.version as unknown as object,
    conversationId: conversationId ?? null,
    chatHistory: turns as unknown as object[],
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [turns]);
```

- [ ] **Step 4: Add the beforeunload last-chance flush**

Add this effect directly after the autosave effect:

```ts
// Last-chance flush when the tab closes. sendBeacon fires after unload and
// doesn't need a response — safe to fire-and-forget.
useEffect(() => {
  const handleUnload = () => {
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn || lastTurn.inFlight || !lastTurn.version) return;
    const payload = JSON.stringify({
      reportId: reportId ?? 0,
      params: lastTurn.version,
      conversationId: conversationId ?? null,
      chatHistory: turns,
    });
    navigator.sendBeacon(
      "/api/reports/draft",
      new Blob([payload], { type: "application/json" }),
    );
  };
  window.addEventListener("beforeunload", handleUnload);
  return () => window.removeEventListener("beforeunload", handleUnload);
}, [turns, reportId, conversationId]);
```

- [ ] **Step 5: Delete draft after each save succeeds**

Find `handleSaveNew` (the `createReport.mutate(...)` call) and add `deleteDraft.mutate(reportId ?? 0)` inside `onSuccess`:

```ts
onSuccess: (data) => {
  deleteDraft.mutate(reportId ?? 0);   // <-- add this line
  setToast("Report saved");
  if (data.report?.id != null) onAfterSaveNew?.(data.report.id);
},
```

Find `handleUpdateSavedReport` (the `updateReportSql.mutate(...)` call) and add the delete in `onSuccess`:

```ts
{ onSuccess: () => {
    deleteDraft.mutate(reportId ?? 0);  // <-- add this line
    setToast("Report updated");
  }
}
```

Find `handleEditDetails` (the `updateReportDetails.mutate(...)` call). This is a title/description-only update — the draft should be kept (the SQL hasn't changed), so do **not** add delete here.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/reports/components/builder/ReportsBuilder.tsx
git commit -m "feat(reports): autosave draft after each turn, delete on save"
```

---

## Task 7: Recovery flow in ReportsBuilder

**Files:**
- Modify: `src/features/reports/components/builder/ReportsBuilder.tsx`

- [ ] **Step 1: Import `useReportDraft`**

Add `useReportDraft` to the import line updated in Task 6:

```ts
import {
  useCreateSavedReport,
  useDeleteReport,
  useUpdateReportDetails,
  useUpdateReportSql,
  useUpsertReportDraft,
  useDeleteReportDraft,
  useReportDraft,
} from "../../lib/queries";
```

- [ ] **Step 2: Add recovery state and query**

After the `const [loadError, setLoadError] = useState<string | null>(null);` line, add:

```ts
// Recovery states:
//   'idle'       — draft query still loading
//   'none'       — no draft found
//   'restored'   — auto-restored silently (< 8h); show brief chip
//   'banner'     — stale draft (≥ 8h); show in-builder banner
//   'dismissed'  — user dismissed the banner
const [recoveryState, setRecoveryState] = useState<
  "idle" | "none" | "restored" | "banner" | "dismissed"
>("idle");

const draftQuery = useReportDraft(reportId ?? 0);
const alreadyRecoveredRef = useRef(false);
```

- [ ] **Step 3: Add the recovery effect**

Add this effect after the `autoSubmittedRef` effect (around line 280):

```ts
// Recovery: once draft loads, decide auto-restore vs. banner.
// Guard with alreadyRecoveredRef so StrictMode double-invoke is safe.
useEffect(() => {
  if (alreadyRecoveredRef.current) return;
  if (draftQuery.isLoading) return;
  if (!draftQuery.data) {
    setRecoveryState("none");
    return;
  }

  const draft = draftQuery.data;
  const ageMs = Date.now() - new Date(draft.lastTouchedAt).getTime();
  const EIGHT_HOURS = 8 * 60 * 60 * 1000;

  alreadyRecoveredRef.current = true;

  if (ageMs < EIGHT_HOURS) {
    // Silently restore turns from chatHistory
    const history = (draft.chatHistory as BuilderTurn[] | null) ?? [];
    if (history.length > 0) {
      setTurns(history);
      const lastVersion = history.findLast((t) => t.version != null)?.version;
      if (lastVersion) setLocalSelectedN(lastVersion.n);
    }
    deleteDraft.mutate(reportId ?? 0);
    setRecoveryState("restored");
    // Auto-hide the "restored" chip after 3 seconds
    window.setTimeout(() => setRecoveryState("none"), 3000);
  } else {
    setRecoveryState("banner");
  }
}, [draftQuery.isLoading, draftQuery.data]);
```

- [ ] **Step 4: Add the restore / start-fresh handlers**

Add these two handlers after `handleEditDetails`:

```ts
const handleRestoreDraft = useCallback(() => {
  const draft = draftQuery.data;
  if (!draft) return;
  const history = (draft.chatHistory as BuilderTurn[] | null) ?? [];
  if (history.length > 0) {
    setTurns(history);
    const lastVersion = history.findLast((t) => t.version != null)?.version;
    if (lastVersion) setLocalSelectedN(lastVersion.n);
  }
  deleteDraft.mutate(reportId ?? 0);
  setRecoveryState("none");
}, [draftQuery.data, deleteDraft, reportId]);

const handleDiscardDraft = useCallback(() => {
  deleteDraft.mutate(reportId ?? 0);
  setRecoveryState("dismissed");
}, [deleteDraft, reportId]);
```

- [ ] **Step 5: Add the banner and chip JSX**

In the component's return JSX, find the top of the `<ResultsPane>` section (around where the component renders the main split layout) and add the in-builder banner immediately above it. Also add a "Draft restored" chip in the `<BuilderChat>` children or the chat rail section.

Below is the in-builder restore banner — add it as the first child inside the results-column `div` (the same div that contains `<ResultsPane>`):

```tsx
{recoveryState === "banner" && (
  <div className="mx-3 mb-2 flex items-center justify-between rounded-lg border border-[#C4B5FD] bg-[#EDE7F6] px-3.5 py-2.5 text-[12.5px]">
    <span className="text-[#5B21B6]">
      <span className="font-semibold">You have unsaved work</span>
      <span className="ml-1.5 text-[#7C3AED]">
        from {relativeAge(draftQuery.data?.lastTouchedAt ?? "")}
      </span>
    </span>
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleDiscardDraft}
        className="rounded-md border border-[#C4B5FD] bg-white px-2.5 py-1 text-[11.5px] text-[#5B21B6] hover:bg-[#F7F5FA]"
      >
        Discard
      </button>
      <button
        type="button"
        onClick={handleRestoreDraft}
        className="rounded-md bg-[#3D1D72] px-2.5 py-1 text-[11.5px] text-white hover:bg-[#2D1562]"
      >
        Restore
      </button>
    </div>
  </div>
)}
```

Add the "Draft restored" chip in the `<BuilderChat>` component or at the bottom of the chat rail. Pass `showRestoredChip={recoveryState === "restored"}` as a prop to `BuilderChat`, or render it as an overlay inside the chat column div:

```tsx
{recoveryState === "restored" && (
  <div className="mx-3 mb-2 rounded-md border border-[#A5D6A7] bg-[#E8F5E9] px-3 py-1.5 text-[11.5px] text-[#2E7D32]">
    ✓ Draft restored
  </div>
)}
```

- [ ] **Step 6: Add the `relativeAge` helper**

Add this helper function at the module level (outside the component, near the top of the file):

```ts
function relativeAge(iso: string): string {
  if (!iso) return "recently";
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} minutes ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hours ago`;
  return `${Math.round(diffSec / 86400)} days ago`;
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/reports/components/builder/ReportsBuilder.tsx
git commit -m "feat(reports): recovery flow — auto-restore <8h, banner ≥8h"
```

---

## Task 8: Navigate-away toast + library banner in ReportsTab

**Files:**
- Modify: `src/features/reports/components/ReportsTab.tsx`

- [ ] **Step 1: Add imports**

Add `useEffect`, `useRef` to the React import (they may already be there). Add `useReportDraft` and `useDeleteReportDraft` to the imports:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useReportDraft, useDeleteReportDraft } from "../lib/queries";
```

- [ ] **Step 2: Add state and hooks inside `ReportsTab`**

After the `const [newReportNonce, setNewReportNonce] = useState(0);` line, add:

```ts
const [navAwayToast, setNavAwayToast] = useState(false);
const prevViewRef = useRef<string | null>(null);
const draftQuery = useReportDraft(0); // only track fresh-session drafts for library banner
const deleteDraft = useDeleteReportDraft();
```

- [ ] **Step 3: Add the navigate-away toast effect**

Add this effect after the `updateParams` callback:

```ts
// Show "Draft saved" toast when user leaves the builder and a fresh draft exists.
useEffect(() => {
  const current = view ?? null;
  const previous = prevViewRef.current;
  prevViewRef.current = current;

  if (previous === "builder" && current !== "builder" && draftQuery.data) {
    setNavAwayToast(true);
    const t = window.setTimeout(() => setNavAwayToast(false), 4000);
    return () => window.clearTimeout(t);
  }
}, [view, draftQuery.data]);
```

- [ ] **Step 4: Update `onOpenReport` to handle id=0**

Find the `onOpenReport` prop passed to `<ReportsLibrary>` and change:

```ts
onOpenReport={(id) => goToBuilder({ report: String(id) })}
```

to:

```ts
onOpenReport={(id) => {
  if (id === 0) goToBuilder();          // fresh-session draft: no report param
  else goToBuilder({ report: String(id) });
}}
```

- [ ] **Step 5: Add the library banner and toast JSX**

In the `return` block for the library view (currently `return <ReportsLibrary ... />`), wrap it:

```tsx
return (
  <div className="relative flex flex-col">
    {/* Navigate-away toast */}
    {navAwayToast && (
      <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-xl bg-[#1E1033] px-4 py-3 text-[13px] text-white shadow-lg">
        <span className="text-base">✏️</span>
        <div>
          <div className="font-semibold">Draft saved</div>
          <div className="text-[11.5px] text-[#C4B5FD]">
            Resume anytime from the Reports tab
          </div>
        </div>
      </div>
    )}

    {/* Library banner — stale fresh-session draft */}
    {draftQuery.data &&
      Date.now() - new Date(draftQuery.data.lastTouchedAt).getTime() >= 8 * 60 * 60 * 1000 && (
        <div className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-[#C4B5FD] bg-[#EDE7F6] px-3.5 py-2.5 text-[12.5px]">
          <span className="text-[#5B21B6]">
            <span className="font-semibold">✏️ You have an unsaved draft</span>
            <span className="ml-2 text-[#7C3AED]">
              {draftQuery.data.lastTouchedAt
                ? relativeAgeShort(draftQuery.data.lastTouchedAt)
                : ""}
            </span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => deleteDraft.mutate(0)}
              className="rounded-md border border-[#C4B5FD] bg-white px-2.5 py-1 text-[11.5px] text-[#5B21B6] hover:bg-[#F7F5FA]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => goToBuilder()}
              className="rounded-md bg-[#3D1D72] px-2.5 py-1 text-[11.5px] text-white hover:bg-[#2D1562]"
            >
              Resume →
            </button>
          </div>
        </div>
      )}

    <ReportsLibrary
      initialTab={initialLibraryTab}
      onTabChange={handleLibraryTabChange}
      onOpenReport={(id) => {
        if (id === 0) goToBuilder();
        else goToBuilder({ report: String(id) });
      }}
      onNewReport={(prompt) => {
        const extras: Record<string, string> = {};
        if (prompt) extras.prompt = prompt;
        goToBuilder(extras);
      }}
    />
  </div>
);
```

- [ ] **Step 6: Add `relativeAgeShort` helper at module level**

```ts
function relativeAgeShort(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/reports/components/ReportsTab.tsx
git commit -m "feat(reports): navigate-away toast and library resume banner"
```

---

## Task 9: Draft row UI in LibraryRow

**Files:**
- Modify: `src/features/reports/components/library/LibraryRow.tsx`

- [ ] **Step 1: Add the expiry helpers at module level**

Add after the existing `relativeTime` function:

```ts
function daysUntilExpiry(lastTouchedAt: string): number {
  const msRemaining =
    new Date(lastTouchedAt).getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now();
  return Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
}

function expiryStyle(daysLeft: number): {
  border: string;
  bg: string;
  badgeColor: string;
  label: string | null;
} {
  if (daysLeft > 7) {
    return {
      border: "1.5px dashed #B39DDB",
      bg: "#FAF8FF",
      badgeColor: "",
      label: null,
    };
  }
  if (daysLeft > 1) {
    return {
      border: "1.5px dashed #F59E0B",
      bg: "#FFFBEB",
      badgeColor: "bg-[#FEF3C7] text-[#92400E]",
      label: `⚠ expires in ${daysLeft} days`,
    };
  }
  return {
    border: "1.5px dashed #EF4444",
    bg: "#FFF5F5",
    badgeColor: "bg-[#FEE2E2] text-[#991B1B]",
    label: "⚠ expires tomorrow",
  };
}
```

- [ ] **Step 2: Add the draft row rendering branch**

In the `LibraryRow` component, add an early return for draft rows before the main `return` statement:

```tsx
if (report.isDraft) {
  const daysLeft = daysUntilExpiry(report.lastTouchedAt ?? report.updatedAt);
  const style = expiryStyle(daysLeft);
  return (
    <div
      onClick={() => onOpen(report.id)}
      className="flex cursor-pointer items-center gap-3.5 px-4 py-3.5 transition-colors duration-100"
      style={{ border: style.border, background: style.bg, borderRadius: 8, margin: "2px 0" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[#403770]">
            {report.title}
          </span>
          <span className="shrink-0 rounded-full bg-[#EDE7F6] px-2 py-0.5 text-[10px] font-semibold text-[#6B21A8]">
            DRAFT
          </span>
          {style.label && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badgeColor}`}>
              {style.label}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11.5px] text-[#8A80A8]">
          {style.label
            ? "Save or resume before it's gone"
            : `Unsaved · ${relativeTime(report.lastTouchedAt ?? null)} · expires in ${daysLeft} days`}
        </div>
      </div>
      <span className="shrink-0 text-[11.5px] font-semibold text-[#7C3AED]">
        Resume →
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/reports/components/library/LibraryRow.tsx
git commit -m "feat(reports): draft row styling with DRAFT badge and expiry countdown"
```

---

## Task 10: Sort draft rows to top of LibraryList

**Files:**
- Modify: `src/features/reports/components/library/LibraryList.tsx`

- [ ] **Step 1: Sort draft rows before saved rows in the filtered list**

In `LibraryList`, update the `filtered` useMemo to sort drafts to the top:

```ts
const filtered = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();
  const result = q ? rows.filter((r) => r.title.toLowerCase().includes(q)) : rows;
  // Draft rows always appear above saved reports
  return [...result].sort((a, b) => {
    if (a.isDraft && !b.isDraft) return -1;
    if (!a.isDraft && b.isDraft) return 1;
    return 0;
  });
}, [rows, searchQuery]);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/reports/components/library/LibraryList.tsx
git commit -m "feat(reports): sort draft rows to top of Mine list"
```

---

## Smoke Test Checklist

After completing all tasks, verify the feature end-to-end:

- [ ] Open the Reports tab → builder → type a prompt and wait for a turn to complete
- [ ] Navigate away to the Map tab — confirm the "Draft saved" toast appears for ~4 seconds
- [ ] Return to Reports → library — confirm the draft row appears with DRAFT badge in the Mine tab
- [ ] Confirm the draft row shows the first user message as title and "expires in 30 days"
- [ ] Click Resume on the draft row — confirm the builder restores the turn history
- [ ] Save the report — confirm the DRAFT row disappears from the library
- [ ] Start a new report, run a turn, then close and reopen the tab within 8 hours — confirm silent auto-restore with "✓ Draft restored" chip
- [ ] In the database, confirm `report_drafts` table has `(user_id, report_id)` as PK
