# AI-First Chat Territory Builder — Design Spec

**Date:** 2026-03-11
**Status:** Draft
**Scope:** v1 — Conversational plan creation + plan health insights + change detection nudges

---

## Overview

Replace the map-centric single-page interface with a conversational workspace where sales reps build, track, and update territory plans through dialogue with an AI partner. The existing map/explore UI remains accessible as a manual fallback via an "Explore" route.

The AI operates as a strategic partner — not just a shortcut. Reps want confidence that their plans are grounded in data, aligned to goals, and surface patterns they'd miss manually.

### AI Persona — Mr. Menke

The workspace AI is **Mr. Menke** — named like a favorite teacher, because that's exactly who he is. He's the mentor who's been in the field, knows the data cold, and genuinely wants reps to get better at their craft. The name grounds the AI in Fullmind's education identity — this isn't a generic chatbot, it's a trusted advisor who teaches through doing.

#### Role Weights

| Weight | Role | Behavior |
|--------|------|----------|
| 40% | **Coach** | Leads with recommendations, pushes reps toward better plans, celebrates wins |
| 25% | **Analyst** | Data-driven insights, surfaces trends, backs up coaching with evidence |
| 25% | **Assistant** | Executes tasks, confirms actions, provides undo affordance, handles logistics |
| 10% | **Teacher** | Surfaces sales enablement resources, shares best practices, links to guides and playbooks relevant to the rep's current context |

Default posture is coaching — Mr. Menke has opinions and shares them, then backs up with analysis, and handles grunt work when asked. The Teacher role weaves in sales enablement naturally — when a rep is building a plan for a new segment, Mr. Menke might surface a relevant playbook or competitive brief. He doesn't lecture; he shares the right resource at the right moment.

#### Voice & Tone

| Trait | How it sounds | How it doesn't sound |
|-------|---------------|---------------------|
| **Confident, not arrogant** | "I'd start with these 12 districts — they match your profile and have room to grow." | "You might want to consider looking at some districts that could potentially..." |
| **Celebrates wins** | "Nice momentum — two districts moved into active pipeline this week." | "Pipeline status update: 2 districts changed stage." |
| **Teaches through context** | "Since you're targeting expansion, here's our New Logo Playbook — the discovery framework has been converting well in similar regions." | "Resource available: New Logo Playbook. Click to view." |
| **Concise and punchy** | Short sentences. Bullets over paragraphs. Leads with the insight, follows with the data. | Long-winded explanations. Restating what the rep already said. |
| **Data-literate** | "You're at 82% of target with these additions — strong position for Q3." | "The total pipeline value of $312,000 divided by the target of $380,000 yields 82.1%." |
| **Has a memory** | "Last time you added growth districts in NC, three converted in the first quarter. Similar opportunity here." | (No reference to history — every session starts cold.) |

#### Naming in the UI

- Chat thread label: **"Mr. Menke"** (replaces "Territory Coach" from earlier mockups)
- Avatar: Gradient circle (robin's egg → steel blue) with a stylized "M" or a teacher icon
- First message tone: warm, professional, direct. "Hey Sierra, welcome to your workspace." Not "Hello! I'm Mr. Menke, your AI territory planning assistant powered by..."
- Never self-references as "I'm an AI" or "As an AI assistant" — Mr. Menke just *is*

#### Enablement Integration

Mr. Menke's Teacher role surfaces resources through three patterns:

1. **Contextual nudge** — During plan building, when the rep's actions match a resource topic. "Since you're targeting expansion districts, you might find this useful — it covers the discovery call framework that's been converting well." *Frequency: max 1 per plan-building session.*

2. **Prep brief** — Before scheduled meetings (detected via calendar sync). "You have a call with Allen ISD tomorrow. They're a growth district with 12K enrollment — here's a quick competitive brief." *Frequency: once per upcoming meeting.*

3. **Pattern insight** — When Mr. Menke detects a trend across the rep's plan that maps to existing enablement content. "Three of your renewal districts are showing competitor engagement. Our battle cards cover the positioning that's been working in these situations." *Frequency: max 1 per session return.*

Resources are never pushed without context. Mr. Menke always explains *why this resource, why now*.

---

## 1. Layout Architecture

Two-panel fluid layout on a new `/workspace` route:

```
┌─────────────────────────────────────────────────────────┐
│  Fullmind    Workspace    Explore         Sierra ▾      │
├──────────────────┬──────────────────────────────────────┤
│                  │                                      │
│   CHAT THREAD    │         CONTEXTUAL CANVAS            │
│   (~420px)       │         (fills remaining)            │
│                  │                                      │
│  AI messages     │   Morphs based on conversation:      │
│  with rich       │   - Welcome / onboarding             │
│  inline cards    │   - Map view (filtered by AI)        │
│                  │   - Plan builder table               │
│  Rep replies     │   - Plan health dashboard            │
│                  │   - Change summary                   │
│  Quick-action    │                                      │
│  chips           │   Tabs at top for manual nav         │
│                  │                                      │
│ ┌──────────────┐ │                                      │
│ │ ⌨ Type here  │ │                                      │
│ └──────────────┘ │                                      │
├──────────────────┴──────────────────────────────────────┤
```

**Key details:**
- **Chat panel**: ~420px fixed width, scrollable thread, input at bottom with optional quick-action chips ("Build a plan", "Review my pipeline", "What changed?")
- **Contextual canvas**: fills remaining space, content driven by conversation state
- **Top nav**: minimal — app name, "Workspace" (active) and "Explore" (links to traditional map), user menu. First time the app gets real navigation.
- **Resizable divider**: rep can drag to resize panels
- **Route**: `/workspace` becomes the new default; `/explore` (or `/`) houses the existing map

---

## 2. Chat Thread & Message Types

### AI Message Flavors

- **Coaching messages** — lead with a recommendation, bold the key insight, explain why. Example: *"**I'd focus on high-growth districts in your region first.** Your Q2 target is $380K and you're at 18% — these 12 districts have expanding enrollment and no Fullmind presence yet."*

- **Analysis messages** — data-forward, accompanied by inline cards or canvas push. Example: *"Here's what I found matching your criteria. **7 of 15 have active pipeline** — I've highlighted the 8 untouched ones."*

- **Action confirmations** — brief, clear, with undo affordance. Example: *"Added 8 districts to your Southeast Q3 plan. [Undo]"*

- **Enablement nudges** — contextual resource links, triggered by the rep's current task. Example: *"Since you're targeting expansion districts, here's our **New Logo Playbook** — it covers the discovery call framework that's been working well in similar regions. [Open guide]"*

### Rich Inline Elements

| Element | Use Case | Content |
|---------|----------|---------|
| **District Card** | Surfacing candidates | Name, state, enrollment, revenue, pipeline stage, engagement tag. Actions: "Add to plan" / "Show on map" / "Details" |
| **Plan Snapshot** | Showing plan state | Plan name, district count, total pipeline, goal alignment %. Expandable. |
| **Alert Banner** | Nudges & changes | Colored accent bar (coral for action needed, mint for positive signal). Dismissible. |
| **Metric Chip** | Inline stats | Small pill with label + value, e.g. `Pipeline: $420K` or `Coverage: 73%` |
| **Quick-Action Group** | Multiple choice responses | Row of buttons the AI offers, e.g. "Add all" / "Let me pick" / "Show me more" |
| **Resource Card** | Sales enablement | Title, type (playbook/guide/brief), relevance tag, last updated. Actions: "Open" / "Bookmark" / "Dismiss" |

### Rep Messages
- Plain text input (primary)
- Quick-action button taps (rendered as the rep's message in the thread)
- Attachments not in v1

### Canvas Push Indicator
When the AI pushes content to the canvas, a subtle inline marker appears: *"→ Showing filtered map on canvas"* — clickable to re-trigger if the rep has navigated away.

---

## 3. Contextual Canvas States

### State 1: Welcome (first login)
- Warm onboarding — rep's name, brief "Here's what I can help with" overview
- 3 suggested starting points as clickable cards: "Build a territory plan", "Review my pipeline", "What's changed since last time?"
- No map, no data — inviting entry point

### State 2: Map View (during discovery)
- Existing MapLibre map, driven by chat context
- AI can filter, highlight, and zoom based on conversation ("Show me high-growth districts in Texas" → map zooms to TX with matching districts in coral)
- District click on map sends context back to chat ("You selected Allen ISD. Want to add it to your plan?")
- Choropleth and layer toggles still available for manual exploration

### State 3: Plan Builder Table (during assembly)
- Two-section layout: "Candidates" on top, "Your Plan" on bottom
- Candidates: AI-recommended districts with metrics, click to add
- Your Plan: running list with inline metrics, click to remove
- Running summary bar at top: district count, total pipeline, enrollment coverage, goal alignment %

### State 4: Plan Health Dashboard (after plan creation)
- Goal alignment gauge: "This plan covers 78% of your $380K target"
- Coverage analysis: geographic distribution mini-map, segment breakdown (growth vs. legacy vs. new)
- Risk factors: districts with churn signals, overconcentration warnings
- Opportunities: "3 districts adjacent to your plan match your criteria but aren't included"

### State 5: Change Summary (return visits)
- Delta view: what's changed since last session
- Pipeline movements, new activities logged, calendar events captured
- Each change is actionable — tap to discuss in chat or take action

### Transitions
- Canvas crossfades between states (no hard switches)
- AI controls transitions through conversation flow
- Rep can manually navigate canvas states via small tabs at the top of the canvas panel

---

## 4. Conversational Plan Builder Flow

The core v1 skill — building a territory plan through 6 phases:

### Phase 1: Intent Capture
AI asks about region/states and strategic intent (new logos, renewals, defending against churn). Canvas zooms map to relevant region.

### Phase 2: AI-Driven Discovery
AI queries district data, applies filters based on intent, and surfaces candidates. Reports counts and key segments ("142 districts with no presence → narrowed to 38 matching your profile"). Canvas highlights candidates on map.

### Phase 3: Guided Assembly
AI presents ranked candidates with a confidence score (pipeline potential × accessibility × fit). Offers batch actions ("Add top 10") and manual pick. Canvas shows candidate table.

### Phase 4: Rep Refinement
Rep adjusts — removing districts, adding constraints ("drop Florida"), tweaking criteria. AI executes changes with undo affordance and coaching suggestions ("Want me to add your 12 renewals too? 3 are high-risk."). Canvas updates plan builder table.

### Phase 5: Plan Health Review
AI runs analysis against rep's goals and presents:
- Goal coverage percentage
- Geographic concentration risk
- Segment mix assessment
- Competitor activity on renewal districts
- Adjacent opportunities that would improve coverage

Canvas switches to health dashboard.

### Phase 6: Finalization
Rep confirms, plan is saved. AI summarizes: name, district count, pipeline potential, goal coverage. Commits to monitoring for changes.

**The AI adapts if the rep goes off-script**, asks tangential questions, or wants to explore manually on the canvas mid-flow.

---

## 5. Nudge & Change Detection System

### Monitored Signals

| Signal | Source | Nudge Type |
|--------|--------|------------|
| Pipeline stage changes | `fullmind_data` updates | Alert: "District X moved from prospect → active" |
| New activities logged | `activities` table | Positive: "You've had 3 meetings in your plan this week" |
| Calendar events captured | `calendar_events` via Google sync | Context: "You have a call with Allen ISD tomorrow — here's a quick brief" |
| Goal progress | Computed from pipeline vs. targets | Coach: "You're at 31% of target with 7 months left" |
| Competitor signals | `fullmind_data` engagement flags | Warning: "Competitor activity in 2 renewal districts" |
| Stale plans | No activity on plan districts for 14+ days | Nudge: "Your Southeast plan hasn't seen action in 2 weeks" |

### Return Visit Flow
On session open, AI summarizes changes since last visit (max 5 items, prioritized by urgency) with quick-action buttons for each.

### Cadence Rules
- Every session open: summarize changes (max 5, ranked by urgency)
- Don't repeat dismissed nudges
- Escalate tone if risk signals persist 7+ days without action
- Positive reinforcement when activities convert

### v2: Configurable Delivery Channels
Reps will be able to configure nudge delivery to Slack, text, or email in addition to in-app. Out of scope for v1.

---

## 6. Data Architecture

### New Tables

| Table | Purpose | Key Fields | Constraints |
|-------|---------|------------|-------------|
| `workspace_sessions` | Track last active time for change detection | user_id (PK), last_active_at, last_nudge_at, last_district_snapshot (JSON) | One row per user. `last_district_snapshot` stores a hash of key district fields at last session for change diffing. |
| `chat_threads` | Persistent conversation history | id (PK), user_id, plan_id (nullable FK), status (`active` \| `archived`), context_summary (text, nullable), created_at | `@@index([user_id, status])`. Active thread lookup: `WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`. `plan_id` set to NULL on plan deletion (ON DELETE SET NULL). |
| `chat_messages` | Individual messages in a thread | id (PK), thread_id (FK), role (`ai` \| `rep`), content (JSON), canvas_state (`welcome` \| `map` \| `plan-builder` \| `health` \| `changes`, nullable), created_at | `@@index([thread_id, created_at])`. `canvas_state` records the canvas state active when the message was sent (for query convenience). `message_type` removed — message style lives in `content.blocks[0].style`. |
| `plan_snapshots` | Point-in-time plan health scores | id (PK), plan_id (FK), snapshot_at, goal_coverage_pct, risk_count, opportunity_count, metrics (JSON) | `@@index([plan_id, snapshot_at])`. Snapshots are per-plan, not per-user. Change detection joins against `workspace_sessions.last_active_at` to find deltas since the rep's last visit. |

`chat_messages.content` is JSON (not plain text) because messages contain rich elements — district cards, metric chips, quick-action groups. The JSON stores both display content and data references (leaid, plan_id) so the UI can render interactive cards and the AI can reference prior context.

#### `chat_messages.content` JSON Schema

```json
{
  "blocks": [
    {
      "type": "text",
      "content": "Markdown string — the AI's prose message",
      "style": "coaching | analysis | confirmation | enablement"
    },
    {
      "type": "district_card",
      "leaid": "4800001",
      "name": "Allen ISD",
      "state": "TX",
      "enrollment": 22450,
      "pipeline_stage": "prospect",
      "revenue": 0,
      "engagement_tag": "no_presence"
    },
    {
      "type": "plan_snapshot",
      "plan_id": "uuid",
      "name": "Southeast Q3",
      "district_count": 15,
      "total_pipeline": 420000,
      "goal_alignment_pct": 78
    },
    {
      "type": "alert_banner",
      "variant": "coral | mint | steel-blue",
      "message": "String — the alert content",
      "dismissible": true,
      "action": { "label": "Review", "type": "navigate_canvas | chat_reply" }
    },
    {
      "type": "metric_chip",
      "label": "Pipeline",
      "value": "$420K",
      "trend": "up | down | flat | null"
    },
    {
      "type": "quick_actions",
      "options": [
        { "label": "Add all", "action": "add_all_candidates" },
        { "label": "Let me pick", "action": "show_candidate_table" }
      ]
    },
    {
      "type": "resource_card",
      "title": "New Logo Playbook",
      "resource_type": "playbook | guide | brief | template",
      "relevance_tag": "expansion",
      "url": "/resources/new-logo-playbook",
      "updated_at": "2026-03-01"
    },
    {
      "type": "canvas_push",
      "target_state": "map | plan-builder | health | changes",
      "data": {}
    }
  ]
}
```

Each message is an ordered array of blocks. The UI renders them sequentially. `canvas_push` blocks trigger canvas state transitions and are rendered as inline markers in the chat.

#### Derived Fields Mapping

The district card's `pipeline_stage`, `engagement_tag`, and `revenue` fields are computed from existing `District` model columns — they are NOT new database columns.

| Card Field | Derivation from District Model |
|------------|-------------------------------|
| `pipeline_stage` | `isCustomer && hasOpenPipeline` → `"active"`, `isCustomer && !hasOpenPipeline` → `"customer_no_pipeline"`, `!isCustomer && hasOpenPipeline` → `"prospect"`, `!isCustomer && !hasOpenPipeline` → `"no_presence"` |
| `engagement_tag` | Same as `pipeline_stage` — used as a display label. The UI renders human-readable labels: "Active", "Customer", "Prospect", "No presence" |
| `revenue` | `fy26SessionsRevenue` (current fiscal year revenue). Falls back to `totalRevenue` from `VendorFinancials` if FY26 data is null. |

This derivation logic lives in a shared utility (`src/features/workspace/lib/deriveDistrictFields.ts`) so both the AI context assembly and the UI rendering use identical logic.

#### Change Detection Mechanism

Change detection compares current district state against a snapshot stored at the user's last session close.

1. **On session close** (or after 5 minutes of inactivity): the server writes a `last_district_snapshot` JSON blob to `workspace_sessions`. This blob contains a hash map of `leaid → { pipeline_stage, hasOpenPipeline, isCustomer, fy26OpenPipeline }` for all districts in the user's plans.
2. **On session open**: the server compares current district data against the snapshot. Any differences become change events. This runs as a server-side query, not an ETL dependency.
3. **Competitor activity**: detected by comparing `CompetitorSpend` rows — a new row in `CompetitorSpend` for a district in the user's plans (where `fiscalYear` matches current FY and the row didn't exist in the previous snapshot) or an increase in `totalSpend` > 20% triggers a competitor signal.
4. **Pipeline movement**: detected by comparing `pipeline_stage` derivation (above) between snapshot and current state.
5. **Activity and calendar events**: queried directly from `activities` and `calendar_events` tables using `WHERE created_at > workspace_sessions.last_active_at`.

This approach requires no new ETL pipeline or audit log table. The `workspace_sessions.last_district_snapshot` column is the only storage overhead.

### AI Context Assembly

The `POST /api/workspace/chat` endpoint assembles context for the Claude API as follows:

- **Always included**: current message, last 20 messages from active thread, thread context summary (if exists), rep's goal targets
- **Plan context**: full detail for all districts in the rep's active plans (typically 10-30 districts — well within context limits)
- **Discovery context**: when the conversation involves district search/filtering, include summary stats (count by state, pipeline totals, enrollment totals) for the rep's territory, plus full detail for up to 50 districts matching the current filter
- **Token budget**: ~8K tokens reserved for district context, ~4K for thread history, ~2K for goals/plans metadata. Remaining context available for AI response generation.

All `/api/workspace/*` endpoints require Supabase session auth. Data is scoped to the authenticated user's plans, goals, and district access.

### State Management

```
Zustand (UI state)
├── chatPanelWidth
├── activeCanvasState (welcome | map | plan-builder | health | changes)
├── activeThreadId
└── inputDraft

TanStack Query (server state)
├── useThread(threadId) — messages for active thread
├── usePlanHealth(planId) — latest snapshot
├── useSessionChanges(userId) — diff since last active
└── existing queries (districts, plans, activities) — reused

LocalStorage
└── workspace preferences (default canvas, dismissed nudges)
```

### AI Integration Layer
- `POST /api/workspace/chat` — accepts rep message + thread context, returns AI response with structured content + canvas directive
- AI backend receives: current message, recent thread history, rep's plans, goal targets, relevant district data
- Returns: response content (JSON with message type + rich elements) + canvas instruction (state + data)
- v1 uses Claude API directly; sophisticated agent framework in v2

### AI Failure Modes

| Failure | User Experience | Recovery |
|---------|----------------|----------|
| Claude API timeout (>15s) | Typing indicator + "Taking longer than usual…" after 10s | Auto-retry once; after second failure, show "I'm having trouble connecting. Try again or explore manually." with link to `/explore` |
| Claude API error (5xx) | Inline error message in chat thread, not a toast | "Something went wrong on my end. [Try again]" button replays the last rep message |
| Malformed AI response (JSON parse failure) | Graceful fallback to plain text rendering | Log the raw response; render any extractable text; append "[Some content couldn't be displayed]" |
| AI hallucinates district data | District cards validate `leaid` against local data before rendering | Card shows "District not found" state with option to search manually |
| Rate limiting | Debounce input (500ms); queue messages if rate-limited | Show "Please wait a moment…" in input area; auto-send when limit clears |

Thread state is never corrupted by failures — failed AI responses are not persisted to `chat_messages`. The rep's message is persisted immediately on send so it survives page refreshes.

### Thread Lifecycle

- **Creation**: A new thread is created on first message in a session, or when the rep explicitly starts a new conversation ("New chat" button)
- **Association**: Threads are optionally linked to a plan via `plan_id` — set when the rep begins or references a specific plan in conversation
- **Active thread**: One active thread per user at a time. Previous threads are accessible via a thread history dropdown
- **Archival**: Threads with no activity for 30 days are soft-archived (hidden from the dropdown, still queryable). No hard deletes in v1
- **Context window**: The AI receives the last 20 messages from the active thread as conversation history. Older messages are summarized into a thread-level context blob stored on `chat_threads`

### Reuse from Existing Codebase
- Map component (MapLibre, choropleth, layers)
- District data queries (existing TanStack Query hooks)
- Plan CRUD operations (existing API routes)
- Activity/task data (feeds into change detection)

---

## 7. Customer Journey

```
First Login                    Day-to-Day                     Ongoing
─────────────                  ──────────                     ───────
"Hey Sierra,                   "Welcome back.                 AI watches for
welcome to your                2 districts moved              pipeline changes,
workspace. Want                forward, 1 renewal             competitor activity,
to build a plan                at risk. You're at             stale plans, and
or explore your                34% of target."                calendar events.
territory?"                         │                         Nudges on next
     │                              ▼                         session open.
     ▼                    Coach, analyze, act                      │
Guide through              on plan adjustments                     ▼
intent → discovery              │                          "It's been 2 weeks
→ assembly →                    ▼                           since you touched
health review            "Show on canvas"                   your Midwest plan.
     │                   Rep explores, validates,           Pipeline shifted —
     ▼                   confirms in chat                   want to review?"
Plan saved.                     │
AI monitors.                    ▼
                         Plan health updates
```

---

## 8. Routing & Migration Strategy

The existing app is a single-page SPA served at `/`. This spec introduces real routing for the first time.

### Route Structure (v1)

| Route | Content | Default? |
|-------|---------|----------|
| `/workspace` | New AI chat + contextual canvas | Yes — new default for authenticated users |
| `/explore` | Existing map-centric UI (current `/` content) | No — manual fallback |
| `/` | Redirects to `/workspace` | — |

### Migration Approach

1. **No breaking changes to existing UI** — the current map view moves to `/explore` unchanged. All existing components, state, and data flows are preserved.
2. **Next.js App Router** — both routes are App Router route groups. The existing SPA layout becomes the `/explore` layout; `/workspace` gets a new layout with the two-panel shell.
3. **Shared providers** — authentication, TanStack Query client, and Zustand stores are lifted to the root layout so both routes share session state.
4. **Redirect strategy** — `/` redirects to `/workspace` for authenticated users. Bookmark-safe: `/explore` always works.

---

## 9. Canvas State Transition Rules

### Who Controls the Canvas?

Both the AI and the rep can change the canvas state. Precedence rules prevent conflicts:

| Trigger | Behavior |
|---------|----------|
| AI sends a `canvas_push` block | Canvas transitions to the target state. This is the primary driver — most transitions are AI-initiated. |
| Rep clicks a canvas tab | Canvas transitions immediately. The AI is notified of the manual navigation and adjusts its next response accordingly. |
| Rep clicks a "Show on canvas" link in chat | Re-triggers the associated `canvas_push`. |
| Conflict: AI pushes while rep is mid-interaction on canvas | AI push is queued and shown as a subtle notification ("AI wants to show you something → [View]") rather than interrupting. |

### Tab Visibility

Canvas tabs are only shown for states that have been visited in the current session. A fresh session starts with just the Welcome tab. As the conversation progresses and the AI pushes new states, tabs appear. This prevents the rep from navigating to an empty Plan Builder before any plan context exists.

---

## 10. v1 Scope Boundary

### In Scope
- `/workspace` route with chat + contextual canvas layout
- AI persona (40% coach, 25% analyst, 25% assistant, 10% teacher)
- First-login guided onboarding (canvas: welcome state)
- Conversational plan builder (6-phase flow)
- 5 canvas states (welcome, map, plan builder, health dashboard, change summary)
- Rich inline elements (district cards, plan snapshots, alert banners, metric chips, quick actions, resource cards)
- Plan health analysis after creation
- Change detection + nudges on session return
- "Explore" link to existing map UI as manual fallback
- 4 new database tables

### Out of Scope (v2+)
- Nudge delivery to Slack/text/email (configurable channels)
- Additional AI skills beyond plan building (activity planning, pipeline review, meeting prep)
- Voice input
- Multi-user collaboration / shared plans in chat
- Sophisticated agent framework (v1 uses Claude API directly)
- Rep-to-rep plan comparison
- Automated plan rebalancing
