# Photo & Media Capture

**Date:** 2026-02-26
**Status:** Concept
**Priority:** P2 — Enhance
**Parent:** [Mobile Companion Vision](./00-vision.md)

## Problem Statement

Reps see valuable things in the field every day — product displays in a school hallway, a competitor's booth at a conference, a whiteboard from a planning meeting, a school marquee promoting a program. They sometimes snap photos on their personal phone, but these photos live in their camera roll, untagged, unshared, and quickly buried.

Meanwhile, reps encounter relevant social media content — a school posting about a new initiative, a competitor's LinkedIn announcement, a district's Twitter update — and have no way to capture it into the CRM. This ground-level intelligence is valuable for competitive strategy, marketing, and deal context, but it's systematically lost.

**Who benefits:** Reps (capture context without filing it later), marketing (competitive and market intelligence), managers (richer account context and territory visibility).

## Proposed Solution

Two capture modes built on the same activity model:

1. **Territory Photos** — Camera capture tagged to an account, location, and category
2. **Social Media Capture** — Screenshot or link capture of social content tagged to an account

Both are fast (< 15 seconds), tagged with rich metadata, and synced to the web app where they become part of the account's story.

## Feature 1: Territory Photos

### User Flow

```
1. Rep taps "Capture" → selects "Photo"
2. Camera opens
3. Rep takes photo (or selects from gallery)
4. Tagging screen:
   ┌─────────────────────────────────────┐
   │ 📸 Territory Photo                  │
   │                                     │
   │ [photo preview]                     │
   │                                     │
   │ Account: [Acme Elementary ▾]        │
   │ (auto-suggested if checked in       │
   │  or near an account)                │
   │                                     │
   │ Category:                           │
   │ [Product Display] [Signage]         │
   │ [Meeting Notes] [Facility]          │
   │ [Event] [Other]                     │
   │                                     │
   │ Caption: [optional text]            │
   │                                     │
   │ 📍 1234 Oak St, Austin TX           │
   │                                     │
   │ [Save]                              │
   └─────────────────────────────────────┘
5. Saved and queued for sync
```

### Photo Categories

| Category | Use Case |
|----------|----------|
| **Product Display** | Our products or competitor products visible in a school |
| **Signage** | School signs, banners, marquees mentioning programs |
| **Meeting Notes** | Whiteboard photos, handwritten notes from a meeting |
| **Facility** | School building, classroom, library — useful for proposals |
| **Event** | Conference booths, presentations, networking events |
| **Other** | Anything else worth capturing |

### Smart Features

- **Auto-tag account:** If the rep is checked in at an account or within 0.25 miles of one, auto-suggest it
- **Auto-tag event:** If an event session is active (from check-in), auto-tag the event
- **Batch capture:** "Take Another" button loops back to camera immediately, same tags applied
- **AI captioning (Phase 2):** Run photos through Claude Vision to auto-generate captions and extract text from whiteboard photos

## Feature 2: Social Media Capture

### User Flow

```
Option A: Share Extension
1. Rep is browsing LinkedIn/Twitter/Facebook
2. Sees a relevant post (school announcing new program, competitor news)
3. Taps "Share" → selects "Fullmind Companion"
4. Share extension opens a compact tagging form:
   ┌─────────────────────────────────────┐
   │ 📱 Social Capture                   │
   │                                     │
   │ From: linkedin.com                  │
   │ [link preview or screenshot]        │
   │                                     │
   │ Account: [search or auto-detect]    │
   │ Type: [Customer News] [Competitor]  │
   │       [Industry] [Other]            │
   │ Note: [optional]                    │
   │                                     │
   │ [Save]                              │
   └─────────────────────────────────────┘
5. Saved to activity feed

Option B: Screenshot + In-App Tagging
1. Rep screenshots a social media post
2. Opens the app → "Capture" → "Social / Screenshot"
3. Picks the screenshot from gallery
4. Tags with account and category
5. Saved
```

### Social Capture Types

| Type | Use Case |
|------|----------|
| **Customer News** | School/district announcements, program launches, leadership changes |
| **Competitor Activity** | Competitor posts about wins, product launches, events |
| **Industry News** | Policy changes, funding announcements, market trends |
| **Other** | Anything else worth flagging |

### AI Enhancement (Phase 2)

After sync, run the screenshot or linked content through Claude to extract:
- Who posted it (person/org)
- Key entities mentioned (schools, districts, companies)
- Summary of the content
- Suggested account links based on entities mentioned

## Technical Design

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mobile/photos` | Creates a photo activity with image upload |
| `POST` | `/api/mobile/social-captures` | Creates a social capture activity |
| `GET` | `/api/mobile/photos?accountId=` | Returns photos for an account (for web app gallery) |
| `POST` | `/api/mobile/photos/upload` | Pre-signed S3 URL for direct image upload |

### Data Model

```prisma
model PhotoCapture {
  id          String   @id @default(cuid())
  activityId  String   @unique
  imageUrls   String[] // S3 URLs (multiple photos per capture)
  category    PhotoCategory
  caption     String?
  aiCaption   String?  // auto-generated caption (Phase 2)

  activity    Activity @relation(fields: [activityId], references: [id])
}

enum PhotoCategory {
  PRODUCT_DISPLAY
  SIGNAGE
  MEETING_NOTES
  FACILITY
  EVENT
  OTHER
}

model SocialCapture {
  id          String   @id @default(cuid())
  activityId  String   @unique
  sourceUrl   String?  // original URL if shared via share extension
  screenshotUrl String? // S3 URL of screenshot
  platform    String?  // linkedin, twitter, facebook, etc.
  captureType SocialCaptureType
  aiSummary   String?  // auto-generated summary (Phase 2)

  activity    Activity @relation(fields: [activityId], references: [id])
}

enum SocialCaptureType {
  CUSTOMER_NEWS
  COMPETITOR_ACTIVITY
  INDUSTRY_NEWS
  OTHER
}
```

### Image Handling

- **Capture:** `expo-camera` for photos, `expo-image-picker` for gallery selection
- **Compression:** Resize to max 2048px on longest side, JPEG quality 80%. Keeps file sizes under 1MB for fast upload.
- **Upload:** Pre-signed S3 URLs for direct upload from the device. The activity record references the S3 key.
- **Offline:** Photos stored locally in app cache. Queued for upload on connectivity. Activity record created immediately (local) with "image pending" status.
- **Thumbnail generation:** S3 trigger (Lambda) creates thumbnails at 200px and 600px for the web app gallery view.

### Share Extension (iOS/Android)

- **iOS:** Share Extension using React Native's share extension capability (or a thin Swift extension that communicates with the main app)
- **Android:** Intent filter for `ACTION_SEND` with URL or image MIME types
- **Limitation:** Share extensions have limited memory and runtime. Keep the UI minimal — just the tagging form and save button. Full processing happens in the main app.

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **Large photo (> 5MB)** | Compress aggressively before upload. If still large, warn and proceed. |
| **Photo upload fails** | Retry 3 times with exponential backoff. Keep local copy. Show "upload pending" badge. |
| **Share extension can't reach the app** | Save the URL/image to a shared container. Process when the main app next opens. |
| **Social link is behind a login wall** | Store the URL and screenshot if available. Don't attempt to scrape the content. |
| **Rep takes 50 photos at a conference** | Batch upload in background. Show progress: "Uploading 23 of 50 photos." |
| **No account to tag** | Allow untagged captures. They appear in an "Untagged" section for later organization. |
| **Duplicate screenshot** | Basic dedup: if the same image file (by hash) was already captured, warn: "This looks like a duplicate." |
| **Storage costs at scale** | At ~1MB per photo, 10 reps x 5 photos/day = ~50MB/day = ~1.5GB/month. Minimal cost on S3. Consider lifecycle policies for old photos. |

## Testing Strategy

### Unit Tests
- Image compression and resize logic
- Photo category and social capture type mapping
- Pre-signed URL generation
- Offline queue management for images
- Duplicate detection by image hash

### Integration Tests
- Full photo capture flow: camera → compress → upload → activity creation
- Social share extension: URL share → tagging → activity creation
- Batch upload: 10 photos queued → sequential upload → all confirmed
- Offline photo capture → connectivity → upload → sync

### Manual / QA Tests
- Photo quality after compression (various lighting conditions)
- Share extension from LinkedIn, Twitter, Facebook, Instagram
- Batch capture of 20+ photos at an event
- Gallery browsing on the web app after mobile captures sync

**Approximate total: 12-15 automated tests + manual QA**

## Open Questions

1. **Photo retention policy** — Keep all photos forever, or auto-archive/delete after a period? Storage is cheap but photo libraries can become unwieldy.
2. **Share extension priority** — How important is the share extension for v1 vs. the simpler "screenshot and tag" approach? Share extensions add complexity (separate build target, platform-specific code).
3. **Web app gallery** — What should the photo/social gallery look like on the territory planning web app? Grid view on the account page? A separate "Field Intel" section?
4. **Permissions and visibility** — Can all reps see all photos, or only their own? Should there be a "team feed" of recent field captures?
5. **Meeting notes OCR** — Whiteboard photos are common. Should we auto-extract text from meeting notes photos and make them searchable? High value but adds processing cost.
