# Sea Monkey SP4 — Dropbox Sign Delivery (Design)

**Date:** 2026-06-09
**Branch:** `feat/sea-monkey-delivery`
**Predecessors:** SP1 renderer (PR #267, merged), SP2 form (PR #265, merged)
**Related:** `project_sea_monkey`, `project_esign_approach`, `project_sea_monkey_renderer`,
`reference_clasp_deploy_vs_push`, `reference_clasp_worktree_trap`

## Goal

Make the Review stage's "Send for signature" button actually send the generated
contract for signature via Dropbox Sign, and track the signature lifecycle live
via webhooks. Today the button is a no-op placeholder and the app renders only
clean (`tags:false`) docs.

## Scope (locked decisions)

| Decision | Choice |
|---|---|
| Send mechanism | **A** — "Send" re-renders the payload with `tags:true` + `auto_send:true` in one Apps Script call, reusing the existing auto_send block in `generateFullContract`. |
| Lifecycle | **Full lifecycle via webhooks** — a Dropbox Sign callback updates the stored status live (sent → viewed → signed/declined/canceled). |
| Persistence | **New dedicated Prisma table** (`GeneratedDocument`), keyed by `signatureRequestId` for webhook lookup. |
| Send posture | **Test-mode locked** — `DROPBOX_SIGN_TEST_MODE='1'` stays the single source of truth (Apps Script property). No real client sends in v1; recipients restricted to `@fullmindlearning.com`. |

**Out of scope (v1):**
- Branch-c — "re-fire an existing doc URL after verifying its tags." Mechanism A
  re-renders on send, so no `sendExistingDoc(docId)` function and no
  tag-verification path are needed.
- Production cutover (flipping `DROPBOX_SIGN_TEST_MODE` to `'0'`, production
  recipient/domain rules) — a separate deliberate step; the checklist already
  lives in `project_sea_monkey`.
- Opportunity/plan entry points (SP3). The table gains a nullable `opportunityId`
  now so SP3 can populate it without a migration.

## Why these choices

- **Mechanism A** reuses the already-PoC-tested auto_send block. Rendering is a
  deterministic pure function of the payload, so the freshly-rendered tagged doc
  is content-identical to the clean reviewed doc (only the signature-page text
  tags differ) — the single-renderer principle holds in substance. It also avoids
  white-styling the `\s1\`/`\d1\` tags and avoids building a send-existing-doc path.
- **New table** because `Opportunity` is read-only (external writer refreshes it
  every 30 min) and the `Activity` log models rep actions, not external document
  state — mutating an activity on each webhook event fights its grain.
- **Test-mode locked** ships and proves the full send→webhook→status machinery
  without ever mailing a legally-binding doc to a real client.

## Architecture

### Layers

**Apps Script (`scripts/document-generation/appsscript/`)** — minimal changes:
- **Recipient fix:** the existing auto_send block sends to `payload.deal.client_email`
  but addresses the email with the *signer's* name. When signer ≠ client this mails
  the wrong person. Change the block to send to `payload.deal.signer_email` with a
  fallback to `client_email`. (Requires the payload to emit `deal.signer_email`.)
- The auto_send block already returns `{ sent, signatureRequestId, sendError }` —
  no structural change.
- **Deploy:** after any `.gs` edit, `npx clasp push` **then**
  `npx clasp deploy -i <deploymentId>` to update `/exec`. Push alone serves stale
  code (the documented redeploy trap). Worktree needs the `.clasp.json` symlink.

**Payload (`src/features/document-generation/lib/payload.ts` + `payload-types.ts`)**:
- Emit `deal.signer_email` (from the resolved signer contact), so the `.gs`
  recipient fix has an address to use.

**New send lib (`src/features/document-generation/lib/render-apps-script.ts` or sibling)**:
- `sendForSignature(payload)` — POSTs `{ ...payload, tags:true, auto_send:true }`
  to the deployed Apps Script (same service-account JWT auth as `renderViaAppsScript`)
  and returns `{ docUrl, docId, signatureRequestId, sent, sendError }`. Generalize
  the existing options handling rather than duplicating the JWT/fetch plumbing.

**New send route (`src/app/api/document-generation/send/route.ts`)**:
- Auth via `getUser` (existing pattern). **Contract-only guard** — reject
  `boces_quote` (no eSign).
- Calls `sendForSignature(payload)`.
- On `sent:true` → write a `GeneratedDocument` row with `status='sent'`.
- On `sent:false` → write `status='error'` with `sendError`, no `signatureRequestId`.
- Returns `{ docUrl, signatureRequestId, status }` to the client.
- `/api/document-generation/render` stays a **pure preview** (tags:false, no
  persistence) — unchanged.

**New table (`prisma/schema.prisma` + migration)** — `GeneratedDocument`:

| Field | Type | Notes |
|---|---|---|
| `id` | int PK | |
| `docType` | string | `contract` (BOCES never sent) |
| `docUrl` | string | the generated Google Doc URL |
| `docId` | string | Drive file id |
| `signatureRequestId` | string? `@unique` | webhook lookup key; null until sent / on error |
| `recipientEmail` | string | signer (or client fallback) |
| `companyName` | string | |
| `status` | enum | `sent \| viewed \| signed \| declined \| canceled \| error` |
| `districtLeaId` | string? | from prefill |
| `ownerProfileId` | string | current user (`getUser` → profile) |
| `opportunityId` | string? | nullable; SP3 populates later |
| `sentAt` | DateTime? | |
| `signedAt` | DateTime? | |
| `createdAt` / `updatedAt` | DateTime | |

**New webhook route (`src/app/api/webhooks/dropbox-sign/route.ts`)**:
- Parse the Dropbox Sign event, **verify HMAC** (`HMAC-SHA256` keyed by the API
  key over `event_time + event_type`), map `event_type → status`, find the row by
  `signatureRequestId`, update `status` + timestamps.
- **Idempotent + tolerant:** valid-but-unknown request id → ack `200` (handles the
  send-response/webhook race and out-of-scope requests). Invalid HMAC → `400`.
  Respond with the literal `Hello API Event Received` body Dropbox Sign requires.
- Needs a **new env var** `DROPBOX_SIGN_API_KEY` in the Next app (currently only in
  Apps Script properties) for HMAC verification.

**UI (`ReviewStage.tsx` + `GenerateDocumentModal.tsx`)**:
- Wire `onSend` → POST `/api/document-generation/send` via a small client fn.
- **Busy-guard** the Send button (disabled while in-flight) — the gap flagged in
  the SP1 review. Prevents a re-render/sign race.
- Post-send state: `Sent ✓ to <email>` + status; keep the existing
  "Open the rendered document ↗" link.
- **Contract-only:** hide Send for `boces_quote`.
- **Drop the redundant "Open Google Doc (manual)" button** — with mechanism A the
  reviewed doc is already clean (`tags:false`), so the tag-free re-render is
  redundant with the existing rendered-doc link.

### Data flow

1. **Render (preview):** form → `/render {tags:false}` → clean doc → ReviewStage.
2. **Send:** Send (guarded) → `/send {payload}` → `sendForSignature` → `.gs` renders
   tagged doc + POSTs to Dropbox Sign → returns `signatureRequestId` → write
   `GeneratedDocument(status=sent)` → UI shows "Sent ✓".
3. **Lifecycle:** Dropbox Sign → `/api/webhooks/dropbox-sign` → verify HMAC → map
   event → update row status.

### Event → status mapping (table-driven, unit-tested)

| Dropbox Sign `event_type` | status |
|---|---|
| `signature_request_sent` | `sent` |
| `signature_request_viewed` | `viewed` |
| `signature_request_signed` | `signed` (single signer) |
| `signature_request_all_signed` | `signed` |
| `signature_request_declined` | `declined` |
| `signature_request_canceled` | `canceled` |
| `signature_request_email_bounce` / error events | `error` |
| anything else (e.g. `callback_test`) | ignored (ack 200, no row change) |

## Error handling

- **Send fails** (`sent:false`): persist `status='error'` + `sendError`, surface to
  the rep, no `signatureRequestId`.
- **Webhook:** invalid HMAC → `400`; valid but unknown request id → `200` ack
  (no-op); only known event types mutate state, the rest are ignored.

## Testing

- **Pure units (TDD-first):** `event_type → status` mapper (table-driven); HMAC
  verify helper.
- **Routes:** `/send` (mock `sendForSignature` + Prisma — assert row written on
  success, error row on `sent:false`, contract-only guard); webhook (HMAC pass/fail,
  event mapping, idempotency / unknown-id race).
- **E2E (test-mode):** ngrok tunnel → set Dropbox Sign account callback URL to the
  tunnel + `NEXT_PUBLIC_SITE_URL` override (per CLAUDE.md webhook section); send to a
  `@fullmindlearning.com` address; watch the row advance `sent → viewed → signed`.

## Verification items the plan must resolve (not guessed in code)

1. Exact Dropbox Sign **webhook payload shape** (multipart vs `application/x-www-form-urlencoded`
   with a `json` field), the **HMAC algorithm/inputs**, the `Hello API Event Received`
   response requirement, and **where the account-level callback URL is configured** —
   confirm against current Dropbox Sign API docs before writing the handler.
2. Confirm the deployed `/exec` (v3) auto_send returns
   `signature_request.signature_request_id` (per `Code.gs`, it does — verify live).
3. **Setup (user-gated):** add `DROPBOX_SIGN_API_KEY` to `.env.local` / `.env.example`
   / Vercel; set the account callback URL in the Dropbox Sign dashboard.

## Deferred follow-ups

- Production cutover (test-mode → production, real recipient/domain rules).
- Branch-c (re-fire existing doc URL after tag verification).
- Surfacing sent documents in a list / on opportunity & plan detail (SP3).
- Per-rep Drive file ownership (needs "execute as accessing user" deployment).
