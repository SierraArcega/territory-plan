# Sea Monkey SP5: Archive & Reporting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Executed contracts auto-archive to a Google Drive folder; doc-gen outputs (sends + BOCES renders) persist full deal payloads with promoted report columns, queryable through the existing reports tooling; the Review stage becomes PDF-first.

**Architecture:** The Dropbox Sign webhook gains a post-status archive step (download executed PDF → Drive upload via the existing service-account JWT). `generated_documents` gains `payload JSONB` + promoted scalar columns + a `rendered` status; `/send` persists them and `/render` upserts BOCES-quote rows by quote number + owner. The table moves from the query tool's `excludedTables` into `TABLE_REGISTRY`.

**Tech Stack:** Next.js 16 App Router routes, Prisma/Postgres (raw-SQL migrations via `prisma db execute`), googleapis JWT (already a dependency), Vitest.

**Spec:** `Docs/superpowers/specs/2026-06-10-sea-monkey-sp5-archive-reporting-design.md`

---

## GATES — read before starting

1. **PR #271 must be merged.** This plan's code references the post-#271 state of the send route, webhook, ReviewStage, and queries lib. Create the implementation worktree off a main that contains #271: `git worktree add .worktrees/feat-sea-monkey-sp5 -b feat/sea-monkey-sp5 main` after `git pull`. Symlink `.env`/`.env.local` into it (start-session step 6). Bring the spec + this plan onto the branch (cherry-pick from `docs/sea-monkey-sp5-spec` or merge that docs branch first).
2. **User-gated setup before Tasks 5–7 can be e2e-verified** (code + unit tests don't need it): enable the **Google Drive API** in GCP project `fullmind-doc-gen`; create the "Executed" Drive folder; set `GOOGLE_DOC_EXECUTED_FOLDER_ID` in `.env.local` (+ `.env.example`, Vercel later).
3. Run `git branch --show-current` before dispatching any implementer — must print `feat/sea-monkey-sp5`.
4. House rules: targeted vitest only; never full-tree eslint; `npx prisma generate && rm -rf .next` for phantom Prisma/tsc errors; no TODOs in migration files.

---

### Task 1: Migration — `rendered` status, payload + promoted + PDF columns, BOCES upsert index

**Files:**
- Modify: `prisma/schema.prisma` (enum `SignatureStatus` ~line 2160, model `GeneratedDocument` ~line 2173)
- Create: `prisma/migrations/20260610120000_sp5_payload_and_archive/migration.sql`

- [ ] **Step 1: Schema.** Add `rendered` as the last enum value:

```prisma
enum SignatureStatus {
  processing
  sent
  viewed
  signed
  declined
  canceled
  error
  rendered

  @@map("signature_status")
}
```

Add to `model GeneratedDocument` (after `opportunityId`):

```prisma
  payload            Json?           @db.JsonB
  orderTotal         Decimal?        @map("order_total") @db.Decimal(12, 2)
  paymentType        String?         @map("payment_type") @db.Text
  startDate          DateTime?       @map("start_date") @db.Date
  endDate            DateTime?       @map("end_date") @db.Date
  schoolYear         String?         @map("school_year") @db.Text
  quoteNumber        String?         @map("quote_number") @db.Text
  executedPdfUrl     String?         @map("executed_pdf_url") @db.Text
  executedPdfFileId  String?         @map("executed_pdf_file_id") @db.Text
```

- [ ] **Step 2: Migration file:**

```sql
-- SP5: deal payload + promoted report columns + executed-PDF archive fields.
-- 'rendered' = non-eSign outputs (BOCES quotes recorded at render time).
ALTER TYPE "signature_status" ADD VALUE 'rendered';
ALTER TABLE "generated_documents"
  ADD COLUMN "payload" JSONB,
  ADD COLUMN "order_total" DECIMAL(12,2),
  ADD COLUMN "payment_type" TEXT,
  ADD COLUMN "start_date" DATE,
  ADD COLUMN "end_date" DATE,
  ADD COLUMN "school_year" TEXT,
  ADD COLUMN "quote_number" TEXT,
  ADD COLUMN "executed_pdf_url" TEXT,
  ADD COLUMN "executed_pdf_file_id" TEXT;
-- One row per BOCES quote number per rep — re-renders update in place.
CREATE UNIQUE INDEX "generated_documents_boces_quote_owner_key"
  ON "generated_documents" ("quote_number", "owner_profile_id")
  WHERE "doc_type" = 'boces_quote';
```

NOTE: Postgres forbids `ALTER TYPE … ADD VALUE` in the same transaction as its use, and `prisma db execute` wraps the script — if it errors on that, split into two files (`…_a_enum.sql` with the ALTER TYPE, `…_b_columns.sql` with the rest) and run them in order; commit whichever layout actually applied.

- [ ] **Step 3: Apply** (shared Supabase — additive and backward-compatible; nothing writes the new columns until this branch ships):

```bash
npx prisma db execute \
  --file prisma/migrations/20260610120000_sp5_payload_and_archive/migration.sql \
  --url "$(grep '^DIRECT_URL' .env .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')"
```

Expected: `Script executed successfully.` Then VERIFY (db execute returns no rows — use a script that raises if wrong):

```bash
npx prisma db execute --url "<same url>" --stdin <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'signature_status' AND e.enumlabel = 'rendered')
    THEN RAISE EXCEPTION 'rendered missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'generated_documents' AND column_name = 'payload')
    THEN RAISE EXCEPTION 'payload column missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'generated_documents_boces_quote_owner_key')
    THEN RAISE EXCEPTION 'boces upsert index missing'; END IF;
END $$;
SQL
```

- [ ] **Step 4:** `npx prisma generate`, then `npx vitest run src/features/document-generation src/app/api/document-generation src/app/api/webhooks/dropbox-sign` — all green.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): sp5 schema — payload, promoted columns, executed-pdf fields, rendered status"`

---

### Task 2: `promotedFields` helper

**Files:**
- Create: `src/features/document-generation/lib/persist.ts`
- Test: `src/features/document-generation/lib/__tests__/persist.test.ts`

- [ ] **Step 1: Failing tests:**

```ts
import { describe, it, expect } from "vitest";
import { promotedFields } from "../persist";
import { assemblePayload } from "../payload";
import { emptyFormState } from "../payload-types";

// Minimal states via the same fixtures payload.test.ts uses (copy the `jane` fixture shape).
const jane = { id: "c1", firstName: "Jane", lastName: "Doe", title: "CFO", email: "jane@d.org", phone: "555", salutation: "Ms." };

describe("promotedFields", () => {
  it("extracts report columns from a contract payload", () => {
    const s = emptyFormState("contract", "0601234");
    s.clientContact = jane;
    s.paymentType = "A";
    s.schoolYear = "2026 - 2027";
    s.startDate = "2026-07-01";
    s.endDate = "2027-06-30";
    const p = assemblePayload(s);
    const f = promotedFields(p);
    expect(f.paymentType).toBe("A");
    expect(f.schoolYear).toBe("2026 - 2027");
    expect(f.startDate?.toISOString()).toContain("2026-07-01");
    expect(f.endDate?.toISOString()).toContain("2027-06-30");
    expect(f.orderTotal).toBe(0); // empty line items
    expect(f.quoteNumber).toBeNull(); // contracts have no quote number
  });
  it("extracts quote number + total from a boces payload, nulls blank dates", () => {
    const s = emptyFormState("boces_quote", "0601234");
    s.clientContact = jane;
    s.quoteNumber = "Q-1042";
    s.startDate = "";
    s.endDate = "";
    const p = assemblePayload(s);
    const f = promotedFields(p);
    expect(f.quoteNumber).toBe("Q-1042");
    expect(f.startDate).toBeNull();
    expect(f.schoolYear).toBeNull(); // BOCES has no school year
  });
});
```

(Adapt the `jane`/`emptyFormState` shapes to the real `ContactRef`/signature — copy from `payload.test.ts`.)

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/features/document-generation/lib/__tests__/persist.test.ts`

- [ ] **Step 3: Implement** `persist.ts`:

```ts
// Extracts the promoted report columns from a DocPayload for generated_documents.
// Shared by the send route (contracts) and the render route (BOCES quotes) so the
// two write paths can't drift.
import type { DocPayload } from "./payload-types";

export interface PromotedFields {
  orderTotal: number;
  paymentType: string;
  startDate: Date | null;
  endDate: Date | null;
  schoolYear: string | null;
  quoteNumber: string | null;
}

// Form dates are "YYYY-MM-DD"; store as UTC midnight so @db.Date keeps the day.
function toDate(s: string | undefined): Date | null {
  return s && s.trim() !== "" ? new Date(`${s}T00:00:00Z`) : null;
}

export function promotedFields(payload: DocPayload): PromotedFields {
  const deal = payload.deal as Record<string, string>;
  return {
    orderTotal: payload.quote.order_total,
    paymentType: String(payload.payment.type ?? ""),
    startDate: toDate(deal.start_date),
    endDate: toDate(deal.end_date),
    schoolYear: deal.school_year?.trim() ? deal.school_year : null,
    quoteNumber: deal.quote_number?.trim() ? deal.quote_number : null,
  };
}
```

(Verify `payload.quote.order_total` and `payload.payment.type` against `payload-types.ts` — both exist on contract and boces payloads; adjust property access if the types require narrowing.)

- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): promotedFields extracts report columns from DocPayload"`

---

### Task 3: `/send` persists payload + promoted columns

**Files:**
- Modify: `src/app/api/document-generation/send/route.ts` (the `prisma.generatedDocument.create` data block)
- Test: `src/app/api/document-generation/send/__tests__/route.test.ts`

- [ ] **Step 1: Failing test** (append; reuse the file's `req`/`CONTRACT`/`mockCreate` helpers — extend `CONTRACT` with `quote: { order_total: 5869 }`-style fields if it's minimal; check what `promotedFields` needs and make the fixture satisfy it):

```ts
it("persists the payload and promoted report columns", async () => {
  await POST(req({ payload: CONTRACT, districtLeaId: "0601234" }));
  const data = mockCreate.mock.calls[0][0].data;
  expect(data.payload).toEqual(CONTRACT);
  expect(data.orderTotal).toBe(CONTRACT.quote.order_total);
  expect(data.paymentType).toBe(CONTRACT.payment.type);
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/app/api/document-generation/send`

- [ ] **Step 3: Implement** — in the route: `import { promotedFields } from "@/features/document-generation/lib/persist";`, then in the create data:

```ts
const promoted = promotedFields(payload);
...
data: {
  ...existing fields unchanged...,
  payload: payload as object,
  ...promoted,
},
```

(`payload` is typed `DocPayload`; Prisma `Json` accepts it via `as object` or `as Prisma.InputJsonValue` — match the codebase's existing Json-write pattern if one exists; otherwise `as unknown as Prisma.InputJsonValue` with the `Prisma` import.)

- [ ] **Step 4: Run, verify PASS** (whole send dir).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): send route persists payload + promoted report columns"`

---

### Task 4: BOCES render rows — upsert on `/render`

**Files:**
- Modify: `src/features/document-generation/lib/persist.ts` (add `upsertBocesRender`)
- Modify: `src/app/api/document-generation/render/route.ts`
- Modify: `src/features/document-generation/lib/render-client.ts` (`appsScriptRenderClient` body gains `districtLeaId`)
- Modify: `src/features/document-generation/lib/payload-types.ts` (`RenderClient` opts type gains `districtLeaId?: string`)
- Modify: `src/features/document-generation/components/GenerateDocumentModal.tsx` (pass `districtLeaId` in the render call's opts)
- Test: `src/features/document-generation/lib/__tests__/persist.test.ts`, `src/app/api/document-generation/render/__tests__/route.test.ts` (check it exists; create following the send route test's mock pattern if not)

- [ ] **Step 1: Failing persist tests** (mock prisma like the send-route test does — `vi.hoisted` + `vi.mock("@/lib/prisma", ...)` with `findFirst`/`update`/`create` mocks):

```ts
describe("upsertBocesRender", () => {
  it("creates a rendered row for a new quote number", async () => {
    mockFindFirst.mockResolvedValue(null);
    await upsertBocesRender({ payload: BOCES_PAYLOAD, docUrl: "https://docs.google.com/document/d/D1/edit", docId: "D1", districtLeaId: "0601234", ownerProfileId: "u1" });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ docType: "boces_quote", status: "rendered", quoteNumber: "Q-1042", ownerProfileId: "u1" }),
    }));
  });
  it("updates the existing row on re-render of the same quote number", async () => {
    mockFindFirst.mockResolvedValue({ id: 9 });
    await upsertBocesRender({ payload: BOCES_PAYLOAD, docUrl: "u2", docId: "D2", districtLeaId: null, ownerProfileId: "u1" });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9 } }));
  });
  it("skips silently when quote number is blank", async () => {
    await upsertBocesRender({ payload: BOCES_NO_QN, docUrl: "u", docId: "D", districtLeaId: null, ownerProfileId: "u1" });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
```

(Build `BOCES_PAYLOAD` via `assemblePayload(emptyFormState("boces_quote", ...))` with `quoteNumber = "Q-1042"`; `BOCES_NO_QN` with it blank. NOTE: persist.test.ts now needs the prisma mock — if mixing pure `promotedFields` tests and mocked `upsertBocesRender` tests in one file gets awkward, split into `persist-upsert.test.ts`.)

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement `upsertBocesRender`** in `persist.ts`:

```ts
// additions to persist.ts — promotedFields is defined in this same file (Task 2)
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface BocesRenderInput {
  payload: DocPayload;          // doc_type "boces_quote"
  docUrl: string;
  docId: string;
  districtLeaId: string | null;
  ownerProfileId: string;
}

/** Records a successful BOCES-quote render. Render is the quote's terminal action
 *  (no eSign), so one row per (quote number, owner) — re-renders update in place.
 *  Blank quote number → no row (validation requires it, but never trust input). */
export async function upsertBocesRender(input: BocesRenderInput): Promise<void> {
  const promoted = promotedFields(input.payload);
  if (!promoted.quoteNumber) return;
  const existing = await prisma.generatedDocument.findFirst({
    where: { docType: "boces_quote", quoteNumber: promoted.quoteNumber, ownerProfileId: input.ownerProfileId },
    select: { id: true },
  });
  const fields = {
    docUrl: input.docUrl,
    docId: input.docId,
    payload: input.payload as unknown as Prisma.InputJsonValue,
    ...promoted,
    ...(input.districtLeaId ? { districtLeaId: input.districtLeaId } : {}),
  };
  if (existing) {
    await prisma.generatedDocument.update({ where: { id: existing.id }, data: fields });
  } else {
    await prisma.generatedDocument.create({
      data: { ...fields, docType: "boces_quote", status: "rendered", recipientEmail: "", companyName: String((input.payload.deal as Record<string, string>).client_company ?? ""), ownerProfileId: input.ownerProfileId },
    });
  }
}
```

(Adjust Prisma Json typing to match Task 3's chosen pattern. The DB's partial unique index backstops the find-then-write race.)

- [ ] **Step 4: Wire the render route.** Body type gains `districtLeaId?: string`. After a successful `renderViaAppsScript` for `doc_type === "boces_quote"`:

```ts
if (body.payload.doc_type === "boces_quote") {
  try {
    const docId = docIdFromUrl(result.docUrl) ?? "";
    await upsertBocesRender({ payload: body.payload, docUrl: result.docUrl, docId, districtLeaId: body.districtLeaId ?? null, ownerProfileId: user.id });
  } catch (persistError) {
    console.error("BOCES render persist error:", persistError); // never break the render response
  }
}
```

`docIdFromUrl` lives in `src/features/document-generation/lib/ids.ts` — CHECK that file first; if a doc-id-from-url helper already exists under another name, use it. If absent, add it in THIS task (Task 8 reuses it):

```ts
/** Extracts the Drive file id from a Google Docs URL ("/d/<id>/"). */
export function docIdFromUrl(url: string): string | null {
  return /\/d\/([^/]+)/.exec(url)?.[1] ?? null;
}
```

with a unit test in the neighboring ids test file (or a new `__tests__/ids.test.ts`): `expect(docIdFromUrl("https://docs.google.com/document/d/ABC123/edit")).toBe("ABC123")` and `expect(docIdFromUrl("nonsense")).toBeNull()`.

Route tests: add cases — boces render creates the upsert call (mock persist lib OR prisma); contract render does NOT; upsert throwing still returns 200 with the render result. If no render route test file exists, create one mirroring the send route test's mock structure (`mockGetUser`, mock `renderViaAppsScript`, mock `persist`).

- [ ] **Step 5: Wire the client + modal.** `RenderClient` opts type (in `payload-types.ts`): `{ tags: boolean; districtLeaId?: string }`. `appsScriptRenderClient` includes `districtLeaId: opts.districtLeaId` in the POST body. `GenerateDocumentModal.doRender` passes `{ tags, districtLeaId: state.districtLeaId }`. `stubRenderClient` signature follows the type but ignores the new opt. Update any RenderClient-typed test fakes that now fail to compile.

- [ ] **Step 6: Run** — `npx vitest run src/features/document-generation src/app/api/document-generation` — all green.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat(doc-gen): BOCES quote renders persist as rendered rows (upsert by quote number)"`

---

### Task 5: Drive archive lib

**Files:**
- Modify: `src/features/document-generation/lib/render-apps-script.ts` (export `buildJwt`)
- Create: `src/features/document-generation/lib/drive-archive.ts`
- Test: `src/features/document-generation/lib/__tests__/drive-archive.test.ts`

- [ ] **Step 1:** In `render-apps-script.ts`, change `function buildJwt()` to `export function buildJwt()` (it already includes the `drive` scope in `SCOPES`).

- [ ] **Step 2: Failing tests** (mock `googleapis`):

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFilesCreate, mockJwt } = vi.hoisted(() => ({
  mockFilesCreate: vi.fn(),
  mockJwt: vi.fn(),
}));
vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: mockJwt },
    drive: () => ({ files: { create: mockFilesCreate } }),
  },
}));
vi.mock("server-only", () => ({}));

import { uploadExecutedPdf } from "../drive-archive";

describe("uploadExecutedPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_DOC_EXECUTED_FOLDER_ID = "FOLDER123";
    process.env.GOOGLE_DOC_RENDER_SUBJECT = "service@fullmindlearning.com";
    process.env.GOOGLE_DOC_RENDER_SA_EMAIL = "sa@x.iam.gserviceaccount.com";
    process.env.GOOGLE_DOC_RENDER_SA_KEY = "k";
    mockFilesCreate.mockResolvedValue({ data: { id: "F1", webViewLink: "https://drive.google.com/file/d/F1/view" } });
  });

  it("uploads into the executed folder and returns id + link", async () => {
    const out = await uploadExecutedPdf(Buffer.from("%PDF"), "Acme — signed.pdf");
    expect(mockFilesCreate).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({ name: "Acme — signed.pdf", parents: ["FOLDER123"] }),
      fields: "id, webViewLink",
    }));
    expect(out).toEqual({ fileId: "F1", url: "https://drive.google.com/file/d/F1/view" });
  });
  it("throws when the folder env var is missing", async () => {
    delete process.env.GOOGLE_DOC_EXECUTED_FOLDER_ID;
    await expect(uploadExecutedPdf(Buffer.from("x"), "n.pdf")).rejects.toThrow(/GOOGLE_DOC_EXECUTED_FOLDER_ID/);
  });
});
```

(Adapt the googleapis mock to how `render-apps-script.ts`'s existing tests mock it — check `__tests__` for a render-apps-script test and mirror its approach. If `vi.mock("server-only")` is already globally handled in vitest setup, drop that line.)

- [ ] **Step 3: Run, verify FAIL**, then implement `drive-archive.ts`:

```ts
import "server-only";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { buildJwt } from "./render-apps-script";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Uploads an executed-contract PDF into the Executed Drive folder.
 *  Auth reuses the doc-gen service account (DWD grant already includes drive). */
export async function uploadExecutedPdf(pdf: Buffer, filename: string): Promise<{ fileId: string; url: string }> {
  const folderId = requireEnv("GOOGLE_DOC_EXECUTED_FOLDER_ID");
  const drive = google.drive({ version: "v3", auth: buildJwt() });
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: "application/pdf", body: Readable.from(pdf) },
    fields: "id, webViewLink",
  });
  if (!res.data.id) throw new Error("Drive upload returned no file id");
  return { fileId: res.data.id, url: res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view` };
}
```

- [ ] **Step 4: Run, verify PASS.**
- [ ] **Step 5:** Add `GOOGLE_DOC_EXECUTED_FOLDER_ID=` to `.env.example` with a one-line comment.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(doc-gen): drive-archive uploads executed PDFs to the Executed folder"`

---

### Task 6: Dropbox Sign executed-file download lib

**Files:**
- Create: `src/features/document-generation/lib/dropbox-files.ts`
- Test: `src/features/document-generation/lib/__tests__/dropbox-files.test.ts`

- [ ] **Step 1: Failing tests** (mock global fetch):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchExecutedPdf } from "../dropbox-files";

describe("fetchExecutedPdf", () => {
  const realFetch = global.fetch;
  beforeEach(() => { process.env.DROPBOX_SIGN_API_KEY = "k"; });
  afterEach(() => { global.fetch = realFetch; });

  it("returns the PDF buffer on 200", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(Buffer.from("%PDF-1.7"), { status: 200 }));
    const buf = await fetchExecutedPdf("sig_1");
    expect(buf?.subarray(0, 4).toString()).toBe("%PDF");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.hellosign.com/v3/signature_request/files/sig_1?file_type=pdf",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining("Basic ") }) }),
    );
  });
  it("returns null when the file is not ready yet (409)", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("conflict", { status: 409 }));
    expect(await fetchExecutedPdf("sig_1")).toBeNull();
  });
  it("throws on other failures", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(fetchExecutedPdf("sig_1")).rejects.toThrow(/500/);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**, implement:

```ts
import "server-only";

/** Downloads the executed PDF for a completed signature request.
 *  Returns null when Dropbox Sign hasn't finished assembling the file yet
 *  (409 conflict) — the caller leaves the archive columns empty rather than retrying
 *  inside the webhook. Throws on any other non-200. */
export async function fetchExecutedPdf(signatureRequestId: string): Promise<Buffer | null> {
  const apiKey = process.env.DROPBOX_SIGN_API_KEY ?? "";
  const res = await fetch(
    `https://api.hellosign.com/v3/signature_request/files/${encodeURIComponent(signatureRequestId)}?file_type=pdf`,
    { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` } },
  );
  if (res.status === 409) return null;
  if (!res.ok) throw new Error(`Dropbox Sign files returned HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
```

VERIFICATION ITEM (do this in Step 2, before settling the 409 branch): check current Dropbox Sign docs (`developers.hellosign.com` / Dropbox Sign API reference, signature_request/files) for the actual not-ready status code (`409 conflict` with `file_not_ready`-style error is the documented historical behavior — confirm, and match whatever it really is; if it's a different code, adapt code+test and note it in the commit message).

- [ ] **Step 3: Run, verify PASS.**
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(doc-gen): dropbox-files downloads executed PDFs"`

---

### Task 7: Webhook archive integration

**Files:**
- Modify: `src/app/api/webhooks/dropbox-sign/route.ts`
- Test: `src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts`

- [ ] **Step 1: Failing tests** (the file mocks prisma via `mockUpdateMany`; extend the prisma mock with `findUnique` + `update`, and mock the two new libs):

```ts
const { mockUpdateMany, mockFindUnique, mockRowUpdate, mockFetchPdf, mockUpload } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockRowUpdate: vi.fn(),
  mockFetchPdf: vi.fn(),
  mockUpload: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { updateMany: mockUpdateMany, findUnique: mockFindUnique, update: mockRowUpdate } } }));
vi.mock("@/features/document-generation/lib/dropbox-files", () => ({ fetchExecutedPdf: mockFetchPdf }));
vi.mock("@/features/document-generation/lib/drive-archive", () => ({ uploadExecutedPdf: mockUpload }));

it("archives the executed PDF on all_signed", async () => {
  mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme ISD", executedPdfFileId: null });
  mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
  mockUpload.mockResolvedValue({ fileId: "F1", url: "https://drive/f1" });
  const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
  expect(res.status).toBe(200);
  expect(mockUpload).toHaveBeenCalled();
  expect(mockRowUpdate).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: 5 },
    data: { executedPdfUrl: "https://drive/f1", executedPdfFileId: "F1" },
  }));
});
it("skips archiving when the row already has an executed file (idempotent across signed events)", async () => {
  mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", executedPdfFileId: "F-old" });
  await POST(eventForm("signature_request_all_signed", "sig_1"));
  expect(mockFetchPdf).not.toHaveBeenCalled();
});
it("still acks when archiving fails", async () => {
  mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", executedPdfFileId: null });
  mockFetchPdf.mockRejectedValue(new Error("boom"));
  const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("Hello API Event Received");
});
it("does not archive on non-signed events", async () => {
  await POST(eventForm("signature_request_viewed", "sig_1"));
  expect(mockFindUnique).not.toHaveBeenCalled();
});
it("leaves columns untouched when the PDF is not ready yet (null)", async () => {
  mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", executedPdfFileId: null });
  mockFetchPdf.mockResolvedValue(null);
  const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
  expect(res.status).toBe(200);
  expect(mockUpload).not.toHaveBeenCalled();
});
```

(Keep ALL existing tests passing — the new prisma mock keys must not disturb them.)

- [ ] **Step 2: Run, verify new tests FAIL.**

- [ ] **Step 3: Implement** — in the webhook route, after the existing `updateMany` block (inside the `if (status && sigId)` branch):

```ts
// Archive the executed PDF on signed events. Strictly best-effort: any failure
// logs and leaves the columns null — Dropbox Sign must always get the ack.
if (status === "signed") {
  try {
    const row = await prisma.generatedDocument.findUnique({
      where: { signatureRequestId: sigId },
      select: { id: true, companyName: true, executedPdfFileId: true },
    });
    if (row && !row.executedPdfFileId) {
      const pdf = await fetchExecutedPdf(sigId);
      if (pdf) {
        const today = new Date().toISOString().slice(0, 10);
        const name = `${row.companyName || "Contract"} — signed ${today} (${sigId.slice(0, 8)}).pdf`;
        const uploaded = await uploadExecutedPdf(pdf, name);
        await prisma.generatedDocument.update({
          where: { id: row.id },
          data: { executedPdfUrl: uploaded.url, executedPdfFileId: uploaded.fileId },
        });
      }
    }
  } catch (archiveError) {
    console.error("Executed-PDF archive error:", archiveError);
  }
}
```

(Both `signature_request_signed` and `signature_request_all_signed` map to `signed` — the `executedPdfFileId` guard makes the second event a no-op.)

- [ ] **Step 4: Run** — `npx vitest run src/app/api/webhooks/dropbox-sign` all green (old + new).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): webhook archives executed PDFs to Drive on signed"`

---

### Task 8: PDF-first Review stage

**Files:**
- Modify: `src/features/document-generation/components/review/ReviewStage.tsx`
- Test: `src/features/document-generation/components/review/__tests__/ReviewStage.test.tsx`
- Uses: `docIdFromUrl` from `src/features/document-generation/lib/ids.ts` (created in Task 4 if it didn't already exist).

- [ ] **Step 1: Failing tests:**

```tsx
it("offers a View PDF primary action derived from the doc URL", () => {
  render(<ReviewStage {...base} />); // base.result.docUrl = "https://docs.google.com/document/d/DOC123/edit"
  const pdf = screen.getByRole("link", { name: /view pdf/i });
  expect(pdf).toHaveAttribute("href", "https://docs.google.com/document/d/DOC123/export?format=pdf");
});
it("keeps the Google Doc link as the manual-edit escape hatch", () => {
  render(<ReviewStage {...base} />);
  expect(screen.getByRole("link", { name: /edit in google docs/i })).toHaveAttribute("href", base.result.docUrl);
});
it("explains that manual edits do not flow into Send", () => {
  render(<ReviewStage {...base} docType="contract" />);
  expect(screen.getByText(/Send re-renders a clean copy/i)).toBeInTheDocument();
});
```

(Adapt to the file's existing `base` helper. Update existing tests that assert the old "Open the rendered document" link text.)

- [ ] **Step 2: Run, verify FAIL.**

- [ ] **Step 3: Implement.** Replace the current header link block with:

```tsx
const docId = docIdFromUrl(result.docUrl);
...
<div className="flex flex-wrap items-center gap-2">
  {docId && (
    <a href={`https://docs.google.com/document/d/${docId}/export?format=pdf`} target="_blank" rel="noreferrer"
      className="rounded-lg bg-[#403770] px-3 py-1 text-sm text-white whitespace-nowrap">View PDF ↓</a>
  )}
  <a href={result.docUrl} target="_blank" rel="noreferrer"
    className="text-sm text-[#403770] underline whitespace-nowrap">Edit in Google Docs ↗</a>
</div>
{docType === "contract" && (
  <p className="text-xs text-[#6E6390]">
    Manual doc edits don&apos;t carry into sending — Send re-renders a clean copy. The PDF always shows the doc&apos;s current state.
  </p>
)}
```

`docIdFromUrl` (in `ids.ts` if not already there):

```ts
/** Extracts the Drive file id from a Google Docs URL ("/d/<id>/"). */
export function docIdFromUrl(url: string): string | null {
  return /\/d\/([^/]+)/.exec(url)?.[1] ?? null;
}
```

Keep the order total, agreement link, send banner, and button row as they are. Narrow-width: action row is `flex flex-wrap` with `whitespace-nowrap` on each action — required by house rules.

- [ ] **Step 4: Run** — `npx vitest run src/features/document-generation/components/review` + the full feature dir; all green.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): PDF-first review actions — View PDF / Edit in Docs / Send"`

---

### Task 9: Query-tool registration

**Files:**
- Modify: `src/lib/district-column-metadata.ts` (remove from `excludedTables` ~line 3800; add `GENERATED_DOCUMENT_COLUMNS` + a `generated_documents` `TABLE_REGISTRY` entry)
- Test: `src/lib/__tests__/district-column-metadata.test.ts` (the schema-coverage test enforces membership — it should keep passing for this table, now via the registry)

- [ ] **Step 1:** Remove `"generated_documents"` (and its comment block) from `excludedTables`.

- [ ] **Step 2:** Add the columns array (place near the other `*_COLUMNS` consts; match the compact one-line style of `ACTIVITY_COLUMNS`). FIRST check the `ColumnDomain`/`DataFormat`/`DataSource` union types at the top of the file and use valid literals — the values below are intent, not gospel (`domain: "crm"`, `source: "user"`, formats `text`/`date`/`currency`/`boolean` — verify `currency` exists; if not, use the file's money-format literal):

```ts
export const GENERATED_DOCUMENT_COLUMNS: ColumnMetadata[] = [
  { field: "id", column: "id", label: "Document ID", description: "Serial PK.", domain: "crm", format: "integer", source: "user", queryable: true },
  { field: "docType", column: "doc_type", label: "Doc Type", description: "'contract' (sent for signature) or 'boces_quote' (rendered quote, no eSign).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "status", column: "status", label: "Status", description: "Lifecycle: 'rendered' (BOCES quotes — terminal at render), 'processing' (send accepted, awaiting webhook), 'sent', 'viewed', 'signed', 'declined', 'canceled', 'error'. For 'executed contracts' filter status='signed'; for 'open signature requests' use sent/viewed/processing.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "companyName", column: "company_name", label: "Company", description: "Client company/district name as it appears on the document.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "recipientEmail", column: "recipient_email", label: "Recipient", description: "Signer email for contracts; empty for BOCES quotes.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "orderTotal", column: "order_total", label: "Order Total", description: "Total dollar value of the quoted/contracted order.", domain: "crm", format: "currency", source: "user", queryable: true },
  { field: "paymentType", column: "payment_type", label: "Payment Type", description: "A (standard) / B (customized) / C (BOCES standardized).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "startDate", column: "start_date", label: "Service Start", description: "Contract/quote service start date.", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "endDate", column: "end_date", label: "Service End", description: "Contract/quote service end date.", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "schoolYear", column: "school_year", label: "School Year", description: "e.g. '2026 - 2027'. Contracts only — null for BOCES quotes.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "quoteNumber", column: "quote_number", label: "Quote #", description: "BOCES quote number — null for contracts. One row per quote number per owner (re-renders update in place).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "districtLeaId", column: "district_lea_id", label: "District LEA ID", description: "FK to districts.leaid (nullable).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "ownerProfileId", column: "owner_profile_id", label: "Owner", description: "FK to user_profiles.id — the rep who generated it.", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "opportunityId", column: "opportunity_id", label: "Opportunity ID", description: "FK to opportunities — null until the opportunity entry points ship (SP3).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "executedPdfUrl", column: "executed_pdf_url", label: "Executed PDF", description: "Drive link to the signed PDF; null until signing completes (or if archiving failed).", domain: "crm", format: "text", source: "user", queryable: true },
  { field: "docUrl", column: "doc_url", label: "Doc URL", description: "Google Doc link to the rendered (unsigned) document.", domain: "crm", format: "text", source: "user", queryable: false },
  { field: "sentAt", column: "sent_at", label: "Sent At", description: "When the signature send was initiated (null for BOCES quotes).", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "signedAt", column: "signed_at", label: "Signed At", description: "When signing completed.", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "createdAt", column: "created_at", label: "Created At", description: "Row creation (render time for quotes, send time for contracts).", domain: "crm", format: "date", source: "user", queryable: true },
  { field: "updatedAt", column: "updated_at", label: "Updated At", description: "Last lifecycle/render update.", domain: "crm", format: "date", source: "user", queryable: true },
];
```

- [ ] **Step 3:** Registry entry (alphabetical/grouped placement matching the file's ordering):

```ts
  generated_documents: {
    table: "generated_documents",
    description:
      "Doc-gen outputs — contracts sent for Dropbox Sign signature plus rendered BOCES quotes, with order totals, payment terms, service dates, and signature lifecycle. One row per send (contracts) or per quote number per owner (BOCES; re-renders update in place). Query this for 'what did we quote/contract this month', win-through-signature funnels (sent→viewed→signed), executed-contract lookups (status='signed', executed_pdf_url), or quote volume by district/rep.",
    primaryKey: "id",
    columns: GENERATED_DOCUMENT_COLUMNS,
    excludedColumns: ["payload", "doc_id", "signature_request_id", "error_message", "executed_pdf_file_id"],
    relationships: [
      { toTable: "districts", type: "many-to-one", joinSql: "generated_documents.district_lea_id = districts.leaid", description: "District the document was generated for" },
      { toTable: "user_profiles", type: "many-to-one", joinSql: "generated_documents.owner_profile_id = user_profiles.id", description: "Rep who generated/sent it" },
      { toTable: "opportunities", type: "many-to-one", joinSql: "generated_documents.opportunity_id = opportunities.id", description: "Source opportunity (null until SP3 entry points ship)" },
    ],
  },
```

(VERIFY the `opportunities` PK column name in the registry's existing opportunities entry before writing `opportunities.id` — match whatever join key its other relationships use. Same check for `user_profiles`.)

- [ ] **Step 4: Run** — `npx vitest run src/lib/__tests__/district-column-metadata.test.ts`. The coverage test must accept the table via TABLE_REGISTRY now. (It still fails on the four OTHER features' tables — pre-existing; confirm `generated_documents` is not in the failure list.)
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): register generated_documents in the reports query-tool registry"`

---

### Task 10: Full verification

- [ ] `npx vitest run` — only the pre-existing main failures (notes ×2, pipeline ×1, schema-coverage's four foreign tables). Tile-route test may flake under parallel load — rerun in isolation before concluding.
- [ ] `git diff --name-only main...HEAD -- '*.ts' '*.tsx' | xargs npx eslint` — clean.
- [ ] `npx tsc --noEmit` — error set identical to main (compare counts/files; `npx prisma generate && rm -rf .next` first if phantom errors).
- [ ] Commit any fixes.

---

## Deployment + e2e verification (manual, after suite green)

1. **One-time setup (user-gated):** enable Drive API in GCP `fullmind-doc-gen`; create the "Executed" Drive folder (suggest sibling of `_output`, shared with the workspace); put its ID in `.env.local` as `GOOGLE_DOC_EXECUTED_FOLDER_ID` (and Vercel at cutover).
2. Dev server (3005) + ngrok + Dropbox callback → tunnel (same drill as SP4; the ngrok free domain is static per account, so the dashboard URL likely still matches).
3. **Contract e2e:** test-mode send → sign it → row walks `processing → sent → signed` AND `executed_pdf_url` populates; the PDF appears in the Executed folder and opens.
4. **BOCES e2e:** render a quote with quote number → row appears (`status='rendered'`, payload + promoted columns populated); re-render the same quote number → same row updated, no duplicate; **View PDF** button downloads the doc as PDF; confirm the export URL works for a non-owner rep (spec verification item — if blocked, file the server-proxy fallback as follow-up).
5. **Reports:** ask the query tool a "quotes this month by district with totals" question; confirm it reaches `generated_documents`.
6. Restore tunnel/callback as needed.

## Out of scope (per spec)

Monitoring view UI; SP3 entry points; archive retry/backfill; line-item normalization; prod cutover; backfill of pre-SP5 rows.
