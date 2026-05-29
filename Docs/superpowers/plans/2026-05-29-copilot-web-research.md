# Copilot Web Research (web_search + web_fetch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the copilot autonomous public-web research via Anthropic's server-side `web_search` + `web_fetch` tools, rendering answers as prose with a numbered Sources list.

**Architecture:** Extend the shared `runAgentLoop` to (1) call the beta messages endpoint when `betas` are supplied, (2) continue across `pause_turn`, and (3) emit a new `research` result when server tools ran. Web tools are added only to `COPILOT_TOOLS`, and the new behavior is a no-op for the `reports`/`list-builder` variants. Citations are extracted off text blocks and rendered by a new `ResearchAnswer` component.

**Tech Stack:** Next.js 16 App Router, TypeScript, `@anthropic-ai/sdk` ^0.90 (beta tool types `BetaWebSearchTool20250305` / `BetaWebFetchTool20250910`), Vitest + Testing Library.

**Spec:** `Docs/superpowers/specs/2026-05-29-copilot-web-research-design.md`

**Branch:** `feat/ai-copilot-core-objects` (the copilot's home worktree). Commit with no model-ID trailers; use `-c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com"`.

---

## File Structure

- **Create** `src/features/copilot/lib/citations.ts` — `CopilotCitation` type + `extractCitations()` (pure, endpoint-agnostic).
- **Modify** `src/features/copilot/lib/tools.ts` — add `web_search` + `web_fetch` server-tool defs; append to `COPILOT_TOOLS`.
- **Modify** `src/features/reports/lib/agent/agent-loop.ts` — `betas` arg, beta-endpoint branch, `pause_turn` continuation, server-tool tracking, `research` result kind.
- **Modify** `src/features/copilot/lib/types.ts` — `research` variant on `CopilotTurnResult`.
- **Modify** `src/app/api/copilot/chat/stream/route.ts` — pass `betas`, emit `research` SSE, persist research turn.
- **Modify** `src/features/copilot/lib/system-prompt.ts` — web-research guidance.
- **Create** `src/features/copilot/components/ResearchAnswer.tsx` — prose + Sources list.
- **Modify** `src/features/copilot/components/CopilotPanel.tsx` — handle/render `research`.
- **Tests** co-located in each `__tests__/` dir.

Run all tests for a file with: `npx vitest run <path>`.

---

## Task 1: Citation extraction helper + type

**Files:**
- Create: `src/features/copilot/lib/citations.ts`
- Test: `src/features/copilot/lib/__tests__/citations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/copilot/lib/__tests__/citations.test.ts
import { describe, it, expect } from "vitest";
import { extractCitations } from "../citations";

describe("extractCitations", () => {
  it("pulls url + title from text-block citations", () => {
    const content = [
      {
        type: "text",
        text: "Austin ISD passed a bond.",
        citations: [{ url: "https://austinisd.org/bond", title: "2024 Bond" }],
      },
    ];
    expect(extractCitations(content)).toEqual([
      { url: "https://austinisd.org/bond", title: "2024 Bond" },
    ]);
  });

  it("dedupes by url, first-seen wins, and preserves order", () => {
    const content = [
      { type: "text", text: "a", citations: [{ url: "https://x.org/a", title: "A" }] },
      { type: "text", text: "b", citations: [{ url: "https://y.org/b", title: "B" }] },
      { type: "text", text: "c", citations: [{ url: "https://x.org/a", title: "A again" }] },
    ];
    expect(extractCitations(content)).toEqual([
      { url: "https://x.org/a", title: "A" },
      { url: "https://y.org/b", title: "B" },
    ]);
  });

  it("falls back to the host (sans www) when title is missing/blank", () => {
    const content = [
      { type: "text", text: "a", citations: [{ url: "https://www.kut.org/news/123", title: "" }] },
    ];
    expect(extractCitations(content)).toEqual([
      { url: "https://www.kut.org/news/123", title: "kut.org" },
    ]);
  });

  it("ignores non-text blocks and citation entries with no url", () => {
    const content = [
      { type: "server_tool_use", text: "" },
      { type: "text", text: "x", citations: [{ title: "no url" }] },
      { type: "text", text: "y" },
    ];
    expect(extractCitations(content)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/citations.test.ts`
Expected: FAIL — `Failed to resolve import "../citations"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/copilot/lib/citations.ts

/** A web source backing a research answer. */
export interface CopilotCitation {
  url: string;
  title: string;
}

/** Minimal structural shape of an assistant content block carrying citations.
 *  Endpoint-agnostic so it accepts both stable and beta SDK content blocks. */
interface CitationCarrier {
  type: string;
  citations?: Array<{ url?: string | null; title?: string | null }> | null;
}

/**
 * Pull web citations off an assistant message's content blocks: only `text`
 * blocks carry them. Dedupe by URL (first-seen wins) preserving order, and fall
 * back to the URL host when a citation has no usable title.
 */
export function extractCitations(content: CitationCarrier[]): CopilotCitation[] {
  const seen = new Set<string>();
  const out: CopilotCitation[] = [];
  for (const block of content) {
    if (block.type !== "text" || !block.citations) continue;
    for (const c of block.citations) {
      const url = c.url ?? undefined;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      const title = c.title?.trim();
      out.push({ url, title: title || hostOf(url) });
    }
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/citations.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/lib/citations.ts src/features/copilot/lib/__tests__/citations.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(copilot): citation extraction helper for web research"
```

---

## Task 2: Server-tool definitions

**Files:**
- Modify: `src/features/copilot/lib/tools.ts`
- Test: `src/features/copilot/lib/__tests__/tools.test.ts` (exists — add cases)

- [ ] **Step 1: Add the failing test cases**

Append inside the existing `describe` in `src/features/copilot/lib/__tests__/tools.test.ts` (import `COPILOT_TOOLS` is already present; if not, add `import { COPILOT_TOOLS } from "../tools";` and `import { AGENT_TOOLS } from "@/features/reports/lib/agent/tool-definitions";`):

```ts
  it("exposes web_search and web_fetch to the copilot", () => {
    const names = COPILOT_TOOLS.map((t) => (t as { name: string }).name);
    expect(names).toContain("web_search");
    expect(names).toContain("web_fetch");
  });

  it("caps web tool usage at 5 per turn", () => {
    const ws = COPILOT_TOOLS.find((t) => (t as { name: string }).name === "web_search");
    const wf = COPILOT_TOOLS.find((t) => (t as { name: string }).name === "web_fetch");
    expect((ws as { max_uses?: number }).max_uses).toBe(5);
    expect((wf as { max_uses?: number }).max_uses).toBe(5);
  });

  it("does not add web tools to the reports AGENT_TOOLS set", () => {
    const names = AGENT_TOOLS.map((t) => (t as { name: string }).name);
    expect(names).not.toContain("web_search");
    expect(names).not.toContain("web_fetch");
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/tools.test.ts`
Expected: FAIL — `web_search` not found in `COPILOT_TOOLS`.

- [ ] **Step 3: Implement — add the server-tool defs**

Edit `src/features/copilot/lib/tools.ts`. After the `proposeActions` definition and before the `COPILOT_TOOLS` export, add:

```ts
// Anthropic server-side tools. `web_search` is GA; `web_fetch` is beta and
// requires the `web-fetch-2025-09-10` beta header (supplied by the stream
// route via runAgentLoop's `betas`). They run Anthropic-side — we never execute
// them — and return text blocks with `citations`.
const webSearch: Anthropic.Beta.BetaWebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
};

const webFetch: Anthropic.Beta.BetaWebFetchTool20250910 = {
  type: "web_fetch_20250910",
  name: "web_fetch",
  max_uses: 5,
  citations: { enabled: true },
  max_content_tokens: 50_000,
};
```

Then replace the `COPILOT_TOOLS` export:

```ts
export const COPILOT_TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  ...(AGENT_TOOLS as Anthropic.Beta.BetaToolUnion[]),
  webSearch,
  webFetch,
  proposeActions,
];
```

> Note: `AGENT_TOOLS` and `proposeActions` are stable `Anthropic.Tool`s; the cast widens them to the beta union so the whole set can go through the beta endpoint. If a `satisfies`/field mismatch appears against the installed SDK shape (e.g. `citations`/`max_content_tokens` naming), adjust the literal to match `Anthropic.Beta.BetaWebFetchTool20250910` — do not loosen to `any`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck the file**

Run: `npx tsc --noEmit`
Expected: no errors in `tools.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/features/copilot/lib/tools.ts src/features/copilot/lib/__tests__/tools.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(copilot): add web_search + web_fetch server tools"
```

---

## Task 3: Agent loop — betas, pause_turn, research result

**Files:**
- Modify: `src/features/reports/lib/agent/agent-loop.ts`
- Test: `src/features/copilot/lib/__tests__/agent-loop-copilot.test.ts` (exists — add cases + extend the mock)

- [ ] **Step 1: Extend the test mock to support the beta endpoint, add failing tests**

In `agent-loop-copilot.test.ts`, replace the `scripted` helper so the same scripted responses are served from both `messages.stream` and `beta.messages.stream`:

```ts
function scripted(responses: Array<unknown>) {
  let i = 0;
  const streamFn = vi.fn(() => {
    const resp = responses[i++];
    return { on: vi.fn(), finalMessage: vi.fn(async () => resp) };
  });
  return {
    messages: { stream: streamFn },
    beta: { messages: { stream: streamFn } },
  };
}
```

Then add these cases inside the `describe`:

```ts
  it("continues across pause_turn, then returns research on the final text", async () => {
    const anthropic = scripted([
      {
        stop_reason: "pause_turn",
        content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "x" } }],
      },
      {
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: "Austin ISD passed a $2.4B bond in 2024.",
            citations: [{ url: "https://austinisd.org/bond", title: "2024 Bond" }],
          },
        ],
      },
    ]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "any recent Austin ISD news?",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle: vi.fn() },
      betas: ["web-fetch-2025-09-10"],
    });
    expect(res.kind).toBe("research");
    if (res.kind === "research") {
      expect(res.assistantText).toContain("bond");
      expect(res.citations).toEqual([{ url: "https://austinisd.org/bond", title: "2024 Bond" }]);
    }
    // pause_turn forced a second model call
    expect(anthropic.beta.messages.stream).toHaveBeenCalledTimes(2);
  });

  it("uses the beta endpoint when betas are supplied", async () => {
    const anthropic = scripted([
      {
        stop_reason: "end_turn",
        content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: {} },
                  { type: "text", text: "done", citations: [] }],
      },
    ]);
    await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "search the web",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle: vi.fn() },
      betas: ["web-fetch-2025-09-10"],
    });
    expect(anthropic.beta.messages.stream).toHaveBeenCalledTimes(1);
    expect(anthropic.messages.stream).not.toHaveBeenCalled();
  });

  it("still treats a no-tool text turn as clarifying when no server tools ran", async () => {
    const anthropic = scripted([
      { stop_reason: "end_turn", content: [{ type: "text", text: "Which district?" }] },
    ]);
    const res = await runAgentLoop({
      anthropic: anthropic as never,
      userMessage: "tell me about it",
      priorTurns: [],
      userId: "u1",
      agentVariant: "copilot",
      systemPrompt: SYS,
      tools: TOOLS,
      terminalTool: { name: "propose_actions", handle: vi.fn() },
      betas: ["web-fetch-2025-09-10"],
    });
    expect(res.kind).toBe("clarifying");
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/features/copilot/lib/__tests__/agent-loop-copilot.test.ts`
Expected: FAIL — `res.kind` is `clarifying` (research not implemented) and `beta.messages.stream` is never called.

- [ ] **Step 3a: Add the `research` variant to `AgentResult` and the `betas` arg**

In `agent-loop.ts`, add the import near the top:

```ts
import { extractCitations, type CopilotCitation } from "@/features/copilot/lib/citations";
```

Add to the `AgentResult` union (after the `terminal_result` member, before `clarifying`):

```ts
    | {
        kind: "research";
        assistantText: string;
        citations: CopilotCitation[];
      }
```

Add to `RunAgentLoopArgs`:

```ts
  /**
   * Anthropic beta flags. When non-empty, the loop calls the beta messages
   * endpoint (required for server tools like web_fetch). Reports/list-builder
   * omit this → the stable endpoint and unchanged behavior.
   */
  betas?: Anthropic.Beta.AnthropicBeta[];
```

Destructure `betas` alongside the other args in `runAgentLoop`.

- [ ] **Step 3b: Branch the model call onto the beta endpoint**

Replace the `const modelStream = anthropic.messages.stream({ ... });` block with:

```ts
    const streamParams = {
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" as const },
      ...(effort ? { output_config: { effort } } : {}),
      system: [
        { type: "text" as const, text: systemPrompt, cache_control: { type: "ephemeral" as const, ttl: "1h" as const } },
      ],
      messages,
    };
    const modelStream =
      betas && betas.length > 0
        ? anthropic.beta.messages.stream({
            ...streamParams,
            betas,
            tools: toolSet as unknown as Anthropic.Beta.BetaToolUnion[],
          })
        : anthropic.messages.stream({
            ...streamParams,
            tools: toolSet as Anthropic.ToolUnion[],
          });
```

> Note: `toolSet` is typed `Anthropic.Tool[]` on the args; the casts adapt it to each endpoint's tool param. Keep the existing `modelStream.on("text", ...)` + `await modelStream.finalMessage()` lines unchanged.

- [ ] **Step 3c: Track server tools + handle pause_turn**

Near the other loop-state declarations (e.g. after `let assistantText = "";`), add:

```ts
  let usedServerTools = false;
  let pauseContinuations = 0;
  const MAX_PAUSE_CONTINUATIONS = 10;
  // Accumulated assistant content across pause_turn continuations, for citation
  // extraction at the research exit.
  const serverContent: Array<{ type: string; citations?: Array<{ url?: string | null; title?: string | null }> | null }> = [];
```

Immediately after the `pushEvent({ kind: "model_call", ... })` call (and before `if (toolUses.length === 0)`), add:

```ts
    if (response.content.some((b) => (b as { type?: string }).type === "server_tool_use")) {
      usedServerTools = true;
    }
    serverContent.push(
      ...(response.content as Array<{ type: string; citations?: Array<{ url?: string | null; title?: string | null }> | null }>),
    );

    // Server tools (web_search/web_fetch) pause the turn while Anthropic runs
    // them. Re-send the partial assistant content and continue — the model
    // resumes with the results. Bounded so a runaway sequence surrenders.
    if ((response as { stop_reason?: string | null }).stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content as Anthropic.MessageParam["content"] });
      pauseContinuations++;
      if (pauseContinuations > MAX_PAUSE_CONTINUATIONS) {
        const text = assistantText || "I wasn't able to finish researching that. Could you narrow it down?";
        return { kind: "surrender", text, events, usage: totalUsage };
      }
      continue;
    }
```

- [ ] **Step 3d: Return `research` at the no-client-tool exit**

In the `if (toolUses.length === 0) { ... }` block, after the existing ghost-report handling and the `if (ghostReportRetriesUsed > 0) { return surrender }` block, and **before** the final `return { kind: "clarifying", ... }`, insert:

```ts
      // A turn that used server tools (web_search/web_fetch) and finished with
      // text is a researched answer, not a clarifying question.
      if (usedServerTools) {
        return {
          kind: "research",
          assistantText: text,
          citations: extractCitations(serverContent),
          events,
          usage: totalUsage,
        };
      }
```

- [ ] **Step 4: Run to verify the new tests pass**

Run: `npx vitest run src/features/copilot/lib/__tests__/agent-loop-copilot.test.ts`
Expected: PASS (all cases, including the pre-existing run_sql/propose/clarifying ones).

- [ ] **Step 5: Run the reports agent-loop tests to confirm no regression**

Run: `npx vitest run src/features/reports`
Expected: PASS (reports/list-builder variants unchanged — they never pass `betas`).

- [ ] **Step 6: Commit**

```bash
git add src/features/reports/lib/agent/agent-loop.ts src/features/copilot/lib/__tests__/agent-loop-copilot.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(copilot): pause_turn handling + research result for server tools"
```

---

## Task 4: Result type + stream route wiring

**Files:**
- Modify: `src/features/copilot/lib/types.ts`
- Modify: `src/app/api/copilot/chat/stream/route.ts`
- Test: `src/features/copilot/lib/__tests__/types.test.ts` (create) — a compile-level guard

- [ ] **Step 1: Add the `research` variant to `CopilotTurnResult`**

In `types.ts`, add the import:

```ts
import type { CopilotCitation } from "./citations";
```

Add to the `CopilotTurnResult` union (after the `actions` member):

```ts
  | {
      kind: "research";
      conversationId: string;
      assistantText: string;
      citations: CopilotCitation[];
    }
```

- [ ] **Step 2: Write a guard test (fails to compile/run until the route maps it)**

```ts
// src/features/copilot/lib/__tests__/types.test.ts
import { describe, it, expect } from "vitest";
import type { CopilotTurnResult } from "../types";

describe("CopilotTurnResult research variant", () => {
  it("accepts a research result with citations", () => {
    const r: CopilotTurnResult = {
      kind: "research",
      conversationId: "c1",
      assistantText: "Austin ISD passed a bond.",
      citations: [{ url: "https://austinisd.org/bond", title: "2024 Bond" }],
    };
    expect(r.kind).toBe("research");
    expect(r.citations).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run to verify it passes (type-only)**

Run: `npx vitest run src/features/copilot/lib/__tests__/types.test.ts`
Expected: PASS.

- [ ] **Step 4: Wire the stream route**

In `src/app/api/copilot/chat/stream/route.ts`:

(a) Pass `betas` into `runAgentLoop` — add to the call options:

```ts
          effort: "medium",
          betas: ["web-fetch-2025-09-10"],
```

(b) Persist research turns. In the `// Persist the turn` block, add a branch before the final `else`:

```ts
          } else if (result.kind === "research") {
            await saveCopilotTurn({
              userId,
              conversationId,
              question,
              assistantText: result.assistantText,
              events: result.events,
              usage: result.usage,
            });
          } else {
```

(c) Emit the research SSE result. In the terminal `if (result.kind === "result") { ... } else if (...) { ... } else { ... }` chain, add before the final `else`:

```ts
        } else if (result.kind === "research") {
          send("result", {
            kind: "research",
            conversationId,
            assistantText: result.assistantText,
            citations: result.citations,
          });
        } else {
```

> Note: research turns persist only `assistantText` (+ telemetry). Live source links are not stored, so reopening an old thread shows the prose without the Sources list — matching how SQL answer turns don't persist rows. A "researched the web — N sources" replay note is deferred (it would need a new column on `copilotTurn`).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `route.ts` / `types.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/features/copilot/lib/types.ts src/app/api/copilot/chat/stream/route.ts src/features/copilot/lib/__tests__/types.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(copilot): emit + persist research turn over the stream route"
```

---

## Task 5: System-prompt web-research guidance

**Files:**
- Modify: `src/features/copilot/lib/system-prompt.ts`
- Test: `src/features/copilot/lib/__tests__/system-prompt.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/features/copilot/lib/__tests__/system-prompt.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/features/reports/lib/agent/system-prompt", () => ({
  buildSystemPrompt: vi.fn(async () => "DB_REFERENCE"),
}));

import { buildCopilotSystemPrompt } from "../system-prompt";

describe("buildCopilotSystemPrompt — web research", () => {
  it("documents the web research tools and the internal/external boundary", async () => {
    const prompt = await buildCopilotSystemPrompt({ id: "u1", email: "rep@x.com" });
    expect(prompt).toMatch(/web_search/);
    expect(prompt).toMatch(/web_fetch/);
    // never use it for internal data
    expect(prompt).toMatch(/never.*internal data/i);
    // prefer authoritative sources
    expect(prompt).toMatch(/\.gov.*\.edu|authoritative/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/copilot/lib/__tests__/system-prompt.test.ts`
Expected: FAIL — `web_search` not present in the prompt.

- [ ] **Step 3: Add the guidance**

In `system-prompt.ts`, add a third capability to the opening list. Change the `## Style` boundary by inserting a new section just before `## Style`. Insert this block immediately before the `## Style` heading inside `COPILOT_PREAMBLE`:

```ts
## Researching the public web
You can research the public web with \`web_search\` and \`web_fetch\` to answer questions that need external, public facts the database doesn't hold — district news, bond/funding measures, superintendent or board changes, grant announcements, ed-tech trends. Use them autonomously when external info would genuinely help; you don't need the rep to ask.
- NEVER use web tools for the rep's internal data (plans, activities, contacts, district records, opportunities) — that is ALWAYS \`run_sql\`.
- Prefer authoritative sources: official district sites, \`.gov\` / \`.edu\`, and reputable news. Avoid forums and social media.
- Ground every external claim in a citation — don't assert unsourced facts. Keep it to at most ~5 searches per turn.
- A web-researched answer is rendered as prose with a Sources list; you don't call a terminal tool — just write the answer in text.

```

Also extend the "Decide per turn" list — add this bullet after the `propose_actions` bullet:

```ts
- The rep wants EXTERNAL/public info not in our data (news, funding, leadership changes) → research with \`web_search\` / \`web_fetch\` and answer in prose with citations.
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/copilot/lib/__tests__/system-prompt.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/lib/system-prompt.ts src/features/copilot/lib/__tests__/system-prompt.test.ts
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(copilot): system-prompt guidance for web research"
```

---

## Task 6: ResearchAnswer component

**Files:**
- Create: `src/features/copilot/components/ResearchAnswer.tsx`
- Test: `src/features/copilot/components/__tests__/ResearchAnswer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/copilot/components/__tests__/ResearchAnswer.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResearchAnswer } from "../ResearchAnswer";

describe("ResearchAnswer", () => {
  const citations = [
    { url: "https://austinisd.org/bond", title: "2024 Bond Program" },
    { url: "https://www.kut.org/news/123", title: "Voters approve bond" },
  ];

  it("renders the prose answer and a numbered Sources list with links", () => {
    render(<ResearchAnswer text="Austin ISD passed a $2.4B bond." citations={citations} />);
    expect(screen.getByText(/Austin ISD passed/)).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    const first = screen.getByRole("link", { name: /2024 Bond Program/ });
    expect(first).toHaveAttribute("href", "https://austinisd.org/bond");
    expect(first).toHaveAttribute("target", "_blank");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("omits the Sources section when there are no citations", () => {
    render(<ResearchAnswer text="No external sources." citations={[]} />);
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/copilot/components/__tests__/ResearchAnswer.test.tsx`
Expected: FAIL — `Failed to resolve import "../ResearchAnswer"`.

- [ ] **Step 3: Implement the component**

```tsx
// src/features/copilot/components/ResearchAnswer.tsx
"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { AssistantMarkdown } from "@/features/shared/components/AssistantMarkdown";
import type { CopilotCitation } from "../lib/citations";

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SourceFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Globe className="h-3.5 w-3.5 shrink-0 text-[#8A80A8]" aria-hidden="true" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostOf(url))}&sz=32`}
      alt=""
      className="h-3.5 w-3.5 shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}

/** Prose research answer followed by a compact, numbered Sources list. */
export function ResearchAnswer({
  text,
  citations,
}: {
  text: string;
  citations: CopilotCitation[];
}) {
  return (
    <div className="space-y-2">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-[#EFEDF5] px-3 py-2 text-sm text-[#403770]">
        <AssistantMarkdown text={text} />
      </div>

      {citations.length > 0 && (
        <div className="rounded-lg border border-[#E2DEEC] bg-[#F7F5FA] px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8A80A8]">
            Sources
          </p>
          <ol className="space-y-1">
            {citations.map((c, i) => (
              <li key={c.url} className="flex items-center gap-2 text-xs">
                <span className="shrink-0 text-[#8A80A8]">{i + 1}.</span>
                <SourceFavicon url={c.url} />
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 truncate text-[#403770] underline decoration-[#C9C1DE] hover:decoration-[#403770]"
                  title={c.title}
                >
                  <span className="text-[#8A80A8] whitespace-nowrap">{hostOf(c.url)}</span>
                  {" — "}
                  {c.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/copilot/components/__tests__/ResearchAnswer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/copilot/components/ResearchAnswer.tsx src/features/copilot/components/__tests__/ResearchAnswer.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(copilot): ResearchAnswer prose + Sources list component"
```

---

## Task 7: Wire ResearchAnswer into CopilotPanel

**Files:**
- Modify: `src/features/copilot/components/CopilotPanel.tsx`
- Test: `src/features/copilot/components/__tests__/CopilotPanel.research.test.tsx` (create) — unit-test `applyResult` mapping via a small extraction, OR a render assertion. We extract the mapping to keep it testable.

- [ ] **Step 1: Add `citations` to the `ChatMessage` type and import**

In `CopilotPanel.tsx`, add the imports (`CopilotCitation` comes directly from `../lib/citations`, where it is defined):

```ts
import { ResearchAnswer } from "./ResearchAnswer";
import type { CopilotCitation } from "../lib/citations";
```

Add to the `ChatMessage` interface:

```ts
  citations?: CopilotCitation[];
```

- [ ] **Step 2: Handle `research` in `applyResult`**

In the `applyResult` callback, add before the final `return` (the clarifying fallback):

```ts
      if (res.kind === "research") {
        return {
          ...prev,
          streaming: false,
          text: res.assistantText,
          citations: res.citations,
        };
      }
```

- [ ] **Step 3: Render the Sources list when a message has citations**

In the message render block, after the `{msg.answer && ( ... )}` block, add:

```tsx
      {msg.citations && msg.citations.length > 0 && (
        <ResearchAnswer text="" citations={msg.citations} />
      )}
```

> The prose is already rendered by the existing `AssistantMarkdown` block (driven by `msg.text`), so pass `text=""` here to render only the Sources list. To avoid the empty prose bubble, guard `ResearchAnswer`'s prose: wrap the prose `<div>` in `{text && ( ... )}`. Apply that guard in `ResearchAnswer.tsx` now:

```tsx
      {text && (
        <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-[#EFEDF5] px-3 py-2 text-sm text-[#403770]">
          <AssistantMarkdown text={text} />
        </div>
      )}
```

Re-run the Task 6 test after this guard:

Run: `npx vitest run src/features/copilot/components/__tests__/ResearchAnswer.test.tsx`
Expected: PASS (the "omits Sources when empty" test renders text only; the main test still finds prose + links).

- [ ] **Step 4: Write a render test for the panel mapping**

```tsx
// src/features/copilot/components/__tests__/CopilotPanel.research.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResearchAnswer } from "../ResearchAnswer";

// The panel reuses ResearchAnswer for the Sources list; this asserts the
// citations -> Sources rendering contract the panel depends on.
describe("CopilotPanel research rendering contract", () => {
  it("renders a Sources list from message citations", () => {
    render(
      <ResearchAnswer
        text=""
        citations={[{ url: "https://nces.ed.gov/x", title: "NCES" }]}
      />,
    );
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /NCES/ })).toHaveAttribute(
      "href",
      "https://nces.ed.gov/x",
    );
  });
});
```

- [ ] **Step 5: Run the panel test + full copilot suite**

Run: `npx vitest run src/features/copilot`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/copilot/components/CopilotPanel.tsx src/features/copilot/components/ResearchAnswer.tsx src/features/copilot/components/__tests__/CopilotPanel.research.test.tsx
git -c user.name="SierraArcega" -c user.email="sierra.arcega@fullmindlearning.com" \
  commit -m "feat(copilot): render research answers + Sources in the panel"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npm test`
Expected: PASS (no regressions in reports/copilot/list-builder).

- [ ] **Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Manual E2E (dev)**

`npm run dev` (port 3005). Open the copilot, ask something external (e.g. "any recent bond or funding news for Austin ISD?"). Confirm: it searches, streams a prose answer, and shows a numbered Sources list with working links. Ask an internal question ("how many open tasks do I have?") and confirm it still returns a table (no web search). `web_fetch` requires the beta — confirm no 400 on the beta header (the route sends `web-fetch-2025-09-10`).

---

## Notes / deferred

- **Replay note for research turns** — deferred; needs a `copilotTurn` discriminator column to show "researched the web — N sources" on reopen. Prose still replays.
- **Phases 2–4** (`district_brief`, `plot_on_map`, write-action tool) are out of scope; each gets its own spec → plan cycle. `plot_on_map` must first reconcile with the existing query→map district plotting on this worktree.
