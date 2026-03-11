# Fullmind Field Companion — Product Vision

**Date:** 2026-02-26
**Status:** Concept

## Vision

A lightweight mobile app that turns every field interaction into structured CRM data — without reps filling out forms, compromising personal device security, or changing the phone number their customers already know.

The territory planning web app is where reps plan and analyze. The Field Companion is where they capture. Together they close the loop between strategy and execution.

## The Problem

Field sales reps at Fullmind spend significant time away from their desks — driving between accounts, attending conferences, visiting schools in territory, and meeting contacts over lunch. During these interactions they generate valuable intelligence: call outcomes, meeting context, competitive observations, new contacts, and relationship signals.

Today, most of this data is lost. Reps either forget to log it, or the friction of opening a CRM and filling out forms means they capture a fraction of what actually happened. The reps who do log consistently spend 30-60 minutes per day on manual data entry.

Meanwhile, managers lack visibility into field activity. They can see pipeline numbers but not the ground-level context that explains why deals are moving (or stalling).

## Core Principle: Activity Capture, Not a Second CRM

The app does one thing well: capture field activity with minimal friction. Every feature is a variation of the same pattern:

```
Activity {
  type: call | note | check_in | photo | business_card | voice_memo | social_capture
  rep_id: string
  account_id?: string
  contact_id?: string
  location?: { lat: number, lng: number }
  content: text | audio_url | image_url
  metadata: Record<string, unknown>
  captured_at: timestamp
  synced_at?: timestamp
}
```

One unified model. One sync queue. Different UI surfaces for different capture moments. This keeps the app lightweight and prevents it from becoming a bloated mobile CRM that reps resent.

## Key Constraints

1. **Personal device, personal number** — Reps use their own phones and their customers have their numbers memorized. The app must never require access to personal messages, contacts, or call history beyond what the rep explicitly chooses to share. No MDM. No invasive permissions.

2. **Offline-first** — Conferences have bad wifi. Rural territories have dead zones. The app must queue activities locally and sync when connectivity returns. A rep should never lose a capture because they were in a basement exhibit hall.

3. **15-second rule** — If any capture flow takes longer than 15 seconds, reps won't use it. Every interaction should be optimizable to 2-3 taps or a short voice command.

4. **The web app is home base** — The mobile app captures data. The web app is where reps plan territories, analyze performance, and managers review activity. Don't duplicate web app features on mobile.

## Feature Set

### Priority 1 — Core (v1 Launch)

| # | Feature | Description | PRD |
|---|---------|-------------|-----|
| 1 | [Voice-to-CRM](./01-voice-to-crm-prd.md) | Hands-free voice logging while driving. Rep speaks, AI extracts structured CRM data. | `01` |
| 2 | [Meeting Prep Briefings](./02-meeting-prep-briefings-prd.md) | AI-powered 30-second account summary before walking into a meeting. | `02` |
| 3 | [In-Territory Intelligence](./03-in-territory-intelligence-prd.md) | Geo-nudges near accounts, competitor intel capture, lightweight territory map. | `03` |
| 4 | [Call & Text Logging](./04-call-text-logging-prd.md) | Log calls/texts to CRM contacts from personal devices without invasive permissions. | `04` |

### Priority 2 — Enhance (v1.1)

| # | Feature | Description | PRD |
|---|---------|-------------|-----|
| 5 | [Business Card Capture](./05-business-card-capture-prd.md) | Snap a photo of a business card, AI extracts contact fields, auto-links to account. | `05` |
| 6 | [Field Check-ins](./06-field-check-ins-prd.md) | GPS-stamped check-ins at accounts, conferences, and events. | `06` |
| 7 | [Photo & Media Capture](./07-photo-media-capture-prd.md) | Territory photos and social media content tagged to accounts. | `07` |

## Tech Stack (Recommended)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Expo (React Native) | Shares React knowledge with web app. Single codebase for iOS + Android. Native access to camera, GPS, microphone, call log (Android). |
| **Language** | TypeScript | Same as web app. Share types and business logic. |
| **State / Sync** | WatermelonDB or custom SQLite queue | Offline-first local storage with background sync to the API. |
| **Backend API** | Existing Next.js API routes | Extend the current territory planning API with mobile-specific endpoints. Shared Prisma schema. |
| **Speech-to-Text** | Whisper API or Deepgram | For voice-to-CRM transcription. |
| **AI Parsing** | Claude API | Extract structured fields from voice transcriptions, business card text, and social content. |
| **Push Notifications** | Expo Notifications + FCM/APNs | Geo-fence triggers, sync confirmations, reminders. |
| **Image Storage** | S3 or Cloudflare R2 | Business card photos, territory photos, social screenshots. |

## Data Flow

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Field Companion │────▶│  Sync Queue  │────▶│  Territory API  │
│  (Expo app)      │     │  (local DB)  │     │  (Next.js)      │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                      │
                                              ┌───────┴───────┐
                                              │   PostgreSQL   │
                                              │   (shared DB)  │
                                              └───────────────┘
                                                      │
                                              ┌───────┴───────┐
                                              │  Territory Web │
                                              │  (dashboards,  │
                                              │   map views,   │
                                              │   analytics)   │
                                              └───────────────┘
```

## Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| **Daily active usage** | 80%+ of field reps use it on work days | Adoption is the whole game |
| **Activities logged per rep per day** | 5+ (up from ~1 via manual CRM entry) | More data captured = better visibility |
| **Time to capture** | < 15 seconds average per activity | Speed drives adoption |
| **Data quality** | 90%+ of voice-to-CRM extractions need no manual correction | AI accuracy must be high or reps lose trust |
| **Sync reliability** | 99.9% of offline captures eventually sync successfully | Zero data loss tolerance |

## What This Is Not

- **Not a mobile CRM** — No deal management, no pipeline views, no reporting on mobile. That's the web app's job.
- **Not a communication tool** — Reps keep using their phone's native dialer, iMessage, and email. The app logs activity, it doesn't replace communication channels.
- **Not an MDM solution** — Zero device management. The app asks for camera, location, and microphone permissions. That's it.
- **Not a replacement for the territory planning web app** — The mobile app feeds data into the system. The web app is where that data becomes actionable.

## Open Questions

1. **Monorepo or separate repo?** — The mobile app shares types and API logic with the web app. A monorepo (Turborepo) would simplify sharing. A separate repo keeps deployment pipelines clean.
2. **Authentication** — Should the mobile app use the same NextAuth session, or a separate token-based auth (JWT/refresh tokens) more suited to mobile?
3. **App Store vs. enterprise distribution?** — Public App Store listing or TestFlight/enterprise distribution for internal teams?
4. **Incremental rollout** — Ship all P1 features at once, or ship voice-to-CRM alone first and add features weekly?
