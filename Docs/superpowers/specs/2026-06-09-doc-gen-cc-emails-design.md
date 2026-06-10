# Doc-Gen: CC Executed Copy + Honest Send Status — Design

**Date:** 2026-06-09
**Status:** Approved (brainstorm with Aston)
**Builds on:** SP4 Dropbox Sign delivery (PR #269)

## Problem

When a rep sends a contract for signature, Dropbox Sign emails the executed
(signed) copy only to the signers and the API account holder's email. The
initiating rep never receives it, and there is no way to copy other parties
(e.g., the district's AP team) on the executed agreement.

## Solution

CC the contract sender (`deal.sender_email`, auto-filled from the rep's
profile) on every signature request, plus any additional emails the rep enters
in a new optional form field. CC'd parties are notified at send time and
receive the executed copy when signing completes.

Bundled with two SP4 polish items on the same send-feedback loop: the webhook
stamps `errorMessage` with the failing event type (§6), and "Sent ✓" becomes
honest — shown only after Dropbox Sign's `signature_request_sent` webhook
confirms the signer email actually went out (§7).

### Decisions (locked in brainstorm)

1. **CC source = form `sender_email`**, not the authenticated user's email.
   They are almost always the same; using the form field keeps the Apps Script
   contract simple and lets a rep deliberately route the copy by editing the
   sender block.
2. **Additional CCs via a freeform comma/semicolon-separated text field**,
   contract-only (BOCES quotes have no eSign).
3. **CC list travels as a comma-joined string** in `deal.cc_emails` —
   `ContractPayload.deal` is `Record<string, string>`, and extra deal keys are
   harmless to the doc render (`replaceMergeFields` only replaces markers that
   exist in the template; there is no `<<cc_emails>>` marker).
4. **Not persisted on `GeneratedDocument`** for v1 (YAGNI — the future
   signature-monitoring view can add it if needed).

## Changes

### 1. `payload-types.ts` — form state

Add `ccEmails: string` to `DocFormState` with initial value `""`.

### 2. `PartiesContactsSection.tsx` — UI

Contract-only (`!isBoces`) optional text input below the signer rows:
label/placeholder "CC executed copy to (comma-separated emails)". Follows the
section's existing input styling (border `#C2BBD4`, no required highlight).

### 3. `validation.ts` — completeness

Parse `ccEmails` (split on `,` and `;`, trim, drop empties). Each token failing
a basic email regex adds `Invalid CC email: <token>` to `missing`, blocking
send the same way required fields do. Empty field remains valid. Export the
parse helper (`parseCcEmails`) so payload assembly reuses it — no drift between
validation and emission.

### 4. `payload.ts` — payload assembly

Emit `deal.cc_emails` = normalized comma-joined string from `parseCcEmails(state.ccEmails)`
(empty string when none).

### 5. `Code.gs` — Dropbox Sign send (auto_send block)

Build the CC list:

```
[deal.sender_email, ...deal.cc_emails.split(',')]
  → trim each, drop empties
  → dedupe case-insensitively
  → drop the signer's email (Dropbox Sign rejects a CC that duplicates a signer)
  → emit 'cc_email_addresses[0]', 'cc_email_addresses[1]', … on the POST
```

The request payload object moves into a local variable so keys can be added
conditionally before `UrlFetchApp.fetch`.

### 6. Webhook `errorMessage` stamp (bundled SP4 polish)

`POST /api/webhooks/dropbox-sign` currently sets `status: "error"` on
`signature_request_invalid` / `signature_request_email_bounce` events but
leaves `error_message` null, so the row says "error" with no cause. Fix: when
the mapped status is `error`, include `errorMessage: event.event_type` in the
`updateMany` data. No schema change — the column exists.

### 7. Honest "Sent ✓" — `processing` status + UI polling (bundled SP4 polish)

Dropbox Sign's synchronous `200` means "accepted for processing," not "sent" —
PDF processing, field detection, and signer email all happen asynchronously
after it (the text-tag incident: accepted + id returned, then
`signature_request_invalid` fired and no email ever went out). The UI banner
currently renders "Sent ✓" from the synchronous response and never re-checks.

**Model change — new initial status:**
- Add `processing` to the `SignatureStatus` enum (Prisma + Postgres
  `signature_status`). Migration: `ALTER TYPE signature_status ADD VALUE
  'processing';` — apply via `prisma db execute --url $DIRECT_URL` (raw SQL,
  matching how `generated_documents` shipped; `ADD VALUE` doesn't play well
  inside Prisma's transactional migrations).
- `POST /api/document-generation/send` writes the row with status
  `processing` (on successful synchronous accept; `error` path unchanged).
  `sentAt` keeps meaning "send initiated" and stays set at creation.
- The webhook already maps `signature_request_sent → sent` and its terminal
  guard (`notIn: signed/declined/canceled`) permits `processing → sent`.
  **No webhook changes needed** for the promotion.

**Status read API:** `GET /api/document-generation/documents/[id]` — auth'd,
owner-scoped, returns `{ id, status, errorMessage, recipientEmail, docUrl }`.

**UI (ReviewStage):** after send, poll the row via a TanStack Query hook
(`refetchInterval` ~2s, serialized-primitive key `["generated-document", id]`,
component mounts only while a send is being tracked, stops on settled status
or ~60s timeout):
- `processing` → "Sending…"
- `sent` / `viewed` / `signed` → "Sent ✓ to <email>"
- `error` → error banner showing `errorMessage` (this is what makes the §6
  stamp visible to the rep)
- timeout while still `processing` → "Send accepted — awaiting confirmation"
  (neither lies "sent" nor cries error; webhook may be down)

`SendResponse`/send-client types: `status` becomes `"processing" | "error"`.

## Error handling

No new paths. A Dropbox Sign rejection (e.g., invalid CC) flows through the
existing error handling: `result.sendError` → `/send` route → `error` status +
`errorMessage` on the `GeneratedDocument` row → UI banner.

## Testing

- **Vitest:** `parseCcEmails` normalization (splitting, trimming, dedupe input
  cases); validation flags bad tokens and passes empty/valid input;
  `assemblePayload` emits `deal.cc_emails`; `PartiesContactsSection` shows the
  field for contract and hides it for BOCES; webhook route stamps
  `errorMessage` with the event type on error-mapped events and leaves it
  untouched for non-error transitions; send route writes `processing` on
  accept; documents/[id] route enforces auth + ownership; ReviewStage banner
  walks processing → sent and processing → error (with message) and the
  timeout copy.
- **`.gs` + full loop (no test harness):** verify e2e with a test-mode send —
  sender = rep profile email, signer = a different address, one additional CC
  at a second `@fullmindlearning.com` address. Confirm: CC notification
  arrives + request shows CCs in the Dropbox Sign dashboard; banner shows
  "Sending…" then flips to "Sent ✓" only after the `signature_request_sent`
  webhook lands (ngrok tunnel + account callback URL per CLAUDE.md). Test mode
  may reject external-domain CCs; real AP-team CCs get exercised at prod
  cutover.

## Deployment

`clasp push` then `clasp deploy -i AKfycby0oFEDEj77XpMNNZaB9WpOVsHoUBeY1Nsa2nJbvU5J3nyfnTYSmvQHJgh9DdCtoTsy`
(versioned `/exec` deployment — push alone does not go live). Safe to deploy
while `DROPBOX_SIGN_TEST_MODE='1'`.

## Out of scope

- Persisting CC addresses on `GeneratedDocument`
- The signature-status monitoring view (separate future plan; the
  documents/[id] status route added here is a natural building block for it)
- Prod cutover steps (test-mode flip, Vercel env, callback URL)
