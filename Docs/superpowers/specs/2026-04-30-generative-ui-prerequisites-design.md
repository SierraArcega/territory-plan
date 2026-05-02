# Generative UI — Prerequisites Design

**Status:** Draft, awaiting review
**Date:** 2026-04-30

## Goal

Define what must be in place — technically, architecturally, and domain-wise — before the
Generative UI feature can be implemented successfully in the territory-plan reports interface.

Generative UI replaces the fixed chip summary + results table in the right panel with a
model-generated, fully interactive HTML page tailored to each query result. It lives alongside
the existing reports system as a **mode toggle**, not a replacement. Templates remain the
fast-path for known recurring questions; gen UI is the flexible path for ad-hoc and analytical
queries.

## Background

The core idea (from Leviathan et al., Google Research) is that instead of returning markdown,
the model returns a complete, runnable HTML page. For territory-plan, the architecture is
layered on top of the existing agent loop:

```
User prompt
  → Agent loop (existing) — SQL generation, schema exploration, data retrieval
  → Gen UI model call (new) — HTML page generation from query result
  → Sandboxed iframe (new) — progressive render in the right panel
```

The agent loop already handles the hard part reliably (SQL validation, hallucination guards,
conversation history). The gen UI layer is responsible only for presentation.

The pipeline hygiene questions from the PR #144 exploration
(`2026-04-28-pipeline-hygiene-report-builder-design.md`) are the north-star use case:
"which of my deals are stuck?", "how long do Won deals spend in Proposal?",
"is my pipeline healthy this quarter?" — rich analytical questions that benefit from
visualization, not a text bubble.

## Architecture decision: data flow

**Chosen approach: Option A (presentation-only) as the initial implementation, Option B
(live-fetching) as the longer-term direction.**

- **Option A:** Agent loop runs first, returns rows + columns + summary. The gen UI model
  call receives that data payload and generates HTML with the data baked in. The iframe
  makes no live API calls. Safe, simple, buildable immediately.
- **Option B:** Generated HTML calls domain API endpoints (e.g., `/api/opportunities/pipeline-hygiene`)
  at render time, enabling live filters and drill-down. Requires domain API routes to exist and
  an auth strategy for the iframe. This is the target once domain APIs are built.

The prerequisites below are scoped to Option A with explicit callouts where Option B adds
requirements.

---

## Layer 0 — Security

**Must be correct before any generated HTML is rendered. All subsequent layers depend on this.**

### Decision: Sandbox boundary

The `sandbox` attribute on the iframe controls what generated scripts can do.

| Option | Attributes | Risk |
|---|---|---|
| Recommended | `allow-scripts` only | JS runs; no parent-frame access, no cookie access, no form submission |
| Forbidden | `allow-scripts allow-same-origin` | JS + same-origin = generated scripts can read session cookies |

**Decision: `sandbox="allow-scripts"` only. Never add `allow-same-origin`.**

When live-fetching (Option B) is needed, auth is handled via a short-lived signed token
embedded in the HTML by the server. The generated JS sends it as a `Bearer` header —
not via cookies, not via `allow-same-origin`.

### Decision: Streaming mechanism

Two approaches to stream model-generated HTML into a sandboxed iframe:

| Option | Mechanism | Requires same-origin? |
|---|---|---|
| Recommended | Render URL | No |
| Alternative | `document.write()` into iframe | Yes (incompatible with above) |

**Decision: Render URL.**

The client opens the iframe pointing to `/api/gen-ui/render/[sessionId]`. That endpoint
streams the HTML as it arrives from the model. The browser handles progressive rendering
natively. CSP is enforced via HTTP response headers on the render endpoint, not embedded
in the HTML (though the post-processor also injects a `<meta>` CSP tag as belt-and-suspenders).

### CSP policy

Applied as an HTTP header on `/api/gen-ui/render/[sessionId]`:

```
Content-Security-Policy:
  default-src 'none';
  script-src 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com;
  style-src 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'none';
  frame-src 'none';
```

`connect-src 'none'` enforces Option A. When transitioning to Option B, this becomes
`connect-src 'self'` (same-origin fetches only). Path-level restriction to `/api/gen-ui/`
is enforced at the route level via auth, not via CSP (CSP `connect-src` takes origins, not paths).

### Done definition

A `<GenUIFrame>` component exists that accepts a `sessionId` and renders an iframe
pointed at `/api/gen-ui/render/[id]` with the correct `sandbox` attribute. CSP headers
are set on the render endpoint. A security review confirms: no parent-frame access
possible, no session data reachable, an arbitrary malicious HTML string cannot
compromise the parent app.

---

## Layer 1 — Core Pipeline

**The fundamental mechanics: how requests flow, how HTML is generated, how it reaches
the iframe.**

### Decision: Backbone model

Model capability for HTML generation is emergent — error rates vary dramatically by model.

| Model | Recommendation |
|---|---|
| `claude-sonnet-4-6` | Default. Fast, cost-effective, solid HTML output. |
| `claude-opus-4-7` | Fallback for complex visualizations if sonnet output quality is lacking. |
| `claude-haiku-4-5` | Not recommended. Error rate on complex HTML is too high. |

**Decision: `claude-sonnet-4-6` as default.** The model is a named constant
(`GEN_UI_MODEL` in `src/features/reports/lib/gen-ui/config.ts`), not hardcoded, so it
can be swapped without touching pipeline code.

### Decision: Data payload format

The agent loop can return up to 500 rows. Passing all rows to the gen UI model is
expensive and slow.

**Decision: Sampled payload.** Pass up to 100 rows plus a summary object:

```typescript
type GenUIDataPayload = {
  columns: string[]
  rows: Record<string, unknown>[]   // up to 100
  summary: {
    totalRowCount: number
    columnTypes: Record<string, 'string' | 'number' | 'date' | 'boolean'>
    numericStats: Record<string, { min: number; max: number; avg: number }>
  }
  querySummary: QuerySummary        // source table, active filters, sort — from agent loop
}
```

100 rows covers nearly every rep-level view. The `summary` object ensures the model
understands the full dataset scope even when rows are truncated. `querySummary` tells
the model what was queried, not just what the rows contain.

### Decision: Post-processor timing

Post-processors need the full HTML document to operate correctly (Tailwind fixes, CSP
injection, etc.). Since we're streaming, the document isn't complete until generation
finishes.

**Decision: Stream raw output first, post-process after.**

The render endpoint streams raw model output to the iframe during generation. After
generation completes, post-processors run on the full document. The post-processed
HTML is the artifact used for any future "save" or "export" flow — not the iframe
during live generation.

**MVP post-processors (required before first deploy):**

1. **CSP meta injection** — insert `<meta http-equiv="Content-Security-Policy" ...>` in
   `<head>` as belt-and-suspenders alongside the HTTP header.
2. **Error reporting injection** — inject a small `<script>` that catches uncaught errors
   and surfaces them to the parent via a safe message channel (not `window.parent`).
3. **Tailwind CDN injection** — ensure `<script src="https://cdn.tailwindcss.com">` is
   present even if the model omitted it.

Remaining post-processors from the integration spec are deferred to Phase 2.

### API surface

| Route | Method | Purpose |
|---|---|---|
| `/api/gen-ui/generate` | `POST` | Accept `{ prompt, data: GenUIDataPayload }`, call gen UI model with streaming, write chunks to session store, return `{ sessionId }` |
| `/api/gen-ui/render/[sessionId]` | `GET` | Stream stored chunks with CSP headers; serve complete post-processed HTML once generation is done |

### Done definition

`POST /api/gen-ui/generate` accepts a prompt and data payload, calls `claude-sonnet-4-6`
with streaming, writes chunks to a session store keyed by session ID. `GET /api/gen-ui/render/[sessionId]`
streams those chunks with correct CSP headers. The post-processor pipeline exists as a
composable `(html: string) => string` chain in
`src/features/reports/lib/gen-ui/post-processors.ts`. All three MVP processors are
implemented and tested.

---

## Layer 2 — Domain Context

**What separates a generic HTML renderer from one that understands territory-plan data.**

### Decision: Where domain context lives

The agent loop system prompt handles querying knowledge (schema, joins, SQL patterns for
`stage_history`). The gen UI system prompt handles presentation knowledge — what the data
means visually, when to show warnings, how to label values.

**Decision: Both system prompts carry domain knowledge, with clear separation.**

- Agent loop system prompt: querying, schema exploration, SQL correctness.
- Gen UI system prompt: presentation, warnings, labeling, visualization choices.

They share domain facts but serve different purposes.

### Decision: Static vs. dynamically injected context

**Decision: Static domain facts in the system prompt file; per-request context injected
at call time.**

Static (committed to the system prompt file, versioned independently):
- `is_stale` semantics — `is_stale=true` means "still ticking" (segment is current),
  not "outdated." Duration values for `is_stale=true` rows are snapshots from last
  sync, not final.
- Stage threshold model — per-stage p90 thresholds from PR #144 exploration:
  Meeting Booked 30d, Discovery 60d, Presentation 45d, Proposal 45d,
  Negotiation 30d, Commitment 30d. A deal past threshold is a prompt to review,
  not a disqualification.
- Migration cohort caveat — a 2025-08-18 bulk-import cluster exists where
  `changed_at` is synthesized (not real transition timestamps). Surface a warning
  banner when ≥10% of result rows fall into this cohort.
- Legacy stage taxonomy — stages like "Position Identified" coexist with the canonical
  6. Surface without staleness signals; note when present.
- Refresh cadence — data refreshes every 30 minutes from an upstream writer. This
  repo only reads. Surface as "data freshness" context.

Dynamic (injected at request time via `%%%PLACEHOLDER%%%` substitution):
- `%%%DATE%%%` — current date
- `%%%USER%%%` — current rep name
- `%%%QUERY_SUMMARY%%%` — JSON-serialized `QuerySummary` from the agent loop
  (source table, active filters, column metadata, row count)

### System prompt file location

`src/features/reports/lib/gen-ui/system-prompt.ts`

Versioned independently from the agent loop's `system-prompt.ts`. The gen UI system
prompt is the highest-leverage component — it should be treated as a first-class
artifact, not an implementation detail.

### Done definition

`src/features/reports/lib/gen-ui/system-prompt.ts` exists with a static Domain Context
section covering all five facts above. Dynamic injection points exist for date, user,
and query summary. The file is independently versioned. A test confirms dynamic
substitution works correctly before the first model call.

---

## Layer 3 — Integration

**How gen UI plugs into the existing reports UI.**

### Decision: Mode toggle placement and persistence

**Decision: Reports header toggle.** Gen UI is a view-level mode, not a per-result
option. The toggle persists the user's preference in localStorage so it survives
page reloads. Switching modes does not clear conversation history or the current
result — it only changes the rendering path for new queries.

### Decision: Loading states

Two sequential model calls require two distinct loading phases communicated to the user.

**Decision: Two-phase progress indicator in the right panel.**

| Phase | Message | When |
|---|---|---|
| 1 | "Analyzing your question…" | Agent loop running (existing behavior) |
| 2 | "Generating visualization…" | Gen UI model running (new) |

The agent loop's `assistantText` appears in the chat panel as soon as phase 1 completes,
giving the user something to read while phase 2 runs. The right panel shows phase 2
loading state until the iframe begins streaming.

### Decision: Fallback behavior

When gen UI fails (model error, post-processor rejection, timeout, broken HTML):

**Decision: Explicit fallback with notice.** Show the standard chip summary + results
table (the data is fine), with a small notice: "Visualization failed — showing standard
view" and a Retry button. Silent fallback is confusing; a hard error with no result is
too punishing when the data came back successfully.

### Decision: Eval criteria

Before gen UI mode is surfaced to users, 10 seed prompts must pass a defined bar.

**Seed prompts** (drawn from PR #144 question types, committed alongside this spec):
1. "Which of my deals are stuck right now?"
2. "How long do Won deals typically spend in Proposal?"
3. "Show me stage velocity across all stages for Won vs Lost deals"
4. "Which reps have the most stale deals this school year?"
5. "What's my pipeline health this quarter?"
6. "How many open deals do I have past threshold, and what's the total booking at risk?"
7. "Show me the Won-deal benchmark distribution for Discovery stage"
8. "Which deals entered Negotiation more than 30 days ago and haven't moved?"
9. "Compare my stage velocity to the team average"
10. "Give me a summary of pipeline hygiene for all reps"

**Pass criteria for each prompt:**
- No render errors (iframe loads without JS exceptions)
- No hallucinated values (spot-check 3 data points against raw rows)
- Interactive elements (buttons, toggles, filters in the generated page) function
- Loads within 2 minutes end-to-end
- Gen UI version is more useful than the table for at least 7 of 10 prompts (subjective,
  reviewed by at least one sales rep)

### Done definition

Mode toggle exists in the reports header, persists preference, switches rendering path
for new queries without clearing conversation. Two-phase loading states render in the
right panel. Fallback to standard view on gen UI failure with explicit notice and Retry
button. All 10 seed prompts pass eval criteria before gen UI mode is exposed to users.

---

## Build order

These layers have hard dependencies:

```
Layer 0 (Security)
  └─ Layer 1 (Core Pipeline)
       └─ Layer 2 (Domain Context)
            └─ Layer 3 (Integration)
```

No layer should be started before the previous layer's done definition is met.

## Open questions

1. **Session store for streaming chunks** — in-memory (Map) is fine for the spike;
   Redis is needed for production if multiple instances are running. Decide before
   deploying beyond a single instance.
2. **Token budget ceiling** — `claude-sonnet-4-6` with a 100-row payload + domain
   context system prompt: estimate token count before committing to cost. May need
   a hard `max_tokens` cap on the gen UI call.
3. **Option B transition timing** — live-fetching requires domain API routes (pipeline
   hygiene, stage velocity, etc.) and an auth strategy (short-lived signed token).
   Track as a separate spec once Option A is validated.
4. **Seed prompt authorship** — the 10 eval prompts should be reviewed by a sales rep
   before implementation begins to ensure they reflect real question patterns.

## Reference

- Integration guide: `generative-ui-integration.md` (from prior Claude session)
- Pipeline hygiene exploration: `Docs/superpowers/specs/2026-04-28-pipeline-hygiene-report-builder-design.md`
- Paper: *Generative UI: LLMs are Effective UI Generators*, Leviathan et al., Google Research
