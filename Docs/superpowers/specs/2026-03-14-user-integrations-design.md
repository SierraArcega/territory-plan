# Feature Spec: User Integrations (Gmail, Calendar, Slack, Mixmax)

**Date:** 2026-03-14
**Slug:** user-integrations
**Status:** Draft

## Overview

Expand the user profile page with a "Connected Accounts" section enabling reps to connect Gmail, Google Calendar, Slack, and Mixmax. Synced data flows into the existing Activity model and surfaces as a unified chronological timeline on district detail views. Reps can also compose outreach (email, Slack messages, Mixmax campaigns) from contact cards.

## Requirements

### What problem does this solve?
Reps currently context-switch between Gmail, Slack, Google Calendar, Mixmax, and Fullmind. Activity with district contacts is scattered across tools with no unified view. This feature consolidates all communication activity into one timeline per district and enables outreach without leaving the app.

### Who uses it?
Sales reps (territory plan owners) who manage district relationships. Each rep connects their own accounts and sees their own + shared activity on districts.

### Success criteria
- Reps can connect/disconnect all 4 services from their profile page
- All synced activity appears in the district activity timeline alongside manually-logged activities
- Reps can compose emails, send Slack messages, and start/add-to Mixmax campaigns from contact cards
- Mixmax sequence data enriches Gmail-synced email activities
- Unlinked activities (no district match) surface via notification badge for manual triage

### Constraints
- Must use existing `Activity` model — no separate activity tables
- Tokens encrypted at rest (AES-256-GCM)
- Gmail initial sync: 90 days of history
- Migrate existing `CalendarConnection` into new `UserIntegration` model for consistency
- Activity is shared — all reps with a district in their plan see all activity for that district

## Architecture

### Approach: Direct OAuth + Per-Service Adapters
- Next.js API routes handle OAuth flows per service
- Tokens stored encrypted in `UserIntegration` Prisma model
- Each service gets an adapter module under `src/features/integrations/`
- Adapters normalize data into existing `Activity` model entries
- District correlation via `Contact.email` → `Contact.leaid` → District

## Data Model

### New Model: `UserIntegration`

Replaces `CalendarConnection` with a generalized per-service integration model.

```prisma
model UserIntegration {
  id                String    @id @default(uuid())
  userId            String    @map("user_id") @db.Uuid
  service           String    @db.VarChar(30)  // "gmail", "google_calendar", "slack", "mixmax"
  accountEmail      String?   @map("account_email") @db.VarChar(255)
  accountName       String?   @map("account_name") @db.VarChar(255)
  accessToken       String    @map("access_token")    // encrypted at rest
  refreshToken      String?   @map("refresh_token")   // encrypted at rest
  tokenExpiresAt    DateTime? @map("token_expires_at")
  scopes            String[]  @default([])
  metadata          Json?     // service-specific (Slack workspace ID, Calendar companyDomain, etc.)
  syncEnabled       Boolean   @default(true) @map("sync_enabled")
  status            String    @default("connected") @db.VarChar(20) // connected, expired, disconnected, error
  lastSyncAt        DateTime? @map("last_sync_at")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, service])
  @@map("user_integrations")
}
```

### Extend Existing `Activity` Model

New fields for Gmail dedup, Slack dedup, Mixmax enrichment, and service-specific metadata:

```prisma
// Gmail dedup (parallel to existing googleEventId for calendar)
gmailMessageId      String?  @unique @map("gmail_message_id")

// Slack dedup (channel + message timestamp is unique in Slack)
slackMessageTs      String?  @map("slack_message_ts")
slackChannelId      String?  @map("slack_channel_id") @db.VarChar(50)

// Service-specific metadata (e.g., Slack channelName/threadTs, Gmail labels)
integrationMeta     Json?    @map("integration_meta")

// Mixmax sequence enrichment
mixmaxSequenceName  String?  @map("mixmax_sequence_name") @db.VarChar(255)
mixmaxSequenceStep  Int?     @map("mixmax_sequence_step")
mixmaxSequenceTotal Int?     @map("mixmax_sequence_total")
mixmaxStatus        String?  @map("mixmax_status") @db.VarChar(30) // active, paused, completed, bounced, replied
mixmaxOpenCount     Int?     @map("mixmax_open_count")
mixmaxClickCount    Int?     @map("mixmax_click_count")

@@unique([slackChannelId, slackMessageTs]) // Slack dedup
```

### Extend `Activity.source` Values

Existing: `"manual"`, `"calendar_sync"`
New: `"gmail_sync"`, `"slack_sync"`

Mixmax does not create activities — it enriches Gmail-synced activities.

### Migration: `CalendarConnection` → `UserIntegration`

- Migrate existing `CalendarConnection` rows into `UserIntegration` with `service: "google_calendar"`
- Map `companyDomain` and calendar-specific fields into `metadata` JSON
- **Re-point `CalendarEvent.connectionId` FK:** `CalendarEvent` currently references `CalendarConnection.id` (not userId). The migration must either:
  - Rewrite `CalendarEvent.connectionId` to reference `UserIntegration.id` (preferred — keeps the FK pattern), or
  - Replace `connectionId` with a `userId` FK and update the `@@unique([connectionId, googleEventId])` constraint accordingly
- Update all calendar sync code that queries via `CalendarConnection` to use `UserIntegration` where `service = "google_calendar"`
- Drop `CalendarConnection` model after migration and FK rewrite

### V1 Constraint: Single Account per Service

The `@@unique([userId, service])` constraint limits each user to one connection per service. This is intentional for v1 — most reps use one Gmail, one Slack workspace, one Mixmax account. Multi-account support (e.g., personal + work Gmail, multiple Slack workspaces) is deferred to a future iteration if needed.

## OAuth Connection Flows

### Gmail
- Scopes: `gmail.readonly`, `gmail.send` (not `gmail.modify` — we only need read + send, keeping the consent screen minimal)
- Hybrid auth: if user's Supabase Google account matches desired Gmail account, request incremental consent for Gmail scopes. Otherwise, full OAuth flow for a different Google account.
- Callback: `POST /api/integrations/gmail/callback` → stores tokens in `UserIntegration`

### Google Calendar
- Already built — migrating from `CalendarConnection` to `UserIntegration`
- Existing OAuth flow and scopes preserved
- Profile page now surfaces connection status (previously only accessible from calendar feature)

### Slack
- Scopes: `channels:read`, `channels:history`, `chat:write`, `users:read`
- Standard Slack OAuth flow — user authorizes Fullmind Slack app
- Callback stores bot token + workspace metadata in `UserIntegration`
- `metadata` stores: `{ workspaceId, workspaceName, botUserId }`

### Mixmax
- API key-based (not OAuth)
- User pastes API key into a modal input field
- Validate key against Mixmax API (`GET /api/v1/users/me`) before storing
- Stored encrypted in `UserIntegration.accessToken`

## Sync Architecture

### Gmail Sync
- **Initial sync:** Last 90 days of sent/received email on connect
- **Incremental sync:** Gmail `history` API with stored `historyId`, polled every 5 minutes (cron) or on page load
- **Activity creation:** Each email → `Activity` with `source: "gmail_sync"`, `gmailMessageId` for dedup
- **District correlation:** Match sender/recipient email → `Contact.email` → `Contact.leaid` → insert `ActivityDistrict` and `ActivityContact` junction rows
- **Unlinked emails:** Activities with no Contact match get created without district links → surfaced in unlinked queue

### Mixmax Enrichment
- Runs as a post-processing step after each Gmail sync
- Query Mixmax API for sequence data on synced `gmailMessageId` values
- Annotate matching Activities with: sequence name, step number, total steps, status, open/click counts
- Not a separate sync — piggybacks on Gmail sync cycle

### Calendar Sync
- Already built — existing `CalendarEvent` staging + review-before-promote flow
- No changes to sync logic, only model migration

### Slack Sync
- Poll joined channels via `conversations.history` API (every 5 minutes or on page load)
- District correlation strategy:
  - Primary: Match channel name/topic against district names
  - Secondary: Match mentioned user emails → Contact → District
  - Fallback: Manual triage via unlinked queue
- Dedup via `@@unique([slackChannelId, slackMessageTs])` on Activity — Slack channel + timestamp is globally unique
- Store additional Slack context (channelName, threadTs, permalink) in `Activity.integrationMeta` JSON for linking back to Slack

## UI Design

### Profile Page: Connected Accounts (Inline)
- New "Connected Accounts" section below the existing profile card on `ProfileView.tsx`
- Each service shown as a row: service icon, name, connection status, action button (Connect / Disconnect / Manage)
- Connected services show account email and green status indicator
- Disconnected services show "Not connected" with a "Connect" button in Plum (#403770)
- Mixmax labeled as "Gmail enhancement" to clarify its role

### District Activity Feed: Unified Timeline
- Chronological feed on district detail view showing all activity sources
- Date group headers (Today, Yesterday, Mar 11, etc.)
- Service-colored icons on timeline nodes: Gmail (red), Calendar (blue), Slack (purple)
- Filter chips: All / Email / Calendar / Slack / Manual
- Mixmax sequence info shown as badge on email items: "Step 2/5 · Q3 Renewal Outreach"
- Mixmax tracking data (open/click counts) shown as metadata below email items
- Manual activities shown with a neutral icon, same timeline treatment

### Contact Card: Outreach Actions
- Action buttons on contact cards: Email, Slack, Add to Mixmax Campaign
- **Email:** Opens compose panel pre-filled with contact email. Sends via Gmail API using stored tokens. Creates Activity on send.
- **Slack:** Opens compose panel for sending a Slack message. User picks channel or DM. Sends via Slack API. Creates Activity on send.
- **Mixmax:** Opens a modal to start a new campaign or add contact to an existing Mixmax sequence. Calls Mixmax API.
- Actions disabled/hidden if the corresponding service isn't connected (with tooltip: "Connect Gmail in Profile to send emails")

### Unlinked Activity Badge
- Notification badge on activity/integrations section showing count of unlinked activities
- Tapping opens a triage view where reps can manually assign activities to districts
- Simple dropdown: pick a district → creates `ActivityDistrict` junction row

## States

### Loading
- Profile integrations section: skeleton cards while fetching connection status
- Activity feed: skeleton timeline items while fetching activities
- Sync in progress: subtle spinner on the integration row with "Syncing..." text

### Empty
- No integrations connected: section shows all 4 services as "Not connected" with connect buttons
- No activity on district: "No activity yet. Connect your accounts in Profile to start syncing, or log an activity manually."

### Error
- Token expired: Yellow warning badge on integration row, "Re-authenticate" button
- Sync failed: Red status on integration row with last error message, retry button
- API key invalid (Mixmax): Inline error on connect modal, don't store
- Service unavailable: Activity feed shows last successful sync time, graceful degradation

## Delivery Order

1. **OAuth infrastructure + profile connection UI** — `UserIntegration` model, encryption, OAuth flows for all 4 services, profile "Connected Accounts" section, `CalendarConnection` migration
2. **Activity feed + district timeline** — Unified timeline component on district detail, filter chips, date grouping, manual activity logging preserved
3. **Gmail integration** — Sync engine (initial 90-day + incremental), Activity creation, Contact email matching, district correlation
4. **Mixmax enrichment** — API key connection, post-Gmail-sync enrichment, sequence badges on timeline
5. **Google Calendar migration** — Migrate CalendarConnection to UserIntegration, surface on profile, preserve existing sync
6. **Slack integration** — OAuth, channel sync, district correlation, Slack message sending
7. **Outreach actions on contact cards** — Email compose, Slack compose, Mixmax campaign actions
8. **Unlinked activity triage** — Notification badge, triage view, manual district assignment

## Out of Scope

- **Dedicated integrations dashboard** — activity lives on district views, not a separate page (may come later)
- **Activity feed on a standalone page** — starts on district detail only, expandable later
- **Two-way Slack sync** — we read from and write to Slack, but don't sync edits/deletes back
- **Gmail draft management** — we send emails, but don't sync or manage drafts
- **Mixmax template editing** — we start/add-to campaigns but don't create or edit sequence templates
- **Webhook-based real-time sync** — polling-based for v1, webhooks can be added later for lower latency
- **Admin-level integration management** — each rep manages their own connections, no org-wide admin
