# Sea Monkey SP6 — Naming Convention + Slack Auto-Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give executed PDFs and rendered Google Docs a deliberate school-year-first naming convention, and auto-post the executed agreement (PDF attached) to `#contracts-signed` when signing completes.

**Architecture:** Both features hang off the SP5 Dropbox Sign webhook's `signed` block. A new pure helper module (`naming.ts`) builds executed-PDF filenames; a new `slack-notify.ts` posts via Slack's external-upload flow using env-configured bot credentials; the webhook wires both in with strict best-effort isolation. Apps Script gets mirrored naming helpers (cross-language twins) for the rendered docs in `_output`.

**Tech Stack:** Next.js App Router route handler, Prisma, Slack Web API (`files.getUploadURLExternal` / `files.completeUploadExternal`), Google Apps Script + clasp, Vitest.

**Spec:** `Docs/superpowers/specs/2026-06-11-sea-monkey-sp6-naming-slack-design.md`

---

## Branch setup (before Task 1)

Implementation branch `feat/sea-monkey-sp6` in a worktree off **latest main**, with the docs branch merged in so spec+plan ride along:

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan"
git checkout main && git pull origin main
git worktree add .worktrees/feat-sea-monkey-sp6 -b feat/sea-monkey-sp6 main
cd .worktrees/feat-sea-monkey-sp6
git merge --no-edit docs/sea-monkey-sp6-spec
# Symlink gitignored files (worktrees don't inherit them):
MAIN="/Users/astonfurious/The Laboratory/territory-plan"
for f in .env .env.local; do ln -sf "$MAIN/$f" .; done
ln -sf "$MAIN/scripts/document-generation/appsscript/.clasp.json" scripts/document-generation/appsscript/.clasp.json
```

Run `git branch --show-current` (expect `feat/sea-monkey-sp6`) before dispatching any implementer subagent — subagents commit to whatever HEAD they find.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/features/document-generation/lib/naming.ts` | Create | Pure filename/convention helpers: `formatSchoolYearShort`, `isoDate`, `buildExecutedPdfName` |
| `src/features/document-generation/lib/__tests__/naming.test.ts` | Create | Unit tests for the above |
| `src/features/document-generation/lib/slack-notify.ts` | Create | `buildExecutedMessage` + `postExecutedAgreement` (Slack external upload, env-gated) |
| `src/features/document-generation/lib/__tests__/slack-notify.test.ts` | Create | Unit tests, fetch stubbed |
| `src/app/api/webhooks/dropbox-sign/route.ts` | Modify | Use `buildExecutedPdfName`; read `test_mode`; post to Slack after archive, isolated |
| `src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts` | Modify | New filename assertion + Slack wiring/test-mode/failure-isolation tests |
| `scripts/document-generation/appsscript/Utils.gs` | Modify | `shortSchoolYear` + `isoToday` helpers (TS twins, cite spec) |
| `scripts/document-generation/appsscript/Code.gs` | Modify | Contract docName line (line ~45) |
| `scripts/document-generation/appsscript/BocesQuote.gs` | Modify | BOCES docName line (line ~155) |
| `.env.example` | Modify | `SLACK_BOT_TOKEN`, `SLACK_EXECUTED_CHANNEL_ID` |

Notes for the implementer:
- `src/features/shared/lib/date-utils.ts` was checked — it only has `parseLocalDate` (a parser, not a formatter), so `naming.ts` defines its own `isoDate`. Do not hand-roll date formatting elsewhere; import from `naming.ts`.
- `generated_documents` columns used here: `companyName`, `schoolYear` (e.g. `"2026 - 2027"`, null pre-SP5), `orderTotal` (Prisma `Decimal | null`), `payload` (JSONB; `payload.deal.sender_first` / `sender_last` exist in SP5+ payloads).
- The webhook event JSON carries `signature_request.test_mode: boolean`.

---

### Task 1: `naming.ts` — convention helpers

**Files:**
- Create: `src/features/document-generation/lib/naming.ts`
- Test: `src/features/document-generation/lib/__tests__/naming.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/document-generation/lib/__tests__/naming.test.ts
import { describe, it, expect } from "vitest";
import { formatSchoolYearShort, isoDate, buildExecutedPdfName } from "../naming";

describe("formatSchoolYearShort", () => {
  it("shortens the canonical form", () => {
    expect(formatSchoolYearShort("2026 - 2027")).toBe("SY26-27");
  });
  it("tolerates missing spaces and en-dashes", () => {
    expect(formatSchoolYearShort("2026-2027")).toBe("SY26-27");
    expect(formatSchoolYearShort("2026 – 2027")).toBe("SY26-27");
  });
  it("returns null for null, empty, and unparseable input", () => {
    expect(formatSchoolYearShort(null)).toBeNull();
    expect(formatSchoolYearShort("")).toBeNull();
    expect(formatSchoolYearShort("twenty-six")).toBeNull();
  });
});

describe("isoDate", () => {
  it("formats local YYYY-MM-DD with zero padding", () => {
    expect(isoDate(new Date(2026, 5, 10))).toBe("2026-06-10");
    expect(isoDate(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("buildExecutedPdfName", () => {
  const base = {
    companyName: "Gary Community Schools",
    schoolYear: "2026 - 2027",
    signatureRequestId: "a1b2c3d4e5f6a7b8",
    date: new Date(2026, 5, 10),
  };
  it("builds the full school-year-first name", () => {
    expect(buildExecutedPdfName(base)).toBe(
      "SY26-27 — Gary Community Schools — Contract — signed 2026-06-10 (a1b2c3d4).pdf",
    );
  });
  it("omits the school-year segment when school year is null", () => {
    expect(buildExecutedPdfName({ ...base, schoolYear: null })).toBe(
      "Gary Community Schools — Contract — signed 2026-06-10 (a1b2c3d4).pdf",
    );
  });
  it("omits the company segment when companyName is empty", () => {
    expect(buildExecutedPdfName({ ...base, companyName: "" })).toBe(
      "SY26-27 — Contract — signed 2026-06-10 (a1b2c3d4).pdf",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/document-generation/lib/__tests__/naming.test.ts`
Expected: FAIL — `Cannot find module '../naming'` (or equivalent).

- [ ] **Step 3: Implement `naming.ts`**

```ts
// src/features/document-generation/lib/naming.ts
/**
 * SP6 file-naming convention for doc-gen outputs (see
 * Docs/superpowers/specs/2026-06-11-sea-monkey-sp6-naming-slack-design.md).
 * Apps Script mirrors these in Utils.gs (shortSchoolYear / isoToday) —
 * cross-language twins, keep in sync.
 */

/** "2026 - 2027" → "SY26-27"; null when the input lacks two 4-digit years. */
export function formatSchoolYearShort(schoolYear: string | null | undefined): string | null {
  if (!schoolYear) return null;
  const m = /(\d{4})\s*[-–]\s*(\d{4})/.exec(schoolYear);
  return m ? `SY${m[1].slice(2)}-${m[2].slice(2)}` : null;
}

/** Local-date YYYY-MM-DD (Drive-name safe — no slashes). */
export function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Executed-PDF name: "SY26-27 — <company> — Contract — signed <ISO> (<sigid8>).pdf".
 *  Missing school year / company segments are omitted, never left dangling. */
export function buildExecutedPdfName(opts: {
  companyName: string;
  schoolYear: string | null;
  signatureRequestId: string;
  date: Date;
}): string {
  const sy = formatSchoolYearShort(opts.schoolYear);
  const segments = [
    ...(sy ? [sy] : []),
    ...(opts.companyName ? [opts.companyName] : []),
    "Contract",
    `signed ${isoDate(opts.date)} (${opts.signatureRequestId.slice(0, 8)})`,
  ];
  return `${segments.join(" — ")}.pdf`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/document-generation/lib/__tests__/naming.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/naming.ts src/features/document-generation/lib/__tests__/naming.test.ts
git commit -m "feat(doc-gen): SP6 naming helpers — school-year-first executed-PDF names"
```

---

### Task 2: `slack-notify.ts` — executed-agreement post

**Files:**
- Create: `src/features/document-generation/lib/slack-notify.ts`
- Test: `src/features/document-generation/lib/__tests__/slack-notify.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/features/document-generation/lib/__tests__/slack-notify.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildExecutedMessage, postExecutedAgreement } from "../slack-notify";

const NOTICE = {
  pdf: Buffer.from("%PDF-fake"),
  filename: "SY26-27 — Acme ISD — Contract — signed 2026-06-10 (a1b2c3d4).pdf",
  companyName: "Acme ISD",
  orderTotal: 20211.18 as number | null,
  schoolYearShort: "SY26-27" as string | null,
  repName: "Aston Arcega" as string | null,
  signedDate: "2026-06-10",
  driveUrl: "https://drive.google.com/file/d/F1/view" as string | null,
};

describe("buildExecutedMessage", () => {
  it("includes company, total, SY, rep, date, and Drive link", () => {
    const msg = buildExecutedMessage(NOTICE);
    expect(msg).toContain("Contract signed — Acme ISD");
    expect(msg).toContain("$20,211.18");
    expect(msg).toContain("SY26-27");
    expect(msg).toContain("sent by Aston Arcega");
    expect(msg).toContain("signed 2026-06-10");
    expect(msg).toContain("https://drive.google.com/file/d/F1/view");
  });
  it("omits null segments without dangling separators", () => {
    const msg = buildExecutedMessage({
      ...NOTICE,
      orderTotal: null,
      schoolYearShort: null,
      repName: null,
      driveUrl: null,
    });
    expect(msg).toContain("Contract signed — Acme ISD");
    expect(msg).toContain("signed 2026-06-10");
    expect(msg).not.toContain("$");
    expect(msg).not.toContain("·  ·");
    expect(msg).not.toContain("Drive:");
  });
});

describe("postExecutedAgreement", () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_EXECUTED_CHANNEL_ID = "C123";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_EXECUTED_CHANNEL_ID;
  });

  function queueHappyPath() {
    mockFetch
      .mockResolvedValueOnce({ // files.getUploadURLExternal
        ok: true,
        json: async () => ({ ok: true, upload_url: "https://files.slack/upload/u1", file_id: "FILE1" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // raw upload POST
      .mockResolvedValueOnce({ // files.completeUploadExternal
        ok: true,
        json: async () => ({ ok: true }),
      });
  }

  it("runs the 3-call external upload sequence", async () => {
    queueHappyPath();
    await postExecutedAgreement(NOTICE);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(String(mockFetch.mock.calls[0][0])).toContain("files.getUploadURLExternal");
    expect(String(mockFetch.mock.calls[1][0])).toBe("https://files.slack/upload/u1");
    expect(String(mockFetch.mock.calls[2][0])).toContain("files.completeUploadExternal");
    const completeBody = JSON.parse(mockFetch.mock.calls[2][1].body as string);
    expect(completeBody.channel_id).toBe("C123");
    expect(completeBody.files[0].id).toBe("FILE1");
    expect(completeBody.initial_comment).toContain("Acme ISD");
  });

  it("skips silently when env vars are missing", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    await expect(postExecutedAgreement(NOTICE)).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when Slack returns ok:false (caller isolates)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "invalid_auth" }),
    });
    await expect(postExecutedAgreement(NOTICE)).rejects.toThrow("invalid_auth");
  });

  it("throws when the byte upload itself fails", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: "https://files.slack/upload/u1", file_id: "FILE1" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(postExecutedAgreement(NOTICE)).rejects.toThrow("500");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/document-generation/lib/__tests__/slack-notify.test.ts`
Expected: FAIL — `Cannot find module '../slack-notify'`.

- [ ] **Step 3: Implement `slack-notify.ts`**

```ts
// src/features/document-generation/lib/slack-notify.ts
import "server-only";

/** Inputs for the executed-agreement Slack post. Null fields are omitted from
 *  the message (pre-SP5 rows lack totals/school year/payload sender). */
export interface ExecutedAgreementNotice {
  pdf: Buffer;
  filename: string;
  companyName: string;
  orderTotal: number | null;
  schoolYearShort: string | null;
  repName: string | null;
  signedDate: string; // ISO YYYY-MM-DD
  driveUrl: string | null;
}

const SLACK_API = "https://slack.com/api";

export function buildExecutedMessage(n: ExecutedAgreementNotice): string {
  const facts = [
    ...(n.orderTotal != null
      ? [n.orderTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })]
      : []),
    ...(n.schoolYearShort ? [n.schoolYearShort] : []),
    ...(n.repName ? [`sent by ${n.repName}`] : []),
    `signed ${n.signedDate}`,
  ];
  const lines = [`🖋️ *Contract signed — ${n.companyName}*`, facts.join(" · ")];
  if (n.driveUrl) lines.push(`Drive: ${n.driveUrl}`);
  return lines.join("\n");
}

/** Posts the executed PDF + summary to the configured channel via Slack's
 *  external-upload flow (files.upload is deprecated). Missing env config is a
 *  silent skip (preview deploys); Slack API failures throw — the webhook
 *  isolates them. Strictly best-effort from the caller's perspective. */
export async function postExecutedAgreement(n: ExecutedAgreementNotice): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_EXECUTED_CHANNEL_ID;
  if (!token || !channel) {
    console.warn("Slack notify skipped: SLACK_BOT_TOKEN / SLACK_EXECUTED_CHANNEL_ID not set");
    return;
  }

  const urlRes = await fetch(`${SLACK_API}/files.getUploadURLExternal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ filename: n.filename, length: String(n.pdf.byteLength) }),
  });
  const urlData = await urlRes.json();
  if (!urlData.ok) throw new Error(`Slack getUploadURLExternal failed: ${urlData.error}`);

  const putRes = await fetch(urlData.upload_url, { method: "POST", body: new Uint8Array(n.pdf) });
  if (!putRes.ok) throw new Error(`Slack file upload failed: HTTP ${putRes.status}`);

  const completeRes = await fetch(`${SLACK_API}/files.completeUploadExternal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ id: urlData.file_id, title: n.filename }],
      channel_id: channel,
      initial_comment: buildExecutedMessage(n),
    }),
  });
  const completeData = await completeRes.json();
  if (!completeData.ok) throw new Error(`Slack completeUploadExternal failed: ${completeData.error}`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/document-generation/lib/__tests__/slack-notify.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/slack-notify.ts src/features/document-generation/lib/__tests__/slack-notify.test.ts
git commit -m "feat(doc-gen): Slack executed-agreement notifier (external upload flow, env-gated)"
```

---

### Task 3: Webhook uses the naming convention

**Files:**
- Modify: `src/app/api/webhooks/dropbox-sign/route.ts` (the `status === "signed"` block, currently lines 68–89)
- Modify: `src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test + update existing mocks**

In `route.test.ts`, the route will now select `schoolYear`, `orderTotal`, `payload` — update every `mockFindUnique.mockResolvedValue({...})` row object to include them (null is fine), e.g.:

```ts
mockFindUnique.mockResolvedValue({
  id: 5, companyName: "Acme ISD", schoolYear: "2026 - 2027",
  orderTotal: null, payload: null, executedPdfFileId: null,
});
```

Then add the filename assertion test:

```ts
it("names the archived PDF with the SP6 convention", async () => {
  mockFindUnique.mockResolvedValue({
    id: 5, companyName: "Acme ISD", schoolYear: "2026 - 2027",
    orderTotal: null, payload: null, executedPdfFileId: null,
  });
  mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
  mockUpload.mockResolvedValue({ fileId: "F1", url: "https://drive/f1" });
  await POST(eventForm("signature_request_all_signed", "sig_12345678"));
  const name = mockUpload.mock.calls[0][1] as string;
  expect(name).toMatch(/^SY26-27 — Acme ISD — Contract — signed \d{4}-\d{2}-\d{2} \(sig_1234\)\.pdf$/);
});
```

- [ ] **Step 2: Run the webhook tests to verify the new one fails**

Run: `npx vitest run src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts`
Expected: the new test FAILS (name still matches the old `— signed <date> (...)` template without the SY prefix); all pre-existing tests PASS.

- [ ] **Step 3: Switch the route to `buildExecutedPdfName`**

In `route.ts`, add the import:

```ts
import { buildExecutedPdfName } from "@/features/document-generation/lib/naming";
```

Extend the `findUnique` select and replace the inline name (current lines 70–79):

```ts
const row = await prisma.generatedDocument.findUnique({
  where: { signatureRequestId: sigId },
  select: {
    id: true, companyName: true, schoolYear: true,
    orderTotal: true, payload: true, executedPdfFileId: true,
  },
});
if (row && !row.executedPdfFileId) {
  const pdf = await fetchExecutedPdf(sigId);
  if (pdf) {
    const name = buildExecutedPdfName({
      companyName: row.companyName,
      schoolYear: row.schoolYear,
      signatureRequestId: sigId,
      date: new Date(),
    });
    const uploaded = await uploadExecutedPdf(pdf, name);
    ...
```

(`const today = ...` line is deleted; everything else in the block stays as-is for this task.)

- [ ] **Step 4: Run the webhook tests to verify all pass**

Run: `npx vitest run src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts`
Expected: PASS (16 tests — 15 pre-existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/dropbox-sign/route.ts src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts
git commit -m "feat(doc-gen): archived executed PDFs use the SP6 school-year-first name"
```

---

### Task 4: Webhook posts to Slack (test-mode aware, failure-isolated)

**Files:**
- Modify: `src/app/api/webhooks/dropbox-sign/route.ts`
- Modify: `src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Add the Slack mock at the top of `route.test.ts` (inside the existing `vi.hoisted` + a new `vi.mock`):

```ts
const { mockUpdateMany, mockFindUnique, mockRowUpdate, mockFetchPdf, mockUpload, mockSlackPost } = vi.hoisted(() => ({
  // ...existing five...
  mockSlackPost: vi.fn(),
}));
vi.mock("@/features/document-generation/lib/slack-notify", () => ({ postExecutedAgreement: mockSlackPost }));
```

Extend `eventForm` to carry test mode:

```ts
function eventForm(eventType: string, sigId: string | null, opts: { tamper?: boolean; testMode?: boolean } = {}) {
  // ...existing...
  ...(sigId
    ? { signature_request: { signature_request_id: sigId, ...(opts.testMode ? { test_mode: true } : {}) } }
    : {}),
```

Add `mockSlackPost.mockResolvedValue(undefined);` to `beforeEach`, plus a signed-row helper and these tests:

```ts
function signedRow() {
  mockFindUnique.mockResolvedValue({
    id: 5, companyName: "Acme ISD", schoolYear: "2026 - 2027",
    orderTotal: { toString: () => "20211.18" }, // Prisma Decimal duck-type; Number() coerces via toString
    payload: { deal: { sender_first: "Aston", sender_last: "Arcega" } },
    executedPdfFileId: null,
  });
  mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
  mockUpload.mockResolvedValue({ fileId: "F1", url: "https://drive/f1" });
}

it("posts the executed agreement to Slack after archiving", async () => {
  signedRow();
  await POST(eventForm("signature_request_all_signed", "sig_12345678"));
  expect(mockSlackPost).toHaveBeenCalledTimes(1);
  const notice = mockSlackPost.mock.calls[0][0];
  expect(notice.companyName).toBe("Acme ISD");
  expect(notice.orderTotal).toBeCloseTo(20211.18);
  expect(notice.schoolYearShort).toBe("SY26-27");
  expect(notice.repName).toBe("Aston Arcega");
  expect(notice.driveUrl).toBe("https://drive/f1");
  expect(notice.filename).toMatch(/^SY26-27 — Acme ISD — Contract — signed/);
});

it("skips Slack entirely for test-mode signings (still archives)", async () => {
  signedRow();
  await POST(eventForm("signature_request_all_signed", "sig_1", { testMode: true }));
  expect(mockUpload).toHaveBeenCalled();
  expect(mockSlackPost).not.toHaveBeenCalled();
});

it("still acks and keeps the archive stamp when Slack throws", async () => {
  signedRow();
  mockSlackPost.mockRejectedValue(new Error("slack down"));
  const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("Hello API Event Received");
  expect(mockRowUpdate).toHaveBeenCalled(); // archive stamp happened before Slack
});

it("posts to Slack with a null Drive link when the Drive upload fails", async () => {
  signedRow();
  mockUpload.mockRejectedValue(new Error("drive down"));
  const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
  expect(res.status).toBe(200);
  expect(mockSlackPost).toHaveBeenCalledTimes(1);
  expect(mockSlackPost.mock.calls[0][0].driveUrl).toBeNull();
});

it("does not post to Slack on non-signed events", async () => {
  await POST(eventForm("signature_request_viewed", "sig_1"));
  expect(mockSlackPost).not.toHaveBeenCalled();
});

it("does not post to Slack when the PDF is not ready", async () => {
  signedRow();
  mockFetchPdf.mockResolvedValue(null);
  await POST(eventForm("signature_request_all_signed", "sig_1"));
  expect(mockSlackPost).not.toHaveBeenCalled();
});
```

Also update the pre-existing test `"still acks when archiving fails"` — its row mock gains the new fields (from Step 1 of Task 3) and it should additionally assert `expect(mockSlackPost).not.toHaveBeenCalled()` (fetch threw, so no PDF buffer exists).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts`
Expected: the 6 new tests FAIL (`mockSlackPost` never called / Drive-failure case currently swallows everything); pre-existing tests PASS.

- [ ] **Step 3: Restructure the signed block in `route.ts`**

Add imports:

```ts
import { buildExecutedPdfName, formatSchoolYearShort, isoDate } from "@/features/document-generation/lib/naming";
import { postExecutedAgreement } from "@/features/document-generation/lib/slack-notify";
```

Extend the `parsed` type:

```ts
signature_request?: { signature_request_id?: string; test_mode?: boolean };
```

Replace the whole `if (status === "signed") { ... }` block with:

```ts
// Post-signing pipeline, strictly best-effort: archive the executed PDF to
// Drive, then announce it in Slack. Each leg has its own catch — a Drive
// failure must not kill the Slack post and vice versa, and Dropbox Sign must
// always get the ack. Idempotency rides the executedPdfFileId guard; the
// known rare signed/all_signed double-fire can double-run this block (spare
// Drive file + duplicate Slack post) — accepted at current volume.
if (status === "signed") {
  try {
    const row = await prisma.generatedDocument.findUnique({
      where: { signatureRequestId: sigId },
      select: {
        id: true, companyName: true, schoolYear: true,
        orderTotal: true, payload: true, executedPdfFileId: true,
      },
    });
    if (row && !row.executedPdfFileId) {
      const pdf = await fetchExecutedPdf(sigId);
      if (pdf) {
        const now = new Date();
        const name = buildExecutedPdfName({
          companyName: row.companyName,
          schoolYear: row.schoolYear,
          signatureRequestId: sigId,
          date: now,
        });

        let uploaded: { fileId: string; url: string } | null = null;
        try {
          uploaded = await uploadExecutedPdf(pdf, name);
          await prisma.generatedDocument.update({
            where: { id: row.id },
            data: { executedPdfUrl: uploaded.url, executedPdfFileId: uploaded.fileId },
          });
        } catch (archiveError) {
          console.error("Executed-PDF archive error:", archiveError);
        }

        // Test-mode signings never reach the channel; the Drive archive above
        // still runs so test e2e flows stay observable.
        if (parsed.signature_request?.test_mode !== true) {
          try {
            const deal = (row.payload as { deal?: Record<string, string> } | null)?.deal;
            const repName =
              [deal?.sender_first, deal?.sender_last].filter(Boolean).join(" ") || null;
            await postExecutedAgreement({
              pdf,
              filename: name,
              companyName: row.companyName,
              orderTotal: row.orderTotal == null ? null : Number(row.orderTotal),
              schoolYearShort: formatSchoolYearShort(row.schoolYear),
              repName,
              signedDate: isoDate(now),
              driveUrl: uploaded?.url ?? null,
            });
          } catch (slackError) {
            console.error("Slack notify error:", slackError);
          }
        }
      }
    }
  } catch (postSignError) {
    console.error("Signed-event post-processing error:", postSignError);
  }
}
```

(The old block's `// Archive the executed PDF...` comment is replaced by the new one above. Nothing else in the file changes.)

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts`
Expected: PASS (22 tests — 16 from Task 3 + 6 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/dropbox-sign/route.ts src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts
git commit -m "feat(doc-gen): auto-post executed agreements to Slack on signing (test-mode aware)"
```

---

### Task 5: Apps Script — rendered-doc names in `_output`

**Files:**
- Modify: `scripts/document-generation/appsscript/Utils.gs` (append helpers)
- Modify: `scripts/document-generation/appsscript/Code.gs:45` (contract docName)
- Modify: `scripts/document-generation/appsscript/BocesQuote.gs:155` (BOCES docName)

No Vitest coverage exists for `.gs` files (existing pattern: manual `Tests.gs` harness + live render). Verification is the live render in Step 4.

- [ ] **Step 1: Append the helpers to `Utils.gs`**

```js
/**
 * Short school-year tag for file names: '2026 - 2027' → 'SY26-27'.
 * Returns '' when the input lacks two 4-digit years (caller omits the segment).
 * Cross-language twin of formatSchoolYearShort in
 * src/features/document-generation/lib/naming.ts — keep in sync (SP6 spec).
 * @param {string} schoolYear
 * @returns {string}
 */
function shortSchoolYear(schoolYear) {
  var m = /(\d{4})\s*[-–]\s*(\d{4})/.exec(String(schoolYear || ''));
  return m ? 'SY' + m[1].slice(2) + '-' + m[2].slice(2) : '';
}

/**
 * Render-time date for file names, ISO yyyy-MM-dd — Drive-name safe (no
 * slashes, unlike deal.today's MM/DD/YYYY which stays the <<today>> format).
 * @returns {string}
 */
function isoToday() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
```

- [ ] **Step 2: Update the contract docName in `Code.gs`**

Replace line 45:

```js
var docName = payload.deal.client_company + ' — Contract ' + payload.deal.today;
```

with:

```js
var sy = shortSchoolYear(payload.deal.school_year);
var docName = (sy ? sy + ' — ' : '') + payload.deal.client_company + ' — Contract — ' + isoToday();
```

(The Dropbox Sign attachment `.setName(docName + '.pdf')` and `'title': docName` lower in the function pick the new name up automatically — do not touch them.)

- [ ] **Step 3: Update the BOCES docName in `BocesQuote.gs`**

Replace line 155:

```js
var docName = payload.deal.client_company + ' — BOCES Quote ' + payload.deal.today;
```

with:

```js
var qn = String(payload.deal.quote_number || '').trim();
var docName = payload.deal.client_company + ' — BOCES Quote' + (qn ? ' ' + qn : '') + ' — ' + isoToday();
```

- [ ] **Step 4: Push, deploy, and verify with a live render**

```bash
cd scripts/document-generation/appsscript
npx clasp push
npx clasp deploy -i AKfycby0oFEDEj77XpMNNZaB9WpOVsHoUBeY1Nsa2nJbvU5J3nyfnTYSmvQHJgh9DdCtoTsy
```

Expected: deploy reports a new version (**@10**). `clasp push` alone does NOT update `/exec` — the deploy step is mandatory. Note: the deploy goes live for production renders immediately; the change is name-only, so this is low-risk.

Then verify: run the dev server (`npm run dev` from the worktree, port 3005), generate one contract and one BOCES quote through the Generate Document form (render only — do NOT send), and confirm in the Drive `_output` folder:
- Contract: `SY26-27 — <company> — Contract — <today ISO>`
- BOCES: `<company> — BOCES Quote <number> — <today ISO>`

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/Utils.gs scripts/document-generation/appsscript/Code.gs scripts/document-generation/appsscript/BocesQuote.gs
git commit -m "feat(doc-gen): SP6 rendered-doc names — ISO dates, SY prefix, BOCES quote number (Apps Script @10)"
```

---

### Task 6: Env documentation + full verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the Slack vars to `.env.example`**

Append after the existing doc-gen block:

```bash
# Slack executed-agreement auto-post (SP6). Bot token from the Fullmind Slack
# app (needs files:write — reinstall after adding the scope); channel id of
# #contracts-signed (invite the bot). Missing vars = post silently skipped.
SLACK_BOT_TOKEN=
SLACK_EXECUTED_CHANNEL_ID=
```

- [ ] **Step 2: Run the full doc-gen + webhook test suites**

Run: `npx vitest run src/features/document-generation src/app/api/webhooks/dropbox-sign src/app/api/document-generation`
Expected: PASS, 0 failures.

- [ ] **Step 3: Lint only the changed files** (full-tree eslint OOMs)

```bash
npx eslint src/features/document-generation/lib/naming.ts \
  src/features/document-generation/lib/slack-notify.ts \
  src/features/document-generation/lib/__tests__/naming.test.ts \
  src/features/document-generation/lib/__tests__/slack-notify.test.ts \
  src/app/api/webhooks/dropbox-sign/route.ts \
  src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts
```

Expected: clean.

- [ ] **Step 4: Commit, push, open PR**

```bash
git add .env.example
git commit -m "chore(doc-gen): document SLACK_BOT_TOKEN + SLACK_EXECUTED_CHANNEL_ID"
git push -u origin feat/sea-monkey-sp6
gh pr create --base main --title "feat(doc-gen): SP6 — naming convention + Slack auto-post of executed agreements" --body "..."
```

PR body should cover: the two features, the spec path, the accepted double-post corners (mirroring the spec), the cutover additions (Slack app `files:write` reinstall, `#contracts-signed` creation, two Vercel env vars), and that Apps Script is deployed @10.

---

## E2e (after PR review, user-gated — needs Slack setup + ngrok)

Not a plan task — checklist for the live verification session:

1. Add `files:write` to the Slack app, reinstall, copy the bot token; create `#contracts-signed` (or a scratch channel first) and invite the bot; put `SLACK_BOT_TOKEN` + `SLACK_EXECUTED_CHANNEL_ID` in `.env.local`.
2. Start `ngrok http 3005`, set `NEXT_PUBLIC_SITE_URL` to the tunnel, point the Dropbox Sign callback at `<tunnel>/api/webhooks/dropbox-sign`, restart dev.
3. Send + sign a test contract. Expected: Drive archive under the new name; **no Slack post** (test mode).
4. Temporarily hardcode-skip the test-mode guard OR flip test mode off for one send to verify the Slack post lands (PDF + message in the channel), then restore.
5. Remove the `.env.local` overrides; killing the tunnel resumes harmless Dropbox 404 emails until prod cutover.

## Cutover additions (join the SP4/5 checklist)

- Slack app: `files:write` scope + reinstall → new bot token.
- Create `#contracts-signed`, invite the bot, capture channel id.
- Vercel Production: `SLACK_BOT_TOKEN` (Sensitive) + `SLACK_EXECUTED_CHANNEL_ID` (alongside pending `GOOGLE_DOC_EXECUTED_FOLDER_ID`, `DROPBOX_SIGN_API_KEY` rotation, callback URL, Apps Script test-mode flip).

---

## Addendum tasks (2026-06-11, smoke-test feedback) — see spec Addendum 2

### Task 7A: School-year data layer (helpers, state, payload meta, promoted column, registry)

**Files:**
- Create: `src/features/document-generation/lib/school-year.ts`
- Test: `src/features/document-generation/lib/__tests__/school-year.test.ts`
- Modify: `src/features/document-generation/lib/payload-types.ts` (DocFormState, ContractPayload, emptyFormState)
- Modify: `src/features/document-generation/lib/payload.ts` (emit meta)
- Modify: `src/features/document-generation/lib/validation.ts` (+ its test)
- Modify: `src/features/document-generation/lib/persist.ts` (+ promoted field; tests)
- Modify: `prisma/schema.prisma` + new migration `prisma/migrations/20260611210000_sp6_school_year_manual/migration.sql`
- Modify: `src/lib/district-column-metadata.ts` (GENERATED_DOCUMENT_COLUMNS entry)

- [ ] **Step 1: failing tests for school-year.ts**

```ts
// src/features/document-generation/lib/__tests__/school-year.test.ts
import { describe, it, expect } from "vitest";
import { schoolYearFromDate, defaultSchoolYear, schoolYearOptions } from "../school-year";

describe("schoolYearFromDate", () => {
  it("maps a fall start to the SY it opens (July-1 boundary)", () => {
    expect(schoolYearFromDate("2026-09-01")).toBe("2026 - 2027");
  });
  it("maps a mid-year (spring) start into the SY in progress", () => {
    expect(schoolYearFromDate("2027-03-01")).toBe("2026 - 2027");
  });
  it("July 1 starts the new SY; June 30 belongs to the old one", () => {
    expect(schoolYearFromDate("2026-07-01")).toBe("2026 - 2027");
    expect(schoolYearFromDate("2026-06-30")).toBe("2025 - 2026");
  });
  it("returns null for empty/invalid input", () => {
    expect(schoolYearFromDate("")).toBeNull();
    expect(schoolYearFromDate("not-a-date")).toBeNull();
  });
});

describe("defaultSchoolYear", () => {
  it("is the SY starting in the current calendar year, all year long", () => {
    expect(defaultSchoolYear(new Date(2026, 5, 11))).toBe("2026 - 2027"); // June
    expect(defaultSchoolYear(new Date(2026, 9, 1))).toBe("2026 - 2027"); // October
  });
});

describe("schoolYearOptions", () => {
  it("offers prev + current + next 4 around the FY rule", () => {
    expect(schoolYearOptions(new Date(2026, 5, 11))).toEqual([
      "2024 - 2025", "2025 - 2026", "2026 - 2027",
      "2027 - 2028", "2028 - 2029", "2029 - 2030",
    ]);
  });
  it("always contains the default", () => {
    const today = new Date(2026, 10, 2);
    expect(schoolYearOptions(today)).toContain(defaultSchoolYear(today));
  });
});
```

- [ ] **Step 2: run → FAIL (module not found)**

- [ ] **Step 3: implement school-year.ts** (separate module from fiscal-year.ts ON PURPOSE — fiscal-year.ts pulls the pricebook import chain; this stays dependency-light. Form dates are ISO from `<input type=date>`, so parseLocalDate suffices.)

```ts
// src/features/document-generation/lib/school-year.ts
import { getCurrentFY } from "@/lib/fiscal-year";
import { parseLocalDate } from "@/features/shared/lib/date-utils";

/** Canonical school-year string for the SY ending in `end` (e.g. 2027 → "2026 - 2027").
 *  This is the format the SP6 naming regex and existing rows use. */
const syForEndYear = (end: number) => `${end - 1} - ${end}`;

/** SY containing the given ISO date (July-1 boundary via the canonical FY rule);
 *  null for empty/unparseable input. */
export function schoolYearFromDate(dateStr: string): string | null {
  const t = dateStr.trim();
  if (!t) return null;
  const d = parseLocalDate(t);
  if (Number.isNaN(d.getTime())) return null;
  return syForEndYear(getCurrentFY(d));
}

/** Pre-dates fallback: the SY that STARTS in the current calendar year —
 *  in June reps quote next fall, in October they're in it; both resolve here. */
export function defaultSchoolYear(today: Date = new Date()): string {
  return syForEndYear(today.getFullYear() + 1);
}

/** Selector window: previous + current (FY rule) + next 4. */
export function schoolYearOptions(today: Date = new Date()): string[] {
  const currentEnd = getCurrentFY(today);
  return Array.from({ length: 6 }, (_, i) => syForEndYear(currentEnd - 1 + i));
}
```

- [ ] **Step 4: run → PASS (7 tests)**

- [ ] **Step 5: state + payload + validation (TDD where there are existing suites)**

`payload-types.ts`: `DocFormState` gains `schoolYearManual: boolean;` (next to `schoolYear`). `ContractPayload` gains `meta: { school_year_manual: boolean };`. `emptyFormState` seeds:

```ts
schoolYear: docType === "contract" ? defaultSchoolYear() : "",
schoolYearManual: false,
```

(import `defaultSchoolYear` from `./school-year` — no cycle: school-year.ts only imports `@/lib/fiscal-year` + shared date-utils).

`payload.ts` contract branch: after `sections`, add

```ts
meta: { school_year_manual: state.schoolYearManual },
```

`validation.ts` inside the `docType === "contract"` block:

```ts
if (!state.schoolYear.trim()) missing.push("School year");
```

Add to the existing validation test file: contract with empty schoolYear → missing contains "School year"; BOCES with empty schoolYear → does not.

- [ ] **Step 6: promoted column**

`prisma/schema.prisma` GeneratedDocument, after `quoteNumber`:

```prisma
schoolYearManual   Boolean         @default(false) @map("school_year_manual")
```

`prisma/migrations/20260611210000_sp6_school_year_manual/migration.sql`:

```sql
-- SP6 Addendum 2: track manual school-year entry (vs the selector)
ALTER TABLE "generated_documents" ADD COLUMN "school_year_manual" BOOLEAN NOT NULL DEFAULT false;
```

Run `npx prisma migrate deploy` (applies to the live DB — additive with default, safe; confirm it reports the migration applied) then `npx prisma generate`.

`persist.ts`: `PromotedFields` gains `schoolYearManual: boolean;`; `promotedFields()` adds

```ts
schoolYearManual: (payload as { meta?: { school_year_manual?: boolean } }).meta?.school_year_manual === true,
```

Extend the existing persist tests: payload with `meta.school_year_manual: true` → field true; payload without meta → false. Verify both write paths (send route create + BOCES upsert) compile — they spread PromotedFields, so the new field flows automatically; if either constructs fields explicitly, add it there.

`district-column-metadata.ts` GENERATED_DOCUMENT_COLUMNS: add an entry next to school_year, mirroring an existing boolean column's shape, description: "True when the rep typed the school year manually instead of picking from the selector — tracks how often the dropdown fails its job (SP6 Addendum 2)."

- [ ] **Step 7: run the full doc-gen suite + registry/schema-coverage test; commit**

```bash
npx vitest run src/features/document-generation src/lib 2>&1 | tail -3
git add -A && git commit -m "feat(doc-gen): school-year helpers, payload meta + promoted school_year_manual column"
```

### Task 7B: School-year selector UI (select, manual toggle, sync, required styling)

**Files:**
- Modify: `src/features/document-generation/components/form/PartiesContactsSection.tsx`
- Test: `src/features/document-generation/components/form/__tests__/PartiesContactsSection.test.tsx`

- [ ] **Step 1: failing tests** — add to the existing section test file: (a) contract renders a combobox labeled "School year *" with the 6 generated options; (b) a value outside the window renders as an extra (first) option and stays selected; (c) clicking "Type manually" swaps to a textbox and fires `onChange({ schoolYearManual: true })`; in manual mode the button reads "Use selector"; (d) changing startDate prop re-derives (component fires `onChange({ schoolYear: <derived> })`) when untouched, but NOT after the user picked a year manually from the select; (e) empty value in manual mode gets the red border class `border-[#F37167]`.

- [ ] **Step 2: implement** — replace the school-year block (the `{!isBoces && (...)}` label at ~line 47) with:

```tsx
{!isBoces && (
  <label className="flex flex-col gap-1">
    <span className="flex items-center justify-between text-xs uppercase tracking-wide text-[#6E6390]">
      School year *
      <button type="button"
        className="text-[10px] normal-case tracking-normal text-[#6E6390] underline hover:text-[#403770]"
        onClick={() => {
          if (state.schoolYearManual) {
            // Back to the selector: re-derive (or default) and resume syncing.
            syTouched.current = false;
            onChange({
              schoolYearManual: false,
              schoolYear: schoolYearFromDate(state.startDate) ?? defaultSchoolYear(),
            });
          } else {
            onChange({ schoolYearManual: true });
          }
        }}>
        {state.schoolYearManual ? "Use selector" : "Type manually"}
      </button>
    </span>
    {state.schoolYearManual ? (
      <input placeholder="e.g. 2026 - 2027" value={state.schoolYear}
        onChange={(e) => onChange({ schoolYear: e.target.value })}
        className={`w-full rounded border px-2 py-1 text-sm ${state.schoolYear.trim() ? "border-[#C2BBD4]" : "border-[#F37167]"}`} />
    ) : (
      <select aria-label="School year" value={state.schoolYear}
        onChange={(e) => { syTouched.current = true; onChange({ schoolYear: e.target.value }); }}
        className={`w-full rounded border px-2 py-1 text-sm ${state.schoolYear.trim() ? "border-[#C2BBD4]" : "border-[#F37167]"}`}>
        {syOptions.map((sy) => (<option key={sy} value={sy}>{sy}</option>))}
      </select>
    )}
  </label>
)}
```

with, above the return (hooks only meaningful for contracts; cheap for BOCES):

```tsx
const syOptions = useMemo(() => {
  const opts = schoolYearOptions();
  // A draft/legacy value outside the window must stay visible and selected.
  return state.schoolYear && !opts.includes(state.schoolYear)
    ? [state.schoolYear, ...opts]
    : opts;
}, [state.schoolYear]);

// Start-date sync: derive until the rep takes over. A loaded draft whose SY
// already disagrees with its derived value counts as taken-over.
const syTouched = useRef(
  state.schoolYearManual ||
    (state.schoolYear !== "" &&
      schoolYearFromDate(state.startDate) !== null &&
      state.schoolYear !== schoolYearFromDate(state.startDate)),
);
useEffect(() => {
  if (isBoces || state.schoolYearManual || syTouched.current) return;
  const derived = schoolYearFromDate(state.startDate);
  if (derived && derived !== state.schoolYear) onChange({ schoolYear: derived });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [state.startDate]);
```

imports: `{ useEffect, useMemo, useRef }` from react; `{ schoolYearFromDate, defaultSchoolYear, schoolYearOptions }` from `@/features/document-generation/lib/school-year`.

- [ ] **Step 3: run section tests + the form/modal suites** (state-shape change may touch fixtures):

```bash
npx vitest run src/features/document-generation/components 2>&1 | tail -3
```

- [ ] **Step 4: eslint changed files; commit**

```bash
git commit -m "feat(doc-gen): mandatory school-year selector with manual-entry toggle"
```
