# Backend Context: Activities + Calendar Redesign

**Date:** 2026-04-27
**Slug:** activities-calendar-redesign
**Branch:** worktree-activities-calendar-redesign
**Source:** Discovery agent run, distilled by parent agent.

## Executive summary

Scaffold commit `8b0c9371` (and prerequisite `91a4da61`) already laid the page UI shell, the `ActivityNote` and `ActivityAttachment` tables, the Supabase Storage `activity-attachments` bucket SQL, and notes/attachment route handlers. **What's still missing** vs `design_handoff_activities_calendar/README.md`:

- 5 new Activity columns: `sentiment`, `next_step`, `follow_up_date`, `deal_impact`, `outcome_disposition`. Existing `outcome` is free-text and should stay as "outcome notes" — add a separate column for the handoff's 4-way enum.
- 4 new ActivityExpense columns: `category`, `incurred_on`, `receipt_storage_path`, `created_by_id`.
- `POST /api/activities/[id]/expenses` and `DELETE /…/expenses/[expenseId]` (currently expenses round-trip through PATCH on the parent activity).
- `CalendarSyncBadge` (new one in `features/activities/components/page/`) only emits `connected`/`disconnected` — never derives `stale`.
- `useActivities` query key uses raw object — phantom refetches per CLAUDE.md.
- Multi-value filter params are client-side only; silent 500-row truncation in team scope.
- **Bug**: `ActivitiesParams` sends `stateCode` but the GET route reads `stateAbbrev` — state filtering is broken.
- **Convention**: project uses `String` columns + constant arrays, NOT Prisma enums (only `UserRole` is a real enum).

## 1. Schema state — current vs handoff

| Concept | Handoff wants | Current state | Delta |
|---|---|---|---|
| `ActivityStatus` | enum {planned, tentative, in_progress, completed, cancelled} | `String @default("planned")`; `VALID_ACTIVITY_STATUSES = [planned, requested, planning, in_progress, wrapping_up, completed, cancelled]` | Set differs — handoff has `tentative` (new), current has 3 legacy statuses. **Recommend**: keep 7 in DB; render only the 5 handoff statuses in the redesigned drawer. Map "Tentative" UI → `requested` legacy value, OR add `tentative` to the constant array. |
| `ActivityOutcome` | enum {completed, no_show, rescheduled, cancelled} | `outcomeType String? @db.VarChar(30)` with sentiment-leaning legacy values | Different concept entirely. **Add new column** `outcome_disposition VARCHAR(20)`. |
| `ActivitySentiment` | enum {positive, neutral, negative} | not present | Add `sentiment VARCHAR(10)` |
| `nextStep` | String? | not present | Add `next_step TEXT` |
| `followUpDate` | DateTime? | not present | Add `follow_up_date TIMESTAMP(3)` |
| `dealImpact` | enum default none | not present | Add `deal_impact VARCHAR(20) NOT NULL DEFAULT 'none'` |
| `Activity.outcome` (free text) | n/a | `outcome String? @db.VarChar(500)` | Keep as "outcome notes"; do not repurpose. |
| `ActivityNote` | new table | **EXISTS** (migration `20260418_add_activity_notes_attachments`) | Matches handoff 1:1 |
| `ActivityExpense` | id, activityId, category, amountCents, description, incurredOn, receiptUrl, createdAt | id, activityId, description, `amount Decimal(10,2)`, createdAt | Missing: category, incurredOn, receiptStoragePath, createdById. **Keep Decimal**; expose `amountCents` in API responses if UI prefers. |
| `ActivityAttachment` | new table | **EXISTS** (migration `20260418_…`); stores `storagePath`, signed URL minted at read | Matches; `kind String VARCHAR(10)` accepts `'photo' \| 'file'` |
| `ExpenseCategory` enum | {travel, meals, lodging, swag, other} | not present | Add as String + constant array. |

## 2. Migration plan

Three migrations, project convention: timestamp-prefixed dir + single `migration.sql`.

### `prisma/migrations/20260427_add_activity_outcome_fields/migration.sql`
```sql
ALTER TABLE activities ADD COLUMN sentiment VARCHAR(10);
ALTER TABLE activities ADD COLUMN next_step TEXT;
ALTER TABLE activities ADD COLUMN follow_up_date TIMESTAMP(3);
ALTER TABLE activities ADD COLUMN deal_impact VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE activities ADD COLUMN outcome_disposition VARCHAR(20);
CREATE INDEX activities_follow_up_date_idx ON activities(follow_up_date) WHERE follow_up_date IS NOT NULL;
```

### `prisma/migrations/20260427_add_activity_expense_fields/migration.sql`
```sql
ALTER TABLE activity_expenses ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'other';
ALTER TABLE activity_expenses ADD COLUMN incurred_on TIMESTAMP(3);
UPDATE activity_expenses SET incurred_on = created_at WHERE incurred_on IS NULL;
ALTER TABLE activity_expenses ALTER COLUMN incurred_on SET NOT NULL;
ALTER TABLE activity_expenses ADD COLUMN receipt_storage_path VARCHAR(500);
ALTER TABLE activity_expenses ADD COLUMN created_by_id UUID REFERENCES user_profiles(id);
CREATE INDEX activity_expenses_category_idx ON activity_expenses(category);
```

### Storage
`supabase/storage-activity-attachments.sql` exists. **Run manually in Supabase SQL Editor.** Receipts: namespace under `<activityId>/receipts/<expenseId>-<filename>` in the same bucket — no second bucket needed.

## 3. API route inventory

### Activities (existing — only deltas listed)

| Route | Verb | Status | Action |
|---|---|---|---|
| `/api/activities` | GET | EXISTS | Add multi-value support (CSV-parsed), fix `stateCode`/`stateAbbrev` mismatch |
| `/api/activities/[id]` | PATCH | EXISTS | Add new outcome fields to accepted payload |
| `/api/activities/[id]/expenses` | POST | **MISSING** | Add — body `{category, description, amount, incurredOn, receiptStoragePath?}` |
| `/api/activities/[id]/expenses/[expenseId]` | DELETE | **MISSING** | Add — owner+admin only |
| `/api/activities/[id]/expenses/[expenseId]/receipt` | POST | **MISSING (optional)** | Multipart receipt upload to Supabase Storage |

### Calendar status — already returns enough data; UI derives `stale` from `lastSyncAt + pendingCount`. No backend change needed.

## 4. Supabase Storage

- Bucket: `activity-attachments` (private, 25MB cap, RLS ownership-checked)
- Helper: `src/lib/supabase-storage.ts` — `uploadActivityAttachment`, `getActivityAttachmentSignedUrl` (60-min TTL), `deleteActivityAttachment`
- **Setup**: `supabase/storage-activity-attachments.sql` is NOT auto-run by `prisma migrate`. Run manually in Supabase SQL Editor before deploying receipt upload UI.

## 5. Calendar sync — badge wiring

Two sync badges exist. Recommend extracting `useCalendarSyncState()` hook so both share logic.

State derivation:
- `connected`: `data.connected && status === "connected" && (Date.now() - lastSyncAt) < STALE_MS` (recommend 30 min)
- `stale`: connected but past threshold OR `pendingCount > 0`
- `disconnected`: `!data.connected || status === "error"`

`useActivitiesChrome` zustand store correctly excludes `syncState` from `partialize` — recompute on mount.

## 6. Query layer

- **Bug — fix in this PR**: `useActivities` query key uses raw object `["activities", params]`. Replace with serialized primitives per CLAUDE.md.
- **Bug — fix in this PR**: `ActivitiesParams.stateCode` vs route's `stateAbbrev`.
- **Multi-value filters**: extend GET to accept CSV (`?category=meetings,events&owner=u1,u2`). Less risky than client-side filtering over a 500-row window.
- **Pagination**: 4 pivots are date-range-bound (not list-paginated); the date filter is the natural boundary. Add the "narrow your filters" hint banner when `totalInDb > limit` per CLAUDE.md performance rules.

## 7. Auth + ownership

- **"Mine" derivation**: `where.createdByUserId = user.id` is the default; `ownerId="all"` opts in to team scope.
- **Plan-linked activities** are readable by anyone with plan access; PATCH/DELETE remain owner+admin.
- **Frontend default**: `useActivitiesChrome.filters.owners` seeds with `[profile.id]` from `useProfile()` via mount-time ref guard (CLAUDE.md UX rule).

## 8. Testing patterns

- Vitest + Testing Library + jsdom; co-located `__tests__/`
- Route handler tests: mock `@/lib/supabase/server`, `@/lib/prisma`, `@/features/calendar/lib/push`. Use `new NextRequest(new URL(url, "http://localhost:3000"), init)` to invoke directly.
- Add: `expenses/__tests__/route.test.ts`, extend existing `activities/__tests__/route.test.ts` PATCH cases for new outcome fields.

## 9. Risks & open questions

1. **Status set mismatch** (5 vs 7) — recommend keep 7 in DB, render 5 in drawer.
2. **Outcome column overload** — recommend keep `outcome` as notes; add `outcome_disposition`.
3. **Expense amount storage** — keep Decimal; expose `amountCents` in responses.
4. **Sync-badge `stale` derivation missing** — wire in shared hook.
5. **Multi-value filter** — extend API server-side rather than client-truncate.
6. **Audit log trigger** not extended to activities — out of scope v1.
7. **Receipt upload UX** — two-phase (create row → POST receipt) keeps API simple.
8. **`useActivities` query key** — fix this PR.
9. **`stateCode`/`stateAbbrev` bug** — fix this PR.
10. **`/activities` route file** — does NOT exist yet; create at `src/app/activities/page.tsx`.

## Anchor file paths

```
prisma/schema.prisma                                                             (Activity@576, ActivityNote@794, ActivityAttachment@811)
prisma/migrations/20260418_add_activity_notes_attachments/migration.sql
supabase/storage-activity-attachments.sql
src/lib/supabase-storage.ts
src/lib/supabase/server.ts
src/app/api/activities/route.ts                                                  (extend filter parsing)
src/app/api/activities/[id]/route.ts                                             (extend PATCH)
src/app/api/activities/[id]/notes/route.ts
src/app/api/activities/[id]/notes/[noteId]/route.ts
src/app/api/activities/[id]/attachments/route.ts
src/app/api/activities/[id]/attachments/[attachmentId]/route.ts
src/app/api/activities/[id]/attachments/[attachmentId]/url/route.ts
src/app/api/calendar/status/route.ts
src/features/activities/types.ts                                                 (VALID_ACTIVITY_STATUSES@131)
src/features/activities/outcome-types.ts
src/features/activities/lib/queries.ts                                           (fix query key + state bug; add multi-value)
src/features/activities/lib/filters-store.ts
src/features/activities/lib/saved-views.ts
src/features/activities/components/page/CalendarSyncBadge.tsx                    (derive stale)
src/features/calendar/components/CalendarSyncBadge.tsx
src/features/calendar/lib/queries.ts
src/features/shared/lib/queries.ts                                               (useProfile@169)
src/features/shared/lib/format.ts
src/features/shared/lib/cn.ts
src/features/shared/types/api-types.ts                                           (Activity@463, ActivitiesParams@573)
```
