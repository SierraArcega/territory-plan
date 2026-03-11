# Voice-to-CRM

**Date:** 2026-02-26
**Status:** Concept
**Priority:** P1 — Core
**Parent:** [Mobile Companion Vision](./00-vision.md)

## Problem Statement

Sales reps spend hours per week driving between accounts. This is when call context is freshest — they just hung up, they know exactly what was discussed, what the next step is, and how the deal is tracking. But by the time they sit down at a computer, the details have faded and the motivation to log has evaporated.

The result: CRM data is sparse, stale, and unreliable. Managers can't trust activity reports. Reps lose track of follow-ups. Institutional knowledge walks out the door when a rep leaves.

**Who benefits:** Reps (less manual data entry), managers (better activity visibility), the org (richer CRM data).

## Proposed Solution

A hands-free voice capture flow that lets reps dictate CRM updates while driving. The rep taps one button (or uses a voice trigger), speaks naturally for 10-30 seconds, and the system transcribes their speech, extracts structured data using an LLM, and creates the appropriate CRM records — call logs, notes, tasks, and deal updates.

The key insight is that reps already do this mentally. We're just capturing the internal monologue they have after every call and turning it into structured data.

## User Flow

```
1. Rep taps "Log" button (or triggers via CarPlay/Android Auto voice command)
2. App starts recording — large visual indicator shows it's listening
3. Rep speaks: "Just got off the phone with John Martinez at Acme Elementary.
   He's interested in the literacy program for Q3. Needs a proposal by Friday.
   Budget is around 50K. He's going to loop in their curriculum director,
   Sarah Chen. Good call, he's warm."
4. App shows a brief "Processing..." state
5. App displays extracted data for confirmation:
   ┌─────────────────────────────────────┐
   │ 📞 Call Log                         │
   │ Contact: John Martinez              │
   │ Account: Acme Elementary            │
   │ Duration: ~10 min (estimated)       │
   │ Disposition: Positive               │
   │                                     │
   │ 📝 Note                             │
   │ Interested in literacy program Q3.  │
   │ Budget ~$50K. Looping in curriculum │
   │ director Sarah Chen.                │
   │                                     │
   │ ✅ Task                              │
   │ Send proposal to John Martinez      │
   │ Due: Friday, Feb 28                 │
   │                                     │
   │ 👤 New Contact (suggested)          │
   │ Sarah Chen — Curriculum Director    │
   │ Acme Elementary                     │
   │                                     │
   │ [Edit]           [Confirm & Save]   │
   └─────────────────────────────────────┘
6. Rep taps "Confirm" (or it auto-confirms after 10 seconds if driving)
7. Activities are queued locally and synced when online
```

## Technical Design

### Speech-to-Text

| Option | Latency | Accuracy | Cost | Offline |
|--------|---------|----------|------|---------|
| **Whisper API (OpenAI)** | 2-5s for 30s audio | Excellent | ~$0.006/min | No |
| **Deepgram Nova-2** | 1-2s streaming | Excellent | ~$0.005/min | No |
| **On-device (Whisper.cpp)** | 5-10s for 30s audio | Good | Free | Yes |

**Recommendation:** Deepgram for real-time streaming when online (rep sees words appearing as they speak). Fall back to on-device Whisper.cpp when offline, with a re-transcription pass when connectivity returns.

### LLM Extraction

After transcription, send the text to the Claude API with a structured extraction prompt:

```
Input: raw transcription text + rep's account/contact list for fuzzy matching
Output: {
  call_log: { contact_id, account_id, disposition, duration_estimate },
  notes: [{ text, account_id, contact_id }],
  tasks: [{ description, due_date, contact_id }],
  new_contacts: [{ name, title, company }],
  deal_updates: [{ field, value }]
}
```

The extraction prompt includes the rep's account and contact list (cached locally) so the LLM can fuzzy-match names like "John at Acme" to the correct records.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mobile/voice-capture` | Receives audio blob or transcription, returns extracted structured data |
| `POST` | `/api/mobile/activities/bulk` | Batch-creates call log, notes, tasks, and contacts from confirmed extraction |
| `GET` | `/api/mobile/contacts/search?q=` | Lightweight contact/account search for fuzzy matching |

### Data Model Changes

New fields on existing models or new models:

```prisma
model Activity {
  id            String   @id @default(cuid())
  type          ActivityType
  repId         String
  accountId     String?
  contactId     String?
  content       String?  // note text, transcription, etc.
  audioUrl      String?  // S3 URL for the original recording
  location      Json?    // { lat, lng }
  metadata      Json?    // flexible per-type data
  capturedAt    DateTime
  syncedAt      DateTime?
  createdAt     DateTime @default(now())

  rep           User     @relation(fields: [repId], references: [id])
  account       Account? @relation(fields: [accountId], references: [id])
  contact       Contact? @relation(fields: [contactId], references: [id])
}

enum ActivityType {
  CALL
  NOTE
  CHECK_IN
  PHOTO
  BUSINESS_CARD
  VOICE_MEMO
  SOCIAL_CAPTURE
}
```

### Mobile Implementation

- **Recording:** Expo AV (`expo-av`) for audio capture. WAV format for quality, compressed to AAC before upload.
- **Streaming transcription:** WebSocket connection to Deepgram when online. Visual feedback as words appear.
- **Offline queue:** Activities stored in local SQLite (WatermelonDB). Background sync via Expo TaskManager when connectivity returns.
- **CarPlay / Android Auto:** Expo doesn't natively support these. Phase 2 consideration — could be a React Native module or a Siri Shortcut / Google Assistant integration.

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **No internet while recording** | Record locally, transcribe on-device with Whisper.cpp, queue for sync. Re-transcribe with Deepgram on reconnection for better accuracy. |
| **LLM can't match a contact name** | Show "Unknown Contact" with the raw name as a suggestion. Rep can tap to search and link manually, or create a new contact. |
| **Ambiguous account reference** | If "Acme" matches multiple accounts, show a disambiguation picker: "Did you mean Acme Elementary or Acme Charter?" |
| **Very short recording (< 3 seconds)** | Prompt: "That was pretty short — want to try again?" Don't process fragments. |
| **Very long recording (> 2 minutes)** | Process normally but warn: "Long recordings may take a moment to process." Consider chunking for streaming transcription. |
| **Background noise / poor audio** | Deepgram and Whisper handle moderate noise well. If transcription confidence is low, flag it: "I had trouble with some parts — please review." Show the raw transcription for manual correction. |
| **Rep mentions a contact not in the CRM** | Extract the name and suggest creating a new contact. Pre-fill any details mentioned (title, company). |
| **Multiple calls described in one recording** | LLM should detect this and create separate activity entries. "It sounds like you described 2 calls — here they are:" |
| **Auto-confirm timeout while driving** | If the rep doesn't interact within 10 seconds, auto-confirm the extraction. They can edit later from the activity feed. |

## Testing Strategy

### Unit Tests
- Transcription → structured extraction parsing (mock LLM responses, verify field mapping)
- Fuzzy name matching against contact list
- Offline queue enqueue/dequeue logic
- Audio recording state management

### Integration Tests
- Full flow: audio upload → transcription → extraction → activity creation
- Offline recording → sync on reconnection
- Bulk activity creation endpoint

### Manual / QA Tests
- Voice capture in a moving car (Bluetooth, road noise)
- Multiple accent types and speaking speeds
- Edge case recordings (whispers, background music, speakerphone echo)

**Approximate total: 15-20 automated tests + manual QA checklist**

## Open Questions

1. **Audio storage policy** — Keep original recordings permanently (useful for compliance/disputes), or delete after transcription is confirmed?
2. **Auto-confirm behavior** — Is 10-second auto-confirm the right UX for driving mode, or should it require an explicit tap?
3. **CarPlay / Android Auto** — How important is this for v1? It's a significant additional effort.
4. **Cost at scale** — At 10 reps x 5 recordings/day x 30 seconds avg, transcription costs are ~$1/day. At 100 reps it's ~$10/day. Acceptable?
