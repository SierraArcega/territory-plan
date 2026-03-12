# AI-First Chat Territory Builder — Design Spec

**Date:** 2026-03-11
**Status:** Draft
**Scope:** v1 — Conversational plan creation + plan health insights + change detection nudges

---

## Overview

Replace the map-centric single-page interface with a conversational workspace where sales reps build, track, and update territory plans through dialogue with an AI partner. The existing map/explore UI remains accessible as a manual fallback via an "Explore" route.

The AI operates as a strategic partner — not just a shortcut. Reps want confidence that their plans are grounded in data, aligned to goals, and surface patterns they'd miss manually.

### AI Persona

| Weight | Role | Behavior |
|--------|------|----------|
| 40% | **Coach** | Leads with recommendations, pushes reps toward better plans, celebrates wins |
| 30% | **Analyst** | Data-driven insights, surfaces trends, backs up coaching with evidence |
| 20% | **Assistant** | Executes tasks, confirms actions, provides undo affordance |

Default posture is coaching — the AI has opinions and shares them, then backs up with analysis, and handles grunt work when asked.

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

### Rich Inline Elements

| Element | Use Case | Content |
|---------|----------|---------|
| **District Card** | Surfacing candidates | Name, state, enrollment, revenue, pipeline stage, engagement tag. Actions: "Add to plan" / "Show on map" / "Details" |
| **Plan Snapshot** | Showing plan state | Plan name, district count, total pipeline, goal alignment %. Expandable. |
| **Alert Banner** | Nudges & changes | Colored accent bar (coral for action needed, mint for positive signal). Dismissible. |
| **Metric Chip** | Inline stats | Small pill with label + value, e.g. `Pipeline: $420K` or `Coverage: 73%` |
| **Quick-Action Group** | Multiple choice responses | Row of buttons the AI offers, e.g. "Add all" / "Let me pick" / "Show me more" |

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

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `workspace_sessions` | Track last active time for change detection | user_id, last_active_at, last_nudge_at |
| `chat_threads` | Persistent conversation history | user_id, plan_id (nullable), created_at |
| `chat_messages` | Individual messages in a thread | thread_id, role (ai/rep), content (JSON), message_type, canvas_state, created_at |
| `plan_snapshots` | Point-in-time plan health scores | plan_id, snapshot_at, goal_coverage_pct, risk_count, opportunity_count, metrics (JSON) |

`chat_messages.content` is JSON (not plain text) because messages contain rich elements — district cards, metric chips, quick-action groups. The JSON stores both display content and data references (leaid, plan_id) so the UI can render interactive cards and the AI can reference prior context.

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

## 8. v1 Scope Boundary

### In Scope
- `/workspace` route with chat + contextual canvas layout
- AI persona (40% coach, 30% analyst, 20% assistant)
- First-login guided onboarding (canvas: welcome state)
- Conversational plan builder (6-phase flow)
- 5 canvas states (welcome, map, plan builder, health dashboard, change summary)
- Rich inline elements (district cards, plan snapshots, alert banners, metric chips, quick actions)
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
