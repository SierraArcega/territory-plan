# Reports Iterative Chat — Design

**Date:** 2026-04-18
**Author:** Sierra + Claude
**Status:** Design approved, awaiting implementation plan

## Problem

The Reports tab chat treats every turn as an independent request. Each message is sent to `/api/ai/query/suggest` with only the raw question — no prior params, no chat history — and the response **replaces** the whole builder via `setParams(res.params)`.

Observed failure (2026-04-18): a user built a "top 40 customers" query over several turns, then typed "can we show the latest opp owner" expecting an added column. Claude, with no knowledge of the existing builder state, instead produced a fresh query for the most recently synced opportunity. The top-40 report was wiped out with no indication of what changed beyond an aggregate receipt ("Populated builder: 0 filters, 7 columns, 1 sort").

Two problems: **(1)** the chat doesn't actually iterate on the builder, and **(2)** the receipt doesn't show *what* changed.

## Goals

1. Every chat turn refines the existing builder instead of replacing it. The only way to reset is the "+ New report" button.
2. Claude has enough context to disambiguate refinement intent (prior messages + current builder state).
3. Claude can ask a short clarifying question when truly ambiguous, instead of guessing.
4. Each assistant reply shows a concrete action list of what was added, removed, or modified — not just aggregate counts.

## Non-goals

- No server-side heuristics that second-guess Claude's refinement decisions.
- No structured operations / patch format from Claude (decided in favor of full-params + client-side diff; see "Alternatives considered").
- No token-budget cap on chat history — accepted during the tuning phase. Revisit once core queries are dialed in.
- No chat-history persistence on saved reports. Saved reports restore params only; conversation starts fresh.
- No browser E2E tests. Vitest unit + component coverage matches existing convention.

## Decisions (from brainstorm)

| Question | Decision |
|---|---|
| Replace vs refine default? | **Always refine.** Reset only via "+ New report" button. |
| What context does Claude see each turn? | **Full chat history + current params**, during tuning. |
| Where does the action list come from? | **Client-side diff** of `prevParams` vs `newParams`. Claude returns full params; client computes the receipt. |
| Action-list visual style? | **Option B — tagged rows.** Green `add`, red `rem`, amber `mod` — tag + field + value. |
| Should Claude ever return without calling the tool? | **Yes** — for clarifying questions when a request is genuinely ambiguous. |

## Architecture

### Data flow (one refine turn)

```
User types message
  │
  ▼
handleSend(text)          [ReportsView.tsx]
  • append user message to local state
  │
  ▼
POST /api/ai/query/suggest
  body: { question, currentParams, chatHistory, conversationId? }
  │
  ▼
Server builds Anthropic messages:
  • system = buildSchemaPrompt() — cached by day (existing)
  • messages = [
      ...chatHistory.map({role, content}),
      { role: "user", content:
          `${question}\n\n<CURRENT_BUILDER>${JSON}</CURRENT_BUILDER>` },
    ]
  • tool_choice: { type: "auto" }   (was forced)
  │
  ▼
Claude → run_query tool call (params)  OR  text-only reply (clarify)
  │
  ▼
Server validates and responds (discriminated union):
  • { kind: "params", params, explanation }
  • { kind: "clarify", question }
  │
  ▼
Client:
  • if "params":
      diff = diffParams(prev, next)
      setParams(next)
      append assistant message with receipt.actions = diff
  • if "clarify":
      append assistant message with content = question, no receipt
```

### Key invariants

- `currentParams` is the source of truth. The schema prompt instructs Claude to preserve what still applies.
- The prompt-cache block (system prompt) is unchanged. Per-request messages change; prompt cache still hits.
- On any validation or network error, builder state is preserved.

## Server changes — `/api/ai/query/suggest`

### Request body (expanded)

```ts
interface SuggestRequestBody {
  question: string;
  currentParams?: QueryParams;
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  conversationId?: string;
}
```

### Response shape (discriminated)

```ts
type SuggestResponse =
  | { kind: "params"; params: QueryParams; explanation: string }
  | { kind: "clarify"; question: string };
```

### Anthropic call changes

1. `tool_choice: { type: "auto" }` — was `{ type: "tool", name: "run_query" }`. Required so Claude can choose to reply with text.
2. Messages: prior chat history verbatim, plus a final user turn with the question and an appended `<CURRENT_BUILDER>` block containing the JSON-stringified current params. If `currentParams` is absent (first turn), no `<CURRENT_BUILDER>` block is added and behavior matches today.

### Schema prompt additions (`schema-prompt.ts`)

Two new bullets, placed near the top rules (after the "Today's date" anchor):

- *"If the user already has a builder state (shown in `<CURRENT_BUILDER>`), modify it to reflect the new question. Preserve anything still relevant. Do not rebuild the query from scratch unless the user explicitly says to start over."*
- *"If a question is genuinely ambiguous or you need info to proceed, respond with a short clarifying question in plain text instead of calling `run_query`. Otherwise always prefer calling the tool with your best attempt and note the caveat in `explanation`."*

### Response handling

| Claude output | Server response | Status |
|---|---|---|
| `tool_use` + valid params | `{ kind: "params", ... }` | 200 |
| `tool_use` + invalid params | existing error shape (`{ error, details, rawParams, explanation }`) | 422 |
| text only (no tool_use) | `{ kind: "clarify", question: <text> }` | 200 |
| neither | `{ kind: "clarify", question: "I'm not sure what to build — could you rephrase?" }` | 200 |

### Query log

- Params path: log `params`, `sql=null`, `question=body.question` (existing).
- Clarify path: log `question=body.question`, `params=null`, `sql=null`, plus a marker in `question` or a new nullable `outcome` column (use a content prefix like `[clarify] ...` to avoid a schema migration for MVP).

## Client changes

### New module — `src/features/reports/lib/params-diff.ts`

```ts
export interface ReceiptAction {
  kind: "add" | "rem" | "mod";
  field: "table" | "join" | "column" | "filter" | "aggregation"
       | "groupBy" | "sort" | "limit";
  label: string;   // primary render text, e.g. "owner_name" or "stage = closed_won"
  detail?: string; // for mod, e.g. "revenue ↓ → take_amount ↓"
}

export function diffParams(
  prev: QueryParams | null,
  next: QueryParams,
): ReceiptAction[];
```

### Diff strategy — key by semantic identity, not position

| Field | Key | Detection |
|---|---|---|
| `table` | — | `add` if prev null; `mod` if name changed |
| `joins` | `toTable` | set difference (add / rem) |
| `columns` | column name | set difference |
| `filters` | `${column}:${op}` | add/rem by key; `mod` if value differs on matching key |
| `aggregations` | `alias ?? fn_column` | add/rem; `mod` if fn or column changed |
| `groupBy` | column name | set difference |
| `orderBy` | `column` | add/rem; `mod` if direction flipped |
| `limit` | — | `mod` only if both defined and differ |

Array order within a field is ignored — reordering produces no actions.

### `ReportsView.tsx` — `handleSend` updates

- Pass `currentParams: params` and `chatHistory: messages.map(toWireShape)` to the suggest mutation.
- Branch on response `kind`:
  - `"params"`: `diff = diffParams(params, res.params); await setParams(res.params);` append assistant message with `receipt.actions = diff` and `content = res.explanation`.
  - `"clarify"`: append assistant message with `content = res.question`, no receipt.
- Existing error path unchanged.

### `ui-types.ts` — `ChatMessageReceipt` shape

Replace `summary` + `counts` with `actions: ReceiptAction[]`:

```ts
export interface ChatMessageReceipt {
  actions: ReceiptAction[];
}
```

Legacy messages loaded from drafts may have a `receipt` without `actions` — treated as `[]` (renders prose only, no action block). No data migration needed.

### `ChatMessage.tsx` — render action list (option B)

- If `receipt?.actions?.length > 0`, render a bordered block below the prose with one row per action.
- Row: `[ tag ] <field>  <label>[  →  <detail>]`
- Tag colors:
  - `add` — green (`#E4F2EA` bg, `#2F7D50` text)
  - `rem` — red (`#FBE6E3` bg, `#B84135` text)
  - `mod` — amber (`#FDF4E6` bg, `#8A5A0B` text)
- If `receipt?.actions?.length === 0` (clarify, or identical params), no action block.

### Persistence

- Draft's `chatHistory` is `Json?` on `ReportDraft`. New `receipt.actions` round-trips as JSON with no schema change.
- On rehydrate, we use stored `actions` verbatim — diff is **not** re-run.

### What does NOT change

- `BuilderStrip` and all chip components.
- `Library`, `SaveModal`, `TopBar`.
- `/api/ai/query/run`, the params validator, the SQL compiler.
- The "+ New report" flow (already wipes params, messages, draft).

## Error handling & edge cases

| Case | Behavior |
|---|---|
| Invalid params from Claude (422) | Builder preserved. Existing error bubble: *"I couldn't translate that — …"*. |
| Network / Anthropic error (502/500) | Builder preserved. Error bubble. |
| No `currentParams` (first turn) | Server omits `<CURRENT_BUILDER>` block. Diff vs `null` → all-`add` actions. |
| Claude ignores refine instruction | Diff renders many rem+add actions. Loud but transparent. User can "+ New report". |
| Stacked clarifications | Each turn is independent; full chat history is always sent. |
| Long conversations | Token cost grows linearly. Accepted during tuning. |
| Legacy draft receipts | `actions` missing → treated as `[]`. No crash, no migration. |
| Race / double-send | `sending` flag disables input while a suggest is pending (existing). |

## Testing plan

### New unit tests — `params-diff.test.ts`

- Null `prev` → every field in `next` produces `add` actions.
- Identical params → empty array.
- `table` change → one `mod` action.
- Each field (joins, columns, filters, aggregations, groupBy, orderBy, limit):
  - pure add, pure remove, pure modify
  - reordered-but-equivalent → no actions
- Filter value change on same `column:op` key → `mod` (not add + rem).
- OrderBy direction flip → `mod` with `detail: "asc → desc"`.
- `limit: undefined → 100` → no action; `100 → 200` → `mod`.

### Updated integration test — suggest route

- Request with `currentParams` + `chatHistory` → mocked Anthropic client receives a final user message containing `<CURRENT_BUILDER>` with serialized params; prior messages forwarded in order.
- Request without `currentParams` → no `<CURRENT_BUILDER>` block.
- Claude text-only response → `{ kind: "clarify", question }`, 200.
- Claude valid `tool_use` → `{ kind: "params", params, explanation }`, 200.
- Claude invalid params → 422 (existing path).

### New component test — `ChatMessage.test.tsx`

- User message renders (existing behavior).
- Assistant with `actions: []` → prose only, no action block.
- Assistant with three actions (one of each kind) → all rendered with correct tag colors and labels.
- Legacy receipt without `actions` → treated as `[]`, no crash.

### Schema prompt test additions — `schema-prompt.test.ts`

- Contains "preserve anything still relevant" (refine rule).
- Contains "clarifying question" (clarify rule).

### Manual verification

- Reproduce the screenshot flow: build "top 40 customers", then ask "can we show the latest opp owner". Expect: single `add column owner_name` action, builder retains top-40 context.
- "+ New report" clears chat + params + draft.

## Alternatives considered

### Approach 2 — Claude emits operations (rejected)
Tool returns `operations: [{kind, field, value}, ...]`. Server applies ops to current params.
- Con: doubles the tool surface; need a server-side applier with its own failure modes.
- Con: "start over" vs "tweak one filter" are wildly different op shapes, complicating the schema.
- Con: duplicates the source of truth (ops vs resulting params) — if they disagree, subtle bugs.

### Approach 3 — Claude returns params + human-readable `changes` (rejected)
Tool returns `{ params, explanation, changes: string[] }`.
- Con: two sources of truth. Claude can hallucinate a change it didn't actually make, or omit one it did.
- Con: no structural data for coloring / grouping the receipt.

### Heuristic refine-vs-replace (rejected)
Server-side code inspecting the response for "too many changes → reject as accidental replace".
- Brittle. Legitimate large refines exist. User memory already mandates "builder is primary" — trust the model + receipt transparency instead.

### Token-budget cap on chat history (deferred)
Trim history to last N messages if estimated tokens exceed a threshold.
- Useful eventually. Not needed while still tuning core queries. Revisit when token cost becomes a real pain point.

## Rollout

No feature flag. Changes ship together:
1. New module (`params-diff.ts`) + tests.
2. Server endpoint accepts new fields, tool_choice becomes auto, response becomes discriminated.
3. Client passes `currentParams` + `chatHistory`, handles both response kinds.
4. `ChatMessage` renders action list; `ChatMessageReceipt` shape updated.
5. Schema prompt gets the two new bullets.

Because legacy receipts fall through gracefully (`actions: []` = prose only) and legacy server responses would come back as the old unshaped object (we're changing the server at the same time), there's no backward-compatibility surface to maintain.

## Open questions

None blocking. Follow-ups worth tracking:
- How often does Claude ask for clarification in practice? Inspect `query_log` after a week of use and decide whether the clarify path needs UI refinements (quick-reply buttons, etc.).
- Whether to add a "revert" action that restores `prevParams` from the last turn. Low priority — "+ New report" covers the severe case, and manual chip edits cover incremental backtracks.
