# Report Draft Recovery

**Date:** 2026-05-19  
**Status:** Approved, pending implementation  

## Problem

Users who build a report and navigate away without clicking "Save Report" lose all their work. The `ReportDraft` table exists in the schema but has never been wired up. This feature activates it.

## Goals

- Autosave draft state after every completed AI turn — no user action required
- Restore drafts when the user returns, with tiered UX based on how long they were away
- Show draft rows in the Reports library (Mine tab) with expiry countdowns
- Soft toast on navigate-away for reassurance; no blocking "are you sure?" modal
- Drafts expire after 30 days of inactivity and are cleaned up by a daily cron

## Non-Goals

- Manual draft naming or tagging
- Sharing drafts with other users
- Draft history / version rollback beyond what already exists via BuilderVersions

---

## Data Layer

### Schema change

The existing `report_drafts` table uses `user_id` as its sole primary key (one draft per user). Replace with a composite key `(user_id, report_id)` to support one draft per context.

- `report_id = 0` is the sentinel for a fresh/unsaved session (no `saved_reports` row will ever have id=0)
- `report_id = N` tracks unsaved refinements on top of saved report N

```sql
ALTER TABLE report_drafts DROP CONSTRAINT report_drafts_pkey;
ALTER TABLE report_drafts ADD COLUMN report_id INT NOT NULL DEFAULT 0;
ALTER TABLE report_drafts ADD PRIMARY KEY (user_id, report_id);
```

> **No FK on `report_id`:** The sentinel value `0` has no corresponding `saved_reports` row, so a foreign key constraint is omitted entirely. Referential integrity for `report_id > 0` is enforced at the application layer — draft upserts always pass a real saved-report id, and the `ON DELETE CASCADE` behaviour is replicated by the delete-draft-on-save lifecycle rule.

### Updated Prisma model

```prisma
model ReportDraft {
  userId         String   @map("user_id") @db.Uuid
  reportId       Int      @default(0) @map("report_id")    // 0 = fresh session
  params         Json                                        // BuilderVersion shape
  conversationId String?  @map("conversation_id") @db.Uuid
  chatHistory    Json?    @map("chat_history")              // BuilderTurn[]
  lastTouchedAt  DateTime @updatedAt @map("last_touched_at")
  createdAt      DateTime @default(now()) @map("created_at")

  user UserProfile @relation("UserReportDraft", fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, reportId])
  @@map("report_drafts")
}
```

### What gets saved

| Field | Value |
|---|---|
| `params` | The current `BuilderVersion` (sql, summary, columns, rows, rowCount, executionTimeMs) |
| `conversationId` | Active conversation UUID |
| `chatHistory` | Full `BuilderTurn[]` array (enables full replay on restore) |
| `reportId` | `0` for fresh session; loaded report's id otherwise |

---

## API

Three endpoints under `/api/reports/draft`:

### `GET /api/reports/draft?reportId=0`
Returns the draft for the calling user + reportId context, or `null` if none exists.

```ts
// Response
{ draft: ReportDraft | null }
```

### `PUT /api/reports/draft`
Upserts the draft for the calling user + reportId. Called after each turn completes.

```ts
// Body
{
  reportId: number          // 0 for fresh session
  params: BuilderVersion
  conversationId?: string
  chatHistory: BuilderTurn[]
}
// Response: 200 { ok: true }
```

### `DELETE /api/reports/draft?reportId=0`
Deletes the draft for the calling user + reportId. Called on:
- Successful save (any save variant)
- User clicks "Discard"
- User clicks "Start fresh" when loading a saved report that has an existing draft

```ts
// Response: 200 { ok: true }
```

### `POST /api/cron/expire-report-drafts`
Deletes all `report_drafts` rows where `last_touched_at < NOW() - INTERVAL '30 days'`. Protected by `CRON_SECRET` header check (same pattern as `pipeline-snapshot`). Scheduled at `0 3 * * *` in `vercel.json`.

---

## TanStack Query Hooks (`queries.ts`)

```ts
// Load draft for a context
useReportDraft(reportId: number): UseQueryResult<ReportDraft | null>

// Upsert draft — called after turn completes
useUpsertReportDraft(): UseMutationResult

// Delete draft — called on save / discard
useDeleteReportDraft(): UseMutationResult
```

Query key: `['report-draft', reportId]` — invalidated on upsert and delete.

---

## Autosave Mechanism (`ReportsBuilder.tsx`)

A `useEffect` watches `turns` for a newly-completed turn (last turn: `inFlight === false && version !== null`). When triggered it calls `upsertDraft.mutate(...)` with the current state. No additional debounce needed — turns naturally take several seconds, making back-to-back saves impossible.

A `beforeunload` event listener is registered on mount as a last-chance flush using `navigator.sendBeacon` (fire-and-forget, survives tab close).

```ts
useEffect(() => {
  const lastTurn = turns[turns.length - 1]
  if (!lastTurn || lastTurn.inFlight || !lastTurn.version) return
  upsertDraft.mutate({
    reportId: reportId ?? 0,
    params: lastTurn.version,
    conversationId,
    chatHistory: turns,
  })
}, [turns])
```

---

## Recovery Flow (`ReportsBuilder.tsx`)

On mount, `useReportDraft(reportId ?? 0)` is called. The result determines which recovery path to take:

| Condition | Behaviour |
|---|---|
| No draft found | Normal load — no change |
| Draft found, `lastTouchedAt` < 8 hours ago | **Silent auto-resume** — restore turns + version, show brief "✓ Draft restored" chip in chat rail (fades after 3s) |
| Draft found, `lastTouchedAt` ≥ 8 hours ago, user is in the builder | **In-builder banner** — shown above the results pane: "You have unsaved work from X days ago — Restore / Start fresh" |
| Draft found, `lastTouchedAt` ≥ 8 hours ago, user is on the library | **Library banner** — shown above the tabs: draft name + age + Resume / Discard |

These two surfaces are independent: the in-builder banner handles direct navigation to `?view=builder`, and the library banner handles discovery when the user browses the library first. Both can be shown in the same session if the user bounces between views.

### In-builder banner (`ReportsBuilder.tsx`)

- Rendered above the results pane when a stale draft is found on mount
- "Restore" → loads draft turns + version into state, deletes the draft row after restore
- "Start fresh" → calls `deleteReportDraft.mutate(reportId ?? 0)`, clears banner, proceeds with empty state

### Library banner (`ReportsTab.tsx`)

- Shown at top of the library when `view !== 'builder'` and a draft with `lastTouchedAt ≥ 8h` exists
- "Resume" → calls `goToBuilder({ report: String(reportId) })`, builder handles restore via in-builder path
- "Discard" → calls `deleteReportDraft.mutate(reportId ?? 0)`, dismisses banner

---

## Navigate-Away Toast

When the user navigates away from the builder (detected via Next.js router `pathname` change) and an unsaved draft exists, show a toast for 4 seconds:

> **Draft saved** — Resume anytime from the Reports tab

Implemented in `ReportsTab.tsx` by watching the active `view` param — when it transitions from `'builder'` to anything else and `upsertDraft.isSuccess`, fire the toast. Uses the existing `setToast` pattern already in `ReportsBuilder`.

Only shown if at least one completed turn exists. Silent if the builder was opened but no turn was ever run.

---

## Library UI Changes

### Draft rows (`LibraryRow.tsx`)

Draft rows are distinguished from saved reports by a `isDraft: true` flag on the list item (returned by `GET /api/reports` when `report_drafts` rows are joined in). Visual treatment:

- Dashed border (`border-dashed`) in plum tone
- Background: `#FAF8FF`
- **DRAFT** badge (pill, `bg-plum-50 text-plum-700`)
- "Resume →" action link (right-aligned)
- Sorted to top of the Mine tab list, above saved reports

### Expiry countdown styling

| Time remaining | Border color | Badge | Subtext color |
|---|---|---|---|
| > 7 days | Plum dashed | — | Muted gray |
| ≤ 7 days | Amber dashed | `⚠ expires in N days` (amber) | Amber |
| ≤ 1 day | Red dashed | `⚠ expires tomorrow` (red) | Red |

---

## Draft Lifecycle Summary

| Event | Action |
|---|---|
| Turn completes in builder | Upsert draft |
| Tab/window closes | Beacon upsert (last-chance flush) |
| Save report (any variant) | Delete draft for context |
| User clicks Discard | Delete draft for context |
| User clicks Start fresh (saved report with draft) | Delete draft for context |
| `last_touched_at` > 30 days | Cron deletes row |

---

## Files Touched

| File | Change |
|---|---|
| `prisma/schema.prisma` | Update `ReportDraft` model — composite PK, add `reportId` |
| `prisma/migrations/` | New migration for schema change |
| `src/app/api/reports/route.ts` | Modify GET — left-join `report_drafts` and include draft rows in the Mine tab response with `isDraft: true` |
| `src/app/api/reports/draft/route.ts` | New — GET + PUT + DELETE |
| `src/app/api/cron/expire-report-drafts/route.ts` | New — daily expiry cron |
| `vercel.json` | Add cron schedule for expire-report-drafts |
| `src/features/reports/lib/queries.ts` | Add `useReportDraft`, `useUpsertReportDraft`, `useDeleteReportDraft` |
| `src/features/reports/components/builder/ReportsBuilder.tsx` | Autosave effect, recovery on mount, in-builder restore banner |
| `src/features/reports/components/ReportsTab.tsx` | Navigate-away toast, library resume banner |
| `src/features/reports/components/library/LibraryRow.tsx` | Draft row styling + expiry countdown |
| `src/features/reports/components/library/LibraryList.tsx` | Sort drafts to top, join draft rows into list |
