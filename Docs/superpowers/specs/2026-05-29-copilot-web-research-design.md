# Copilot Web Research — `web_search` + `web_fetch` (Phase 1)

**Date:** 2026-05-29
**Status:** Design — approved, pending spec review
**Branch:** `feat/ai-copilot-core-objects`

## Context

The copilot today answers questions from internal data (`run_sql` → table) and
proposes writes (`propose_actions` → confirm cards). It cannot reach the public
web. Reps routinely need external, public facts about their districts — bond
measures and funding, superintendent/board changes, ed-tech news, grant
announcements — that simply aren't in our database.

This is **Phase 1** of a larger "add tools to the copilot" effort. The full set
(web research, `district_brief`, `plot_on_map`, a write/action tool) was
decomposed into sequential phases, each with its own spec → plan → implement
cycle. Phase 1 ships web research because it's the original ask, the highest
value, and `web_search` + `web_fetch` share one new requirement — a prose
answer-with-citations output path — so building them together is efficient.

Later phases are out of scope here:
- **Phase 2** — `district_brief` (read tool, benefits from this prose path).
- **Phase 3** — `plot_on_map` (must first reconcile with the query→map district
  plotting already on this worktree; parked).
- **Phase 4** — a confirm-before-write action tool.

## Goals

- The copilot can autonomously research the public web when external/public
  information would help answer a rep's question, interleaving web tools with
  the existing SQL tools in a single turn.
- Research answers render as clean prose followed by a compact, numbered
  **Sources** list — every external claim is grounded in a citation.
- Cost and source quality are bounded: ≤5 searches per turn, soft steer toward
  authoritative sources.
- Zero behavior change for the `reports` and `list-builder` agent variants that
  share the same loop.

## Non-Goals

- Hard domain allow/blocklists enforced at the API level (we use a system-prompt
  soft steer instead).
- Using web tools for internal data — that stays on `run_sql`.
- Caching or de-duplicating web results across turns.
- `district_brief`, `plot_on_map`, write actions (later phases).
- Bumping the model version (`claude-opus-4-7` is retained).

## Product Decisions (settled during brainstorming)

| Decision | Choice |
| --- | --- |
| **Trigger** | **Autonomous** — the model decides when external info helps. Internal questions still go to SQL. Boundary lives in the system prompt. |
| **Guardrails** | **Capped (~5 searches/turn) + prefer authoritative** — soft system-prompt steer toward `.gov`/`.edu`/official district + reputable news. No API-level domain list. |
| **Presentation** | **Prose + Sources list** — clean prose answer, then a numbered Sources list (favicon + site name + page title, each a link). No inline footnote markers. |

## Architecture

`web_search` / `web_fetch` are Anthropic **server-side** tools: the model emits
a `server_tool_use` block, Anthropic executes the search/fetch and streams back
`web_search_tool_result` / `web_fetch_tool_result` blocks, often with a
`pause_turn` stop reason mid-execution. We do **not** execute these tools — we
only need the loop to (a) continue across `pause_turn` and (b) recognize a
server-tool turn and emit a new prose result.

Because the model must interleave web tools with the existing SQL/lookup tools
in one turn, both toolsets live in the **same** `runAgentLoop`. We extend the
shared loop rather than forking a copilot-only path. Two safeguards keep the
blast radius near zero:

1. Web tools are added **only** to `COPILOT_TOOLS`; the `reports` and
   `list-builder` tool sets are untouched.
2. `pause_turn` handling and server-tool detection are **no-ops** unless server
   tools actually run, so other variants behave identically.

### Rejected alternatives

- **Copilot-only wrapper loop** — duplicates loop logic and fights the
  interleaving of web + SQL tools.
- **A fake `web_research` terminal tool that calls Anthropic internally** —
  re-implements what server tools already do natively; no benefit.

## Components

### 1. Tool definitions — `src/features/copilot/lib/tools.ts`

> **SDK note (verified by live probe against `@anthropic-ai/sdk@0.90`):** both
> `web_search_20250305` and `web_fetch_20250910` are accepted on the **stable**
> `anthropic.messages` endpoint with **no beta header** (both returned HTTP 200).
> The stable `Anthropic.ToolUnion` already includes `WebFetchTool20250910` and
> `WebSearchTool20250305`. There is **no beta endpoint, no `betas` arg, and no
> `web-fetch-2025-09-10` header** in this design.

Add two server-tool definitions (stable SDK types) and append them to the
copilot tool set:

```ts
const webSearch: Anthropic.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
};

const webFetch: Anthropic.WebFetchTool20250910 = {
  type: "web_fetch_20250910",
  name: "web_fetch",
  max_uses: 5,
  citations: { enabled: true },
  max_content_tokens: 50_000,
};

export const COPILOT_TOOLS: Anthropic.ToolUnion[] = [
  ...AGENT_TOOLS,
  webSearch,
  webFetch,
  proposeActions,
];
```

- No `allowed_domains` / `blocked_domains`. Authority preference is a
  system-prompt steer.
- `max_content_tokens` caps how much fetched page content enters context.

### 2. Agent loop — `src/features/reports/lib/agent/agent-loop.ts`

- **Tool-arg type widened.** No endpoint change — keep `anthropic.messages.stream`.
  The `tools` arg widens from `Anthropic.Tool[]` to `Anthropic.ToolUnion[]` so the
  web tools fit with no casts; `Anthropic.Tool[]` (reports/list-builder) is
  assignable to it, so their behavior is unchanged.
- **`pause_turn` continuation.** After `finalMessage()`, if
  `stop_reason === "pause_turn"`: push `response.content` onto `messages` and
  `continue` (server tools can pause the turn on the stable endpoint too).
  A pause-continuation cap bounds it so it cannot spin.
- **Server-tool awareness.** Set a `usedServerTools` flag whenever a response
  contains a `server_tool_use` block. Server-tool *result* blocks are not
  `type: "tool_use"`, so the existing client-tool loop already ignores them — we
  must **not** fabricate `tool_result` blocks for them.
- **Research classification at exit.** When the model finishes with text and no
  client `tool_use` (today → `clarifying`): if `usedServerTools` is true, return
  the new `kind: "research"` carrying `assistantText` + extracted `citations`.
  Otherwise return `clarifying` exactly as today. `reports`/`list-builder` never
  set `usedServerTools`, so they can never produce `research`.
- **Citation extraction.** Walk the text blocks' `citations[]`
  (`web_search_result_location` / page-location citations), pull `url` + `title`,
  dedupe by `url`, preserve first-seen order. Helper:
  `extractCitations(content): CopilotCitation[]`.

`AgentResult` union gains:

```ts
| { kind: "research"; assistantText: string; citations: CopilotCitation[] }
```

### 3. Types + SSE — `src/features/copilot/lib/types.ts`, stream route

```ts
export interface CopilotCitation {
  url: string;
  title: string;
}
```

`CopilotTurnResult` gains:

```ts
| {
    kind: "research";
    conversationId: string;
    assistantText: string;
    citations: CopilotCitation[];
  }
```

The stream route (`src/app/api/copilot/chat/stream/route.ts`):
- Maps `result.kind === "research"` → `send("result", { kind: "research", ... })`.
- `saveCopilotTurn` persists research turns (`assistantText` + telemetry). Live
  citation links are not persisted; replay shows the prose. The "researched the
  web — N sources" replay note is deferred (needs a `copilotTurn` discriminator
  column).

### 4. Frontend — `ResearchAnswer.tsx` + `CopilotPanel.tsx`

New `src/features/copilot/components/ResearchAnswer.tsx`:
- Renders the prose `assistantText` (existing markdown rendering path).
- Below it, a compact **Sources** list: numbered, each row = favicon + site
  name + page title, the whole row a link (`target="_blank"`, `rel="noopener
  noreferrer"`).
- Favicon via a lightweight favicon URL derived from the source host; fall back
  to a Lucide globe icon on load error.
- Fullmind brand tokens only (plum neutrals, no Tailwind grays). Narrow-width
  resilient: `whitespace-nowrap` on labels with `overflow-x-auto`/truncation so
  it survives the squeezed copilot panel and mobile.

`CopilotPanel.tsx`: handle `res.kind === "research"` alongside `answer` /
`actions` / `clarifying`, storing `assistantText` + `citations` on the message
and rendering `<ResearchAnswer />`.

### 5. System prompt — `src/features/copilot/lib/system-prompt.ts`

Add a **Web research** section:
- You can research the public web with `web_search` and `web_fetch`.
- Use it for external/public facts: district news, bond/funding measures,
  superintendent/board changes, grant announcements, ed-tech trends.
- **Never** use it for internal data (plans, activities, contacts, district
  records) — that is always `run_sql`.
- Prefer authoritative sources: official district sites, `.gov`/`.edu`,
  reputable news. Avoid forums and social media.
- Ground every external claim in a citation; do not assert unsourced facts.
- Keep it to at most ~5 searches per turn.

## Data Flow

1. Rep asks a question that needs external info.
2. Loop runs; model interleaves `run_sql`/lookup tools (internal) and
   `web_search`/`web_fetch` (external) as needed. Server tools may trigger one
   or more `pause_turn` continuations.
3. Model emits a final text answer with `citations[]` and no client tool_use.
4. Loop returns `kind: "research"` with `assistantText` + deduped `citations`.
5. Stream route emits the `research` SSE result and persists the turn.
6. Panel renders `<ResearchAnswer />` — prose + numbered Sources list.

## Error Handling

- **Server tool failure / no results.** The model produces its best-effort text
  answer; `citations` may be empty → Sources list is omitted, prose still shows.
- **`pause_turn` loop bound.** Reuses the existing iteration ceiling; a runaway
  server-tool sequence surrenders with the standard message rather than spinning.
- **Beta endpoint unavailable / web_fetch error.** Surfaced through the existing
  loop error path → `error` SSE event; the panel shows the standard error state.
- **Citations missing `title`.** Fall back to the URL host as the label.

## Testing

Vitest, co-located in `__tests__/`:
- **Loop:** `pause_turn` causes continuation (content pushed, loop re-enters);
  a turn with `server_tool_use` + final text → `kind: "research"`; a turn with
  no tools at all → `clarifying` (unchanged); `reports` variant never yields
  `research`.
- **Citations:** `extractCitations` pulls url/title, dedupes by url, preserves
  order, falls back to host when title missing.
- **Tools:** `COPILOT_TOOLS` includes `web_search` + `web_fetch`; `AGENT_TOOLS`
  does not (reports/list-builder unaffected).
- **Frontend:** `ResearchAnswer` renders prose + a numbered Sources list with
  working links; omits the list when `citations` is empty; favicon falls back to
  the globe icon on error.

## Rollout / Where

Built on the existing `feat/ai-copilot-core-objects` worktree (the copilot's
home — 12 commits ahead of `main`, already pushed). Small, focused commits; no
model-ID trailers in commit messages.
