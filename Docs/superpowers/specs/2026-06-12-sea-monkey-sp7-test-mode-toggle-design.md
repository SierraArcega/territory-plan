# Sea Monkey SP7 — Dropbox Sign Test Mode Toggle (Design)

**Date:** 2026-06-12
**Status:** Approved (brainstorm 2026-06-12)
**Depends on:** SP4 (PR #269), SP5 (PR #272), SP6 (PR #273) — all merged to main.

## Problem

The doc-gen pipeline's test/live switch is the Apps Script script property
`DROPBOX_SIGN_TEST_MODE` (`'1'`/`'0'`), read in `Code.gs` as
`props[PROP.DROPBOX_SIGN_TEST_MODE] || '1'`. Flipping it requires console access
to the Apps Script project — invisible to admins and reps. Reps sending a
contract in test mode get a "Sent ✓" that never produces a real signature
request, with no explanation.

## Goals

1. Admin-controlled Test Mode toggle in **Admin → Integrations**, presented as a
   "Dropbox Sign" card alongside Google Calendar and OpenSearch Sync.
2. Rep-facing annotation on the doc-gen "Send for signature" button while Test
   Mode is ON, so reps understand why their send is sandboxed.
3. App DB becomes the source of truth; no manual Apps Script property edits ever
   again (the property remains only as a fallback for editor-run tests).
4. This supersedes the prod-cutover step "flip the Apps Script test-mode
   property" → becomes "flip the Admin toggle".

## Decisions (locked in brainstorm)

| Decision | Choice |
|----------|--------|
| Storage | New generic `app_settings` key-value table (no existing settings pattern in the repo) |
| Propagation to Apps Script | Per-send injection: send route injects `test_mode` into the renderer payload; `Code.gs` prefers the payload value, falls back to the script property. One-time Apps Script change → deploy **@12**. No property-sync call. |
| Confirm on flip | Confirm dialog **only Test → Live**; Live → Test flips instantly |
| API shape | Extend `GET /api/admin/integrations` with a third entry; one new generic `PATCH /api/admin/settings` (key allowlist) for writes |

## 1. Data layer

New Prisma model:

```prisma
model AppSetting {
  key         String       @id @db.VarChar(100)
  value       Json
  updatedAt   DateTime     @updatedAt @map("updated_at")
  updatedById String?      @map("updated_by_id") @db.Uuid
  updatedBy   UserProfile? @relation(fields: [updatedById], references: [id], onDelete: SetNull)

  @@map("app_settings")
}
```

(`UserProfile` gains the back-relation.)

- One key for now: **`dropbox_sign_test_mode`**, value = JSON boolean.
- **Missing row = test mode ON** (fail-safe). No seed row needed; the first
  admin toggle creates it.
- Accessors in `src/features/shared/lib/app-settings.ts`:
  - `getAppSetting<T>(key): Promise<T | undefined>` — generic read.
  - `getDropboxSignTestMode(): Promise<boolean>` — missing row or malformed
    value → `true`; a DB **error throws** (the send fails loudly rather than
    silently flipping mode).
  - `setDropboxSignTestMode(value: boolean, byProfileId: string)`.
- Migration note: prod `migrate deploy` is still blocked by ledger drift, so
  this migration is applied to the live DB via `prisma db execute` (same as
  SP6's `school_year_manual`), and the cutover `prisma migrate resolve
  --applied` count grows by one (×5 → **×6**).

## 2. API layer

### `GET /api/admin/integrations` (existing — extended)

Adds a third entry:

```ts
{
  name: "Dropbox Sign",
  slug: "dropbox-sign",
  status: "test" | "live",            // from getDropboxSignTestMode()
  connectedUsers: null,
  totalUsers: null,
  lastSyncAt: <max generated_documents.sent_at> | null,  // rendered as "Last send"
  description: "Sends contracts for e-signature via Dropbox Sign",
  modeChangedAt?: string,             // app_settings.updated_at when row exists
  modeChangedByName?: string,         // joined UserProfile.fullName
}
```

`modeChangedAt`/`modeChangedByName` are optional additions to the
`AdminIntegration` interface; the two existing cards are untouched.

### `PATCH /api/admin/settings` (new)

- Body: `{ key: string, value: unknown }`.
- Allowlist with per-key validators: `dropbox_sign_test_mode` → value must be a
  boolean. Unknown key or invalid value → 400.
- `getAdminUser()` gate → 403 otherwise (same as every `/api/admin/*` route).
- Writes value + `updatedById` from the admin profile; returns the updated
  setting.

### `GET /api/document-generation/settings` (new)

- `getUser()` gate (any authed rep) → 401 otherwise.
- Returns `{ testMode: boolean }` via `getDropboxSignTestMode()`.
- `force-dynamic`, like the sibling doc-gen routes.

### `POST /api/document-generation/send` (existing — extended)

- Reads `getDropboxSignTestMode()` and passes it down:
  `sendForSignature(payload, { testMode })`.
- `sendForSignature` adds `test_mode: testMode ? '1' : '0'` to the renderer
  body (alongside `tags`/`auto_send`). **Server-injected — never read from the
  client payload.**

## 3. Apps Script (deploy @12)

One-time change in `Code.gs` (auto_send block, the `dsPayload.test_mode` line):

```js
'test_mode': (payload.test_mode === '0' || payload.test_mode === '1')
                ? payload.test_mode
                : (props[PROP.DROPBOX_SIGN_TEST_MODE] || '1'),
```

- Strict string match; anything else falls back to the script property, which
  keeps protecting editor-run tests (`Tests.gs`) and any non-app callers.
- Ship: `clasp push` + `clasp deploy -i AKfycby0oFEDEj77XpMNNZaB9WpOVsHoUBeY1Nsa2nJbvU5J3nyfnTYSmvQHJgh9DdCtoTsy -d "SP7 test_mode payload preference"` → **@12**.
- Worktree reminder: symlink `.clasp.json` first (gitignored).
- **Webhook needs no change** — `/api/webhooks/dropbox-sign` already reads
  `signature_request.test_mode` from the Dropbox event itself (Slack skip etc.).

## 4. Admin card UI

`IntegrationsTab` renders the `dropbox-sign` slug via a dedicated
`DropboxSignCard` component (same chrome as `IntegrationCard`: white card,
title, description, status pill top-right, meta line below — the first
interactive card in the grid):

- **Status pill:** amber **"Test Mode"** using the established warning-pill
  pattern (`bg-[#fffaf1] text-[#997c43]`, dot `#FFCF70` — per
  `CalendarSyncBadge`); green **"Live"** reusing the existing connected style
  with a "Live" label.
- **Toggle row:** labeled "Test Mode" switch + helper line
  "Sends are sandboxed — no real emails, no credits." Admin-only by
  construction (the whole `/admin` layout and API route are admin-gated).
- **Meta line:** "Mode changed 2h ago by Aston Arcega · Last send: 3d ago"
  (segments omitted when null; reuse the tab's `relativeTime`).
- **Flip behavior:**
  - Test → Live: confirm dialog — "Going live: future sends create real
    signature requests, email real recipients, and consume Dropbox Sign
    credits." Confirm → PATCH.
  - Live → Test: immediate PATCH (turning safety on has no friction).
  - No optimistic update: switch disabled while the PATCH is in flight, then
    invalidate `["admin", "integrations"]`. Inline error text on failure.

## 5. Rep-facing annotation (ReviewStage)

- `GenerateDocumentModal` mounts `useDocGenSettings()` (TanStack query on
  `GET /api/document-generation/settings`, `staleTime` 60s, stable string key)
  and passes `testMode: boolean | undefined` to `ReviewStage`.
- For **contracts** when `testMode === true`:
  - Amber callout (warning tokens) above the Send button:
    **"Sending is in test mode — this won't produce a real signature request.
    Use Google Docs to send an executable, or contact your Admin to disable
    Test Mode."**
  - The Send button keeps its filled-primary style but gains an amber ring +
    a small "Test mode" tag so the highlight reads at a glance.
  - Button stays **enabled** — test sends still work and are harmless.
- While the settings query is loading or errored: no annotation (fail-quiet —
  it is informational only; the server-side injection at send time is
  authoritative, so a stale annotation can never change what actually happens).

## 6. Error handling summary

| Failure | Behavior |
|---------|----------|
| `app_settings` row missing / malformed value | Test mode ON (fail-safe) |
| DB error reading the setting during send | Send route 500s (loud, no silent mode flip) |
| PATCH toggle fails | Switch reverts (never moved — no optimistic update), inline error on card |
| Settings GET fails in the form | No annotation; send unaffected |
| Payload `test_mode` absent/garbled at Apps Script | Falls back to script property (defaults test) |

## 7. Testing

- **Route tests:** PATCH — 403 non-admin, 400 unknown key / non-boolean value,
  happy write + `updatedById` stamping; doc-gen settings GET — 401 unauthed,
  `testMode: true` default with no row; integrations GET — includes the
  `dropbox-sign` entry with correct `status` mapping.
- **Lib tests:** `getDropboxSignTestMode` — missing row → true, malformed →
  true, explicit false → false.
- **Send route tests:** renderer body carries `test_mode: '0'` when live,
  `'1'` when test or row missing.
- **Component tests:** pill variants (test/live), confirm dialog appears only
  on Test → Live, ReviewStage callout renders when `testMode === true` and is
  absent when false/undefined/non-contract.
- **Apps Script:** verified live post-deploy @12 — a test-mode e2e send (same
  pattern as SP4–SP6 smoke tests), confirming payload preference over the
  property.

## 8. Out of scope

- Webhook changes (already event-derived).
- Signature-status monitoring view, SP3 opportunity entry points.
- Property-sync action in Apps Script (rejected in brainstorm — drift risk).

## 9. Supersession (cutover list update)

The prod-cutover step **"flip the Apps Script `DROPBOX_SIGN_TEST_MODE`
property '1' → '0'"** is replaced by **"disable Test Mode via the Admin →
Integrations toggle"**. The cutover ledger-resolve count becomes ×6 (this
migration included).
