# Business Card Capture

**Date:** 2026-02-26
**Status:** Concept
**Priority:** P2 — Enhance
**Parent:** [Mobile Companion Vision](./00-vision.md)

## Problem Statement

Reps meet new contacts at conferences, school visits, and industry events. They collect business cards, stuff them in a pocket, and most never make it into the CRM. The ones that do get entered days later with minimal context — just a name and email, no notes about the conversation or where they met.

This is a missed opportunity. The moment a rep meets someone is when the context is richest: they know what they talked about, what the person's role is, and what the potential next step might be.

**Who benefits:** Reps (contacts entered instantly with context), the org (more complete contact database), marketing (conference ROI data — how many new contacts per event).

## Proposed Solution

Snap a photo of a business card, let AI extract the contact fields, review and confirm, and the contact is in the system — linked to the right account, tagged with where they met, and optionally enriched with a voice note about the conversation.

## User Flow

```
1. Rep taps "Capture" → selects "Business Card"
2. Camera opens with a card-shaped frame guide
3. Rep snaps the photo (or picks from gallery)
4. 2-3 second processing state: "Reading card..."
5. Extracted fields displayed for review:

   ┌─────────────────────────────────────┐
   │ 📇 New Contact                      │
   │                                     │
   │ [card photo thumbnail]              │
   │                                     │
   │ Name:    John Martinez              │
   │ Title:   Principal                  │
   │ Company: Acme Elementary School     │
   │ Email:   jmartinez@acme.edu         │
   │ Phone:   (512) 555-0142             │
   │ Address: 1234 Oak St, Austin TX     │
   │                                     │
   │ Account: [Acme Elementary ✓ match]  │
   │                                     │
   │ Met at:  [TCEA Conference 2026]     │
   │ Note:    [Add voice/text note...]   │
   │                                     │
   │ [Edit Fields]       [Save Contact]  │
   └─────────────────────────────────────┘

6. Rep confirms (or edits any misread fields)
7. Contact is created and linked to the matched account
8. If the rep is checked in at an event, "Met at" auto-fills
```

## Technical Design

### Card Processing Pipeline

```
Photo → Claude Vision API → Structured Fields → Account Matching → Contact Creation
```

**Step 1: Image → Structured Data**

Send the card photo directly to the Claude Vision API with a structured extraction prompt:

```
Prompt: "Extract all contact information from this business card image.
Return a JSON object with: name, title, company, email, phone, address,
website, and any other visible information. If a field is not visible,
omit it. Handle multiple phone numbers or emails as arrays."
```

Claude Vision handles:
- Standard horizontal cards
- Vertical/non-standard layouts
- Cards with logos obscuring text
- Multilingual cards (Spanish, etc.)
- Poor lighting or slight blur

**Step 2: Account Matching**

After extraction, fuzzy-match the `company` field against existing accounts:
- Exact match on company name
- Fuzzy match (Levenshtein distance < 3) for typos and abbreviations
- Domain match: extract domain from email (e.g., `acme.edu`) and match against account website/email domains

If match confidence > 80%, auto-link. If 50-80%, suggest with a "Did you mean?" prompt. Below 50%, let the rep search or create a new account.

**Step 3: Duplicate Detection**

Before creating the contact, check for duplicates:
- Exact match on email address
- Exact match on phone number (normalized)
- Fuzzy match on name + company combination

If a duplicate is found: "This person may already be in your CRM. [View existing] [Create anyway] [Merge]"

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mobile/business-card/extract` | Accepts image, returns extracted fields via Claude Vision |
| `POST` | `/api/mobile/contacts` | Creates a new contact with account linking |
| `GET` | `/api/mobile/accounts/match?company=&domain=` | Returns potential account matches for linking |
| `GET` | `/api/mobile/contacts/duplicates?email=&phone=&name=` | Returns potential duplicate contacts |

### Data Model

Uses existing Contact model plus:

```prisma
model ContactSource {
  id          String   @id @default(cuid())
  contactId   String
  source      ContactSourceType
  imageUrl    String?  // S3 URL of the business card photo
  eventName   String?  // "TCEA Conference 2026"
  capturedAt  DateTime
  location    Json?    // { lat, lng } where the card was captured

  contact     Contact  @relation(fields: [contactId], references: [id])
}

enum ContactSourceType {
  BUSINESS_CARD
  QR_SCAN
  MANUAL_ENTRY
  IMPORT
}
```

### Mobile Implementation

- **Camera:** `expo-camera` with a custom overlay showing a card-shaped frame guide
- **Image processing:** Capture at high resolution, auto-crop to card bounds if possible (edge detection), compress to JPEG before upload
- **Gallery fallback:** Allow picking from photo gallery for cards already photographed
- **Batch mode:** At a conference, rep might collect 10 cards. Support a "Scan Next" button that loops the camera immediately after saving, with a counter: "3 cards captured"
- **Offline:** Store card photo and extracted fields locally. Sync contact creation when online. The extraction itself requires connectivity (Claude API call), so offline captures are queued as "photo taken, pending extraction."

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **Blurry or dark photo** | If Claude Vision returns low-confidence fields, prompt: "Some fields may be incorrect — please review carefully." Highlight uncertain fields in yellow. |
| **Card in a non-English language** | Claude Vision handles multilingual text. Extract what's possible and flag: "This card appears to be in [language]." |
| **Card with no company name** | Skip account matching. Create the contact with company field empty. Rep can link to an account manually. |
| **Multiple cards for the same person** | Duplicate detection catches this via email/phone match. Offer to update existing contact with any new information from the second card. |
| **Card is a creative/non-standard format** | Claude Vision generally handles these well. If extraction fails entirely, show the photo and let the rep enter fields manually with the image visible as reference. |
| **QR code on the card** | Phase 2: detect and decode QR codes on cards (often contain vCard data). Use the QR data as a supplement to or replacement for OCR. |
| **Rep not connected to internet** | Photo is saved locally with a "pending" badge. When connectivity returns, extraction runs and the rep is notified to review. |
| **Account doesn't exist yet** | Offer "Create new account" inline, pre-filled with the company name and any address info from the card. |

## Testing Strategy

### Unit Tests
- Account fuzzy matching algorithm (exact, fuzzy, domain-based)
- Contact duplicate detection logic
- Phone number normalization for duplicate checking
- Extraction response parsing and field mapping

### Integration Tests
- Full flow: photo upload → Claude Vision extraction → account match → contact creation
- Duplicate detection → merge flow
- Batch capture: multiple cards in sequence
- Offline capture → sync → extraction → notification

### Manual / QA Tests
- 20 diverse business cards: standard, vertical, multilingual, creative designs
- Low-light and blurry photo handling
- Conference simulation: capture 10 cards in rapid succession
- Extraction accuracy metrics (target: 90%+ fields correct without manual editing)

**Approximate total: 12-15 automated tests + manual QA with diverse card set**

## Open Questions

1. **Card photo retention** — Keep card photos permanently? They're useful for reference but add storage costs. Could offer a "delete photo after 30 days" option.
2. **LinkedIn enrichment** — After extracting a name and company, offer to look up their LinkedIn profile for additional context? Privacy implications to consider.
3. **Batch processing UX** — At conferences, reps might capture 20+ cards. Should there be a "process all later" mode where they just snap photos rapidly and review/confirm everything on the train home?
4. **Shared contacts** — If two reps scan the same person's card, should the system merge them? Who "owns" the contact?
