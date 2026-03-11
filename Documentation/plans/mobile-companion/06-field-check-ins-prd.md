# Field Check-ins

**Date:** 2026-02-26
**Status:** Concept
**Priority:** P2 — Enhance
**Parent:** [Mobile Companion Vision](./00-vision.md)

## Problem Statement

Managers have no visibility into whether reps are actually visiting accounts or just calling from their desk. Reps have no easy way to log that they were on-site, and the context of a visit (who they met, what they saw, what the next step is) is rarely captured.

Beyond individual visits, there's no aggregate view of territory coverage — which areas are getting regular attention, which are neglected, and how visit frequency correlates with pipeline health.

**Who benefits:** Reps (prove their field presence, capture visit context), managers (territory coverage visibility, coaching data), the org (visit frequency → conversion analytics).

## Proposed Solution

A one-tap check-in that captures the rep's presence at a location, with optional context: who they met, what happened, and what's next. Check-ins work at specific accounts, general locations (conferences, events), and ad-hoc stops.

## User Flow

### Account Check-in (Primary)

```
1. Rep arrives at an account
   Option A: Geo-nudge notification → tap "Check In"
   Option B: Open account in app → tap "Check In"
   Option C: From territory map → tap nearby pin → "Check In"

2. Check-in screen:
   ┌─────────────────────────────────────┐
   │ ✓ Check In — Acme Elementary        │
   │                                     │
   │ 📍 1234 Oak St, Austin TX           │
   │ 🕐 2:34 PM                          │
   │                                     │
   │ Who'd you meet?                     │
   │ [John Martinez ✓] [Sarah Chen]      │
   │ [+ Add someone]                     │
   │                                     │
   │ Quick note: (optional)              │
   │ [________________________________]  │
   │                                     │
   │ [Check In]                          │
   └─────────────────────────────────────┘

3. One tap on "Check In" creates the activity
4. Optional: add a voice note, photo, or more detailed notes later
```

### Event Check-in (Conference, Trade Show)

```
1. Rep taps "Check In" → selects "Event"
2. Types or selects event name: "TCEA Conference 2026"
3. Check-in is created with event metadata
4. Subsequent captures (business cards, photos, notes) during the event
   are auto-tagged with the event name
5. "Check Out" when leaving (optional) — captures total time at event
```

### Ad-Hoc Check-in

```
1. Rep taps "Check In" → selects "Other Location"
2. Current address is auto-detected via reverse geocoding
3. Rep adds a description: "Lunch with regional director"
4. Saved as an unlinked check-in activity
```

## Technical Design

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mobile/check-ins` | Creates a check-in activity |
| `PUT` | `/api/mobile/check-ins/:id/checkout` | Records check-out time |
| `GET` | `/api/mobile/check-ins/active` | Returns current active check-in (if any) |
| `GET` | `/api/mobile/events` | Returns list of known events for auto-complete |
| `GET` | `/api/mobile/accounts/nearest?lat=&lng=` | Returns nearest accounts for quick check-in |

### Data Model

```prisma
model CheckIn {
  id          String    @id @default(cuid())
  activityId  String    @unique
  checkInAt   DateTime
  checkOutAt  DateTime?
  locationType CheckInLocationType
  eventName   String?
  contactsMet String[]  // contact IDs
  verified    Boolean   @default(false) // within account radius

  activity    Activity  @relation(fields: [activityId], references: [id])
}

enum CheckInLocationType {
  ACCOUNT
  EVENT
  AD_HOC
}
```

### Location Verification

When checking in at an account, the app compares the rep's GPS coordinates against the account's geocoded address:
- **Within 0.25 miles:** Auto-verified (green checkmark). `verified: true`
- **0.25 - 1 mile:** Marked as "nearby" — still logged but not auto-verified
- **Beyond 1 mile:** Allowed but flagged as "remote check-in" (rep might be in the parking lot of a large campus, or checking in proactively while nearby)

This is informational, not punitive. The goal is data quality, not surveillance.

### Event Session Management

When a rep checks into an event:
1. An active event session is created locally
2. All subsequent activities (business cards, photos, notes) are auto-tagged with the event name
3. The session appears as a persistent banner at the top of the app: "📍 At: TCEA Conference (2h 15m)"
4. Tapping the banner offers: "Check Out" or "Still here"
5. If the app detects the rep has left the event area (> 1 mile from check-in point for > 30 minutes), auto-prompt: "Still at TCEA Conference?"

### Mobile Implementation

- **Location:** `expo-location` for current coordinates. Foreground only — no background tracking for check-ins.
- **Reverse geocoding:** Convert coordinates to a readable address for ad-hoc check-ins.
- **Contact picker:** Show contacts associated with the account. Multi-select. Option to add a new contact inline.
- **Auto-suggest:** When the app is opened and the rep is near an account, show a subtle banner: "You're at Acme Elementary. [Check In]"

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **GPS is inaccurate (urban canyons, indoors)** | Accept the check-in regardless. Verification is informational, not blocking. Show accuracy estimate: "Location accurate to ~50m." |
| **Rep checks in but never checks out** | Auto-close check-ins after 4 hours. Or when a new check-in is created (implies they left). |
| **Multiple reps check in at the same account** | Normal behavior — show on the web app's account timeline. Useful for managers to see team coverage. |
| **Rep checks in at an account not assigned to them** | Allow it. The activity is logged under their ID. This happens legitimately (covering for a colleague, joint visit). |
| **No contacts listed for the account** | Show empty "Who'd you meet?" section with just the "+ Add someone" button. |
| **Event name doesn't exist** | Create it on the fly. Future reps checking into the same event name will see it in auto-complete. |
| **Offline check-in** | Works entirely offline using cached account data and locally stored coordinates. Syncs when online. |
| **Location permission denied** | Check-in still works but without GPS coordinates or verification. Rep manually selects the account from a search. |

## Testing Strategy

### Unit Tests
- Location verification radius calculation
- Check-out auto-close logic
- Event session management (start, tag, close)
- Nearest account matching from coordinates

### Integration Tests
- Full check-in flow: location → account match → contact selection → activity creation
- Event session: check-in → capture business card (auto-tagged) → check-out
- Offline check-in → sync
- Auto-suggest banner trigger logic

### Manual / QA Tests
- Check-in at 5 real locations with GPS accuracy verification
- Event simulation: check in, capture 3 cards, take a photo, check out
- Edge case: check in from parking lot (0.3 miles from front door)
- Multi-rep check-in at same location

**Approximate total: 12-15 automated tests + field QA**

## Open Questions

1. **Check-out importance** — Is duration-at-site valuable enough to make check-out a requirement? Or is the check-in timestamp alone sufficient?
2. **Manager dashboard** — What does the territory coverage view look like on the web app? Heat map of check-in density? Timeline per account?
3. **Gamification** — Should there be visit streaks, coverage scores, or "territories fully covered this month" badges? Could drive adoption but might feel patronizing.
4. **Visit requirements** — Do certain accounts or deal stages require a minimum visit frequency? Should the system flag accounts that are "due for a visit"?
