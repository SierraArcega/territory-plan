# Sea Monkey SP7 — Dropbox Sign Test Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-controlled Dropbox Sign Test Mode toggle (Admin → Integrations card) whose value is injected into every doc-gen send, plus a rep-facing test-mode callout on the "Send for signature" review stage.

**Architecture:** New generic `app_settings` key-value table is the source of truth (one key: `dropbox_sign_test_mode`; missing row = test mode ON). The send route reads it and injects `test_mode: '1'|'0'` into the Apps Script renderer payload; `Code.gs` prefers the payload value and falls back to the script property (one-time change, deploy @12). Admin card writes via a new allowlisted `PATCH /api/admin/settings`; the form reads via a new `GET /api/document-generation/settings`.

**Tech Stack:** Next.js 16 App Router, Prisma, TanStack Query, Vitest + Testing Library, Apps Script via clasp.

**Spec:** `Docs/superpowers/specs/2026-06-12-sea-monkey-sp7-test-mode-toggle-design.md`

---

## Setup (orchestrator, before any task)

- [ ] From the main checkout: `git checkout main && git pull origin main`
- [ ] `git worktree add .worktrees/feat-sea-monkey-sp7 -b feat/sea-monkey-sp7 main`
- [ ] Merge the docs branch so spec+plan ride along: `cd .worktrees/feat-sea-monkey-sp7 && git merge docs/sea-monkey-sp7-spec`
- [ ] Symlink gitignored files into the worktree:
  ```bash
  MAIN="/Users/astonfurious/The Laboratory/territory-plan"
  WT="$MAIN/.worktrees/feat-sea-monkey-sp7"
  for f in .env .env.local; do [ -f "$MAIN/$f" ] && ln -sf "$MAIN/$f" "$WT/$f"; done
  ln -sf "$MAIN/scripts/document-generation/appsscript/.clasp.json" "$WT/scripts/document-generation/appsscript/.clasp.json"
  ```
- [ ] Verify branch before dispatching ANY implementer: `git -C "$WT" branch --show-current` → must print `feat/sea-monkey-sp7`

## File structure (what gets created/modified)

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | `AppSetting` model + `UserProfile` back-relation |
| `prisma/migrations/20260612000000_app_settings/migration.sql` | DDL (hand-written, applied via `prisma db execute` — ledger drift blocks `migrate deploy`) |
| `src/features/shared/lib/app-setting-keys.ts` (new) | Client-safe key constants (no server imports) |
| `src/features/shared/lib/app-settings.ts` (new) | Server-only accessors: `getAppSetting`, `getDropboxSignTestMode`, `setAppSetting`, pure `dropboxSignTestModeFromValue` |
| `src/lib/district-column-metadata.ts` | Add `app_settings` to `excludedTables` (schema-coverage test enforces) |
| `src/app/api/admin/settings/route.ts` (new) | Allowlisted PATCH, admin-gated |
| `src/app/api/document-generation/settings/route.ts` (new) | `{ testMode }` GET, any authed user |
| `src/app/api/document-generation/send/route.ts` | Read setting → pass to `sendForSignature` |
| `src/features/document-generation/lib/render-apps-script.ts` | `sendForSignature(payload, { testMode })` injects `test_mode` |
| `src/app/api/admin/integrations/route.ts` | Third entry: Dropbox Sign card data |
| `src/features/admin/hooks/useAdminIntegrations.ts` | Interface fields + `useUpdateAppSetting` mutation |
| `src/features/admin/lib/relative-time.ts` (new) | `relativeTime` extracted from IntegrationsTab (now needed in two files) |
| `src/features/admin/components/DropboxSignCard.tsx` (new) | Interactive card: pill, switch, confirm-on-Live, meta line |
| `src/features/admin/components/IntegrationsTab.tsx` | Route `dropbox-sign` slug to the new card; import shared `relativeTime` |
| `src/features/document-generation/lib/queries.ts` | `useDocGenSettings()` hook |
| `src/features/document-generation/components/GenerateDocumentModal.tsx` | Mount hook, pass `testMode` |
| `src/features/document-generation/components/review/ReviewStage.tsx` | Amber callout + button ring/tag |
| `scripts/document-generation/appsscript/Code.gs` | Prefer `payload.test_mode`, fall back to property |

---

### Task 1: Prisma schema, migration file, registry exclusion

**Files:**
- Modify: `prisma/schema.prisma` (AppSetting model + UserProfile back-relation)
- Create: `prisma/migrations/20260612000000_app_settings/migration.sql`
- Modify: `src/lib/district-column-metadata.ts` (~line 3834, `excludedTables` array)

No vitest for the schema itself; the schema-coverage test in `src/lib/__tests__/district-column-metadata.test.ts` is the failing/passing signal for the registry exclusion.

- [ ] **Step 1: Add the model to `prisma/schema.prisma`.** Place it near the end, after the Leads models block, with this exact content:

```prisma
// ===== App Settings =====
// Generic admin-editable key-value settings (SP7). One key so far:
// 'dropbox_sign_test_mode' (JSON boolean; missing row = test mode ON).
model AppSetting {
  key         String       @id @db.VarChar(100)
  value       Json
  updatedAt   DateTime     @updatedAt @map("updated_at")
  updatedById String?      @map("updated_by_id") @db.Uuid
  updatedBy   UserProfile? @relation("AppSettingUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull)

  @@map("app_settings")
}
```

- [ ] **Step 2: Add the back-relation inside `model UserProfile`** (relation list around `prisma/schema.prisma:1055-1092`, after `assignedLeads`):

```prisma
  appSettingUpdates   AppSetting[]                @relation("AppSettingUpdatedBy")
```

- [ ] **Step 3: Create `prisma/migrations/20260612000000_app_settings/migration.sql`:**

```sql
-- App settings: generic admin-editable key-value store (SP7).
-- First key: 'dropbox_sign_test_mode' (JSON boolean; missing row = test mode ON).
CREATE TABLE "app_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Do NOT run `prisma migrate deploy` or `prisma db execute` in this task — the live-DB DDL is applied by the orchestrator in Task 9 (prod ledger drift means `db execute`, and there's no local sandbox DB).

- [ ] **Step 4: Regenerate the Prisma client:** `npx prisma generate` — expected: completes without error; `prisma.appSetting` now exists in types. (If phantom "Property appSetting does not exist on PrismaClient" errors appear later: re-run `prisma generate` and `rm -rf .next`.)

- [ ] **Step 5: Run the schema-coverage test to see the new failure:**
Run: `npx vitest run src/lib/__tests__/district-column-metadata.test.ts`
Expected: FAIL mentioning `app_settings` not in registry/excluded (pre-existing failures for other foreign tables may also appear — only `app_settings` is yours to fix).

- [ ] **Step 6: Add `"app_settings"` to `SEMANTIC_CONTEXT.excludedTables`** in `src/lib/district-column-metadata.ts` (alphabetical position in the existing list, after `"activity_notes"`):

```ts
    "app_settings",
```

- [ ] **Step 7: Re-run the coverage test:** `npx vitest run src/lib/__tests__/district-column-metadata.test.ts`
Expected: the `app_settings` complaint is gone (any failures that also exist on main are out of scope — verify by `git stash && npx vitest run <same>` if unsure).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260612000000_app_settings/migration.sql src/lib/district-column-metadata.ts
git commit -m "feat(settings): app_settings table + AppSetting model (SP7)"
```

---

### Task 2: Settings accessor lib

**Files:**
- Create: `src/features/shared/lib/app-setting-keys.ts`
- Create: `src/features/shared/lib/app-settings.ts`
- Test: `src/features/shared/lib/__tests__/app-settings.test.ts`

- [ ] **Step 1: Write the failing test** at `src/features/shared/lib/__tests__/app-settings.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindUnique, mockUpsert } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: { appSetting: { findUnique: mockFindUnique, upsert: mockUpsert } },
}));

import {
  DROPBOX_SIGN_TEST_MODE_KEY,
  dropboxSignTestModeFromValue,
  getDropboxSignTestMode,
  setAppSetting,
} from "../app-settings";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dropboxSignTestModeFromValue", () => {
  it("returns the value for explicit booleans", () => {
    expect(dropboxSignTestModeFromValue(false)).toBe(false);
    expect(dropboxSignTestModeFromValue(true)).toBe(true);
  });

  it("fails safe to true for anything else", () => {
    expect(dropboxSignTestModeFromValue(undefined)).toBe(true);
    expect(dropboxSignTestModeFromValue(null)).toBe(true);
    expect(dropboxSignTestModeFromValue("0")).toBe(true);
    expect(dropboxSignTestModeFromValue(0)).toBe(true);
  });
});

describe("getDropboxSignTestMode", () => {
  it("returns true when no row exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await getDropboxSignTestMode()).toBe(true);
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { key: DROPBOX_SIGN_TEST_MODE_KEY } });
  });

  it("returns the stored boolean", async () => {
    mockFindUnique.mockResolvedValue({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false });
    expect(await getDropboxSignTestMode()).toBe(false);
  });

  it("fails safe to true on a malformed value", async () => {
    mockFindUnique.mockResolvedValue({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: "live" });
    expect(await getDropboxSignTestMode()).toBe(true);
  });

  it("propagates DB errors (send must fail loudly, not silently flip mode)", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));
    await expect(getDropboxSignTestMode()).rejects.toThrow("db down");
  });
});

describe("setAppSetting", () => {
  it("upserts value + updatedById", async () => {
    mockUpsert.mockResolvedValue({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false });
    await setAppSetting(DROPBOX_SIGN_TEST_MODE_KEY, false, "admin-uuid");
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: DROPBOX_SIGN_TEST_MODE_KEY },
      create: { key: DROPBOX_SIGN_TEST_MODE_KEY, value: false, updatedById: "admin-uuid" },
      update: { value: false, updatedById: "admin-uuid" },
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails:** `npx vitest run src/features/shared/lib/__tests__/app-settings.test.ts`
Expected: FAIL — `Cannot find module '../app-settings'`.

- [ ] **Step 3: Create `src/features/shared/lib/app-setting-keys.ts`** (client-safe — no server imports, so client components can reference the key):

```ts
// Keys for the app_settings table. Client-safe (no server imports) so both
// API routes and client components can reference them.
export const DROPBOX_SIGN_TEST_MODE_KEY = "dropbox_sign_test_mode";
```

- [ ] **Step 4: Create `src/features/shared/lib/app-settings.ts`:**

```ts
import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { DROPBOX_SIGN_TEST_MODE_KEY } from "./app-setting-keys";

export { DROPBOX_SIGN_TEST_MODE_KEY };

/** Pure fallback rule shared by every reader: only an explicit JSON boolean
 *  counts; anything else (missing row, malformed value) = test mode ON. */
export function dropboxSignTestModeFromValue(value: unknown): boolean {
  return typeof value === "boolean" ? value : true;
}

export async function getAppSetting(key: string): Promise<unknown> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value;
}

/** DB errors propagate — a send must fail loudly rather than silently flip mode. */
export async function getDropboxSignTestMode(): Promise<boolean> {
  return dropboxSignTestModeFromValue(await getAppSetting(DROPBOX_SIGN_TEST_MODE_KEY));
}

export async function setAppSetting(key: string, value: Prisma.InputJsonValue, updatedById: string) {
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value, updatedById },
    update: { value, updatedById },
  });
}
```

- [ ] **Step 5: Run the test to verify it passes:** `npx vitest run src/features/shared/lib/__tests__/app-settings.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/shared/lib/app-setting-keys.ts src/features/shared/lib/app-settings.ts src/features/shared/lib/__tests__/app-settings.test.ts
git commit -m "feat(settings): app-settings accessors with fail-safe test-mode read"
```

---

### Task 3: PATCH /api/admin/settings

**Files:**
- Create: `src/app/api/admin/settings/route.ts`
- Test: `src/app/api/admin/settings/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test** at `src/app/api/admin/settings/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAdminUser, mockUpsert } = vi.hoisted(() => ({
  mockGetAdminUser: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/prisma", () => ({ default: { appSetting: { upsert: mockUpsert } } }));

import { PATCH } from "../route";

function req(body: unknown) {
  return new Request("http://localhost/api/admin/settings", {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminUser.mockResolvedValue({ user: { id: "u1" }, profile: { id: "u1", role: "admin" } });
    mockUpsert.mockResolvedValue({
      key: "dropbox_sign_test_mode", value: false, updatedAt: new Date("2026-06-12T00:00:00Z"), updatedById: "u1",
    });
  });

  it("403s for non-admins", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await PATCH(req({ key: "dropbox_sign_test_mode", value: false }));
    expect(res.status).toBe(403);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400s for an unknown key", async () => {
    const res = await PATCH(req({ key: "nonsense", value: false }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("400s for a non-boolean value", async () => {
    const res = await PATCH(req({ key: "dropbox_sign_test_mode", value: "no" }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("writes the setting stamped with the admin's profile id", async () => {
    const res = await PATCH(req({ key: "dropbox_sign_test_mode", value: false }));
    expect(res.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { key: "dropbox_sign_test_mode" },
      create: { key: "dropbox_sign_test_mode", value: false, updatedById: "u1" },
      update: { value: false, updatedById: "u1" },
    });
    expect(await res.json()).toMatchObject({ key: "dropbox_sign_test_mode", value: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails:** `npx vitest run src/app/api/admin/settings/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Create `src/app/api/admin/settings/route.ts`:**

```ts
// PATCH /api/admin/settings — write one allowlisted app_settings row.
// Body: { key: string, value: unknown }. Admin-only.
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/server";
import { setAppSetting, DROPBOX_SIGN_TEST_MODE_KEY } from "@/features/shared/lib/app-settings";

export const dynamic = "force-dynamic";

// Allowlist of admin-editable settings, each with a value validator.
const SETTING_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  [DROPBOX_SIGN_TEST_MODE_KEY]: (value) => typeof value === "boolean",
};

export async function PATCH(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = (await request.json()) as { key?: string; value?: unknown };
    const key = body.key ?? "";
    const isValid = SETTING_VALIDATORS[key];
    if (!isValid || !isValid(body.value)) {
      return NextResponse.json({ error: "Unknown setting or invalid value" }, { status: 400 });
    }

    const row = await setAppSetting(key, body.value as boolean, admin.profile.id);
    return NextResponse.json({ key: row.key, value: row.value, updatedAt: row.updatedAt });
  } catch (error) {
    console.error("Error updating app setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes:** `npx vitest run src/app/api/admin/settings/__tests__/route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/settings
git commit -m "feat(admin): allowlisted PATCH /api/admin/settings"
```

---

### Task 4: GET /api/document-generation/settings

**Files:**
- Create: `src/app/api/document-generation/settings/route.ts`
- Test: `src/app/api/document-generation/settings/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test** at `src/app/api/document-generation/settings/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFindUnique } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mockGetUser }));
vi.mock("@/lib/prisma", () => ({ default: { appSetting: { findUnique: mockFindUnique } } }));

import { GET } from "../route";

describe("GET /api/document-generation/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "rep-uuid" });
    mockFindUnique.mockResolvedValue(null);
  });

  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("defaults to testMode true with no row", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ testMode: true });
  });

  it("returns the stored mode", async () => {
    mockFindUnique.mockResolvedValue({ key: "dropbox_sign_test_mode", value: false });
    const res = await GET();
    expect(await res.json()).toEqual({ testMode: false });
  });
});
```

- [ ] **Step 2: Run it to verify it fails:** `npx vitest run src/app/api/document-generation/settings/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Create `src/app/api/document-generation/settings/route.ts`:**

```ts
// GET /api/document-generation/settings — doc-gen client settings (any authed user).
// Currently: { testMode } so the form can annotate "Send for signature".
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getDropboxSignTestMode } from "@/features/shared/lib/app-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const testMode = await getDropboxSignTestMode();
    return NextResponse.json({ testMode });
  } catch (error) {
    console.error("Error fetching doc-gen settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes:** `npx vitest run src/app/api/document-generation/settings/__tests__/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/document-generation/settings
git commit -m "feat(doc-gen): settings GET exposing testMode to the form"
```

---

### Task 5: Inject test_mode into the send path

**Files:**
- Modify: `src/features/document-generation/lib/render-apps-script.ts` (`sendForSignature`, ~line 79)
- Modify: `src/app/api/document-generation/send/route.ts` (~line 33)
- Test: `src/features/document-generation/lib/__tests__/render-apps-script.test.ts` (sendForSignature describe, lines 116-157)
- Test: `src/app/api/document-generation/send/__tests__/route.test.ts`

- [ ] **Step 1: Update the sendForSignature tests.** In `render-apps-script.test.ts`, the three existing calls `sendForSignature({ doc_type: "contract" } as never)` become `sendForSignature({ doc_type: "contract" } as never, { testMode: true })`. Extend the first test's body assertion and add a live-mode case:

```ts
  it("POSTs tags:true + auto_send:true and returns the send result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "https://docs.google.com/document/d/D/edit", docId: "D", sent: true, signatureRequestId: "sig_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendForSignature({ doc_type: "contract" } as never, { testMode: true });

    expect(result).toEqual({ docUrl: "https://docs.google.com/document/d/D/edit", docId: "D", sent: true, signatureRequestId: "sig_123", sendError: undefined });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ doc_type: "contract", tags: true, auto_send: true, test_mode: "1" });
  });

  it("POSTs test_mode '0' when live", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "u", docId: "D", sent: true, signatureRequestId: "s" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendForSignature({ doc_type: "contract" } as never, { testMode: false });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ test_mode: "0" });
  });
```

(The other two existing tests only need the second argument added — keep their assertions unchanged.)

- [ ] **Step 2: Run to verify failure:** `npx vitest run src/features/document-generation/lib/__tests__/render-apps-script.test.ts`
Expected: FAIL — body lacks `test_mode` (TS may also complain about the extra argument).

- [ ] **Step 3: Update `sendForSignature` in `render-apps-script.ts`:**

```ts
/** Re-renders the payload with eSign tags ON and auto_send ON (mechanism A) and
 *  returns the Dropbox Sign send result. test_mode is server-injected from
 *  app_settings — never read from the client payload. Reuses buildJwt()/SCOPES. */
export async function sendForSignature(payload: DocPayload, opts: { testMode: boolean }): Promise<SendResult> {
  const data = (await callRenderer({
    ...payload,
    tags: true,
    auto_send: true,
    test_mode: opts.testMode ? "1" : "0",
  })) as {
    success: boolean; url?: string; docId?: string;
    sent?: boolean; signatureRequestId?: string; sendError?: string; error?: string;
  };
  if (!data.success || !data.url) throw new Error(`Send failed: ${data.error ?? "unknown error"}`);

  return {
    docUrl: data.url,
    docId: data.docId,
    sent: data.sent ?? false,
    signatureRequestId: data.signatureRequestId,
    sendError: data.sendError,
  };
}
```

- [ ] **Step 4: Run to verify pass:** `npx vitest run src/features/document-generation/lib/__tests__/render-apps-script.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the send route tests.** In `src/app/api/document-generation/send/__tests__/route.test.ts`:
  - Extend the hoisted mocks with `mockFindUnique: vi.fn()` and change the prisma mock to
    `vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { create: mockCreate }, appSetting: { findUnique: mockFindUnique } } }));`
  - In `beforeEach`, add `mockFindUnique.mockResolvedValue(null);`
  - Change the existing assertion `expect(mockSend).toHaveBeenCalledWith(CONTRACT)` to `expect(mockSend).toHaveBeenCalledWith(CONTRACT, { testMode: true })`.
  - Add two tests:

```ts
  it("passes testMode false when the setting is live", async () => {
    mockFindUnique.mockResolvedValue({ key: "dropbox_sign_test_mode", value: false });
    const res = await POST(req({ payload: CONTRACT, districtLeaId: "0601234" }));
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(CONTRACT, { testMode: false });
  });

  it("passes testMode true when no setting row exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    await POST(req({ payload: CONTRACT, districtLeaId: "0601234" }));
    expect(mockSend).toHaveBeenCalledWith(CONTRACT, { testMode: true });
  });
```

- [ ] **Step 6: Run to verify failure:** `npx vitest run src/app/api/document-generation/send/__tests__/route.test.ts`
Expected: FAIL — `sendForSignature` called without the opts argument.

- [ ] **Step 7: Update the send route.** In `src/app/api/document-generation/send/route.ts`, add the import and replace the `sendForSignature` call (line ~33):

```ts
import { getDropboxSignTestMode } from "@/features/shared/lib/app-settings";
```

```ts
    const testMode = await getDropboxSignTestMode();
    const result = await sendForSignature(payload, { testMode });
```

- [ ] **Step 8: Run to verify pass:** `npx vitest run src/app/api/document-generation/send/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/document-generation/lib/render-apps-script.ts src/features/document-generation/lib/__tests__/render-apps-script.test.ts src/app/api/document-generation/send/route.ts src/app/api/document-generation/send/__tests__/route.test.ts
git commit -m "feat(doc-gen): server-inject test_mode into the Dropbox Sign send payload"
```

---

### Task 6: Extend GET /api/admin/integrations with the Dropbox Sign entry

**Files:**
- Modify: `src/app/api/admin/integrations/route.ts`
- Test: `src/app/api/admin/integrations/__tests__/route.test.ts` (new — the route had no tests)

- [ ] **Step 1: Write the failing test** at `src/app/api/admin/integrations/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAdminUser, mockPrisma } = vi.hoisted(() => ({
  mockGetAdminUser: vi.fn(),
  mockPrisma: {
    userProfile: { count: vi.fn() },
    userIntegration: { count: vi.fn(), findFirst: vi.fn() },
    dataRefreshLog: { findFirst: vi.fn() },
    appSetting: { findUnique: vi.fn() },
    generatedDocument: { aggregate: vi.fn() },
  },
}));

vi.mock("@/lib/supabase/server", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { GET } from "../route";

describe("GET /api/admin/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminUser.mockResolvedValue({ user: { id: "u1" }, profile: { id: "u1", role: "admin" } });
    mockPrisma.userProfile.count.mockResolvedValue(7);
    mockPrisma.userIntegration.count.mockResolvedValue(0);
    mockPrisma.userIntegration.findFirst.mockResolvedValue(null);
    mockPrisma.dataRefreshLog.findFirst.mockResolvedValue(null);
    mockPrisma.appSetting.findUnique.mockResolvedValue(null);
    mockPrisma.generatedDocument.aggregate.mockResolvedValue({ _max: { sentAt: null } });
  });

  it("403s for non-admins", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("includes a dropbox-sign entry defaulting to test mode", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const { integrations } = await res.json();
    const ds = integrations.find((i: { slug: string }) => i.slug === "dropbox-sign");
    expect(ds).toMatchObject({
      name: "Dropbox Sign",
      status: "test",
      connectedUsers: null,
      totalUsers: null,
      modeChangedAt: null,
      modeChangedByName: null,
    });
  });

  it("reports live mode + change metadata + last send", async () => {
    mockPrisma.appSetting.findUnique.mockResolvedValue({
      key: "dropbox_sign_test_mode",
      value: false,
      updatedAt: new Date("2026-06-12T10:00:00Z"),
      updatedBy: { fullName: "Aston Arcega" },
    });
    mockPrisma.generatedDocument.aggregate.mockResolvedValue({ _max: { sentAt: new Date("2026-06-11T09:00:00Z") } });
    const res = await GET();
    const { integrations } = await res.json();
    const ds = integrations.find((i: { slug: string }) => i.slug === "dropbox-sign");
    expect(ds).toMatchObject({
      status: "live",
      modeChangedByName: "Aston Arcega",
      lastSyncAt: "2026-06-11T09:00:00.000Z",
      modeChangedAt: "2026-06-12T10:00:00.000Z",
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails:** `npx vitest run src/app/api/admin/integrations/__tests__/route.test.ts`
Expected: the 403 test passes; the dropbox-sign tests FAIL (`ds` is undefined).

- [ ] **Step 3: Extend the route.** In `src/app/api/admin/integrations/route.ts`, add imports:

```ts
import { dropboxSignTestModeFromValue, DROPBOX_SIGN_TEST_MODE_KEY } from "@/features/shared/lib/app-settings";
```

After the scheduler-status block (line ~49), add:

```ts
    // Dropbox Sign doc-gen mode (app_settings) + last send across generated_documents
    const [testModeRow, lastSendAgg] = await Promise.all([
      prisma.appSetting.findUnique({
        where: { key: DROPBOX_SIGN_TEST_MODE_KEY },
        include: { updatedBy: { select: { fullName: true } } },
      }),
      prisma.generatedDocument.aggregate({ _max: { sentAt: true } }),
    ]);
    const dropboxTestMode = dropboxSignTestModeFromValue(testModeRow?.value);
```

And append a third element to the `integrations` array:

```ts
      {
        name: "Dropbox Sign",
        slug: "dropbox-sign",
        status: dropboxTestMode ? "test" : "live",
        connectedUsers: null,
        totalUsers: null,
        lastSyncAt: lastSendAgg._max.sentAt ?? null,
        description: "Sends contracts for e-signature via Dropbox Sign",
        modeChangedAt: testModeRow?.updatedAt ?? null,
        modeChangedByName: testModeRow?.updatedBy?.fullName ?? null,
      },
```

- [ ] **Step 4: Run to verify pass:** `npx vitest run src/app/api/admin/integrations/__tests__/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/integrations
git commit -m "feat(admin): Dropbox Sign entry in the integrations status route"
```

---

### Task 7: Admin card UI (DropboxSignCard + toggle mutation)

**Files:**
- Create: `src/features/admin/lib/relative-time.ts`
- Modify: `src/features/admin/hooks/useAdminIntegrations.ts`
- Create: `src/features/admin/components/DropboxSignCard.tsx`
- Modify: `src/features/admin/components/IntegrationsTab.tsx`
- Test: `src/features/admin/components/__tests__/DropboxSignCard.test.tsx`

Read `src/features/admin/components/__tests__/NewsIngestCard.test.tsx` first and mirror its render/mocking conventions where they differ from below.

- [ ] **Step 1: Extract `relativeTime`.** Create `src/features/admin/lib/relative-time.ts` with the function currently at the top of `IntegrationsTab.tsx` (lines 5-16), exported:

```ts
export function relativeTime(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
```

Delete the local copy in `IntegrationsTab.tsx` and import it there: `import { relativeTime } from "../lib/relative-time";`

- [ ] **Step 2: Extend the hook file.** In `src/features/admin/hooks/useAdminIntegrations.ts`, add the two optional fields to `AdminIntegration`:

```ts
  modeChangedAt?: string | null;
  modeChangedByName?: string | null;
```

and add the mutation (plus the `useMutation, useQueryClient` imports from `@tanstack/react-query`):

```ts
export function useUpdateAppSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      fetchJson<{ key: string; value: boolean }>(`${API_BASE}/admin/settings`, {
        method: "PATCH",
        body: JSON.stringify({ key, value }),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] }),
  });
}
```

- [ ] **Step 3: Write the failing component test** at `src/features/admin/components/__tests__/DropboxSignCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DropboxSignCard from "../DropboxSignCard";
import type { AdminIntegration } from "../../hooks/useAdminIntegrations";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function makeIntegration(overrides: Partial<AdminIntegration> = {}): AdminIntegration {
  return {
    name: "Dropbox Sign",
    slug: "dropbox-sign",
    status: "test",
    connectedUsers: null,
    totalUsers: null,
    lastSyncAt: null,
    description: "Sends contracts for e-signature via Dropbox Sign",
    modeChangedAt: null,
    modeChangedByName: null,
    ...overrides,
  };
}

function renderCard(integration: AdminIntegration) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DropboxSignCard integration={integration} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ key: "dropbox_sign_test_mode", value: true }) });
});

describe("DropboxSignCard", () => {
  it("shows the amber Test Mode pill and a checked switch in test mode", () => {
    renderCard(makeIntegration());
    expect(screen.getByText("Test Mode", { selector: "span.rounded-full" })).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("shows the green Live pill and an unchecked switch when live", () => {
    renderCard(makeIntegration({ status: "live" }));
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("requires confirmation before going live, then PATCHes value:false", async () => {
    renderCard(makeIntegration());
    fireEvent.click(screen.getByRole("switch"));
    // No request yet — the confirm panel is showing
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Going live/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Go live" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/settings");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ key: "dropbox_sign_test_mode", value: false });
  });

  it("cancel dismisses the confirm without a request", () => {
    renderCard(makeIntegration());
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/Going live/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flips back to test mode instantly (no confirm)", async () => {
    renderCard(makeIntegration({ status: "live" }));
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ key: "dropbox_sign_test_mode", value: true });
    expect(screen.queryByText(/Going live/)).not.toBeInTheDocument();
  });

  it("shows an inline error when the PATCH fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });
    renderCard(makeIntegration({ status: "live" }));
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() => expect(screen.getByText(/Failed to update/)).toBeInTheDocument());
  });

  it("renders mode-change and last-send meta", () => {
    renderCard(makeIntegration({
      modeChangedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      modeChangedByName: "Aston Arcega",
      lastSyncAt: new Date(Date.now() - 3 * 86400_000).toISOString(),
    }));
    expect(screen.getByText(/Mode changed 2h ago by Aston Arcega/)).toBeInTheDocument();
    expect(screen.getByText(/Last send: 3d ago/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run it to verify it fails:** `npx vitest run src/features/admin/components/__tests__/DropboxSignCard.test.tsx`
Expected: FAIL — `Cannot find module '../DropboxSignCard'`.

- [ ] **Step 5: Create `src/features/admin/components/DropboxSignCard.tsx`:**

```tsx
"use client";

import { useState } from "react";
import type { AdminIntegration } from "../hooks/useAdminIntegrations";
import { useUpdateAppSetting } from "../hooks/useAdminIntegrations";
import { DROPBOX_SIGN_TEST_MODE_KEY } from "@/features/shared/lib/app-setting-keys";
import { relativeTime } from "../lib/relative-time";

export default function DropboxSignCard({ integration }: { integration: AdminIntegration }) {
  const testMode = integration.status === "test";
  const [confirmingLive, setConfirmingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateAppSetting();

  function setMode(value: boolean) {
    setError(null);
    setConfirmingLive(false);
    mutation.mutate(
      { key: DROPBOX_SIGN_TEST_MODE_KEY, value },
      { onError: () => setError("Failed to update — try again.") },
    );
  }

  function handleToggle() {
    if (mutation.isPending) return;
    if (testMode) {
      setConfirmingLive(true); // Test → Live needs a confirm
    } else {
      setMode(true); // Live → Test flips instantly (turning safety on has no friction)
    }
  }

  const meta: string[] = [];
  if (integration.modeChangedAt) {
    const by = integration.modeChangedByName ? ` by ${integration.modeChangedByName}` : "";
    meta.push(`Mode changed ${relativeTime(integration.modeChangedAt)}${by}`);
  }
  if (integration.lastSyncAt) meta.push(`Last send: ${relativeTime(integration.lastSyncAt)}`);

  return (
    <div className="bg-white rounded-xl border border-[#E2DEEC] p-5">
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-[#403770] whitespace-nowrap">{integration.name}</span>
        {testMode ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-[#fffaf1] text-[#997c43] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFCF70]" />
            Test Mode
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-[#EDFFE3] text-[#5f665b] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5f665b]" />
            Live
          </span>
        )}
      </div>

      <p className="text-sm text-[#8A80A8] mt-1">{integration.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          role="switch"
          aria-checked={testMode}
          aria-label="Test Mode"
          disabled={mutation.isPending}
          onClick={handleToggle}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${testMode ? "bg-[#FFCF70]" : "bg-[#C2BBD4]"}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${testMode ? "left-[18px]" : "left-0.5"}`} />
        </button>
        <span className="text-sm text-[#544A78] whitespace-nowrap">Test Mode</span>
        <span className="text-xs text-[#A69DC0] whitespace-nowrap">Sends are sandboxed — no real emails, no credits.</span>
      </div>

      {confirmingLive && (
        <div className="mt-3 rounded-lg border border-[#ffd98d] bg-[#fffaf1] p-3">
          <p className="text-sm text-[#997c43]">
            Going live: future sends create real signature requests, email real recipients, and consume Dropbox Sign credits.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setMode(false)}
              className="rounded-lg bg-[#403770] px-3 py-1 text-sm text-white whitespace-nowrap">Go live</button>
            <button type="button" onClick={() => setConfirmingLive(false)}
              className="rounded-lg border border-[#C2BBD4] px-3 py-1 text-sm whitespace-nowrap">Cancel</button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[#c25a52]">{error}</p>}

      {meta.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {meta.map((m) => (
            <span key={m} className="text-xs text-[#A69DC0] whitespace-nowrap">{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire it into `IntegrationsTab.tsx`.** Add `import DropboxSignCard from "./DropboxSignCard";` and change the map in the default export:

```tsx
      {integrations.map((integration) =>
        integration.slug === "dropbox-sign" ? (
          <DropboxSignCard key={integration.slug} integration={integration} />
        ) : (
          <IntegrationCard key={integration.slug} integration={integration} />
        )
      )}
```

- [ ] **Step 7: Run to verify pass:** `npx vitest run src/features/admin/components/__tests__/DropboxSignCard.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 8: Run the admin feature suite for regressions:** `npx vitest run src/features/admin`
Expected: PASS (NewsIngestCard/VacancyScanCard untouched).

- [ ] **Step 9: Commit**

```bash
git add src/features/admin
git commit -m "feat(admin): Dropbox Sign integrations card with Test Mode toggle"
```

---

### Task 8: Rep-facing test-mode annotation (ReviewStage)

**Files:**
- Modify: `src/features/document-generation/lib/queries.ts` (add `useDocGenSettings`)
- Modify: `src/features/document-generation/components/GenerateDocumentModal.tsx`
- Modify: `src/features/document-generation/components/review/ReviewStage.tsx`
- Test: `src/features/document-generation/components/review/__tests__/ReviewStage.test.tsx` (extend existing)

Read the existing `ReviewStage.test.tsx` first and follow its render-helper conventions.

- [ ] **Step 1: Write the failing tests.** Add to the existing `ReviewStage.test.tsx` (adapting to its existing default-props helper):

```tsx
  it("shows the test-mode callout and button tag for contracts in test mode", () => {
    renderStage({ docType: "contract", testMode: true });
    expect(screen.getByText(/Sending is in test mode/)).toBeInTheDocument();
    expect(screen.getByText(/contact your Admin to disable Test Mode/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send for signature/ })).toHaveTextContent("Test mode");
  });

  it("hides the callout when live or unknown", () => {
    const { rerender } = renderStage({ docType: "contract", testMode: false });
    expect(screen.queryByText(/Sending is in test mode/)).not.toBeInTheDocument();
    rerender(makeStage({ docType: "contract", testMode: undefined }));
    expect(screen.queryByText(/Sending is in test mode/)).not.toBeInTheDocument();
  });

  it("hides the callout for BOCES quotes even in test mode", () => {
    renderStage({ docType: "boces_quote", testMode: true });
    expect(screen.queryByText(/Sending is in test mode/)).not.toBeInTheDocument();
  });
```

(If the existing file has no `renderStage`/`makeStage` helpers, create them following however the file currently renders `<ReviewStage …/>` with default props.)

- [ ] **Step 2: Run to verify failure:** `npx vitest run src/features/document-generation/components/review/__tests__/ReviewStage.test.tsx`
Expected: FAIL — no test-mode markup.

- [ ] **Step 3: Update `ReviewStage.tsx`.** Add to `Props`:

```ts
  testMode?: boolean;
```

Destructure `testMode` in the component signature. Insert the callout directly above the buttons row (`<div className="flex flex-wrap gap-2">`):

```tsx
      {docType === "contract" && testMode === true && (
        <div role="status" className="rounded-lg border border-[#ffd98d] bg-[#fffaf1] px-3 py-2 text-sm text-[#997c43]">
          Sending is in test mode — this won&apos;t produce a real signature request. Use Google Docs to send an
          executable, or contact your Admin to disable Test Mode.
        </div>
      )}
```

Replace the Send button with:

```tsx
          <button type="button" onClick={onSend}
            disabled={busy || (sendState != null && sendState.phase !== "error")}
            className={`rounded-lg bg-[#403770] px-3 py-1 text-sm text-white whitespace-nowrap disabled:opacity-50${testMode === true ? " ring-2 ring-[#FFCF70]" : ""}`}>
            {busy ? "Sending…" : "Send for signature"}
            {testMode === true && (
              <span className="ml-2 rounded-full bg-[#fffaf1] px-1.5 py-0.5 text-[10px] font-semibold text-[#997c43] whitespace-nowrap">Test mode</span>
            )}
          </button>
```

- [ ] **Step 4: Add the query hook.** In `src/features/document-generation/lib/queries.ts`:

```ts
// ---------------------------------------------------------------------------
// Doc-gen client settings (test mode annotation)
// ---------------------------------------------------------------------------

export interface DocGenSettings {
  testMode: boolean;
}

export function useDocGenSettings() {
  return useQuery({
    queryKey: ["document-generation", "settings"],
    queryFn: () => fetchJson<DocGenSettings>(`${API_BASE}/document-generation/settings`),
    staleTime: 60 * 1000,
  });
}
```

- [ ] **Step 5: Wire the modal.** In `GenerateDocumentModal.tsx`: extend the queries import to include `useDocGenSettings`, add inside the component (next to `statusQuery`):

```ts
  const settingsQuery = useDocGenSettings();
```

and pass to ReviewStage:

```tsx
            testMode={settingsQuery.data?.testMode}
```

(While loading/errored this is `undefined` → no annotation; the server injection at send time is authoritative, so a stale annotation never changes behavior.)

- [ ] **Step 6: Run the doc-gen suites:** `npx vitest run src/features/document-generation src/app/api/document-generation`
Expected: PASS — ReviewStage additions green, no modal regressions (its tests already wrap in a QueryClientProvider for `useGeneratedDocumentStatus`; if a test renders the modal without a provider, wrap it the same way the other modal tests do).

- [ ] **Step 7: Commit**

```bash
git add src/features/document-generation
git commit -m "feat(doc-gen): rep-facing test-mode callout on the send review stage"
```

---

### Task 9: Apps Script payload preference + live DB DDL (orchestrator-supervised)

**Files:**
- Modify: `scripts/document-generation/appsscript/Code.gs` (line ~80)

This task touches the LIVE Apps Script deployment and the LIVE database. Run it inline (orchestrator), not via a fire-and-forget subagent.

- [ ] **Step 1: Edit `Code.gs`.** Replace the `test_mode` line in the `dsPayload` literal:

```js
          // Server-injected by the app's send route (SP7 Admin toggle). Strict
          // string match; anything else falls back to the script property so
          // editor-run tests stay sandboxed.
          'test_mode':                 (payload.test_mode === '0' || payload.test_mode === '1')
                                         ? payload.test_mode
                                         : (props[PROP.DROPBOX_SIGN_TEST_MODE] || '1'),
```

- [ ] **Step 2: Push + deploy (keeps the /exec URL, bumps to @12):**

```bash
cd scripts/document-generation/appsscript
npx clasp push
npx clasp deploy -i AKfycby0oFEDEj77XpMNNZaB9WpOVsHoUBeY1Nsa2nJbvU5J3nyfnTYSmvQHJgh9DdCtoTsy -d "SP7: prefer payload test_mode over script property"
npx clasp deployments   # confirm the deployment now shows @12
```

(`.clasp.json` must be symlinked in the worktree — done in Setup. `clasp push` updates HEAD only; the `deploy -i` is what makes /exec serve the new code.)

- [ ] **Step 3: Apply the migration to the live DB** (ledger drift blocks `migrate deploy`; same `db execute` path as SP6's `school_year_manual`):

```bash
cd "$WT"
set -a; source .env; set +a
npx prisma db execute --file prisma/migrations/20260612000000_app_settings/migration.sql --url "$DIRECT_URL"
# verify:
echo 'SELECT key, value FROM app_settings;' | npx prisma db execute --stdin --url "$DIRECT_URL"
```

Expected: table exists, zero rows (missing row = test mode ON). The cutover `prisma migrate resolve --applied` count is now **×6**.

- [ ] **Step 4: Commit**

```bash
git add scripts/document-generation/appsscript/Code.gs
git commit -m "feat(appsscript): prefer payload test_mode over the script property (deploy @12)"
```

---

### Task 10: Verification, smoke test, PR

- [ ] **Step 1: Full test pass for touched areas:**

```bash
npx vitest run src/features/document-generation src/app/api/document-generation src/features/admin src/app/api/admin src/features/shared/lib src/lib/__tests__/district-column-metadata.test.ts
```

Expected: PASS except failures that also exist on main (compare with `git stash` or a main checkout if anything looks pre-existing; the tile-route test is a known parallel-load flake).

- [ ] **Step 2: Lint only the changed files** (full-tree eslint OOMs):

```bash
git diff --name-only main -- '*.ts' '*.tsx' | xargs npx eslint
```

Expected: no errors.

- [ ] **Step 3: Manual smoke (dev server on 3005 from the worktree).**
  1. Admin → Integrations: Dropbox Sign card shows amber "Test Mode" pill (no row yet ⇒ test).
  2. Flip the switch OFF → confirm panel appears → "Go live" → pill turns green "Live", meta line shows "Mode changed Just now by <you>". Verify the DB row: `value = false`.
  3. Doc-gen form (district → Generate document → render a contract): with mode LIVE, review stage shows NO callout. **Do NOT press Send while live** (real credits + the prod cutover/key rotation hasn't happened).
  4. Flip back to Test Mode (instant, no confirm). Re-open the review stage → amber callout + "Test mode" tag on the button.
  5. Send the contract in test mode (e2e): banner reaches "Sent ✓" and the webhook row lands (status promoted by the webhook; Slack stays quiet in test mode).
  6. **Payload-preference proof (no credit spent):** temporarily set the script property `DROPBOX_SIGN_TEST_MODE` to `'0'`, keep the Admin toggle on Test Mode, send once more, and confirm the Dropbox webhook event still reports `test_mode: true` — the payload value won over the property. Restore the property to `'1'` afterwards.
- [ ] **Step 4: Mobile spot-check** (Safari Responsive Design Mode): Admin Integrations grid at 375px — card text wraps via the `flex-wrap` rows, no horizontal overflow; review-stage callout wraps cleanly.
- [ ] **Step 5: Push + PR** against `main` from `feat/sea-monkey-sp7` (include spec+plan via the merged docs branch). PR body: feature summary, Apps Script @12 note, live-DB DDL note, cutover-list supersession ("flip the property" → "flip the Admin toggle"; resolve count ×6).

---

## Self-review notes (already applied)

- Spec §1-§7 all map to Tasks 1-10; §9 supersession lands in the PR body + memory update at session end.
- `dropboxSignTestModeFromValue` is the single fallback rule — used by lib reader and integrations route (no inline duplicates).
- `DROPBOX_SIGN_TEST_MODE_KEY` lives in client-safe `app-setting-keys.ts` because `app-settings.ts` is `server-only` and the card needs the constant.
- `sendForSignature(payload, { testMode })` signature is consistent across Task 5 code and tests.
- Existing `IntegrationsTab` skeleton/loading flow untouched — the new card rides the same query (no second loading state).
