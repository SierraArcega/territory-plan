# Sea Monkey SP5: Archive & Reporting — Design

**Date:** 2026-06-10
**Status:** Approved (brainstorm with Aston)
**Builds on:** SP4 delivery (PR #269) + CC/honest-status/PO fixes (PR #271, open at
time of writing — SP5 implementation must start from a main that includes #271,
since it touches the same table, send route, and ReviewStage)

## Problem

1. **Executed contracts vanish into email.** After signing completes, the
   executed PDF exists only inside Dropbox Sign and as email attachments to the
   signer/CCs. Nothing lands anywhere Fullmind controls.
2. **Doc-gen outputs are invisible to reporting.** `generated_documents` stores
   thin metadata (status, recipient, company, district, owner) and only for
   *sends* — no deal content (line items, totals, payment terms, dates), and
   BOCES quotes (no eSign) leave zero database trace. "What did we quote in
   May, by product, by district" is unanswerable.
3. **The Review stage is doc-first, not PDF-first.** Reps get a Google Doc edit
   link; there's no one-click PDF view/download of the rendered output.

## Decisions (locked in brainstorm)

1. **Executed PDFs auto-archive to Google Drive** — a dedicated "Executed"
   folder, uploaded by the existing doc-gen service account. (Not Supabase
   Storage, not link-only.)
2. **Row triggers: send + BOCES render.** Contracts keep row-on-send; contract
   previews stay ephemeral. BOCES quotes get a row on successful render (render
   is their terminal action), **upserted by quote number + owner** so
   re-renders update rather than stack drafts.
3. **Data shape: JSONB + promoted columns.** Full `DocPayload` in a `payload`
   JSONB column; high-traffic report fields promoted to real columns.
4. **Report surface: register `generated_documents` in the query tool's
   `TABLE_REGISTRY`** (it's currently in `excludedTables`). No dedicated
   monitoring view this release.
5. **Review stage becomes PDF-first**: View/Download PDF (primary, via Google's
   native `/export?format=pdf` URL), Edit in Google Docs (secondary — the
   existing doc URL), Send for signature (existing, contracts only).

## Workstream 1: Executed-PDF archiving to Drive

**Flow:** when the Dropbox Sign webhook processes an all-signed event
(`mapEventToStatus → "signed"`), after the status update succeeds it:

1. Downloads the executed PDF: `GET https://api.hellosign.com/v3/signature_request/files/{signature_request_id}`
   (Basic auth with `DROPBOX_SIGN_API_KEY`, `file_type=pdf`).
2. Uploads it to the **Executed Drive folder** via the Google Drive API using
   the existing service account + domain-wide delegation (same JWT machinery as
   `render-apps-script.ts`, new scope usage: the SA's DWD grant already includes
   `https://www.googleapis.com/auth/drive`). Filename:
   `<company_name> — <doc title or signature_request_id> (executed).pdf`.
3. Saves `executed_pdf_url` (Drive webViewLink) + `executed_pdf_file_id` on the
   row.

**Failure isolation:** archiving runs strictly after the status `updateMany`
and inside its own try/catch — any failure logs (`console.error`) and leaves
the PDF columns null. The webhook STILL acks `Hello API Event Received`
(Dropbox Sign must never see archiving failures as delivery failures). No
automatic retry in v1 — null `executed_pdf_url` on a `signed` row is the
re-fetch signal for a later manual/monitoring path.

**New env (Vercel + `.env.local` + `.env.example`):**
- `GOOGLE_DOC_EXECUTED_FOLDER_ID` — the Drive folder ID.

**Prerequisites (one-time setup, user-gated):**
- Enable the **Google Drive API** in GCP project `fullmind-doc-gen` (currently
  disabled — the renderer never needed it).
- Create the "Executed" Drive folder (suggested: sibling of `_output`), grant
  the workspace appropriate access, record its ID.

**Verification items (resolve in plan, don't guess):**
- Dropbox Sign file-availability timing: the executed PDF may lag the
  all-signed event. Confirm against current docs; handle the not-ready
  response (e.g., 409/404/`conflict`) by leaving columns null (v1) rather than
  retry loops inside the webhook.
- Exact response shape of the files endpoint (binary vs `file_url` JSON when
  `get_url=1`) — pick whichever avoids buffering surprises on Vercel.
- Drive upload via SA+DWD: which user to impersonate (`GOOGLE_DOC_RENDER_SUBJECT`,
  i.e. `service@fullmindlearning.com`) so file ownership/visibility is sane.

## Workstream 2: Payload persistence

**Schema (`generated_documents`):** new columns
- `payload JSONB` — the full `DocPayload` as sent to the renderer. Complete
  fidelity; line-item normalization can be derived later if reports demand it.
- Promoted report columns: `order_total NUMERIC`, `payment_type TEXT`,
  `start_date DATE`, `end_date DATE`, `school_year TEXT`, `quote_number TEXT`.
- (Workstream 1 adds `executed_pdf_url TEXT`, `executed_pdf_file_id TEXT`.)
- New `signature_status` enum value: **`rendered`** — the status for non-eSign
  outputs (BOCES quotes). Signature lifecycle statuses don't apply to them;
  `doc_type` + `rendered` reads naturally in reports.

Migration applied the established way (`prisma db execute --url $DIRECT_URL`,
raw SQL, no TODOs in migration files). Enum `ADD VALUE` + `ALTER TABLE ADD
COLUMN`s are backward-compatible.

**`/send` route:** also writes `payload` + the promoted columns (values pulled
from the same `DocPayload` it already receives — `payload.quote.order_total`,
`payload.payment.type`, `deal.start_date`/`end_date`/`school_year`).

**`/render` route:** stays pure for contracts. For `doc_type === "boces_quote"`
with a successful render, it **upserts** a row keyed by
`(docType='boces_quote', quoteNumber, ownerProfileId)`:
- insert: status `rendered`, docUrl/docId, companyName, districtLeaId (request
  must carry it — the render client/form already knows the district), payload +
  promoted columns, recipientEmail `""` (no recipient concept for quotes).
- update (same quote number re-rendered): refresh docUrl/docId/payload/promoted
  columns + `updatedAt`.
- Upsert needs a supporting unique index: partial unique on
  `(quote_number, owner_profile_id)` where `doc_type = 'boces_quote'` (quote
  numbers are required by validation for BOCES, but guard empty-string anyway —
  skip row creation if `quote_number` is blank).
- Render-row failure must not break the render response (try/catch + log; the
  rep still gets their doc).

## Workstream 3: Query-tool registration

In `src/lib/district-column-metadata.ts`:
- Remove `"generated_documents"` from `SEMANTIC_CONTEXT.excludedTables` (added
  there in PR #271 when the table was metadata-only).
- Add a `TABLE_REGISTRY` entry: description ("doc-gen outputs — contracts sent
  for signature + rendered BOCES quotes, with full deal payload"), primary key
  `id`, column metadata for the scalar columns (status incl. `rendered`,
  doc_type, company_name, order_total, payment_type, start/end dates,
  school_year, quote_number, recipient_email, executed_pdf_url, sent_at,
  signed_at, created_at), relationships: `districts` via
  `generated_documents.district_lea_id = districts.leaid`, `opportunities` via
  `opportunity_id` (nullable until SP3), owner profile via `owner_profile_id`.
- Exclude from exposure: `payload` (JSONB blob — too raw for rep-facing
  queries), `doc_id`, `signature_request_id`, `error_message` (note them in
  `excludedColumns` per the registry's existing pattern).
- The schema-coverage test enforces registry/exclusion membership — it flips
  from "excluded" to "registered" cleanly.

## Workstream 4: PDF-first Review stage

`ReviewStage.tsx` action layout becomes:
- **View PDF** (primary button) — opens
  `https://docs.google.com/document/d/<docId>/export?format=pdf` in a new tab
  (browser downloads/previews). Derive from the existing `docId`/`docUrl`.
- **Edit in Google Docs** (secondary link) — the existing doc URL, relabeled;
  the manual-edit escape hatch.
- **Send for signature** (unchanged) — contracts only, honest-status banner.

Caveat to surface in helper text (one short line under the actions): manual
edits to the Google Doc do NOT flow into Send — Send re-renders a clean tagged
copy (mechanism A). The PDF export always reflects the doc's current state.

**Verification item:** confirm the `/export?format=pdf` URL works for a
non-owner rep in the workspace (docs are owned by the Apps Script deployer; if
sharing blocks export for other reps, fall back to a server-proxied
`GET /api/document-generation/documents/[id]/pdf` streaming via the SA — out of
scope unless the simple URL fails).

## Error handling summary

- Archive failure → row stays `signed`, PDF columns null, error logged, webhook
  still acks.
- BOCES render-row failure → render response unaffected, error logged.
- `/send` persistence of new columns is part of the existing row create (same
  transaction semantics as today).

## Testing

- **Vitest:** webhook archive path (mocked Dropbox files fetch + Drive upload —
  verify called only on signed, failure leaves ack intact); send route writes
  payload + promoted columns; render route upserts BOCES rows (insert, update
  on re-render, skip on blank quote number, contract renders untouched);
  ReviewStage three-action layout + caveat text; registry entry passes the
  schema-coverage test.
- **e2e (manual):** test-mode send → sign → executed PDF appears in the Drive
  folder + row has the link; BOCES render → row appears with payload; re-render
  same quote number → row updated not duplicated; View PDF button downloads;
  query tool answers a quotes-by-month question.

## Out of scope

- Monitoring view UI (future — registry covers reporting this release)
- SP3 opportunity/plan entry points (`opportunity_id` stays null)
- Retry/backfill machinery for failed archives (manual re-fetch later)
- Line-item normalization into a child table (derive from JSONB if needed)
- Prod cutover items (test-mode flip, callback URL, key rotation — separate
  checklist, unchanged by this release)
- Backfilling payload/PDF for rows created before SP5
