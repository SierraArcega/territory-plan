# Mixmax Sequence Integration Design

## Overview

Integrate Mixmax email sequence data into the Territory Plan Builder so reps can link their Mixmax campaigns to `email_campaign` activities and see campaign performance data (aggregate stats + per-recipient detail) without leaving the app.

## Goals

- Let reps connect their Mixmax account via API token (per-rep, matching the existing Google Calendar pattern)
- When reporting an email campaign activity, reps can link to a specific Mixmax sequence
- Pull back aggregate campaign stats: sent, delivered, opened, clicked, replied, bounced, meetings, unsubscribed
- Pull back per-recipient status and match recipients to existing contacts by email
- Provide a direct link to the Mixmax campaign for quick access
- Refresh data on-demand or automatically when stale (>1 hour)

## Data Model

### MixmaxConnection

Stores per-rep Mixmax API tokens. Mirrors the `CalendarConnection` pattern.

```prisma
model MixmaxConnection {
  id             String    @id @default(uuid())
  userId         String    @unique @map("user_id") @db.Uuid
  apiToken       String    @map("api_token") // encrypted at rest
  mixmaxEmail    String    @map("mixmax_email") @db.VarChar(255)
  status         String    @default("connected") @db.VarChar(20) // connected, disconnected, error
  lastVerifiedAt DateTime? @map("last_verified_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("mixmax_connections")
}
```

### MixmaxSequenceSync

Cached campaign data for a linked activity. One sequence per activity.

```prisma
model MixmaxSequenceSync {
  id             String    @id @default(uuid())
  activityId     String    @unique @map("activity_id")
  sequenceId     String    @map("sequence_id") // Mixmax sequence ID
  sequenceName   String    @map("sequence_name") @db.VarChar(255)
  sequenceUrl    String    @map("sequence_url") @db.VarChar(500) // deep link to Mixmax
  stats          Json      @default("{}") // { sent, delivered, opened, clicked, replied, bounced, meetings, unsubscribed }
  recipientCount Int       @default(0) @map("recipient_count")
  lastSyncedAt   DateTime? @map("last_synced_at")
  syncStatus     String    @default("synced") @db.VarChar(20) // synced, syncing, error, rate_limited
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  activity   Activity                 @relation(fields: [activityId], references: [id], onDelete: Cascade)
  recipients MixmaxRecipientSnapshot[]

  @@map("mixmax_sequence_syncs")
}
```

### MixmaxRecipientSnapshot

Per-recipient data, refreshed on each sync (full replacement).

```prisma
model MixmaxRecipientSnapshot {
  id             Int      @id @default(autoincrement())
  sequenceSyncId String   @map("sequence_sync_id")
  email          String   @db.VarChar(255)
  contactId      Int?     @map("contact_id") // matched contact, nullable
  status         String   @db.VarChar(20) // queued, active, paused, exited
  opened         Boolean  @default(false)
  clicked        Boolean  @default(false)
  replied        Boolean  @default(false)
  bounced        Boolean  @default(false)
  lastSyncedAt   DateTime @map("last_synced_at")

  sequenceSync MixmaxSequenceSync @relation(fields: [sequenceSyncId], references: [id], onDelete: Cascade)
  contact      Contact?           @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([sequenceSyncId])
  @@index([contactId])
  @@map("mixmax_recipient_snapshots")
}
```

### Schema Changes to Existing Models

- Add `mixmaxConnection MixmaxConnection?` relation to `UserProfile`
- Add `mixmaxSync MixmaxSequenceSync?` relation to `Activity`
- Add `mixmaxRecipients MixmaxRecipientSnapshot[]` relation to `Contact`

## Connection Flow

1. Rep opens Profile > Settings > "Connected Accounts" section
2. Sees a "Mixmax" card showing connection status
3. Clicks "Connect" > enters their Mixmax API token (with instructions and link to Mixmax settings)
4. Backend verifies token by calling `GET /sequences?limit=1` with the token
5. If valid: saves encrypted token, stores Mixmax account email, shows "Connected"
6. If invalid: shows error message
7. Once connected: card shows "Connected as email" with Disconnect and Test Connection options

## Linking a Sequence to an Activity

Only available on activities with type `email_campaign`.

### No sequence linked (State A)

- "Link Mixmax Sequence" button (disabled with tooltip if rep hasn't connected Mixmax)
- Clicking opens a sequence picker modal:
  - Fetches `GET /sequences?limit=50` with pagination
  - Searchable list showing: sequence name, recipient count, created date
  - Rep selects one and confirms
  - Backend creates `MixmaxSequenceSync` and triggers first sync

### Sequence already linked (State B)

- Compact card showing:
  - Sequence name (bold, plum)
  - "Open in Mixmax" link (coral, external-link icon) for direct access to the campaign
  - Sync status indicator + last synced timestamp
  - Quick stats row: Sent, Opened, Clicked, Replied
  - Refresh button for manual re-sync
  - Unlink option in overflow menu

### Constraints

- One sequence per activity (enforced by unique constraint on `activityId`)
- Two different reps can link the same sequence to different activities (each gets its own snapshot)

## Data Sync Mechanism

### When sync happens

1. **On link** - immediately after linking a sequence to an activity
2. **On view** - when opening activity detail, if `lastSyncedAt` is older than 1 hour
3. **On manual refresh** - rep clicks the Refresh button

### Sync process

1. Look up `MixmaxSequenceSync` record and rep's `MixmaxConnection` token
2. Set `syncStatus = "syncing"`
3. Call `GET /sequences/:id?expand=stages` for sequence metadata and aggregate stats
4. Call `GET /sequences/:id/recipients?limit=300` (paginated with offset) for all recipients
5. For each recipient email, batch-match against `contacts` table: `WHERE email IN (...)`
6. Delete old `MixmaxRecipientSnapshot` rows, insert fresh ones (full replacement)
7. Update `MixmaxSequenceSync` with fresh stats, recipient count, `lastSyncedAt`, `syncStatus = "synced"`
8. On failure: set `syncStatus = "error"`, preserve last good data

### Rate Limit Handling

Mixmax allows 120 requests per 60-second window per IP and user.

- **Max page size**: always use `limit=300` to minimize total requests
- **Read rate limit headers**: check `X-RateLimit-Remaining` after each response; if below 20, add 1-second delay between requests
- **Baseline courtesy delay**: for sequences with 1k+ recipients, add 200ms delay between pages
- **Abort on 429**: stop syncing, set `syncStatus = "rate_limited"`, store `Retry-After` value, show rep a message with retry timer
- **No parallel syncs**: if `syncStatus = "syncing"` for an activity, skip and show existing data with "Sync in progress..." indicator
- **Partial data discarded**: recipient snapshots are only committed after full sync completes

## UI: Campaign Stats Card

Displayed on activity detail view when a sequence is linked.

### Header row

- Sequence name (bold, plum)
- "Open in Mixmax" link (coral, external-link icon) - prominent, not buried
- Sync status: green dot + "Synced 15m ago" / spinner + "Syncing..." / orange dot + "Sync error"
- Refresh icon button (right-aligned)

### Stats grid (2 rows x 4 metrics)

Row 1: Sent | Delivered | Opened | Clicked
Row 2: Replied | Bounced | Meetings | Unsubscribed

Each metric shows raw count (large) + percentage of Sent (small, beneath).
Replied gets subtle green highlight. Bounced gets subtle red.

### Footer

"247 recipients - 3 matched to contacts" linking to the recipient detail view.

### Loading/error states

- Syncing: skeleton placeholders
- Error: last good data with yellow banner ("Couldn't refresh - showing data from 2h ago")

## UI: Recipient Detail Table

Expandable section below the stats card. Opened via "View Recipients" button or footer link.

### Columns

| Contact | District | Status | Opened | Clicked | Replied |
|---------|----------|--------|--------|---------|---------|
| Name, Title (matched) or raw email (unmatched) | District name (matched only) | Queued/Active/Paused/Exited | Check/dash | Check/dash | Check/dash |

### Matching

- Match is done purely by email: Mixmax recipient email matched against `contacts.email`
- If matched: display contact name, title, and district from the contacts table
- If unmatched: display raw email in gray italic, no district column

### Sorting and filtering

- Default sort: matched contacts first, then alphabetical by email
- Filter toggles: "Matched only", "Replied" (warm leads), "Bounced" (problem emails)
- Paginate at 50 rows with load-more for sequences over 500 recipients

### Warm leads workflow

Rep filters to "Replied" > sees which contacts at which districts responded > clicks district link > opens district panel on map > creates follow-up activity or task.

## Error Handling

### Token expires or gets revoked

- Any 401 from Mixmax sets `MixmaxConnection.status = "error"`
- Yellow banner on linked activities: "Your Mixmax connection needs to be reconnected" with link to Settings
- Stats card shows last good data with stale indicator

### Sequence deleted in Mixmax

- 404 on sync sets `syncStatus = "error"` with message
- Stats card shows: "This sequence was deleted or is no longer accessible in Mixmax" with Unlink action
- Last-synced data preserved for historical context

### No matched contacts

- Not an error - recipient table shows raw emails
- Footer reads "247 recipients - 0 matched to contacts"

### Rep links wrong sequence

- Unlink via overflow menu on stats card
- Deletes `MixmaxSequenceSync` and all `MixmaxRecipientSnapshot` rows
- Rep can link a different sequence

### Rate limit hit mid-sync

- Partial data discarded (no partial commits)
- `syncStatus = "rate_limited"`, show retry timer
- Last successful sync data remains visible

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/integrations/mixmax` | Check connection status |
| POST | `/api/integrations/mixmax` | Save token, verify, create connection |
| DELETE | `/api/integrations/mixmax` | Disconnect, delete token |
| GET | `/api/integrations/mixmax/sequences` | List rep's sequences (proxied from Mixmax) |
| POST | `/api/activities/[id]/mixmax` | Link sequence to activity, trigger first sync |
| DELETE | `/api/activities/[id]/mixmax` | Unlink sequence from activity |
| POST | `/api/activities/[id]/mixmax/sync` | Trigger manual or auto sync |
| GET | `/api/activities/[id]/mixmax` | Get cached stats + recipient data |

## Files to Create

- `prisma/migrations/xxx_add_mixmax_integration/migration.sql` - schema migration
- `src/lib/mixmax.ts` - Mixmax API client (auth, pagination, rate limit handling, delays)
- `src/app/api/integrations/mixmax/route.ts` - connection CRUD
- `src/app/api/integrations/mixmax/sequences/route.ts` - sequence list proxy
- `src/app/api/activities/[id]/mixmax/route.ts` - link/unlink/get cached data
- `src/app/api/activities/[id]/mixmax/sync/route.ts` - trigger sync
- `src/components/integrations/MixmaxConnectionCard.tsx` - settings UI
- `src/components/activities/SequencePickerModal.tsx` - sequence selection
- `src/components/activities/MixmaxStatsCard.tsx` - aggregate stats display
- `src/components/activities/MixmaxRecipientsTable.tsx` - per-recipient detail

## Files to Modify

- `prisma/schema.prisma` - add 3 new models + relations on UserProfile, Activity, Contact
- `src/components/activities/ActivityFormModal.tsx` - add Mixmax section for email_campaign type
- `src/components/views/ProfileView.tsx` - add Connected Accounts to settings modal
- `src/lib/api.ts` - add React Query hooks: useMixmaxStatus, useMixmaxSequences, useMixmaxStats, useMixmaxSync

## Out of Scope (YAGNI)

- No webhook receiver from Mixmax (pull-based only)
- No pushing recipients TO Mixmax from contacts (read-only integration)
- No background sync jobs (on-demand + staleness check is enough)
- No multi-sequence per activity (one sequence, one activity)
- No Mixmax OAuth flow (simple API token paste)

## Mixmax API Reference

- Base URL: `https://api.mixmax.com/v1`
- Auth: `X-API-Token` header
- Rate limit: 120 requests per 60-second window per IP and user
- Sequences: `GET /sequences`, `GET /sequences/:id?expand=stages`
- Recipients: `GET /sequences/:id/recipients?limit=300&offset=N` (flat array, max 10k)
- Search: `GET /sequences/search` (search recipients by email + sequenceId)
- Docs: https://developer.mixmax.com/reference/getting-started-with-the-api
