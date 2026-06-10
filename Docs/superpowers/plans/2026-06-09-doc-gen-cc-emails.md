# Doc-Gen: CC Executed Copy + Honest Send Status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CC the contract sender + rep-entered additional emails on Dropbox Sign signature requests, stamp `errorMessage` on webhook error events, and make the "Sent ✓" banner reflect the genuine `signature_request_sent` webhook instead of the synchronous accept.

**Architecture:** The CC list rides the existing payload as a comma-joined string in `deal.cc_emails` (deal is `Record<string, string>`); Apps Script expands it into `cc_email_addresses[n]` params. Honest send status adds a `processing` initial row status; the existing webhook promotes it to `sent`; the UI polls a new owner-scoped status route via TanStack Query until settled.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma/Postgres, TanStack Query, Vitest + Testing Library, Google Apps Script (clasp).

**Spec:** `Docs/superpowers/specs/2026-06-09-doc-gen-cc-emails-design.md`

**Branch/worktree:** `feat/doc-gen-cc-emails` at `.worktrees/feat-doc-gen-cc-emails`. Run `git branch --show-current` before dispatching any implementer — it must print `feat/doc-gen-cc-emails`.

**Conventions that apply:** test files live in co-located `__tests__/`; run targeted vitest (`npx vitest run <path>`); do NOT run full-tree eslint (OOMs) — lint only changed files with `npx eslint <files>`; commit after each task.

---

### Task 1: `parseCcEmails` + completeness validation

**Files:**
- Modify: `src/features/document-generation/lib/validation.ts`
- Test: `src/features/document-generation/lib/__tests__/validation.test.ts` (exists — check first; create if missing)

- [ ] **Step 1: Write failing tests**

Append (or create the file with the existing-test imports pattern):

```ts
import { describe, it, expect } from "vitest";
import { parseCcEmails, getCompleteness } from "../validation";
import { emptyFormState } from "../payload-types";

describe("parseCcEmails", () => {
  it("splits on commas and semicolons, trims, drops empties", () => {
    expect(parseCcEmails(" a@x.com, b@y.org ;; c@z.io ,")).toEqual(["a@x.com", "b@y.org", "c@z.io"]);
  });
  it("dedupes case-insensitively, keeping first casing", () => {
    expect(parseCcEmails("AP@x.com, ap@x.com")).toEqual(["AP@x.com"]);
  });
  it("returns [] for empty/whitespace input", () => {
    expect(parseCcEmails("")).toEqual([]);
    expect(parseCcEmails("  ")).toEqual([]);
  });
});

describe("getCompleteness — ccEmails", () => {
  it("flags invalid CC tokens", () => {
    const s = emptyFormState("contract", "0601234");
    s.ccEmails = "good@x.com, not-an-email";
    const { missing } = getCompleteness(s);
    expect(missing).toContain("Invalid CC email: not-an-email");
    expect(missing).not.toContain("Invalid CC email: good@x.com");
  });
  it("accepts an empty ccEmails field", () => {
    const s = emptyFormState("contract", "0601234");
    s.ccEmails = "";
    expect(getCompleteness(s).missing.filter((m) => m.startsWith("Invalid CC"))).toEqual([]);
  });
});
```

Note: `emptyFormState(docType, leaid)` — confirm its exact signature in `payload-types.ts` and match it. `s.ccEmails` doesn't exist yet — Task 2 adds it; for THIS task, the completeness test will not compile until the field exists. **Order fix:** add the `ccEmails: string` field to `DocFormState` + `emptyFormState` in this task (it's one line, needed by the test), leaving payload emission to Task 2.

- [ ] **Step 2: Run tests, verify failure**

Run: `npx vitest run src/features/document-generation/lib/__tests__/validation.test.ts`
Expected: FAIL — `parseCcEmails` is not exported.

- [ ] **Step 3: Implement**

In `payload-types.ts`: add `ccEmails: string;` to `DocFormState` (next to `senderEmail`) and `ccEmails: "",` in `emptyFormState`'s returned object (next to `senderEmail: ""`).

In `validation.ts`:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split a freeform CC field on commas/semicolons into trimmed, case-insensitively deduped emails. */
export function parseCcEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(/[,;]/)) {
    const email = token.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}
```

In `getCompleteness`, before the final `return`:

```ts
for (const email of parseCcEmails(state.ccEmails)) {
  if (!EMAIL_RE.test(email)) missing.push(`Invalid CC email: ${email}`);
}
```

- [ ] **Step 4: Run tests, verify pass** — same command, expected PASS. Also run the full doc-gen suite to catch `DocFormState` consumers broken by the new required field (object literals typed as `DocFormState` need `ccEmails`): `npx vitest run src/features/document-generation`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(doc-gen): parseCcEmails + CC email validation + ccEmails form field"
```

---

### Task 2: Emit `deal.cc_emails` in the payload

**Files:**
- Modify: `src/features/document-generation/lib/payload.ts`
- Test: `src/features/document-generation/lib/__tests__/payload.test.ts`

- [ ] **Step 1: Write failing test** (append; reuse the file's existing state-builder helpers — it builds contract states for the `deal.today` tests)

```ts
// Mirrors the file's existing pattern: emptyFormState("contract", "x") + the
// `jane` contact fixture already defined at the top of this test file.
describe("assemblePayload — deal.cc_emails", () => {
  it("emits normalized comma-joined cc_emails", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = jane;
    s.ccEmails = " ap@x.com ; AP@x.com, boss@y.org ";
    const p = assemblePayload(s) as Extract<ReturnType<typeof assemblePayload>, { doc_type: "contract" }>;
    expect(p.deal.cc_emails).toBe("ap@x.com,boss@y.org");
  });
  it("emits empty string when no CCs", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = jane;
    const p = assemblePayload(s) as Extract<ReturnType<typeof assemblePayload>, { doc_type: "contract" }>;
    expect(p.deal.cc_emails).toBe("");
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/features/document-generation/lib/__tests__/payload.test.ts` (property `cc_emails` undefined)

- [ ] **Step 3: Implement** — in `payload.ts`: `import { parseCcEmails } from "./validation";` and in the contract `deal` object (after `sender_email`):

```ts
cc_emails: parseCcEmails(state.ccEmails).join(","),
```

(No import cycle: validation.ts imports only payload-types + quote.)

- [ ] **Step 4: Run, verify PASS** — same command.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): emit deal.cc_emails in contract payload"`

---

### Task 3: CC input in PartiesContactsSection (contract-only)

**Files:**
- Modify: `src/features/document-generation/components/form/PartiesContactsSection.tsx`
- Test: `src/features/document-generation/components/form/__tests__/PartiesContactsSection.test.tsx` (create)

- [ ] **Step 1: Write failing test** — mock `ContactRolePicker` (it owns a TanStack query; this keeps the test provider-free):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PartiesContactsSection from "../PartiesContactsSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

vi.mock("../ContactRolePicker", () => ({ default: () => <div data-testid="picker" /> }));

describe("PartiesContactsSection — CC emails", () => {
  it("shows the CC field for contracts and forwards changes", () => {
    const onChange = vi.fn();
    render(<PartiesContactsSection state={emptyFormState("contract", "0601234")} onChange={onChange} />);
    const input = screen.getByLabelText("CC executed copy to");
    fireEvent.change(input, { target: { value: "ap@x.com" } });
    expect(onChange).toHaveBeenCalledWith({ ccEmails: "ap@x.com" });
  });
  it("hides the CC field for BOCES quotes", () => {
    render(<PartiesContactsSection state={emptyFormState("boces_quote", "0601234")} onChange={vi.fn()} />);
    expect(screen.queryByLabelText("CC executed copy to")).toBeNull();
  });
});
```

(Match `emptyFormState`'s real signature, as in Task 1.)

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/features/document-generation/components/form/__tests__/PartiesContactsSection.test.tsx`

- [ ] **Step 3: Implement** — in `PartiesContactsSection.tsx`, after the signer block (the `{!isBoces && !state.signerSameAsClient && (...)}` block), add:

```tsx
{!isBoces && (
  <input aria-label="CC executed copy to"
    placeholder="CC executed copy to (comma-separated emails)"
    value={state.ccEmails}
    onChange={(e) => onChange({ ccEmails: e.target.value })}
    className="w-full rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
)}
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): CC emails input on contract parties section"`

---

### Task 4: Apps Script — expand CC list on the Dropbox Sign send

**Files:**
- Modify: `scripts/document-generation/appsscript/Code.gs` (auto_send block, ~lines 72–108)

No test harness for `.gs` — verified in the e2e step at the end. Keep the change minimal and ES5 (Apps Script).

- [ ] **Step 1: Implement** — restructure the fetch to build the payload in a local `dsPayload` first. Replace the current `var dsResponse = UrlFetchApp.fetch(...)` call (which passes an inline `payload: {...}` object) with:

```js
        var dsPayload = {
          'test_mode':                 props[PROP.DROPBOX_SIGN_TEST_MODE] || '1',
          'title':                     docName,
          'subject':                   'Please sign your Fullmind contract',
          'message':                   'Please review and sign your Fullmind agreement for the ' + payload.deal.school_year + ' school year.',
          'signers[0][email_address]': payload.deal.signer_email || payload.deal.client_email,
          'signers[0][name]':          signerName,
          'use_text_tags':             '1',
          'hide_text_tags':            '1',
          'files[0]':                  pdfBlob,
        };
        // CC the sender + any rep-entered emails so they receive the executed copy.
        // Dropbox Sign rejects a CC that duplicates a signer, so the signer is excluded.
        var signerEmail = String(payload.deal.signer_email || payload.deal.client_email || '').trim().toLowerCase();
        var ccCandidates = [String(payload.deal.sender_email || '')]
          .concat(String(payload.deal.cc_emails || '').split(','));
        var ccSeen = {};
        var ccIndex = 0;
        for (var ci = 0; ci < ccCandidates.length; ci++) {
          var cc = ccCandidates[ci].trim();
          var ccKey = cc.toLowerCase();
          if (!cc || ccSeen[ccKey] || ccKey === signerEmail) continue;
          ccSeen[ccKey] = true;
          dsPayload['cc_email_addresses[' + ccIndex + ']'] = cc;
          ccIndex++;
        }
        var dsResponse = UrlFetchApp.fetch('https://api.hellosign.com/v3/signature_request/send', {
          method:  'post',
          headers: { 'Authorization': 'Basic ' + Utilities.base64Encode(props[PROP.DROPBOX_SIGN_API_KEY] + ':') },
          payload: dsPayload,
          muteHttpExceptions: true,
        });
```

Everything after (`dsResult` parsing, `result.sent`, error handling) is unchanged.

- [ ] **Step 2: Sanity-check** — `node --check` does not parse `.gs`; instead re-read the diff (`git diff scripts/`) and confirm: payload keys identical to before plus the conditional `cc_email_addresses[n]`; no ES6 syntax (no `let`/`const`/arrow/template literals).

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat(doc-gen): CC sender + cc_emails on Dropbox Sign send (Code.gs)"`

**Do NOT clasp push/deploy in this task** — that happens in the Deployment section after the suite is green, from this worktree (`.clasp.json` is already symlinked).

---

### Task 5: `processing` enum value (Prisma schema + migration + DB)

**Files:**
- Modify: `prisma/schema.prisma` (`enum SignatureStatus`, ~line 2160)
- Create: `prisma/migrations/20260610000000_add_processing_signature_status/migration.sql`

- [ ] **Step 1: Schema** — add `processing` as the FIRST value of `enum SignatureStatus`:

```prisma
enum SignatureStatus {
  processing
  sent
  viewed
  signed
  declined
  canceled
  error

  @@map("signature_status")
}
```

- [ ] **Step 2: Migration file**

```sql
-- Rows are created as 'processing' on the synchronous Dropbox Sign accept and
-- promoted to 'sent' by the signature_request_sent webhook.
ALTER TYPE "signature_status" ADD VALUE 'processing';
```

- [ ] **Step 3: Apply to the database** (the shared Supabase is the only DB; adding an enum value is backward-compatible — nothing writes `processing` until this branch deploys):

```bash
npx prisma db execute \
  --file prisma/migrations/20260610000000_add_processing_signature_status/migration.sql \
  --url "$(grep '^DIRECT_URL' .env .env.local 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"')"
```

Expected: `Script executed successfully.`

- [ ] **Step 4: Regenerate the client** — `npx prisma generate`. Expected: completes without error. (If later tasks show phantom "Property X does not exist on PrismaClient" errors: `npx prisma generate && rm -rf .next`.)

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): add processing signature_status enum value"`

---

### Task 6: Send route writes `processing`; send-client type follows

**Files:**
- Modify: `src/app/api/document-generation/send/route.ts`
- Modify: `src/features/document-generation/lib/send-client.ts`
- Test: `src/app/api/document-generation/send/__tests__/route.test.ts`, `src/features/document-generation/lib/__tests__/send-client.test.ts`

- [ ] **Step 1: Update tests first.** In the send route test, the existing happy-path test asserts a `'sent'` row — change those assertions and add:

```ts
it("writes the row as processing on synchronous accept", async () => {
  const res = await POST(req({ payload: CONTRACT, districtLeaId: "0601234" }));
  expect(res.status).toBe(200);
  expect(mockCreate.mock.calls[0][0].data.status).toBe("processing");
  const body = await res.json();
  expect(body.status).toBe("processing");
  expect(body.id).toBe(1);
});
```

Keep the error-path test asserting `status: "error"` unchanged. Update `send-client.test.ts` expectations if they reference `"sent"`.

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/app/api/document-generation/send src/features/document-generation/lib/__tests__/send-client.test.ts`

- [ ] **Step 3: Implement.** In `route.ts`, replace the two `"sent"` literals tied to success:

```ts
status: result.sent ? "processing" : "error",   // row create
...
status: result.sent ? "processing" : "error",   // JSON response
```

(`sentAt` stays set on accept — it means "send initiated". The `errorMessage`/`sendError` branches are unchanged.)

In `send-client.ts`:

```ts
export interface SendResponse {
  id?: number;
  docUrl: string;
  status: "processing" | "error";
  signatureRequestId: string | null;
  sendError?: string;
  recipientEmail?: string;
}
```

- [ ] **Step 4: Run, verify PASS** (same command). The `GenerateDocumentModal`/`ReviewStage` tests will break later when their props change — that's Tasks 8–9, not here; but if THIS change breaks them (modal checks `res.status === "sent"`), make the minimal modal edit (`res.status === "processing"`) to keep the suite green, and note Task 9 will rework it.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(doc-gen): send route writes processing until webhook confirms"`

---

### Task 7: Webhook stamps `errorMessage` on error events

**Files:**
- Modify: `src/app/api/webhooks/dropbox-sign/route.ts`
- Test: `src/app/api/webhooks/dropbox-sign/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests** (append; `eventForm` helper exists):

```ts
it("stamps errorMessage with the event type on error events", async () => {
  await POST(eventForm("signature_request_invalid", "sig_1"));
  expect(mockUpdateMany.mock.calls[0][0].data).toMatchObject({
    status: "error",
    errorMessage: "signature_request_invalid",
  });
});

it("does not touch errorMessage on non-error transitions", async () => {
  await POST(eventForm("signature_request_viewed", "sig_1"));
  expect(mockUpdateMany.mock.calls[0][0].data).not.toHaveProperty("errorMessage");
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/app/api/webhooks/dropbox-sign`

- [ ] **Step 3: Implement** — in the `updateMany` data:

```ts
data: {
  status,
  ...(status === "signed" ? { signedAt: new Date() } : {}),
  ...(status === "error" ? { errorMessage: ev.event_type } : {}),
},
```

- [ ] **Step 4: Run, verify PASS.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "fix(doc-gen): webhook stamps errorMessage with failing event type"`

---

### Task 8: `GET /api/document-generation/documents/[id]` + polling hook

**Files:**
- Create: `src/app/api/document-generation/documents/[id]/route.ts`
- Create: `src/app/api/document-generation/documents/[id]/__tests__/route.test.ts`
- Modify: `src/features/document-generation/lib/queries.ts`
- Test: `src/features/document-generation/lib/__tests__/queries.test.ts`

- [ ] **Step 1: Write failing route tests:**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockFindUnique } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindUnique: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getUser: mockGetUser }));
vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { findUnique: mockFindUnique } } }));

import { GET } from "../route";
import { NextRequest } from "next/server";

const ROW = {
  id: 7, status: "processing", errorMessage: null,
  recipientEmail: "s@acme.org", docUrl: "https://docs.google.com/d/D/edit",
  ownerProfileId: "user-uuid",
};
function get(id: string) {
  return GET(new NextRequest(`http://localhost/api/document-generation/documents/${id}`),
    { params: Promise.resolve({ id }) });
}

describe("GET /api/document-generation/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-uuid" });
    mockFindUnique.mockResolvedValue(ROW);
  });

  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    expect((await get("7")).status).toBe(401);
  });
  it("400s on a non-integer id", async () => {
    expect((await get("abc")).status).toBe(400);
  });
  it("404s for an unknown row", async () => {
    mockFindUnique.mockResolvedValue(null);
    expect((await get("7")).status).toBe(404);
  });
  it("404s for another owner's row (no existence leak)", async () => {
    mockFindUnique.mockResolvedValue({ ...ROW, ownerProfileId: "someone-else" });
    expect((await get("7")).status).toBe(404);
  });
  it("returns status fields for the owner, without ownerProfileId", async () => {
    const res = await get("7");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: 7, status: "processing", errorMessage: null,
      recipientEmail: "s@acme.org", docUrl: "https://docs.google.com/d/D/edit",
    });
  });
});
```

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/app/api/document-generation/documents`

- [ ] **Step 3: Implement the route:**

```ts
// GET /api/document-generation/documents/[id] — signature-request status for the
// send-feedback banner (and, later, the monitoring view). Owner-scoped: a row
// belonging to someone else 404s rather than confirming it exists.
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const docId = Number(id);
    if (!Number.isInteger(docId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const row = await prisma.generatedDocument.findUnique({
      where: { id: docId },
      select: { id: true, status: true, errorMessage: true, recipientEmail: true, docUrl: true, ownerProfileId: true },
    });
    if (!row || row.ownerProfileId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { ownerProfileId: _owner, ...doc } = row;
    return NextResponse.json(doc);
  } catch (error) {
    console.error("Generated document status error:", error);
    return NextResponse.json({ error: "Failed to load document status" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Hook + interval helper.** Failing test first (append to `queries.test.ts`):

```ts
import { sendPollInterval, SEND_POLL_MS, SEND_POLL_MAX_UPDATES } from "../queries";

describe("sendPollInterval", () => {
  it("polls while processing", () => {
    expect(sendPollInterval("processing", 1)).toBe(SEND_POLL_MS);
    expect(sendPollInterval(undefined, 0)).toBe(SEND_POLL_MS);
  });
  it("stops on settled statuses", () => {
    for (const s of ["sent", "viewed", "signed", "declined", "canceled", "error"]) {
      expect(sendPollInterval(s, 1)).toBe(false);
    }
  });
  it("stops after the update budget (timeout)", () => {
    expect(sendPollInterval("processing", SEND_POLL_MAX_UPDATES)).toBe(false);
  });
});
```

Run `npx vitest run src/features/document-generation/lib/__tests__/queries.test.ts` → FAIL. Then implement in `queries.ts`:

```ts
export interface GeneratedDocumentStatus {
  id: number;
  status: "processing" | "sent" | "viewed" | "signed" | "declined" | "canceled" | "error";
  errorMessage: string | null;
  recipientEmail: string;
  docUrl: string;
}

export const SEND_POLL_MS = 2000;
export const SEND_POLL_MAX_UPDATES = 30; // ~60s; after this the banner shows "awaiting confirmation"

/** Poll cadence for the send-status query: 2s while processing, stop when settled or after ~60s. */
export function sendPollInterval(status: string | undefined, dataUpdateCount: number): number | false {
  if (status && status !== "processing") return false;
  if (dataUpdateCount >= SEND_POLL_MAX_UPDATES) return false;
  return SEND_POLL_MS;
}

export function useGeneratedDocumentStatus(id: number | null) {
  return useQuery({
    queryKey: ["generated-document", id],
    queryFn: () => fetchJson<GeneratedDocumentStatus>(`${API_BASE}/document-generation/documents/${id}`),
    enabled: id != null,
    refetchInterval: (query) => sendPollInterval(query.state.data?.status, query.state.dataUpdateCount),
  });
}
```

- [ ] **Step 5: Run, verify PASS** — `npx vitest run src/app/api/document-generation/documents src/features/document-generation/lib/__tests__/queries.test.ts`

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(doc-gen): generated-document status route + polling hook"`

---

### Task 9: ReviewStage banner phases + modal wiring

**Files:**
- Modify: `src/features/document-generation/components/review/ReviewStage.tsx`
- Modify: `src/features/document-generation/components/GenerateDocumentModal.tsx`
- Test: `src/features/document-generation/components/review/__tests__/ReviewStage.test.tsx` (update — props change), `src/features/document-generation/components/__tests__/GenerateDocumentModal.test.tsx` (update if it touches sendState)

- [ ] **Step 1: ReviewStage — update tests first.** The `sendState` prop changes shape from `{ status: "sent" | "error" }` to:

```ts
export interface SendBanner {
  phase: "processing" | "sent" | "error" | "unconfirmed";
  recipientEmail?: string;
  sendError?: string;
}
```

Update existing sendState tests to use `phase`, and add:

```tsx
it("shows Sending… while processing and disables the send button", () => {
  render(<ReviewStage {...base} sendState={{ phase: "processing", recipientEmail: "s@x.org" }} />);
  expect(screen.getByText("Sending…")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /send for signature/i })).toBeDisabled();
});
it("shows the awaiting-confirmation banner on timeout", () => {
  render(<ReviewStage {...base} sendState={{ phase: "unconfirmed" }} />);
  expect(screen.getByText(/Send accepted — awaiting confirmation/)).toBeInTheDocument();
});
it("shows the stamped error message", () => {
  render(<ReviewStage {...base} sendState={{ phase: "error", sendError: "signature_request_invalid" }} />);
  expect(screen.getByText(/signature_request_invalid/)).toBeInTheDocument();
});
```

(Reuse the file's existing `base` props helper; match its naming.)

- [ ] **Step 2: Run, verify FAIL** — `npx vitest run src/features/document-generation/components/review`

- [ ] **Step 3: Implement ReviewStage.** Export `SendBanner` from `ReviewStage.tsx`; prop becomes `sendState?: SendBanner | null`. Banner block:

```tsx
{sendState?.phase === "processing" && (
  <div className="rounded-lg bg-[#F7F5FA] px-3 py-2 text-sm text-[#6E6390]">Sending…</div>
)}
{sendState?.phase === "sent" && (
  <div className="rounded-lg bg-[#EAF5EE] px-3 py-2 text-sm text-[#2C6E49]">
    Sent ✓{sendState.recipientEmail ? ` to ${sendState.recipientEmail}` : ""}
  </div>
)}
{sendState?.phase === "error" && (
  <div className="rounded-lg bg-[#fef1f0] px-3 py-2 text-sm text-[#F37167]">
    Send failed: {sendState.sendError ?? "unknown error"}
  </div>
)}
{sendState?.phase === "unconfirmed" && (
  <div className="rounded-lg bg-[#F7F5FA] px-3 py-2 text-sm text-[#6E6390]">
    Send accepted — awaiting confirmation. Check back shortly.
  </div>
)}
```

Send button disable: `disabled={busy || (sendState != null && sendState.phase !== "error")}` — a send in flight, confirmed, or unconfirmed must not be re-fired (the route has no idempotency); an `error` phase may retry. Label stays `{busy ? "Sending…" : "Send for signature"}`.

- [ ] **Step 4: Modal wiring.** In `GenerateDocumentModal.tsx`:

```tsx
import { useGeneratedDocumentStatus, SEND_POLL_MAX_UPDATES } from "@/features/document-generation/lib/queries";
import type { SendBanner } from "./review/ReviewStage";

// state
const [sendId, setSendId] = useState<number | null>(null);
const [syncSend, setSyncSend] = useState<{ recipientEmail?: string; sendError?: string } | null>(null);
const statusQuery = useGeneratedDocumentStatus(sendId);

async function handleSend() {
  if (busy || sendId != null) return;
  setBusy(true);
  try {
    const payload = assemblePayload(state);
    const res = await sendForSignatureRequest(payload, state.districtLeaId);
    if (res.status === "processing" && res.id != null) {
      setSendId(res.id);
      setSyncSend({ recipientEmail: res.recipientEmail });
    } else {
      setSyncSend({ sendError: res.sendError ?? "send failed" });
    }
  } catch {
    setSyncSend({ sendError: "Send request failed" });
  } finally {
    setBusy(false);
  }
}

// derive the banner
let sendState: SendBanner | null = null;
if (syncSend?.sendError) {
  sendState = { phase: "error", sendError: syncSend.sendError };
} else if (sendId != null) {
  const status = statusQuery.data?.status ?? "processing";
  if (status === "error") {
    sendState = { phase: "error", sendError: statusQuery.data?.errorMessage ?? "send failed" };
  } else if (status === "processing") {
    sendState = statusQuery.dataUpdateCount >= SEND_POLL_MAX_UPDATES
      ? { phase: "unconfirmed", recipientEmail: syncSend?.recipientEmail }
      : { phase: "processing", recipientEmail: syncSend?.recipientEmail };
  } else {
    sendState = { phase: "sent", recipientEmail: statusQuery.data?.recipientEmail ?? syncSend?.recipientEmail };
  }
}
```

Retry path: the error-phase Send button calls `handleSend`, which early-returns while `sendId != null` — so when the POLLED status is `error`, retry needs a reset. Change the error-banner derivation's button behavior by clearing on back only is not enough; simplest correct rule: in `handleSend`, allow re-send when the current derived phase is `error`: replace the guard with `if (busy) return;` plus `if (sendId != null && sendState?.phase !== "error") return;` — compute the guard from the same derivation (hoist `sendState` above `handleSend` or compute a `canSend` boolean). Implementers: define `const canSend = !busy && (sendId == null || sendState?.phase === "error")` after the derivation and have `handleSend` early-return on `!canSend`; on retry, reset `setSendId(null); setSyncSend(null)` before POSTing.

`onBack` resets everything: `() => { setResult(null); setSendId(null); setSyncSend(null); }`.

Update `GenerateDocumentModal.test.tsx`: mock the hook —

```ts
vi.mock("@/features/document-generation/lib/queries", () => ({
  useGeneratedDocumentStatus: () => ({ data: undefined, dataUpdateCount: 0 }),
  SEND_POLL_MAX_UPDATES: 30,
}));
```

(adjust to preserve anything else the test imports from queries.ts).

- [ ] **Step 5: Run all component tests, verify PASS** — `npx vitest run src/features/document-generation/components`

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat(doc-gen): honest send banner — processing/sent/error/unconfirmed phases"`

---

### Task 10: Full suite + lint changed files

- [ ] **Step 1:** `npx vitest run` — expected: all pass (~200 tests). Known flake: the tile route test can fail under parallel load (pg Pool exhaustion) — if it's the ONLY failure, rerun it in isolation before concluding anything.
- [ ] **Step 2:** `npx eslint $(git diff --name-only main...HEAD -- '*.ts' '*.tsx' | tr '\n' ' ')` — expected: clean. (Never full-tree eslint — OOMs.)
- [ ] **Step 3:** `npx tsc --noEmit` — expected: clean (run `npx prisma generate && rm -rf .next` first if phantom Prisma/.next-types errors appear).
- [ ] **Step 4:** Commit any fixes.

---

## Deployment + e2e verification (manual, after suite green — driven from this worktree)

1. **Deploy the Apps Script:**
   ```bash
   cd scripts/document-generation/appsscript
   npx clasp push
   npx clasp deploy -i AKfycby0oFEDEj77XpMNNZaB9WpOVsHoUBeY1Nsa2nJbvU5J3nyfnTYSmvQHJgh9DdCtoTsy -d "CC sender + cc_emails"
   ```
   (push alone does NOT change `/exec`; the deploy re-points the pinned version.)
2. **Webhook tunnel:** `ngrok http 3005`; set the Dropbox Sign account callback URL to `<tunnel>/api/webhooks/dropbox-sign` (dashboard, account-level). `DROPBOX_SIGN_TEST_MODE` stays `'1'`.
3. **Send a test contract** from `/document-generator` (port 3005): sender = own profile email, signer = a different `@fullmindlearning.com` address, CC field = one more `@fullmindlearning.com` address.
4. **Confirm:** banner shows "Sending…" → flips to "Sent ✓" only after the `signature_request_sent` webhook lands; both CC notifications arrive; the Dropbox Sign dashboard request lists 2 CCs; DB row went `processing → sent`.
5. **Error path:** confirm a `signature_request_invalid` (if one occurs) or simulate by asserting the webhook unit tests cover `errorMessage` stamping (no need to force a real invalid send).
6. **Restore:** revert the Dropbox Sign callback URL to its prior value if it was changed, stop ngrok.

## Out of scope (per spec)

CC persistence on `GeneratedDocument`; monitoring view; prod cutover (test-mode flip, Vercel env, account callback to prod URL).
