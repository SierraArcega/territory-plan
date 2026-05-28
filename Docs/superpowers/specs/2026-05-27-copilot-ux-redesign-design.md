# Copilot UX redesign — Polished Rail + light proactivity

**Date:** 2026-05-27
**Branch:** `feat/ai-copilot-core-objects`
**Status:** Approved design, pending implementation plan

## Context

The AI Copilot works end-to-end: it answers data questions (read rail), proposes
create/edit actions behind a confirm gate (write rail), plots district answers on
the map, and keeps an activity log. But the *experience* is utilitarian — a
floating pill opens a 380px right rail that drops the rep into a near-blank chat
with the greeting "Ask about your data, or tell me what to create or update." The
streaming state leaks internal tool names ("Running run_sql…"), confirm cards are
plain, and there's no on-ramp for a rep who doesn't already know what to type.

This redesign keeps every existing capability and reimagines the surface so the
copilot feels **discoverable, clear, and like a confident first-class part of the
app** — the assistant a rep reaches for in every moment: a quick mid-workflow ask,
a starting point for the day, fast logging, and "what should I be working on."

## Scope

**UI/feel redesign + light proactivity.** Same read/write brains. The only new
backend work is a small, read-only **nudges endpoint** that powers the home
state's "Worth your attention" section using existing data. No new agentic
capabilities, no new write actions, no changes to the agent loop or action
registry.

## Non-goals

- No new copilot *capabilities* (no risk-detection models, no recommendation
  engine, no new write actions). The nudges are simple aggregate queries.
- No change to the surface model: it stays a right-side rail that splits the page
  (desktop) / fullscreen sheet (mobile). No command-palette / overlay rebuild.
- No change to map-plotting behavior or the action execution/audit pipeline.
- No saving/exporting of conversations beyond the existing history replay.

## Direction

**Polished Rail (evolutionary).** Keep the rail surface, width
(`COPILOT_PANEL_WIDTH = 380`), AppShell page-shrink split, slide-in animation, and
mobile fullscreen. Redesign the *contents* and the *entry points*. Lowest risk,
fastest to ship, and it never covers the rep's map/content — which matters because
"quick mid-workflow ask" is a core moment.

---

## Section 1 — Home state

What the rep sees before typing (and after "New chat"). Replaces the single
greeting line. Scrolls above the pinned composer.

1. **Personalized greeting** — time-of-day + first name from `useProfile()`
   (e.g. "Good morning, Sierra"), with a one-line subtitle. Owned, confident tone.
2. **Worth your attention** — up to ~5 ranked proactive nudges (show the top few;
   the rest reachable by scroll). Each nudge: a status dot (coral = at-risk, plum
   = opportunity), a bold count/headline, a one-line reason, and a chevron.
   Tapping a nudge **seeds the matching question into the conversation** (runs the
   query / lands the rep in the right place) — it does not perform a write.
3. **Jump in** — suggested prompt chips so the rep never faces a blank box. A mix
   of answer prompts, an action prompt, and at least one context-aware prompt
   derived from the current page (e.g. the open plan / state).
4. **Recent** — last 2–3 threads (from history), resumable on tap.

### Nudge set (v1)

Ranked, scoped to the current rep, read-only. The home state requests them once on
open and caches for the session.

- **Deals slipping** — opportunities whose close date has passed (or is imminent)
  with no recent activity. *(at-risk)*
- **Follow-ups due** — follow-up dates from logged activities, plus tasks due this
  week. *(at-risk)*
- **Stale plans / cold districts** — plans marked stale, or plan districts with no
  activity in N days. *(at-risk)*
- **Stale-in-stage deals** — open opportunities sitting in their current stage
  longer than the **average time-in-stage for that stage**, approximated from the
  opportunity's created date (now − created vs. the per-stage average of
  now − created). *(at-risk)*

**Feasibility flags (resolve in planning):**
- The stale-in-stage and deals-slipping nudges require opportunity/pipeline data
  with stage + created date + close date + last-activity. Confirm these fields
  exist and are queryable for the current rep before committing the nudge.
- Each nudge must define: the count query, the rep scoping
  (`owner_id` / `created_by_user_id`), the "N days" threshold, and the seed
  prompt it injects when tapped.
- Nudges with a zero count are omitted (no "0 deals slipping" cards).

### Backend glue — nudges endpoint

A new read-only `GET /api/copilot/nudges` returns an ordered array of
`{ id, kind, severity, headline, reason, count, seedPrompt }`. It runs the v1
nudge queries server-side (rep-scoped), omits zero-count nudges, and ranks
at-risk before opportunity. Fetched by a `useCopilotNudges()` hook
(TanStack Query, stable string key, sensible `gcTime`). No writes; no model call.

---

## Section 2 — Conversation flow

1. **Friendly progress** replaces "Running run_sql…". A soft spinner with
   plain-language steps mapped from the agent's tool events (e.g. querying →
   "Searching your data…", sampling → "Looking through records…", proposing →
   "Drafting…", default → "Thinking…"). Internal tool names never render. This is
   a pure relabel of the existing `latestToolLabel` logic against `TurnEvent`s.
2. **Answers** — assistant text bubble + the existing compact table (id columns
   hidden via `isIdColumn`, ~rows visible with "showing N of M", horizontal
   scroll). The existing auto-plot (focus + switch to Map tab) is unchanged; we
   **add** a **"View N on the map" button** as a repeatable control so the rep can
   re-focus those districts after navigating away. The button calls the same
   `focusDistricts` path the auto-plot already uses.
3. **Confirm cards read as a draft** — object icon + badge ("Log activity"), a
   human summary line, only the fields that matter, a **primary Confirm** and a
   **quiet Dismiss**. After confirm the card collapses to a small "✓ Logged …"
   line. Built by refactoring the existing `ProposedActionCard`.
4. **Batch actions — grouped + expandable.** When a turn proposes multiple actions
   of the same kind (e.g. "log a check-in for each of these 5"), render **one
   summary card** ("Log 5 check-ins") that expands to a reviewable, per-item
   checklist the rep can uncheck, then confirms the selected set. Single actions
   render as today's single card. Execution still calls the execute endpoint
   once per (selected) action; partial failures are surfaced per item.
5. **Errors** stay in-thread, plain-language, with a way forward ("Couldn't find
   that district — want me to search by name?") — never a raw error code.

---

## Section 3 — Entry point, header & overall feel

**Discoverability (all three):**
- **Nav entry** — Copilot joins the left nav so it's visible every session.
  Clicking it opens the rail (toggles `copilotOpen`); it is a launcher, not a
  route/tab.
- **Floating launcher** — the existing bottom-right pill, polished (soft shadow,
  brand plum), kept for one-tap access while working the map.
- **One-time coachmark** — on first login, a small dismissible tip points at the
  launcher ("Ask me what's slipping, or to log a call — I'm right here."). Shown
  once, then auto-expires via a persisted flag (localStorage); never nags.

**Header:**
- "New chat" gets a **text label** (most-used control; not a guess). History and
  Close stay as icons with accessible tooltips/aria-labels.

**Overall feel:**
- Brand plum + plum-derived neutrals throughout (no Tailwind grays); Lucide icons
  with `currentColor`; keep the existing slide-in animation and page-shrink split.
- Mobile = fullscreen sheet (unchanged), safe-area padding preserved.
- Narrow-width resilience: every text span in the new rows/cards gets
  `whitespace-nowrap` + a planned overflow (the 380px rail is itself a narrow
  column).

---

## Component decomposition

New / changed units, each with one clear purpose:

- `CopilotHomeState` (new) — greeting + nudges + suggested prompts + recent;
  rendered when the thread is empty. Owns no chat logic; calls back to seed a
  prompt or resume a thread.
- `useCopilotNudges()` (new hook) + `GET /api/copilot/nudges` (new route) — the
  light proactivity data.
- `CopilotProgress` (new) — friendly streaming label from `TurnEvent[]`
  (extracted/relabeled from `latestToolLabel`).
- `AnswerBlock` (refactor of `AnswerTable`) — table + "View on map" button.
- `ProposedActionCard` (refactor) — draft styling + settled/collapsed state.
- `BatchActionCard` (new) — grouped + expandable multi-action confirm.
- `CopilotLauncher` (refactor of the closed-state button) + first-run coachmark.
- AppShell nav entry — add a Copilot launcher item to the left nav.
- `CopilotPanel` stays the orchestrator (open/view state, send, history) but gets
  thinner as the above are extracted.

`CopilotActivityLog` (the audit "Activity log" view) is untouched.

## Data flow

- Open rail → `CopilotHomeState` mounts → `useCopilotNudges()` fetches
  `/api/copilot/nudges` (rep-scoped, cached for the session).
- Tap a nudge / chip → seed text into the composer state → existing
  `handleSend` → existing `/api/copilot/chat/stream` turn.
- Answer with leaids → "View on map" → existing `focusDistricts` + `setActiveTab`.
- Confirm (single or batch-selected) → existing
  `/api/copilot/actions/execute` per action → existing audit log.

No change to the stream route, agent loop, action registry, or execute route.

## Testing

- `useCopilotNudges` / nudges route: rep scoping, zero-count omission, ranking
  (at-risk before opportunity), shape of returned items. Unit-test each nudge
  query's predicate with fixtures.
- `CopilotProgress`: maps representative `TurnEvent` sequences to friendly labels;
  never emits a raw tool name.
- `AnswerBlock`: hides id columns; shows "View N on the map" only when leaids are
  present; button triggers focus.
- `BatchActionCard`: groups same-kind actions; unchecking excludes an item from
  the confirmed set; single action falls back to the single card.
- `CopilotHomeState`: renders greeting with the profile name; seeding a chip/nudge
  populates the composer; resuming a recent thread loads it.
- Coachmark: shows once, hidden after the persisted flag is set.
- Mobile: home state + cards scroll inside the fullscreen sheet (manual, real
  device per project rules).

## Open risks

- **Nudge data availability** — opportunity/pipeline fields for "deals slipping"
  and "stale-in-stage" must exist and be rep-scopable; if a nudge isn't backable
  by a real query, it's cut from v1 (not faked).
- **Stale-in-stage accuracy** — approximating time-in-stage from created date
  overstates age for deals that changed stage recently. Acceptable for a v1
  "worth a look" nudge; note it, don't present it as precise.
- **Nudge query cost** — keep the endpoint cheap (aggregate counts, indexed
  columns); it runs on every rail open.
