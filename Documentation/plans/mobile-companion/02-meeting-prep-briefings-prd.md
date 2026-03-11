# Meeting Prep Briefings

**Date:** 2026-02-26
**Status:** Concept
**Priority:** P1 — Core
**Parent:** [Mobile Companion Vision](./00-vision.md)

## Problem Statement

Reps pull into a school parking lot and have 2 minutes before they walk in. They need context: When did we last talk? What's the open opportunity? Who's the decision maker? Are there any outstanding issues? Any recent orders?

Today they either wing it (bad) or spend 10 minutes scrolling through CRM records on their phone trying to piece together the story (slow and frustrating). Neither option sets them up for a productive meeting.

**Who benefits:** Reps (walk in prepared, close more deals), accounts (feel valued when reps remember context), managers (reps execute better in the field).

## Proposed Solution

A one-tap AI-powered briefing that synthesizes everything the system knows about an account into a 30-second readable summary. The rep opens an account, taps "Brief me," and gets a concise, narrative-style briefing — not a data dump, but a story about this relationship.

The briefing is generated on-demand by an LLM that has access to the account's full activity history, pipeline, contacts, orders, and territory context.

## User Flow

```
1. Rep opens an account (from search, map, or geo-nudge notification)
2. Account card shows key info: name, address, primary contact, last activity date
3. Rep taps "Brief me" button
4. 1-2 second loading state with a subtle animation
5. Briefing appears:

   ┌─────────────────────────────────────┐
   │ Acme Elementary — Briefing          │
   │                                     │
   │ RELATIONSHIP                        │
   │ You've had 12 touchpoints since     │
   │ Sept 2025. Last call was Jan 15 —   │
   │ John Martinez (Principal) said he's │
   │ evaluating literacy programs for    │
   │ next school year.                   │
   │                                     │
   │ PIPELINE                            │
   │ Open opportunity: Literacy Suite,   │
   │ $48K, Stage: Proposal. You sent a   │
   │ proposal on Jan 20 — no response    │
   │ yet (37 days ago).                  │
   │                                     │
   │ KEY PEOPLE                          │
   │ • John Martinez — Principal (main)  │
   │ • Sarah Chen — Curriculum Director  │
   │   (met at TCEA conference)          │
   │                                     │
   │ HEADS UP                            │
   │ ⚠ Proposal has been pending 37     │
   │   days — consider a follow-up.      │
   │ ⚠ Sarah Chen has no email on file. │
   │                                     │
   │ [Refresh]              [Share]      │
   └─────────────────────────────────────┘

6. Rep reads for 30 seconds, walks in prepared
```

## Technical Design

### Briefing Generation

The briefing is generated server-side via the Claude API. The prompt assembles all relevant account data and asks for a concise, actionable summary.

**Input context sent to LLM:**
- Account details (name, address, type, enrollment, district)
- All contacts associated with the account
- Activity history (last 20 activities: calls, notes, check-ins, emails)
- Open opportunities/pipeline
- Recent orders and revenue history
- Territory assignment and goal progress for this account
- Any pending tasks related to this account

**Output structure:**
```json
{
  "relationship_summary": "string — 2-3 sentences on the relationship arc",
  "pipeline_summary": "string — current deal status and key numbers",
  "key_people": [{ "name": "string", "role": "string", "context": "string" }],
  "heads_up": ["string — actionable alerts or flags"],
  "suggested_talking_points": ["string — optional, based on context"]
}
```

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mobile/accounts/:id/briefing` | Generates and returns an AI briefing for the account |
| `GET` | `/api/mobile/accounts/:id/summary` | Returns raw account data (contacts, activities, pipeline) for the LLM context |

### Caching Strategy

Briefings are expensive to generate (~2-3 seconds, ~$0.01 per briefing in API costs). Cache aggressively:

- **Cache key:** `briefing:{accountId}:{lastActivityTimestamp}`
- **TTL:** 4 hours or until new activity is logged against the account
- **Storage:** Redis or in-database JSON field on the Account model
- **Invalidation:** Any new Activity with this `accountId` invalidates the cache

When the rep taps "Refresh," bypass cache and regenerate.

### Data Model Changes

```prisma
model AccountBriefing {
  id          String   @id @default(cuid())
  accountId   String   @unique
  content     Json     // the structured briefing output
  generatedAt DateTime
  expiresAt   DateTime
  contextHash String   // hash of input data, for cache invalidation

  account     Account  @relation(fields: [accountId], references: [id])
}
```

### Mobile Implementation

- **Trigger:** "Brief me" button on the account detail screen. Also auto-triggered when a geo-nudge brings the rep to an account.
- **Loading state:** Skeleton screen with pulsing blocks matching the briefing layout.
- **Offline:** If the rep has no connectivity, show the last cached briefing with a timestamp: "Based on data from 3 hours ago." If no cached briefing exists, show a stripped-down view using locally synced account data (last activity date, contact names, open deal amount) — no AI summary, just raw facts.
- **Share:** Rep can share the briefing as plain text (copy to clipboard or send to a colleague via the app).

## Edge Cases & Error Handling

| Scenario | Behavior |
|----------|----------|
| **New account with no history** | Briefing shows: "No activity history yet. Here's what we know:" followed by basic account info (enrollment, district, address). Suggested talking point: "This is a first visit — focus on discovery." |
| **Stale data (no activity in 90+ days)** | Heads-up flag: "No contact in [X] days. This account may need re-engagement." |
| **Account with 100+ activities** | Only send the last 20 activities to the LLM. Summarize older history as "47 prior touchpoints between Jan 2024 - Aug 2025." |
| **LLM generation fails** | Fall back to a structured data view: recent activities list, contacts table, pipeline card. No AI narrative, but the rep still gets useful context. |
| **Very slow connection** | Show cached briefing immediately if available. Generate fresh one in background and swap in when ready. |
| **Multiple open opportunities** | Briefing covers all of them, ordered by stage (closest to close first). |
| **Confidential notes** | If an activity is flagged as confidential/internal, include it in the briefing (it's the same rep's data) but mark it visually. |

## Testing Strategy

### Unit Tests
- Briefing prompt assembly (correct data included, proper truncation of long histories)
- Cache invalidation logic (new activity invalidates, stale cache returns correctly)
- Offline fallback rendering (cached briefing vs. raw data view)
- Briefing response parsing and error handling

### Integration Tests
- Full flow: account data → LLM call → briefing response → display
- Cache hit vs. cache miss behavior
- Briefing generation with various account data shapes (new account, old account, many contacts, no pipeline)

### Manual / QA Tests
- Briefing quality review across 10 diverse accounts
- Readability and scan-ability on mobile screens
- Loading performance on slow connections

**Approximate total: 12-15 automated tests + manual QA review**

## Open Questions

1. **Briefing tone** — Professional and terse? Or conversational ("You last spoke with John about...")? Should it be configurable per org?
2. **Talking points** — How prescriptive should suggested talking points be? Just context-based prompts, or actual sales coaching?
3. **Manager view** — Should managers be able to see the briefings their reps generated? Useful for coaching but might make reps feel surveilled.
4. **Trigger timing** — Should briefings auto-generate when a rep is approaching an account (via geo-fence), or only on-demand?
