# Sea Monkey SP6 — Document Naming Convention + Slack Auto-Post

**Date:** 2026-06-11
**Status:** Approved (brainstorm 2026-06-11)
**Builds on:** SP5 (PR #272 — executed-PDF Drive archive, payload reporting), SP4 (PR #269 — Dropbox Sign delivery + lifecycle webhook)

## Goal

Two user-facing improvements to the doc-gen pipeline:

1. **A deliberate naming convention** for executed PDFs in the Drive Executed
   folder and for rendered Google Docs in `_output` — replacing the build-time
   placeholder names.
2. **Auto-post the executed agreement to Slack** (`#contracts-signed`) when
   signing completes, with the PDF attached.

Both changes live at the SP5 webhook archive step, where the PDF buffer and
document metadata are already in hand.

## Decisions (locked in brainstorm)

| Question | Decision |
|---|---|
| Executed-PDF name ordering | **School-year first** — folder sorts into SY groups, then district |
| Rendered `_output` docs | **Adopt the same convention** (and fix the MM/DD/YYYY slashes) |
| Slack delivery | **Upload the PDF file** via the existing Fullmind Slack app + `files:write` scope |
| Test-mode sends | **Skip Slack entirely** (Drive archive still happens) |
| Channel | **New `#contracts-signed`**, env-configured |

## 1. Naming convention

One convention, two implementations. The webhook names executed PDFs in
TypeScript; Apps Script names rendered docs at render time. Cross-language, so
the helpers are mirrored, not shared — each cites this spec.

### Executed PDFs (webhook → Drive Executed folder)

```
SY26-27 — Gary Community Schools — Contract — signed 2026-06-10 (a1b2c3d4).pdf
```

Segments, in order:

| Segment | Source | When missing |
|---|---|---|
| `SY26-27` | promoted `school_year` column (`"2026 - 2027"` → `SY26-27`) | omit segment (pre-SP5 rows have null) |
| Company | `row.companyName` — the name as printed on the document. NOT the DB district name (`district_lea_id` is nullable and the doc is the artifact of record) | always present (NOT NULL) |
| Doc type | literal `Contract` (only contracts reach this folder — BOCES quotes are never sent for signature) | — |
| `signed YYYY-MM-DD` | archive date, ISO | — |
| `(sigid8)` | first 8 chars of `signature_request_id` | — (collision guard for re-sends; always present) |

New module `src/features/document-generation/lib/naming.ts`:

- `formatSchoolYearShort(schoolYear: string | null): string | null` —
  `"2026 - 2027"` → `"SY26-27"`; returns null on null/unparseable input
  (caller omits the segment).
- `isoDate(d: Date): string` — `YYYY-MM-DD` (check `date-utils.ts` first; if an
  equivalent exists, reuse it).
- `buildExecutedPdfName({ companyName, schoolYear, signatureRequestId, date })` —
  assembles the full filename.

The webhook route (`src/app/api/webhooks/dropbox-sign/route.ts`) calls
`buildExecutedPdfName` instead of the current inline template, selecting
`schoolYear` alongside the existing fields.

### Rendered Google Docs (Apps Script → `_output`)

```
SY26-27 — Gary Community Schools — Contract — 2026-06-10        (contract)
BOCES Quote 123445 — Gary Community Schools — 2026-06-10        (BOCES quote)
```

- Date is ISO, computed at render time via
  `Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd')`
  — fixes the slashes that `deal.today` (MM/DD/YYYY, the `<<today>>` token
  format, which does NOT change) currently puts in filenames.
- Contract name school-year segment derives from `deal.school_year`; omitted
  when blank.
- BOCES quotes have no school year; they gain the **quote number**
  (`deal.quote_number`) instead — re-renders of the same quote create new Drive
  files, and the number ties them together. When the quote number is blank the
  segment collapses to plain `BOCES Quote` (no dangling separator).
- Implementation: small helpers in `Utils.gs` (`shortSchoolYear_`,
  `isoToday_`); `Code.gs` and `BocesQuote.gs` docName lines updated.
- Deploy: `clasp push` + `clasp deploy -i AKfycby0oFEDEj77XpMNNZaB9WpOVsHoUBeY1Nsa2nJbvU5J3nyfnTYSmvQHJgh9DdCtoTsy`
  (→ @10). The exported PDF attached to the Dropbox Sign send inherits
  `docName + '.pdf'` and the title field — both pick the new name up
  automatically.

Same-name duplicates in `_output` (contract re-renders on the same day) remain
allowed — Drive permits duplicate names and the DB row points at the correct
`docId`. No retroactive renaming of existing files.

## 2. Slack auto-post

### Placement and isolation

Inside the webhook's existing `status === "signed"` guarded block
(`route.ts`), **after** the Drive archive and DB update, in its **own**
try/catch:

```
if (status === "signed") {
  try { /* existing: fetch PDF → upload to Drive → stamp row */ } catch {...}
  try { /* NEW: post to Slack (skip if test_mode) */ } catch (e) { console.error("Slack notify error:", e); }
}
```

- Slack failure logs and never blocks the ack or the archive (which has
  already been stamped).
- The Slack post runs whenever the PDF buffer was fetched — even if the Drive
  upload failed (the Drive-link line is simply omitted).
- Idempotency rides the existing `executedPdfFileId` guard: the post happens
  only on the call that performed the archive. The known rare concurrent
  signed/all_signed double-fire that can double-upload to Drive can likewise
  double-post; accepted at current volume, same as the documented
  double-upload trade-off.
- One more accepted corner: if the Drive upload fails but the Slack post
  succeeds, the row stays unstamped and a Dropbox Sign retry re-runs both
  steps — a second Slack post in that failure corner is accepted (best-effort,
  low volume, and the retry is also what heals the missing archive).

### Mechanism

Extend the existing Fullmind Slack app (the one behind
`src/app/api/integrations/slack/`) with the `files:write` scope; one admin
reinstall mints a bot token carrying the new scope. Two new env vars (local
`.env.local` + Vercel Production):

- `SLACK_BOT_TOKEN` — bot user OAuth token, marked Sensitive.
- `SLACK_EXECUTED_CHANNEL_ID` — channel id of `#contracts-signed` (create the
  channel, invite the bot).

Per-user `UserIntegration` tokens are NOT used — the webhook has no user
session, and a system-level post should not depend on any individual's
connection.

New module `src/features/document-generation/lib/slack-notify.ts`:

- `postExecutedAgreement({ pdf, filename, companyName, orderTotal, schoolYear, repName, signedDate, driveUrl })`
- Uses Slack's external upload flow: `files.getUploadURLExternal` → HTTP POST of
  the PDF bytes → `files.completeUploadExternal` with `channel_id` +
  `initial_comment`. (`files.upload` is deprecated; the external flow is the
  supported path.)
- Missing env vars → log + return without throwing (graceful on preview
  deploys; mirrors the readonly-pool pattern).

### Message content

```
🖋️ Contract signed — Gary Community Schools
$20,211.18 · SY26-27 · sent by Aston Arcega · signed 2026-06-10
[PDF attached] · Drive: <executed_pdf_url>
```

- Company: `row.companyName`.
- Total: promoted `order_total`, formatted `$X,XXX.XX`; line segment omitted
  when null (pre-SP5 rows).
- School year: `formatSchoolYearShort` (shared with naming); omitted when null.
- Rep: `payload.deal.sender_first + ' ' + sender_last` (always present in
  SP5+ payloads); falls back to omitting when the payload predates SP5.
- Drive link: included only when the archive succeeded.
- Filename: the same `buildExecutedPdfName` output — Slack and Drive show the
  identical name.

### Test mode

The Dropbox Sign event JSON carries `signature_request.test_mode`. When
`true`: archive to Drive exactly as today, **skip the Slack post**. E2e
verification of the Slack step itself uses a temporary
`SLACK_EXECUTED_CHANNEL_ID` override pointing at a scratch channel.

## 3. Testing

TDD throughout:

- `naming.test.ts` — school-year shortening (normal, null, unparseable,
  single-year strings), full filename assembly with/without school year.
- `slack-notify.test.ts` — mocked fetch: happy path (3-call sequence),
  missing-env skip, Slack API error surfaces as throw (caller catches).
- Webhook route tests extended: posts on signed (Slack mocked), skips on
  `test_mode: true`, skips on non-signed events, Slack throw does not break
  the ack or the archive stamp, Drive-link omission when archive failed.
- Apps Script: existing manual harness (`Tests.gs`) + one live render to
  verify both docName shapes.

## 4. Rollout / cutover additions

These join the SP4/5 production cutover checklist (one pass, user-gated):

1. Add `files:write` to the Slack app scopes; reinstall; copy the bot token.
2. Create `#contracts-signed`; invite the bot; capture the channel id.
3. Set `SLACK_BOT_TOKEN` (Sensitive) + `SLACK_EXECUTED_CHANNEL_ID` in Vercel
   Production (alongside the already-pending `GOOGLE_DOC_EXECUTED_FOLDER_ID`).
4. `.env.example` gains both vars.
5. Apps Script deploy @10 (naming).

## Out of scope

- Signature-status monitoring view (separate thread).
- SP3 opportunity entry points (`opportunity_id` still always null).
- Retroactive renaming of already-archived PDFs / rendered docs.
- Moving the archive after the ack (`next/server` `after()`) — stays a noted
  debt.
- BOCES invoice-date business call; pricebook unit cleanup; schema-coverage
  test fix (separate quick PR).

## Addendum 1 (2026-06-11, smoke test) — BOCES name order

Rendered BOCES quote names lead with the quote number so `_output` groups and
sorts by quote: `BOCES Quote 123445 — <company> — <ISO date>`. Deployed @11,
live-verified.

## Addendum 2 (2026-06-11) — Mandatory school-year selector + manual-entry tracking

The contract form's free-text school-year input caused typo risk in the SY
filename segment. Approved changes (contract form only; BOCES untouched):

1. **Selector**: the input becomes a `<select>` of 6 generated school years in
   the canonical `"2026 - 2027"` format — previous, current (July-1 FY rule),
   and next 4. A loaded value outside that window is prepended as an extra
   option so saved state is never misrepresented.
2. **Derivation + default**: new pure module
   `src/features/document-generation/lib/school-year.ts` (deliberately separate
   from `fiscal-year.ts` to avoid the pricebook import chain):
   `schoolYearFromDate(iso)` (SY containing the date, July-1 boundary, via
   `getCurrentFY`), `defaultSchoolYear(today)` (SY starting in the current
   calendar year), `schoolYearOptions(today)` (the 6-option window).
   `emptyFormState` seeds contracts with `defaultSchoolYear()`.
3. **Sync**: changing the start date re-derives the SY until the rep manually
   picks one (touched ref; a draft whose SY differs from its derived value
   counts as touched). Toggling back from manual mode re-derives.
4. **Mandatory**: `getCompleteness` requires a non-empty school year for
   contracts; the select gets the red-border-when-empty treatment.
5. **Manual-entry escape hatch + tracking**: a `Type manually` ⇄ `Use selector`
   text-button swaps the select for the old free-text input. New
   `DocFormState.schoolYearManual: boolean` records the mode; it is emitted as
   top-level `meta: { school_year_manual }` on the contract payload (NOT inside
   `deal` — keeps the merge-field map string-typed; the renderer ignores
   unknown top-level keys), persisted BOTH in the payload JSONB and as a
   promoted `school_year_manual boolean NOT NULL DEFAULT false` column
   (payload is registry-excluded, so the promoted column is what makes
   "how often does manual entry get used?" answerable in the reports tool),
   and registered as a queryable column. The flag means "manual mode was on at
   generate time", not "value differs from an option".
6. **No format validation in manual mode** — that's the escape hatch's job;
   unparseable values already degrade gracefully (SY filename segment and
   Slack fact are omitted).

## Addendum 3 (2026-06-11) — Split year-pair selects

The single combined SY select becomes two side-by-side selects: **left = start
year** (same 6-year window as before, expressed as start years), **right = end
year**, offering start+1 through start+3 (multi-year deals), defaulting to
start+1. Changing the left year resets the right to start+1. The serialized
value stays the canonical `"<start> - <end>"` string — payload, persist,
naming (`formatSchoolYearShort("2026 - 2028")` → `SY26-28`), and tracking are
all unchanged. Derivation/sync/touched semantics carry over (derived value
populates the pair; picking either side counts as touched). The manual
free-text toggle and `school_year_manual` tracking stay. Out-of-window saved
values are injected as extra options per side; unparseable values only occur
in manual mode, where the text input shows them as-is.
