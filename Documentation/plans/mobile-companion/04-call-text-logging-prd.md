# Call & Text Logging

**Date:** 2026-02-26
**Status:** Concept
**Priority:** P1 — Core
**Parent:** [Mobile Companion Vision](./00-vision.md)

## Problem Statement

Reps make calls and send texts from their personal phones. Customers already have their personal numbers memorized — assigning new virtual numbers would mean lost connections, ignored calls from unknown numbers, and rep frustration.

But because these communications happen on personal devices, none of it gets logged to the CRM. Managers have zero visibility into call frequency, and reps lose track of when they last contacted an account.

The challenge: log business communications without accessing personal messages, requiring invasive device permissions, or making reps use a different phone number.

**Who benefits:** Reps (effortless logging, no data entry), managers (activity visibility without micromanaging), the org (accurate communication history).

## Proposed Solution

A privacy-first approach that gives reps control over what gets logged. Three complementary methods, from lowest to highest friction:

### Method 1: Click-to-Call with Return Prompt (Primary)

Rep initiates calls from within the app. The app opens the native dialer via a `tel:` link, then prompts for logging when the rep returns.

```
1. Rep opens a contact in the app
2. Taps the phone number → native dialer opens
3. Rep makes the call using their personal number (customer sees their normal number)
4. When rep returns to the app, a modal is waiting:
   ┌─────────────────────────────────────┐
   │ How'd it go with John Martinez?     │
   │                                     │
   │ Duration: ~8 min (estimated)        │
   │                                     │
   │ [Connected]  [Voicemail]  [No Ans]  │
   │                                     │
   │ Quick note: [________________]      │
   │                                     │
   │ [Save]                  [Skip]      │
   └─────────────────────────────────────┘
5. Rep taps disposition + optional note → call is logged
```

**Duration estimation:** The app timestamps when the user leaves (tel: link tapped) and when they return. Subtract ~10 seconds for dialing. Not exact, but good enough for activity tracking.

### Method 2: Smart Call Log Matching (Android Only)

On Android, with the rep's explicit permission, the app can read the device call log. But instead of reading everything, it only matches against phone numbers already in the CRM.

```
1. App periodically checks the Android call log (e.g., every 15 minutes)
2. Filters entries to only numbers matching CRM contacts
3. For each match, creates a pending activity:
   ┌─────────────────────────────────────┐
   │ Unlogged Calls                      │
   │                                     │
   │ 📞 John Martinez — 3:42 PM (8 min) │
   │    [Log It]  [Dismiss]              │
   │                                     │
   │ 📞 Sarah Chen — 1:15 PM (2 min)    │
   │    [Log It]  [Dismiss]              │
   └─────────────────────────────────────┘
4. Rep taps "Log It" → adds disposition and optional note
5. Dismissed calls are marked as seen and won't reappear
```

**Privacy model:** The app reads call log entries but only surfaces calls to/from numbers that are already in the CRM. Personal calls are never displayed, stored, or transmitted. This filtering happens entirely on-device.

### Method 3: Quick Manual Log (Fallback)

For iOS users who don't initiate calls from the app, or for texts:

```
1. Rep taps "Log Activity" on a contact
2. Selects type: Call / Text / Email
3. Adds disposition and note
4. Timestamp defaults to now (editable)
5. Save
```

This is the current-state CRM experience, but mobile-optimized and fast (target: < 15 seconds).

### Text Message Logging

Text messages are harder than calls — there's no equivalent of `tel:` links that return the user to the app, and SMS reading permissions are highly restricted on both platforms.

**Approach:** Manual logging only, but make it effortless:
- Rep taps a contact → "Log Text" → types a 1-line summary → Save
- Or uses voice-to-CRM: "Texted John Martinez about the proposal, he said he'll review it this week"

Do NOT attempt to read SMS content from the device. This is a privacy line we don't cross.

## Technical Design

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mobile/activities` | Creates a single activity (call, text, etc.) |
| `POST` | `/api/mobile/activities/bulk` | Batch-creates activities from the call log matching queue |
| `GET` | `/api/mobile/contacts/:id/phone-numbers` | Returns CRM phone numbers for call log matching |
| `GET` | `/api/mobile/contacts/phone-index` | Returns a phone→contactId lookup map for local matching |

### Data Model

Uses the shared `Activity` model from the vision doc:

```prisma
// Additional fields for call/text activities
model ActivityCallDetail {
  id           String   @id @default(cuid())
  activityId   String   @unique
  direction    CallDirection
  disposition  CallDisposition
  duration     Int?     // seconds
  phoneNumber  String?  // the number called/texted (for matching)

  activity     Activity @relation(fields: [activityId], references: [id])
}

enum CallDirection {
  OUTBOUND
  INBOUND
}

enum CallDisposition {
  CONNECTED
  VOICEMAIL
  NO_ANSWER
  BUSY
  TEXT_SENT
  TEXT_RECEIVED
}
```

### Mobile Implementation

**Click-to-Call:**
- Use `Linking.openURL('tel:+1234567890')` to open native dialer
- Track `AppState` changes: when app goes to background (call started) and returns to foreground (call ended), calculate duration
- Show logging prompt on return, with a 5-second delay to let the rep orient

**Call Log Matching (Android):**
- Use `expo-contacts` or a custom native module to read call log
- Build a local phone number index from synced CRM contacts
- Match call log entries against the index on-device
- Surface matches as a notification badge: "3 unlogged calls"

**iOS Limitations:**
- iOS does not expose the call log to third-party apps
- CallKit provides limited metadata (call started/ended) but only for VoIP calls
- On iOS, click-to-call with return prompt is the primary method

### Phone Number Matching

Phone numbers are messy. The matching algorithm must handle:
- Country codes: +1, 1, or bare 10-digit numbers
- Formatting: (555) 123-4567 vs. 555-123-4567 vs. 5551234567
- Extensions: strip extensions before matching

Normalize all numbers to E.164 format (`+15551234567`) for comparison. Use `libphonenumber` (Google's phone number library, available for JS/React Native).

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **Rep calls a number not in CRM** | Click-to-call: no logging prompt appears (only prompt for known contacts). Call log matching: entry is ignored. |
| **Same phone number on multiple contacts** | Show disambiguation: "Who did you call? [John Martinez] [Sarah Chen]" |
| **Rep declines call log permission (Android)** | Fall back to click-to-call and manual logging. Show a one-time explanation of the privacy model. |
| **Rep on iOS** | Call log matching is not available. Click-to-call with return prompt is the primary method. Manual logging as fallback. |
| **App was force-closed during a call** | On next app open, check if there's a pending click-to-call that was never logged. Show: "Did you complete your call with John Martinez earlier?" |
| **Very short call (< 10 seconds)** | Still prompt for logging — could be a quick voicemail or wrong number. Rep can dismiss. |
| **Call log has entries from days ago** | Only surface call log matches from the last 24 hours. Older entries are stale and not worth prompting. |
| **No internet** | All logging is local-first. Activities queue and sync when connectivity returns. |

## Testing Strategy

### Unit Tests
- Phone number normalization and E.164 conversion
- Call log matching against contact phone index
- Duration estimation from AppState timestamps
- Disposition mapping

### Integration Tests
- Click-to-call → return → logging prompt → activity creation
- Call log scan → match → bulk activity creation
- Phone index sync and refresh

### Manual / QA Tests
- Click-to-call flow on iOS and Android
- Call log matching accuracy with various phone number formats
- Duration estimation accuracy (compare against actual call logs)
- Privacy verification: confirm personal calls are never surfaced

**Approximate total: 12-15 automated tests + manual QA on both platforms**

## Open Questions

1. **Inbound calls** — Click-to-call only covers outbound. For inbound calls, the only option is call log matching (Android) or manual logging. Is inbound logging important enough to prioritize?
2. **Text message importance** — How much do reps text vs. call? If texting is heavy, we might want to explore a more automated solution (e.g., a share extension where reps can share a text conversation screenshot into the app).
3. **Call recording** — Some orgs want call recordings for coaching. This requires a fundamentally different approach (VoIP routing). Out of scope for v1, but worth noting as a future consideration.
4. **Compliance** — Are there any state-level regulations about call logging that we need to be aware of? (One-party vs. two-party consent states — though we're not recording calls, just logging that they happened.)
