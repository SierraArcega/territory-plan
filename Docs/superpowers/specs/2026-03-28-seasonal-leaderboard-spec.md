# Seasonal Leaderboard — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Goal:** Gamified leaderboard to incentivize platform adoption by sales reps, with seasonal metric rotation and tiered rankings.

---

## Overview

A competitive leaderboard system that tracks rep engagement with the platform through seasonally-rotating metrics. Reps earn points for performing tracked actions, are ranked against each other, and progress through a tiered ranking system (Iron → Bronze → Silver → Gold). A combined view blends season points with actual sales performance (take) to ensure top sellers are recognized alongside highly-engaged reps.

The first season — **Season 0** — retroactively rewards early adopters by tracking **Plans Created**.

---

## Core Concepts

### Seasons

Seasons are arbitrary-length competitive periods defined by an admin via database seeding (no admin UI). Each season specifies:

- A name (e.g., "Season 0", "Season 1")
- A start and end date
- Which actions earn points and how many
- The blend weighting for the Combined score view
- The soft reset magnitude for tier demotion

Only one season is active at a time. The app queries `WHERE isActive = true`.

### Points

Reps earn points in real-time when they perform actions tracked by the active season's metrics. Points increment immediately — when a rep creates a plan and the active season tracks `plan_created`, their `SeasonScore.totalPoints` increases by that metric's `pointValue`.

### Tiers

4 tiers with 3 sub-ranks each (12 rungs total):

| Tier | Sub-ranks | Color | Description |
|------|-----------|-------|-------------|
| Iron | III, II, I | `#8A80A8` (plum-neutral) | Starting tier for all new reps |
| Bronze | III, II, I | Coral tones | Early engagement |
| Silver | III, II, I | Steel blue tones | Consistent engagement |
| Gold | III, II, I | Golden tones | Top performers |

Higher tiers (Platinum, Diamond, etc.) can be added later as user count scales.

**Tier assignment logic:**
- **Threshold** determines your tier — fixed point totals per season (e.g., 0-99 = Iron, 100-299 = Bronze, etc.)
- **Sub-rank within a tier** is percentile-based among everyone in the same tier (bottom third = III, middle = II, top third = I)
- Everyone starts at **Iron III**
- Exact point thresholds are defined per season in seed data, tunable as engagement patterns emerge

**Soft reset between seasons:**
- All reps drop by a configurable number of full tiers (default: 1)
- A Gold I player starts the next season at Silver I
- No one drops below Iron III
- Configured via `softResetTiers` on the Season model

---

## Data Model

### Season

| Field | Type | Description |
|-------|------|-------------|
| `id` | int (auto-increment) | Primary key |
| `name` | string | Display name, e.g., "Season 0" |
| `startDate` | datetime | Season start |
| `endDate` | datetime | Season end |
| `isActive` | boolean | Only one active at a time |
| `softResetTiers` | int (default 1) | Full tiers to drop on reset |
| `seasonWeight` | decimal (default 0.7) | Weight for season points in Combined view |
| `takeWeight` | decimal (default 0.3) | Weight for take in Combined view |
| `createdAt` | datetime | Auto-set |
| `updatedAt` | datetime | Auto-set |

### SeasonMetric

| Field | Type | Description |
|-------|------|-------------|
| `id` | int (auto-increment) | Primary key |
| `seasonId` | FK → Season | Which season this metric belongs to |
| `action` | string | Action identifier, e.g., `plan_created`, `activity_logged`, `task_completed` |
| `pointValue` | int | Points awarded per action |
| `label` | string | Display name, e.g., "Create a Plan" |

### SeasonScore

| Field | Type | Description |
|-------|------|-------------|
| `id` | int (auto-increment) | Primary key |
| `seasonId` | FK → Season | Which season |
| `userId` | FK → UserProfile | Which rep |
| `totalPoints` | int (default 0) | Accumulated points |
| `tier` | string | Current tier, e.g., "gold_1", "iron_3" |
| `rank` | int | Cached position in leaderboard |
| `updatedAt` | datetime | Last update |

**Unique constraint:** `(seasonId, userId)` — one score record per rep per season.

### SeasonTierThreshold

| Field | Type | Description |
|-------|------|-------------|
| `id` | int (auto-increment) | Primary key |
| `seasonId` | FK → Season | Which season |
| `tier` | string | Tier name, e.g., "iron", "bronze", "silver", "gold" |
| `minPoints` | int | Minimum points to enter this tier |

One row per tier per season. Sub-rank (III/II/I) is calculated at runtime via percentile within the tier.

---

## Scoring

### Point Increment Flow

1. Rep performs a tracked action (e.g., creates a plan)
2. The API route handling that action checks for an active season
3. If the action matches a `SeasonMetric` for the active season, the rep's `SeasonScore.totalPoints` increases by the metric's `pointValue`
4. Tier and rank are recalculated on read (no background job at this scale)

### Combined Score Normalization

Season points and take operate on completely different scales. The Combined view normalizes both to a 0-100 scale relative to the top performer in each dimension:

- Normalized season score = `(yourPoints / maxPoints) × 100`
- Normalized take score = `(yourTake / maxTake) × 100`
- Combined = `(normalizedSeason × seasonWeight) + (normalizedTake × takeWeight)`

The `seasonWeight` and `takeWeight` values are stored on the Season model (default 0.7 / 0.3 for Season 0), adjustable per season via seed data.

**Edge case:** If `maxPoints` or `maxTake` is 0 (e.g., season just started, no one has scored), the normalized value for that dimension is 0 for all reps. The combined score weights fully toward whichever dimension has data.

### Season 0

- **Name:** "Season 0"
- **Tracked metric:** Plans Created (`plan_created`, point value TBD)
- **Retroactive backfill:** A seed script counts each rep's existing plans and credits their `SeasonScore` with the appropriate points
- **Blend:** 70% season points / 30% take-normalized

---

## UI Components

### 1. Left Nav Widget (Global — Every Page)

**Position:** Bottom of the left navigation sidebar, directly above the Profile button.

**Expanded state (~60-70px tall):**
- Tier badge (shield icon in tier color) + tier label (e.g., "Silver II")
- Rank number (e.g., "#3")
- Auto-rotating ticker that cycles every 3-4 seconds between:
  - "#2 Sarah — +4 pts ahead"
  - "You: #3 — 127 pts"
  - "#4 Marcus — 6 pts behind"
- Click anywhere opens the full leaderboard modal

**Minimized state:**
- Tier badge icon + rank number only (single compact line)
- Still clickable to open modal

**Dismiss behavior:**
- Small X icon appears on hover to minimize
- Dismiss state stored in `sessionStorage` — resets on next browser session

**Animations:**
- **Hover:** Subtle glow `box-shadow` in the tier's accent color, `transition-all duration-100`
- **Periodic shimmer:** Every 5 minutes, a CSS `@keyframes` gradient sweep (semi-transparent, left-to-right). Triggered by `setInterval` toggling a class.
- **Ticker rotation:** Crossfade transition between lines every 3-4 seconds
- **Rank change:** Brief scale bump + glow pulse when rank moves on data refetch

### 2. Home Sidebar Widget (Home Page Only)

**Position:** Above the profile avatar in the home sidebar panel.

**Layout:** Larger, richer version of the nav widget — same information but with more room for the tier badge, rank, and ticker. Takes advantage of the wider sidebar panel space.

**Behavior:** Same as nav widget (click opens modal) but NOT dismissable — it's part of the home page layout.

**Animations:** Same as nav widget (hover glow, shimmer, ticker, rank change pulse).

### 3. Leaderboard Modal

**Trigger:** Click either widget (nav or home sidebar).

**Header:**
- "Season 0 Leaderboard" — bold, prominent
- Season date range in subtle text below

**View toggle (three pill buttons below header):**
- **Combined** (default) — blended score per season weights
- **Season Points** — pure action-based ranking
- **Take** — pure revenue ranking

Each toggle re-sorts the table. Active view is highlighted.

**Your rank card (pinned at top, always visible):**
- Tier badge (shield icon in tier color) + tier label
- Rank position + total reps (e.g., "#3 of 18")
- Point breakdown (e.g., "4 plans x 10pts = 40pts")
- Take amount shown in Combined and Take views
- Combined score shown in Combined view

**Rankings table:**
- Columns: Rank / Rep (avatar + name) / Tier badge / Score (contextual to active toggle)
- Your row highlighted with plum-tinted background
- Tier boundary dividers — subtle visual separator between Gold/Silver/Bronze/Iron sections
- All reps visible, full transparency

**Modal transitions:**
- Opens with scale-up + fade-in (`duration-200`)
- Backdrop overlay with semi-transparent plum tint
- Closes on backdrop click, X button, or Escape key

---

## Data Dependencies

### Take Data

Take/revenue data flows from an external OpenSearch cluster via the Python scheduler sync pipeline:

**LMS/CRM → OpenSearch → Scheduler sync → PostgreSQL `opportunities` table → `district_opportunity_actuals` materialized view**

The existing `getRepLeaderboardRank()` function in `src/lib/opportunity-actuals.ts` already queries this view. The Combined and Take views in the leaderboard depend on this data being synced.

**Graceful degradation:** If take data is not available for a rep (no synced opportunities), the Take and Combined views show their season points only. The Take column displays "$0" and the combined score weights fully toward season points for that rep.

---

## Season Transition Workflow

Starting a new season is a database operation (no code changes):

1. Insert a new `Season` row with `isActive = true`
2. Set the previous season's `isActive = false`
3. Seed `SeasonMetric` rows for the new season (can reuse actions with different point weights, or entirely different actions)
4. Apply soft reset: query `SeasonScore` rows from the previous season, calculate demoted tiers, insert new `SeasonScore` rows for the new season with reset tier and `totalPoints = 0`

No code changes needed unless a brand new action type is introduced that doesn't exist in the system yet.

---

## File Placement

| What | Where |
|------|-------|
| Prisma models | `prisma/schema.prisma` (Season, SeasonMetric, SeasonScore) |
| Seed script | `prisma/seed/` or `scripts/` — Season 0 setup + retroactive backfill |
| API routes | `src/app/api/leaderboard/` — season data, rankings, score increment |
| Feature code | `src/features/leaderboard/` with `components/`, `lib/` |
| Nav widget | `src/features/leaderboard/components/LeaderboardNavWidget.tsx` |
| Home widget | `src/features/leaderboard/components/LeaderboardHomeWidget.tsx` |
| Modal | `src/features/leaderboard/components/LeaderboardModal.tsx` |
| Queries/hooks | `src/features/leaderboard/lib/queries.ts` |
| Scoring logic | `src/features/leaderboard/lib/scoring.ts` |
| Tier thresholds | Stored in `SeasonTierThreshold` table, seeded per season |

---

## Out of Scope (v1)

- Season selector / history view in the modal
- Admin UI for creating/managing seasons
- Achievements / badges system
- Per-category breakdowns (Outreach, Pipeline, Planning)
- Expandable rows showing other reps' point breakdowns
- Notifications for rank changes
