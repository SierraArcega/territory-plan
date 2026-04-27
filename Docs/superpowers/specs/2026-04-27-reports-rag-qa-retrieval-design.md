---
name: Reports RAG Q&A Retrieval — Design Spec
description: Add semantic retrieval of curated Q&A pairs to the Reports agent loop so Claude grounds answers in institutional knowledge instead of re-exploring every conversation
type: design
---

# Reports RAG Q&A Retrieval — Design Spec

**Date:** 2026-04-27
**Status:** Design proposed, awaiting plan
**Branch (target):** `feat/db-readiness-query-tool` (or follow-up branch off it)
**Predecessor:** `specs/2026-04-21-query-tool-agentic-redesign.md`

## TL;DR

The Reports tab today re-discovers the business every conversation. We add a curated corpus of ~30–50 hand-authored Q&A pairs ("when someone asks about X, here's the right tables, here are the gotchas, here's reference SQL") stored as markdown files, embedded via Voyage AI, and indexed in Postgres via `pgvector`. The agent loop embeds the user's first message, retrieves the top-3 most-similar pairs, and folds them into the system prompt before Claude responds. Follow-up turns don't auto-retrieve, but Claude can call a new `search_examples` tool on demand. v1 is corpus-only; the schema is named generically (`rag_documents` with a `source` column) so a future lane for embedded saved reports drops in without migration.

## Origin — what RAG fixes vs. doesn't

The current Reports agent loop is a strong tool-call architecture (`src/features/reports/lib/agent/agent-loop.ts`) but its retrieval primitives — `search_metadata`, `search_saved_reports` — rank by token-substring overlap, not semantic similarity. This means:

1. **Synonym misses:** A user asking about "bookings broken down by customer" can fail to surface a `SEMANTIC_CONTEXT` mapping authored as "revenue stream separation."
2. **Concept re-discovery every turn:** Each new conversation starts cold. Claude figures out which table to use for pipeline, hits the EK12 add-on gotcha, infers the matview preference — every time.
3. **Mandatory warnings hardcoded:** All 7 cross-table warnings inject into every system prompt regardless of which tables the question touches. ~250 tokens/turn of irrelevant signal.

RAG over a curated Q&A corpus addresses (1) and (2) directly. (3) is fixed in a separate follow-up (adaptive warning injection) explicitly out of scope here.

**What RAG does NOT fix and is not in this spec:**
- Streaming responses (still 20s "Thinking…" — separate spec, immediate next priority)
- Adaptive warning injection (1-day cleanup — separate spec)
- Saved-report semantic retrieval (lane 2 — schema-supported here, not built)
- User feedback loop (thumbs-up/down on answers — separate spec)
- Migrating `SEMANTIC_CONTEXT` into corpus form (follow-up after corpus authoring stabilizes)

This spec ships the *consistency / trust* layer. The *speed / feel* layer is its own work.

## Scope (v1)

**In scope:**
- New markdown corpus directory at `src/features/reports/lib/qa-corpus/`
- New Postgres table `rag_documents` with `pgvector` extension
- Voyage AI embedding pipeline (build-time + dev watch)
- Top-3 retrieval injected into system prompt on the *first* user turn of a conversation
- New `search_examples` tool exposed to Claude for follow-up turns
- Eval harness with retrieval-quality test cases
- Feature flag for A/B between "with examples" and "without"
- Sync script (`npm run rag:sync`) to re-embed corpus
- Initial corpus of 30–50 entries (authored collaboratively in two ~90-minute sessions with the product owner)

**Out of scope:**
- Saved-report embeddings (lane 2 — designed-for via `source` column, not populated)
- `SEMANTIC_CONTEXT` migration into corpus
- Adaptive injection of mandatory warnings
- Streaming / SSE
- Feedback UI (thumbs-up/down)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  src/features/reports/lib/qa-corpus/                            │
│  ├── pipeline-by-customer.md                                    │
│  ├── win-rate-by-rep.md                                         │
│  └── … (~30–50 files)                                           │
└────────────────────────┬────────────────────────────────────────┘
                         │ npm run rag:sync (build / dev watch)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Voyage AI embeddings API                                       │
│  voyage-3-large (1024-dim)                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │ upsert
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Postgres + pgvector                                            │
│  rag_documents (id, source, content, embedding, metadata, …)   │
│  source = 'qa_pair' for v1                                      │
│  source = 'saved_report' reserved for lane 2                    │
└────────────────────────┬────────────────────────────────────────┘
                         │ cosine similarity, top-3, threshold-gated
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  agent-loop.ts (modified)                                       │
│  - Turn 1: retrieve, inject as ## Examples in system prompt     │
│  - Turn N>1: search_examples tool available on demand           │
└─────────────────────────────────────────────────────────────────┘
```

## Q&A Pair Format

Each pair is a markdown file with YAML frontmatter. File name = `id` (kebab-case).

```markdown
---
id: pipeline-by-customer
question: Show me my pipeline broken down by customer
also_phrased_as:
  - what deals do I have open by district
  - pipeline by account
  - opportunities grouped by school district
tables: [opportunities, districts]
gotchas:
  - EK12 add-on opportunities can double-count with master deals — exclude or join carefully
  - Stage names are mixed (some snake_case, some Title Case) — use the normalized stage view
---

# How to answer

Group `opportunities_clean` by `district_id`, sum `amount`, filter to open stages.
Use the matview, not the raw `opportunities` table.

## Reference SQL

```sql
SELECT d.name, SUM(o.amount) AS pipeline_value
FROM opportunities_clean o
JOIN districts d ON o.district_id = d.leaid
WHERE o.stage_normalized IN ('prospecting','negotiation','proposal')
GROUP BY d.name
ORDER BY pipeline_value DESC;
```
```

**Required fields:** `id`, `question`, `tables`, `gotchas` (may be empty array).
**Optional fields:** `also_phrased_as`, body prose, reference SQL.
**Embedding input:** concatenation of `question`, `also_phrased_as` (joined by newlines), and the body prose. SQL block is *not* embedded — it's retrieved with the rest as context but doesn't bias similarity.

## Data Model

### New table: `rag_documents`

```prisma
model RagDocument {
  id         String                @id @default(uuid()) @db.Uuid
  source     String                // 'qa_pair' (v1) or 'saved_report' (future)
  sourceRef  String                @map("source_ref") // 'pipeline-by-customer' or saved_report uuid
  content    String                // full markdown body for re-embedding + retrieval display
  metadata   Json                  // frontmatter as JSON: { question, tables, gotchas, sql, … }
  embedding  Unsupported("vector(1024)")
  createdAt  DateTime              @default(now()) @map("created_at")
  updatedAt  DateTime              @updatedAt      @map("updated_at")

  @@unique([source, sourceRef])
  @@index([source])
  @@map("rag_documents")
}
```

`pgvector` extension enabled via raw SQL migration (Supabase has it bundled). HNSW index on `embedding` for cosine similarity:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE rag_documents (...);
CREATE INDEX rag_documents_embedding_idx
  ON rag_documents
  USING hnsw (embedding vector_cosine_ops);
```

`@@unique([source, sourceRef])` lets the sync script upsert by markdown file id without colliding with future saved-report embeddings.

### Why one table, not two

- Same retrieval code path serves both lanes
- Same embedding pipeline (only the input text differs by source type)
- Lane 2 onboarding is "populate rows with `source='saved_report'` on save" + a small filter at retrieval time — no new migration

### Modified table: `query_log` — new `agent_metadata` column

We need a place to log per-turn agent telemetry (which Q&A pairs were retrieved, similarity scores, threshold hits/misses) for the soak observation period and for future debugging. The existing `params` column on `QueryLog` is already overloaded with the chip summary — folding retrieval results in there muddles its meaning.

Add a generic JSON column:

```prisma
model QueryLog {
  // ... existing fields ...
  agentMetadata  Json?  @map("agent_metadata")  // retrieval results, future telemetry
}
```

For v1, the only thing written here is:
```ts
{
  retrievedExamples: [
    { id: "pipeline-by-customer", similarity: 0.74 },
    { id: "win-rate-by-rep",      similarity: 0.62 },
  ],
  retrievalThreshold: 0.6,
  retrievalSource: "turn_1_auto" | "search_examples_tool",
}
```

Future agent telemetry (token counts, cache hit ratios, etc.) lands here without another migration.

## Data Flow

### Turn 1 of a conversation

"Turn 1" is detected as `priorTurns.length === 0` (the array returned by `loadPriorTurns()` in `agent/conversation.ts`). A `conversationId` is always present — the route generates one for new conversations — so its presence is not a useful signal.

1. `POST /api/ai/query/chat` calls `runAgentLoop()`
2. `runAgentLoop` checks `priorTurns.length === 0`. If so, server embeds the user message via Voyage (`voyage-3-large`, ~150ms)
3. pgvector cosine query: `SELECT * FROM rag_documents WHERE source='qa_pair' ORDER BY embedding <=> $1 LIMIT 3`
4. Filter: drop any result with similarity below threshold (initial: `0.6` cosine — tunable)
5. If ≥1 pair survives the threshold, render them into a *separate* system-prompt cache block (see "System prompt cache strategy" below). The block is titled `## Examples that may be relevant for this question` and explicitly framed as hints, not directives — see "Examples as hints, not authoritative" below.
6. Claude responds as today

### System prompt cache strategy

`agent-loop.ts:70` already passes `system` as an array of cache blocks. We split the system prompt into **two cache blocks** so the static portion still hits cross-user cache:

```ts
system: [
  // Block 1: stable across all users + conversations.
  // Hits cross-user prompt cache.
  {
    type: "text",
    text: STATIC_BASE_PROMPT, // table list + rules + mandatory warnings
    cache_control: { type: "ephemeral" },
  },
  // Block 2: varies per conversation (retrieved examples).
  // Hits within-conversation cache only (because retrieval fires on turn 1
  // and the conversation reuses the same examples on follow-up turns).
  // Omitted entirely when retrieval returns nothing above threshold.
  ...(retrievedExamples.length > 0
    ? [{
        type: "text",
        text: renderExamplesBlock(retrievedExamples),
        cache_control: { type: "ephemeral" },
      }]
    : []),
]
```

This is meaningfully better than a single combined block, which would invalidate the cross-user cache on every conversation.

### Examples as hints, not authoritative

The existing system prompt (`agent/system-prompt.ts:17–25`) demands `search_metadata` + `describe_table` + `get_column_values` before `run_sql`. This was hardened after a failure where Claude guessed a column name (per handoff doc, item 7). Injected examples must NOT weaken that discipline.

The example block must open with explicit framing along the lines of:

> *"Examples below show paths that worked for similar past questions. Treat them as starting points, not authoritative — they may be stale, and your question may differ in ways that matter. Still call `describe_table` on any table you reference if you haven't already this conversation. If an example contradicts what `describe_table` returns, trust the live schema."*

This framing is part of the implementation, not an open question — the spec mandates it. The system prompt update (in `system-prompt.ts`) should also reference the new `## Examples that may be relevant for this question` block by name, so Claude knows where to look and how to weight it.

### Turn N > 1

1. No auto-retrieval (the original 3 pairs are still in conversation history)
2. New tool `search_examples` available to Claude:

```typescript
{
  name: "search_examples",
  description: "Search the curated Q&A corpus for examples similar to a query. Use when the user asks something different from the original question or you need additional grounding.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural-language search query" },
      limit: { type: "integer", default: 3, maximum: 10 }
    },
    required: ["query"]
  }
}
```

3. Tool handler embeds the query, runs the same cosine search, returns the top-N pairs as structured tool result content
4. Counts against the existing 20-exploratory-call cap

### Sync flow

`npm run rag:sync`:
1. Walks `src/features/reports/lib/qa-corpus/` for `*.md` files
2. Parses frontmatter (yaml) + body (markdown)
3. Validates required fields, fails loudly on missing `id` / `question` / `tables`
4. For each file: builds embedding input (question + also_phrased_as + body), calls Voyage embed API, upserts row keyed on `(source='qa_pair', sourceRef=id)`
5. Removes rows in DB whose `sourceRef` no longer corresponds to a file (deletion sync)
6. Runs as part of `npm run build` and via a dev-mode file watcher (chokidar)
7. Idempotent — embedding is only re-computed when content hash changes

### Re-embed-all flag

`npm run rag:sync -- --force` re-embeds every file regardless of content hash. Used when:
- Switching embedding models
- Switching embedding dimensions
- Initial population

## API & Code Surface

### New files

- `src/features/reports/lib/qa-corpus/*.md` — corpus
- `src/features/reports/lib/rag/load-corpus.ts` — markdown parsing + frontmatter validation
- `src/features/reports/lib/rag/embed.ts` — Voyage client wrapper
- `src/features/reports/lib/rag/retrieve.ts` — pgvector cosine search
- `src/features/reports/lib/rag/sync.ts` — sync orchestration
- `src/features/reports/lib/tools/search-examples.ts` — new tool handler
- `scripts/rag-sync.ts` — CLI entry point for `npm run rag:sync`
- `prisma/migrations/<timestamp>_rag_documents/migration.sql` — extension + table + index

### Modified files

- `prisma/schema.prisma` — add `RagDocument` model + `agentMetadata Json?` field on `QueryLog`
- `src/features/reports/lib/agent/agent-loop.ts` — turn-1 retrieval, two-block `system` array, dynamic injection of examples block
- `src/features/reports/lib/agent/system-prompt.ts` — split `buildSystemPrompt()` into `buildStaticBasePrompt()` (block 1) + `renderExamplesBlock(examples)` (block 2). Static base prompt updates to reference the new `## Examples that may be relevant for this question` section by name and tells Claude how to weight it (hints, not authoritative; trust live `describe_table` over examples if they conflict).
- `src/features/reports/lib/agent/tool-definitions.ts` — register `search_examples`
- `src/features/reports/lib/tools/index.ts` — export new tool
- `package.json` — add `rag:sync` script + `voyageai`, `chokidar`, `gray-matter` dependencies
- `.env.example` — document `VOYAGE_API_KEY`

### New env var

- `VOYAGE_API_KEY` — required at build time and at runtime (for query-time embedding). Stored in Vercel + local `.env.local`.

## Feature Flag

```typescript
// src/lib/flags.ts
export const REPORTS_RAG_RETRIEVAL = process.env.REPORTS_RAG_RETRIEVAL === 'true';
```

When `false` (default for first week of soak):
- Agent loop skips retrieval and injection on turn 1
- `search_examples` tool is not registered
- Existing behavior preserved exactly

When `true`:
- Full retrieval flow active

Flip to `true` permanently after one week of A/B observation. Cleanup PR removes the flag itself.

## Testing

### Unit tests

- `load-corpus.test.ts` — parses valid markdown, rejects missing required fields, handles malformed YAML
- `retrieve.test.ts` — mocks pgvector, verifies threshold filter, top-N ordering, source filtering
- `search-examples.test.ts` — tool handler shape, error paths
- `agent-loop.test.ts` (extended) — verifies retrieval fires on turn 1, doesn't fire on turn 2, injection lands in system prompt

### Eval harness

`src/features/reports/lib/rag/__evals__/retrieval-quality.test.ts`:

```typescript
// JSON file of test cases:
[
  { query: "show me deals broken down by school district", expectedTop3: ["pipeline-by-customer"] },
  { query: "how am I doing this quarter on closing", expectedTop3: ["win-rate-by-rep", "bookings-this-quarter"] },
  // … 20–30 cases curated alongside the corpus
]
```

Test passes if the expected pair id appears in the top-3 retrieved for each query. CI fails if recall@3 drops below 80%. Run via `npm run test:rag-eval`.

### Soak / observation

For one week with the flag at `false` for everyone except the product owner's account:
- Log retrieval results to `query_log.metadata` for every turn
- Daily check: which queries had no examples above threshold? (Signal to author new pairs.) Which had wrong examples in top-3? (Signal to fix existing pair phrasing or `also_phrased_as`.)

## Authoring Workflow (collaborative)

The corpus is the long pole, not the code. Authoring happens in two focused sessions with the product owner:

**Session 1 (~90 min, after infra ships):**
- Product owner brings raw notes: 20–30 questions reps actually ask, 5–10 gotchas they re-explain often, synonym pairs, and a list of "good" existing saved reports to seed from
- Together: shape format, write 10–15 entries
- I extract SQL from the seeded saved reports, write `tables` / `gotchas` together, product owner writes `question` / `also_phrased_as` / prose

**Session 2 (~60 min, ~3 days later):**
- Review the 10–15 from Session 1 in context of real questions that came in during the week
- Fill out to 30–50 entries
- First pass at eval cases (the test JSON above)

After Session 2, corpus stays editable; new entries land via PR or in-conversation file edits with me.

## Rollout Plan

1. **Week 1:** infra + sync + flag (off). PR opens, lands behind flag.
2. **Day after merge:** Session 1 corpus authoring.
3. **Day +3:** Session 2 corpus authoring. Eval harness populated. Flag flipped on for product owner only.
4. **Day +10:** Soak observations reviewed. Tune threshold + fix any retrieval misses.
5. **Day +14:** Flag flipped on globally if eval recall@3 ≥ 80% and qualitative review passes.
6. **Day +21:** Cleanup PR removes feature flag.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Voyage API outage breaks every Reports turn | Low (multi-region SLA) | Wrap retrieval in try/catch — fall back to no-injection (current behavior) and log; never block the chat turn |
| Corpus quality decays as it grows | Medium | Eval harness in CI; soak observation; feedback loop is a planned follow-up spec |
| Embedding cost grows unexpectedly | Very low | Voyage free tier covers ~200M tokens/month; this project is well under that |
| Retrieved examples confuse Claude (wrong pair surfaces, biases answer) | Medium | Threshold gate (initial 0.6 cosine); A/B observation period; can drop to top-1 or top-2 if top-3 introduces noise |
| Schema drift when embedding model changes | Low | `--force` re-embed flag; embedding dimension tracked in `metadata.embedding_model` for migration awareness |
| Cache invalidation across conversations because system prompt now varies | Already accepted | Within-conversation cache is the high-value lane; cross-conversation cache is unaffected by retrieval change |

## Open Questions Resolved During Brainstorm

- **Q&A pair shape:** hybrid — question + tables + gotchas + reference SQL prose
- **Retrieval trigger:** auto-inject on turn 1, tool-call on turn N>1
- **v1 scope:** corpus-only; schema lane-agnostic for future saved-report embeddings
- **Storage:** markdown source of truth, DB for embeddings
- **Embedding provider:** Voyage AI

## Out of Scope — Explicit Follow-Up Specs

These are real and necessary for the tool to feel "powerful," but each is its own design:

1. **Streaming / SSE** — biggest user-perceived speed win; immediate next priority after this ships
2. **Adaptive warning injection** — only inject mandatory warnings whose tables the question touches; ~1 day
3. **Saved-report semantic retrieval (lane 2)** — populate `rag_documents` rows on save, surface "you have a similar saved report" suggestion; small follow-up once UX is brainstormed
4. **Feedback loop** — thumbs-up/down on every answer, feeds back into corpus curation queue
5. **`SEMANTIC_CONTEXT` migration** — move the static metadata file into the same corpus form so non-engineers can edit it
6. **Consolidate `search_metadata` and `search_examples`** — these tools overlap conceptually (semantic retrieval over different corpora). v1 ships them as siblings to keep changes scoped; a follow-up should merge them into one embedding-based tool with a `kind` filter (`'qa_pair' | 'concept' | 'column'`). Reduces tool count and gives Claude a single, coherent retrieval primitive.
