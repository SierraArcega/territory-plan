# In-Territory Intelligence

**Date:** 2026-02-26
**Status:** Concept
**Priority:** P1 — Core
**Parent:** [Mobile Companion Vision](./00-vision.md)

## Problem Statement

Reps drive through their territory every day, passing accounts they haven't visited in months, missing opportunities to drop in, and lacking awareness of competitive activity on the ground. The territory planning web app shows them the big picture, but when they're physically in the field they have no real-time awareness of what's around them or what needs attention.

Competitors are winning deals by being present — showing up, noticing things, building relationships through proximity. Our reps have better data but no way to act on it in the moment.

**Who benefits:** Reps (more productive field time, better territory coverage), managers (improved visit frequency and competitive intelligence), marketing (ground-level competitive data).

## Proposed Solution

Three capabilities that make reps smarter while they're physically in territory:

1. **Geo-nudges** — Opt-in proximity alerts when a rep is near an account that needs attention
2. **Competitor intel capture** — Quick photo + note capture for competitive observations, tagged to location and account
3. **Territory map view** — Lightweight mobile map showing nearby accounts, color-coded by last activity recency

## Feature 1: Geo-Nudges

### How It Works

The app monitors the rep's location (with explicit opt-in permission) and compares it against their assigned accounts. When they're within a configurable radius of an account that meets certain criteria, a push notification fires.

### Trigger Criteria (configurable per rep)

| Trigger | Default | Example |
|---------|---------|---------|
| **Dormant account** | No activity in 60+ days | "You're near Lincoln Elementary — last visit was 73 days ago" |
| **Open opportunity** | Active deal in pipeline | "Acme Charter is 0.5 miles away — $35K proposal pending" |
| **Scheduled follow-up** | Task due this week | "Reminder: follow up with John at Oak Hill (due tomorrow)" |
| **New account in territory** | Recently assigned, never visited | "New account: Riverside Middle — no visits yet" |

### Notification Content

```
┌────────────────────────────────────┐
│ 📍 Nearby: Lincoln Elementary      │
│ 0.3 mi away · Last visit: 73 days │
│                                    │
│ [Brief Me]  [Check In]  [Dismiss] │
└────────────────────────────────────┘
```

Tapping "Brief Me" opens the Meeting Prep Briefing (PRD 02). Tapping "Check In" creates a check-in activity (PRD 06). Dismissing silences that account for 24 hours.

### Technical Implementation

- **Geofencing:** Expo Location with background geofence regions. Register up to 100 geofences (iOS limit) for the rep's highest-priority accounts. Rotate geofences based on rep's current region.
- **Priority scoring:** Accounts are scored by: `days_since_last_activity * 0.4 + has_open_deal * 0.3 + is_new_account * 0.2 + has_due_task * 0.1`. Top 100 scores get active geofences.
- **Battery impact:** Background location with geofencing is battery-efficient (iOS and Android handle it at the OS level). Continuous GPS tracking is NOT used.
- **Quiet hours:** No notifications before 8am or after 6pm (configurable).

## Feature 2: Competitor Intel Capture

### How It Works

Rep spots something competitive in the field — a competitor's product on display, a pricing flyer, a booth at a conference, a sign in a school window. They open the app, tap "Competitor Intel," snap a photo, add a quick note, and it's captured.

### User Flow

```
1. Rep taps "Capture" → selects "Competitor Intel"
2. Camera opens
3. Rep takes photo(s) (up to 5)
4. Quick form appears:
   ┌─────────────────────────────────────┐
   │ Competitor Intel                     │
   │                                     │
   │ 📸 [photo thumbnail] [+ more]       │
   │                                     │
   │ Competitor: [dropdown / type-ahead] │
   │ Account:    [auto-detected or pick] │
   │ Note:       [free text]             │
   │                                     │
   │ 📍 Lincoln Elementary (detected)    │
   │                                     │
   │ [Save]                              │
   └─────────────────────────────────────┘
5. Saved to local queue, synced to server
```

### Data Model

```prisma
model CompetitorIntel {
  id           String   @id @default(cuid())
  activityId   String   @unique
  competitor   String   // competitor name
  photos       String[] // S3 URLs
  notes        String?
  category     CompetitorIntelCategory?

  activity     Activity @relation(fields: [activityId], references: [id])
}

enum CompetitorIntelCategory {
  PRODUCT_DISPLAY
  PRICING
  MARKETING_MATERIAL
  EVENT_PRESENCE
  SIGNAGE
  OTHER
}
```

### AI Enhancement (Phase 2)

After sync, optionally run the photo through Claude Vision to auto-extract:
- Competitor name (from logos, branding)
- Product names
- Pricing information
- Any visible text

This creates structured intelligence from raw field photos without the rep having to type it.

## Feature 3: Territory Map View

### How It Works

A lightweight mobile map centered on the rep's current location, showing their assigned accounts as pins. Color-coded by recency of last activity so they can visually identify which accounts need attention.

### Pin Color Coding

| Color | Meaning |
|-------|---------|
| **Green** | Active — activity within 30 days |
| **Yellow** | Aging — 31-60 days since last activity |
| **Red** | Dormant — 60+ days since last activity |
| **Blue** | New — assigned but never visited |
| **Gray** | No open opportunity and recently visited (low priority) |

### Map Features

- **Current location** centered with a radius circle showing "within 5 miles"
- **Tap a pin** to see account name, last activity, open deal amount, and quick-action buttons (Brief Me, Check In, Call, Navigate)
- **"Navigate" button** opens Apple Maps / Google Maps with directions
- **Filter toggles:** Show/hide by pin color, by open deal, by account type
- **Offline tiles:** Cache map tiles for the rep's territory so the map works without connectivity (using Mapbox offline or similar)

### Technical Implementation

- **Map library:** `react-native-maps` (wraps Apple Maps on iOS, Google Maps on Android) or Mapbox GL for consistent cross-platform appearance and offline support
- **Account data:** Synced locally. Each account includes lat/lng (geocoded from address), last activity date, and open deal amount.
- **Performance:** Cluster pins when zoomed out (> 50 visible accounts). Show individual pins when zoomed in.
- **Sync:** Account locations and activity dates refresh on each sync cycle. Full account data is only fetched on-demand (tap to expand).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mobile/accounts/nearby?lat=&lng=&radius=` | Returns accounts within radius with activity metadata |
| `POST` | `/api/mobile/competitor-intel` | Creates a competitor intel record with photo URLs |
| `GET` | `/api/mobile/geofences` | Returns the rep's top 100 priority accounts with coordinates for geofence registration |
| `PUT` | `/api/mobile/geofences/:accountId/dismiss` | Silences a geo-nudge for 24 hours |

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **Rep denies location permission** | Geo-nudges and territory map are disabled. Show a settings prompt explaining the value. App still works for all other features. |
| **Rep in a territory with 500+ accounts** | Geofences limited to top 100 by priority score. Map clusters pins. Nearby endpoint paginates. |
| **Account has no geocoded coordinates** | Pin doesn't appear on map. Flag in the web app for data cleanup. |
| **Rep is outside their territory** | Map still works (shows all their accounts). Geo-nudges still fire if they happen to be near an assigned account. |
| **Offline** | Territory map uses cached tiles and locally synced account data. Competitor intel captures queue locally. Geo-nudges still fire (geofences are OS-level). |
| **Photo upload fails** | Photo is stored locally and retried on next sync. The activity record is created immediately with a "photos pending" flag. |
| **Too many notifications** | Rate-limit: max 5 geo-nudges per day. Rep can snooze all for the rest of the day. Configurable in settings. |
| **Battery drain concern** | Geofencing is battery-efficient by design (OS-level, not continuous GPS). Show battery impact stats in settings for transparency. |

## Testing Strategy

### Unit Tests
- Priority scoring algorithm for geofence selection
- Pin color-coding logic based on activity dates
- Nearby accounts filtering and sorting
- Notification rate-limiting logic
- Quiet hours enforcement

### Integration Tests
- Geofence registration and trigger flow (mocked location)
- Competitor intel capture → activity creation → photo upload
- Nearby accounts API with various radius and account densities
- Offline map rendering with cached data

### Manual / QA Tests
- Real-world driving test with geofences enabled
- Battery impact measurement over a full work day
- Map performance with 200+ account pins
- Photo capture quality in various lighting conditions

**Approximate total: 18-22 automated tests + field QA**

## Open Questions

1. **Geofence radius** — What's the right default? 0.5 miles (urban), 2 miles (suburban), 5 miles (rural)? Should it auto-adjust based on account density?
2. **Competitor taxonomy** — Should the competitor list be pre-defined by the org, or free-text? Pre-defined enables better analytics but adds admin overhead.
3. **Map provider** — Apple/Google Maps (free, familiar) vs. Mapbox (more customizable, offline tiles, costs money)?
4. **Privacy** — How transparent should we be about location tracking? Dashboard showing "your location is only used for [X], never shared with managers"?
5. **Visit verification** — Should check-ins require being within a certain radius of the account? Prevents gaming but adds friction.
