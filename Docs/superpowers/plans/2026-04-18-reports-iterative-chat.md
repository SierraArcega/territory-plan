# Reports Iterative Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each chat turn refine the existing builder instead of replacing it, and show the user a concrete action list of what changed.

**Architecture:** `/api/ai/query/suggest` accepts `currentParams` + `chatHistory` and returns either `{ kind: "params", params, explanation }` or `{ kind: "clarify", question }`. Claude is allowed to skip the tool for clarifying questions (`tool_choice: auto`). The client computes a semantic diff of prev→next params and renders it as a tagged action list under each assistant message.

**Tech Stack:** Next.js App Router, React 19, TypeScript, TanStack Query, Vitest + Testing Library, Anthropic SDK (`@anthropic-ai/sdk`), Tailwind 4.

**Spec:** `Docs/superpowers/specs/2026-04-18-reports-iterative-chat-design.md`

---

## File Structure

**New files:**
- `src/features/reports/lib/params-diff.ts` — pure function `diffParams(prev, next) → ReceiptAction[]`
- `src/features/reports/lib/__tests__/params-diff.test.ts` — unit tests for diff
- `src/app/api/ai/query/__tests__/suggest.test.ts` — route tests
- `src/features/reports/components/__tests__/ChatMessage.test.tsx` — component tests

**Modified files:**
- `src/features/reports/lib/schema-prompt.ts` — add refine + clarify rules
- `src/features/reports/lib/__tests__/schema-prompt.test.ts` — assert new rules
- `src/app/api/ai/query/suggest/route.ts` — new request/response shape, `tool_choice: auto`
- `src/features/reports/lib/queries.ts` — update `SuggestVars` + `SuggestResponse` types
- `src/features/reports/lib/ui-types.ts` — replace `ChatMessageReceipt` contents with `actions: ReceiptAction[]`
- `src/features/reports/components/ChatMessage.tsx` — render tagged action list (option B)
- `src/features/reports/components/ReportsView.tsx` — `handleSend` sends `currentParams + chatHistory`, branches on response `kind`

**Out of scope (follow-ups):**
- Persisting `messages` to `draft.chatHistory` across reloads.
- Token-budget cap on chat history.

---

## Task 1: Add `params-diff` module with exhaustive tests

**Files:**
- Create: `src/features/reports/lib/params-diff.ts`
- Create: `src/features/reports/lib/__tests__/params-diff.test.ts`

- [ ] **Step 1.1: Write the failing test file**

Create `src/features/reports/lib/__tests__/params-diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diffParams, type ReceiptAction } from "../params-diff";
import type { QueryParams } from "../types";

const base: QueryParams = { table: "districts", limit: 100 };

describe("diffParams", () => {
  it("returns empty array for identical params", () => {
    expect(diffParams(base, base)).toEqual([]);
  });

  it("null prev → add action for table", () => {
    const actions = diffParams(null, base);
    expect(actions).toContainEqual<ReceiptAction>({
      kind: "add",
      field: "table",
      label: "districts",
    });
  });

  it("table change → mod action", () => {
    const next: QueryParams = { ...base, table: "opportunities" };
    const actions = diffParams(base, next);
    expect(actions).toContainEqual<ReceiptAction>({
      kind: "mod",
      field: "table",
      label: "opportunities",
      detail: "districts → opportunities",
    });
  });

  it("added column → add action", () => {
    const prev: QueryParams = { ...base, columns: ["leaid"] };
    const next: QueryParams = { ...base, columns: ["leaid", "name"] };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "column", label: "name" },
    ]);
  });

  it("removed column → rem action", () => {
    const prev: QueryParams = { ...base, columns: ["leaid", "name"] };
    const next: QueryParams = { ...base, columns: ["leaid"] };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      { kind: "rem", field: "column", label: "name" },
    ]);
  });

  it("reordered columns → no actions", () => {
    const prev: QueryParams = { ...base, columns: ["a", "b"] };
    const next: QueryParams = { ...base, columns: ["b", "a"] };
    expect(diffParams(prev, next)).toEqual([]);
  });

  it("added join → add action", () => {
    const next: QueryParams = { ...base, joins: [{ toTable: "vacancies" }] };
    expect(diffParams(base, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "join", label: "vacancies" },
    ]);
  });

  it("filter added → add action with column = value label", () => {
    const next: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "eq", value: "open" }],
    };
    expect(diffParams(base, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "filter", label: "status = open" },
    ]);
  });

  it("filter value change on same column+op → mod action", () => {
    const prev: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "eq", value: "open" }],
    };
    const next: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "eq", value: "closed" }],
    };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      {
        kind: "mod",
        field: "filter",
        label: "status = closed",
        detail: "open → closed",
      },
    ]);
  });

  it("filter op change on same column → rem + add, not mod", () => {
    const prev: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "eq", value: "open" }],
    };
    const next: QueryParams = {
      ...base,
      filters: [{ column: "status", op: "neq", value: "open" }],
    };
    const actions = diffParams(prev, next);
    expect(actions).toContainEqual({
      kind: "rem",
      field: "filter",
      label: "status = open",
    });
    expect(actions).toContainEqual({
      kind: "add",
      field: "filter",
      label: "status != open",
    });
  });

  it("aggregation added → add action keyed by alias", () => {
    const next: QueryParams = {
      ...base,
      aggregations: [{ column: "id", fn: "count", alias: "opp_count" }],
    };
    expect(diffParams(base, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "aggregation", label: "opp_count" },
    ]);
  });

  it("aggregation fn change → mod action", () => {
    const prev: QueryParams = {
      ...base,
      aggregations: [{ column: "amount", fn: "sum", alias: "total" }],
    };
    const next: QueryParams = {
      ...base,
      aggregations: [{ column: "amount", fn: "avg", alias: "total" }],
    };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      {
        kind: "mod",
        field: "aggregation",
        label: "total",
        detail: "sum(amount) → avg(amount)",
      },
    ]);
  });

  it("groupBy add/remove", () => {
    const prev: QueryParams = { ...base, groupBy: ["state"] };
    const next: QueryParams = { ...base, groupBy: ["state", "district"] };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      { kind: "add", field: "groupBy", label: "district" },
    ]);
  });

  it("orderBy direction flip → mod action", () => {
    const prev: QueryParams = {
      ...base,
      orderBy: [{ column: "revenue", direction: "asc" }],
    };
    const next: QueryParams = {
      ...base,
      orderBy: [{ column: "revenue", direction: "desc" }],
    };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      {
        kind: "mod",
        field: "sort",
        label: "revenue ↓",
        detail: "asc → desc",
      },
    ]);
  });

  it("orderBy column change → rem + add", () => {
    const prev: QueryParams = {
      ...base,
      orderBy: [{ column: "revenue", direction: "desc" }],
    };
    const next: QueryParams = {
      ...base,
      orderBy: [{ column: "take", direction: "desc" }],
    };
    const actions = diffParams(prev, next);
    expect(actions).toContainEqual({
      kind: "rem",
      field: "sort",
      label: "revenue ↓",
    });
    expect(actions).toContainEqual({
      kind: "add",
      field: "sort",
      label: "take ↓",
    });
  });

  it("limit change → mod action", () => {
    const prev: QueryParams = { ...base, limit: 100 };
    const next: QueryParams = { ...base, limit: 40 };
    expect(diffParams(prev, next)).toEqual<ReceiptAction[]>([
      {
        kind: "mod",
        field: "limit",
        label: "40",
        detail: "100 → 40",
      },
    ]);
  });

  it("limit undefined → defined is not an action (default limit)", () => {
    const prev: QueryParams = { table: "districts" };
    const next: QueryParams = { table: "districts", limit: 100 };
    expect(diffParams(prev, next)).toEqual([]);
  });

  it("multi-field turn: add column + mod sort + rem filter", () => {
    const prev: QueryParams = {
      table: "opportunities",
      columns: ["name", "amount"],
      filters: [{ column: "stage", op: "eq", value: "closed_won" }],
      orderBy: [{ column: "revenue", direction: "desc" }],
    };
    const next: QueryParams = {
      table: "opportunities",
      columns: ["name", "amount", "owner_name"],
      orderBy: [{ column: "take", direction: "desc" }],
    };
    const actions = diffParams(prev, next);
    expect(actions).toContainEqual({
      kind: "add",
      field: "column",
      label: "owner_name",
    });
    expect(actions).toContainEqual({
      kind: "rem",
      field: "filter",
      label: "stage = closed_won",
    });
    // sort: column changed → rem + add
    expect(actions).toContainEqual({
      kind: "rem",
      field: "sort",
      label: "revenue ↓",
    });
    expect(actions).toContainEqual({
      kind: "add",
      field: "sort",
      label: "take ↓",
    });
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `npx vitest run src/features/reports/lib/__tests__/params-diff.test.ts`
Expected: FAIL — `Cannot find module '../params-diff'`.

- [ ] **Step 1.3: Implement `diffParams`**

Create `src/features/reports/lib/params-diff.ts`:

```ts
import type {
  Aggregation,
  Filter,
  OrderBy,
  QueryParams,
} from "./types";

/**
 * Structured record of one change between two QueryParams snapshots.
 * Consumed by ChatMessage to render tagged action rows under an assistant reply.
 */
export interface ReceiptAction {
  kind: "add" | "rem" | "mod";
  field:
    | "table"
    | "join"
    | "column"
    | "filter"
    | "aggregation"
    | "groupBy"
    | "sort"
    | "limit";
  /** Primary text shown in the row, e.g. "owner_name" or "status = open". */
  label: string;
  /** Optional "was → now" detail for `mod` actions. */
  detail?: string;
}

/**
 * Semantic diff between two QueryParams snapshots. Array order within a field
 * is ignored — entries are keyed by identity (column name, alias, etc.) so
 * reorders don't produce spurious actions.
 */
export function diffParams(
  prev: QueryParams | null,
  next: QueryParams,
): ReceiptAction[] {
  const actions: ReceiptAction[] = [];

  // table
  if (!prev) {
    actions.push({ kind: "add", field: "table", label: next.table });
  } else if (prev.table !== next.table) {
    actions.push({
      kind: "mod",
      field: "table",
      label: next.table,
      detail: `${prev.table} → ${next.table}`,
    });
  }

  diffStringSet(
    actions,
    "join",
    (prev?.joins ?? []).map((j) => j.toTable),
    (next.joins ?? []).map((j) => j.toTable),
  );
  diffStringSet(actions, "column", prev?.columns ?? [], next.columns ?? []);
  diffFilters(actions, prev?.filters ?? [], next.filters ?? []);
  diffAggregations(
    actions,
    prev?.aggregations ?? [],
    next.aggregations ?? [],
  );
  diffStringSet(actions, "groupBy", prev?.groupBy ?? [], next.groupBy ?? []);
  diffOrderBy(actions, prev?.orderBy ?? [], next.orderBy ?? []);
  diffLimit(actions, prev?.limit, next.limit);

  return actions;
}

function diffStringSet(
  actions: ReceiptAction[],
  field: ReceiptAction["field"],
  prev: readonly string[],
  next: readonly string[],
): void {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  for (const v of next) if (!prevSet.has(v)) actions.push({ kind: "add", field, label: v });
  for (const v of prev) if (!nextSet.has(v)) actions.push({ kind: "rem", field, label: v });
}

function filterKey(f: Filter): string {
  return `${f.column}:${f.op}`;
}

function filterLabel(f: Filter): string {
  const opStr: Record<Filter["op"], string> = {
    eq: "=",
    neq: "!=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    like: "like",
    ilike: "ilike",
    in: "in",
    notIn: "not in",
    isNull: "is null",
    isNotNull: "is not null",
  };
  const op = opStr[f.op];
  if (f.op === "isNull" || f.op === "isNotNull") return `${f.column} ${op}`;
  const v = Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "");
  return `${f.column} ${op} ${v}`;
}

function filterValueStr(f: Filter): string {
  if (f.op === "isNull" || f.op === "isNotNull") return "";
  return Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "");
}

function diffFilters(
  actions: ReceiptAction[],
  prev: readonly Filter[],
  next: readonly Filter[],
): void {
  const prevMap = new Map(prev.map((f) => [filterKey(f), f]));
  const nextMap = new Map(next.map((f) => [filterKey(f), f]));

  for (const [key, f] of nextMap) {
    const prevF = prevMap.get(key);
    if (!prevF) {
      actions.push({ kind: "add", field: "filter", label: filterLabel(f) });
    } else if (filterValueStr(prevF) !== filterValueStr(f)) {
      actions.push({
        kind: "mod",
        field: "filter",
        label: filterLabel(f),
        detail: `${filterValueStr(prevF)} → ${filterValueStr(f)}`,
      });
    }
  }
  for (const [key, f] of prevMap) {
    if (!nextMap.has(key)) {
      actions.push({ kind: "rem", field: "filter", label: filterLabel(f) });
    }
  }
}

function aggKey(a: Aggregation): string {
  return a.alias ?? `${a.fn}_${a.column}`;
}

function aggBody(a: Aggregation): string {
  return `${a.fn}(${a.column})`;
}

function diffAggregations(
  actions: ReceiptAction[],
  prev: readonly Aggregation[],
  next: readonly Aggregation[],
): void {
  const prevMap = new Map(prev.map((a) => [aggKey(a), a]));
  const nextMap = new Map(next.map((a) => [aggKey(a), a]));

  for (const [key, a] of nextMap) {
    const prevA = prevMap.get(key);
    if (!prevA) {
      actions.push({ kind: "add", field: "aggregation", label: key });
    } else if (prevA.fn !== a.fn || prevA.column !== a.column) {
      actions.push({
        kind: "mod",
        field: "aggregation",
        label: key,
        detail: `${aggBody(prevA)} → ${aggBody(a)}`,
      });
    }
  }
  for (const [key] of prevMap) {
    if (!nextMap.has(key)) {
      actions.push({ kind: "rem", field: "aggregation", label: key });
    }
  }
}

function orderLabel(o: OrderBy): string {
  return `${o.column} ${o.direction === "desc" ? "↓" : "↑"}`;
}

function diffOrderBy(
  actions: ReceiptAction[],
  prev: readonly OrderBy[],
  next: readonly OrderBy[],
): void {
  const prevMap = new Map(prev.map((o) => [o.column, o]));
  const nextMap = new Map(next.map((o) => [o.column, o]));

  for (const [col, o] of nextMap) {
    const prevO = prevMap.get(col);
    if (!prevO) {
      actions.push({ kind: "add", field: "sort", label: orderLabel(o) });
    } else if (prevO.direction !== o.direction) {
      actions.push({
        kind: "mod",
        field: "sort",
        label: orderLabel(o),
        detail: `${prevO.direction} → ${o.direction}`,
      });
    }
  }
  for (const [col, o] of prevMap) {
    if (!nextMap.has(col)) {
      actions.push({ kind: "rem", field: "sort", label: orderLabel(o) });
    }
  }
}

function diffLimit(
  actions: ReceiptAction[],
  prev: number | undefined,
  next: number | undefined,
): void {
  // Ignore undefined → default transitions (validator inserts default=100).
  if (prev === undefined || next === undefined) return;
  if (prev === next) return;
  actions.push({
    kind: "mod",
    field: "limit",
    label: String(next),
    detail: `${prev} → ${next}`,
  });
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

Run: `npx vitest run src/features/reports/lib/__tests__/params-diff.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 1.5: Commit**

```bash
git add src/features/reports/lib/params-diff.ts src/features/reports/lib/__tests__/params-diff.test.ts
git commit -m "feat(reports): add params-diff for action-list receipts"
```

---

## Task 2: Schema prompt — refine and clarify rules

**Files:**
- Modify: `src/features/reports/lib/schema-prompt.ts`
- Modify: `src/features/reports/lib/__tests__/schema-prompt.test.ts`

- [ ] **Step 2.1: Add failing tests for the new rules**

Edit `src/features/reports/lib/__tests__/schema-prompt.test.ts`, add these `it` blocks inside the `describe("buildSchemaPrompt", ...)` block:

```ts
  it("tells Claude to modify existing builder state when present", () => {
    expect(prompt).toMatch(/<CURRENT_BUILDER>/);
    expect(prompt).toMatch(/preserve anything still relevant/i);
  });

  it("allows Claude to ask a clarifying question when ambiguous", () => {
    expect(prompt).toMatch(/clarifying question/i);
  });
```

- [ ] **Step 2.2: Run the schema-prompt tests to verify they fail**

Run: `npx vitest run src/features/reports/lib/__tests__/schema-prompt.test.ts`
Expected: FAIL — the two new tests fail.

- [ ] **Step 2.3: Add the new rules to the prompt**

Edit `src/features/reports/lib/schema-prompt.ts`. In the `parts.push(...)` call near the top (after the `Today's date is ${today}.` line), add two more bullets into the `IMPORTANT:` list:

```ts
    "IMPORTANT:",
    "- Use tables and columns ONLY from the list below. If a question cannot be answered with these tables, call `run_query` with your best attempt AND write a short explanation noting the limitation.",
    "- When multiple tables could answer a question, follow the routing rules in the CONCEPT MAPPINGS section below.",
    "- Respect the WARNINGS below — they encode known data quality issues and are non-negotiable.",
    "- Always provide a 1-2 sentence `explanation` summarizing what the query will return and surfacing any mandatory caveats.",
    "- If the user already has a builder state (shown in `<CURRENT_BUILDER>`), modify it to reflect the new question. Preserve anything still relevant. Do not rebuild the query from scratch unless the user explicitly says to start over.",
    "- If a question is genuinely ambiguous or you need info to proceed, respond with a short clarifying question in plain text instead of calling `run_query`. Otherwise always prefer calling the tool with your best attempt and note the caveat in `explanation`.",
    "",
```

- [ ] **Step 2.4: Run the schema-prompt tests to verify they pass**

Run: `npx vitest run src/features/reports/lib/__tests__/schema-prompt.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 2.5: Commit**

```bash
git add src/features/reports/lib/schema-prompt.ts src/features/reports/lib/__tests__/schema-prompt.test.ts
git commit -m "feat(reports): schema prompt rules for refine + clarify turns"
```

---

## Task 3: Suggest route — new request/response shape and tests

**Files:**
- Modify: `src/app/api/ai/query/suggest/route.ts`
- Create: `src/app/api/ai/query/__tests__/suggest.test.ts`

- [ ] **Step 3.1: Write failing route tests**

Create `src/app/api/ai/query/__tests__/suggest.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: { queryLog: { create: vi.fn() } },
}));

vi.mock("@/features/reports/lib/claude-client", () => ({
  getAnthropic: () => ({
    messages: { create: (...args: unknown[]) => mockCreate(...args) },
  }),
}));

import { POST as suggest } from "../suggest/route";

const USER = { id: "00000000-0000-0000-0000-000000000001", email: "u@x" };

function req(body: unknown) {
  return new NextRequest(new URL("/api/ai/query/suggest", "http://localhost"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue(USER);
});

describe("POST /api/ai/query/suggest", () => {
  it("401 without user", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await suggest(req({ question: "x" }));
    expect(res.status).toBe(401);
  });

  it("returns kind=params when Claude calls run_query", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_1",
          input: {
            table: "districts",
            columns: ["leaid"],
            explanation: "All districts.",
          },
        },
      ],
    });
    const res = await suggest(req({ question: "list districts" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("params");
    expect(body.params.table).toBe("districts");
    expect(body.explanation).toBe("All districts.");
  });

  it("returns kind=clarify when Claude only emits text", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Which fiscal year did you mean?" }],
    });
    const res = await suggest(req({ question: "show me the numbers" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("clarify");
    expect(body.question).toBe("Which fiscal year did you mean?");
  });

  it("appends <CURRENT_BUILDER> block to the last user message when currentParams given", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_2",
          input: { table: "districts", explanation: "ok" },
        },
      ],
    });
    await suggest(
      req({
        question: "add name",
        currentParams: { table: "districts", columns: ["leaid"] },
      }),
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.content).toContain("<CURRENT_BUILDER>");
    expect(lastMsg.content).toContain('"table": "districts"');
    expect(lastMsg.content).toContain('"leaid"');
  });

  it("omits <CURRENT_BUILDER> when currentParams is absent", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_3",
          input: { table: "districts", explanation: "ok" },
        },
      ],
    });
    await suggest(req({ question: "list districts" }));
    const callArgs = mockCreate.mock.calls[0][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];
    expect(lastMsg.content).not.toContain("<CURRENT_BUILDER>");
  });

  it("forwards chatHistory as prior messages in order", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_4",
          input: { table: "districts", explanation: "ok" },
        },
      ],
    });
    await suggest(
      req({
        question: "add name",
        chatHistory: [
          { role: "user", content: "list districts" },
          { role: "assistant", content: "Here are the districts." },
        ],
      }),
    );
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(3);
    expect(callArgs.messages[0]).toEqual({ role: "user", content: "list districts" });
    expect(callArgs.messages[1]).toEqual({
      role: "assistant",
      content: "Here are the districts.",
    });
    expect(callArgs.messages[2].role).toBe("user");
    expect(callArgs.messages[2].content).toContain("add name");
  });

  it("uses tool_choice auto (not forced)", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Clarify?" }],
    });
    await suggest(req({ question: "x" }));
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: "auto" });
  });

  it("422 when Claude params fail validation", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "run_query",
          id: "tu_5",
          input: { table: "NOT_REGISTERED", explanation: "bad" },
        },
      ],
    });
    const res = await suggest(req({ question: "x" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/invalid params/i);
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/ai/query/__tests__/suggest.test.ts`
Expected: FAIL — most assertions fail on response shape / `tool_choice` / message structure.

- [ ] **Step 3.3: Update the route to match the new contract**

Replace the full contents of `src/app/api/ai/query/suggest/route.ts` with:

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import { buildSchemaPrompt } from "@/features/reports/lib/schema-prompt";
import { runQueryTool } from "@/features/reports/lib/run-query-tool";
import { validateParams } from "@/features/reports/lib/params-validator";
import type { QueryParams } from "@/features/reports/lib/types";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface SuggestRequestBody {
  question: string;
  currentParams?: QueryParams;
  chatHistory?: ChatTurn[];
  conversationId?: string;
}

type SuggestResponse =
  | { kind: "params"; params: QueryParams; explanation: string }
  | { kind: "clarify"; question: string };

// Prompt is stable except for the current-date anchor — cache keyed by
// YYYY-MM-DD so a long-running process picks up date rollover at midnight UTC.
let cachedPrompt: { date: string; text: string } | null = null;
function schemaPrompt(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  if (!cachedPrompt || cachedPrompt.date !== date) {
    cachedPrompt = { date, text: buildSchemaPrompt(now) };
  }
  return cachedPrompt.text;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.question || typeof body.question !== "string") {
    return NextResponse.json(
      { error: "Missing 'question' string in request body" },
      { status: 400 },
    );
  }

  let anthropic: Anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic client unavailable" },
      { status: 500 },
    );
  }

  const finalUserContent = body.currentParams
    ? `${body.question}\n\n<CURRENT_BUILDER>\n${JSON.stringify(body.currentParams, null, 2)}\n</CURRENT_BUILDER>`
    : body.question;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...(body.chatHistory ?? []),
    { role: "user", content: finalUserContent },
  ];

  const startedAt = Date.now();
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: schemaPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [runQueryTool],
      tool_choice: { type: "auto" },
      messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Claude request failed", details: message },
      { status: 502 },
    );
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "run_query",
  );
  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );

  const executionTimeMs = Date.now() - startedAt;

  if (!toolUse) {
    const clarify = textBlock?.text?.trim() ||
      "I'm not sure what to build — could you rephrase?";
    void prisma.queryLog
      .create({
        data: {
          userId: user.id,
          conversationId: body.conversationId ?? undefined,
          question: `[clarify] ${body.question}`,
          executionTimeMs,
        },
      })
      .catch(() => undefined);
    const payload: SuggestResponse = { kind: "clarify", question: clarify };
    return NextResponse.json(payload);
  }

  const { explanation, ...rawParams } = toolUse.input as QueryParams & {
    explanation?: string;
  };
  const validation = validateParams(rawParams);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Claude produced invalid params",
        details: validation.errors,
        rawParams,
        explanation,
      },
      { status: 422 },
    );
  }

  void prisma.queryLog
    .create({
      data: {
        userId: user.id,
        conversationId: body.conversationId ?? undefined,
        question: body.question,
        params: validation.normalized as unknown as object,
        executionTimeMs,
      },
    })
    .catch(() => undefined);

  const payload: SuggestResponse = {
    kind: "params",
    params: validation.normalized,
    explanation: explanation ?? "",
  };
  return NextResponse.json(payload);
}
```

- [ ] **Step 3.4: Run route tests to verify they pass**

Run: `npx vitest run src/app/api/ai/query/__tests__/suggest.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 3.5: Run the full reports test suite to check for regressions**

Run: `npx vitest run src/features/reports src/app/api/ai/query`
Expected: PASS — all tests green (prior 59 + new).

- [ ] **Step 3.6: Commit**

```bash
git add src/app/api/ai/query/suggest/route.ts src/app/api/ai/query/__tests__/suggest.test.ts
git commit -m "feat(reports): suggest accepts currentParams + chatHistory, returns discriminated response"
```

---

## Task 4: Client types — `SuggestVars`, `SuggestResponse`, `ChatMessageReceipt`

**Files:**
- Modify: `src/features/reports/lib/queries.ts`
- Modify: `src/features/reports/lib/ui-types.ts`

- [ ] **Step 4.1: Update `ChatMessageReceipt` in ui-types.ts**

Edit `src/features/reports/lib/ui-types.ts`. Replace the existing `ChatMessageReceipt` interface with:

```ts
import type { ReceiptAction } from "./params-diff";

export interface ChatMessageReceipt {
  /** Structured per-change rows. Empty for clarify replies or no-op turns. */
  actions: ReceiptAction[];
}
```

Also delete the (now unused) old `summary` and `counts` fields.

- [ ] **Step 4.2: Update `SuggestVars` and `SuggestResponse` in queries.ts**

Edit `src/features/reports/lib/queries.ts`. Replace the `SuggestVars`, `SuggestResponse` interfaces and `useSuggestMutation` hook with:

```ts
interface SuggestVars {
  question: string;
  currentParams?: QueryParams;
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  conversationId?: string;
}

export type SuggestResponse =
  | { kind: "params"; params: QueryParams; explanation: string }
  | { kind: "clarify"; question: string };

export function useSuggestMutation() {
  return useMutation<SuggestResponse, Error, SuggestVars>({
    mutationFn: (body) =>
      fetchJson<SuggestResponse>(`${API_BASE}/ai/query/suggest`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}
```

- [ ] **Step 4.3: Verify compile passes**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: Type errors appear in `ReportsView.tsx` (still consuming the old shape). We fix these in Task 6.

**Do not commit yet** — types are intentionally in a half-applied state. We'll commit after Task 6 so the tree is never broken across a commit.

---

## Task 5: `ChatMessage` renders the action list

**Files:**
- Modify: `src/features/reports/components/ChatMessage.tsx`
- Create: `src/features/reports/components/__tests__/ChatMessage.test.tsx`

- [ ] **Step 5.1: Write failing component tests**

Create `src/features/reports/components/__tests__/ChatMessage.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatMessage from "../ChatMessage";
import type { ChatMessage as ChatMessageData } from "../../lib/ui-types";

function msg(overrides: Partial<ChatMessageData>): ChatMessageData {
  return {
    id: "x",
    role: "assistant",
    content: "ok",
    timestamp: "2026-04-18T00:00:00Z",
    ...overrides,
  };
}

describe("ChatMessage", () => {
  it("renders user messages without a receipt block", () => {
    render(<ChatMessage message={msg({ role: "user", content: "hi" })} />);
    expect(screen.getByText("hi")).toBeInTheDocument();
  });

  it("renders assistant prose and no action block when actions is empty", () => {
    render(
      <ChatMessage
        message={msg({
          content: "Clarify please?",
          receipt: { actions: [] },
        })}
      />,
    );
    expect(screen.getByText("Clarify please?")).toBeInTheDocument();
    expect(screen.queryByText(/\badd\b/i)).not.toBeInTheDocument();
  });

  it("renders no action block when receipt is missing", () => {
    render(<ChatMessage message={msg({ content: "text only" })} />);
    expect(screen.getByText("text only")).toBeInTheDocument();
  });

  it("renders one row per action with tag, field, and label", () => {
    render(
      <ChatMessage
        message={msg({
          content: "Added owner column and flipped the sort.",
          receipt: {
            actions: [
              { kind: "add", field: "column", label: "owner_name" },
              {
                kind: "mod",
                field: "sort",
                label: "revenue ↓",
                detail: "asc → desc",
              },
              { kind: "rem", field: "filter", label: "stage = closed_won" },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("add")).toBeInTheDocument();
    expect(screen.getByText("mod")).toBeInTheDocument();
    expect(screen.getByText("rem")).toBeInTheDocument();
    expect(screen.getByText("owner_name")).toBeInTheDocument();
    expect(screen.getByText("revenue ↓")).toBeInTheDocument();
    expect(screen.getByText(/asc → desc/)).toBeInTheDocument();
    expect(screen.getByText("stage = closed_won")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5.2: Run component tests to verify they fail**

Run: `npx vitest run src/features/reports/components/__tests__/ChatMessage.test.tsx`
Expected: FAIL — assertions fail because the component doesn't render actions yet (it still uses `receipt.summary`).

- [ ] **Step 5.3: Rewrite `ChatMessage` to render action rows**

Replace the full contents of `src/features/reports/components/ChatMessage.tsx` with:

```tsx
import type { ChatMessage as ChatMessageData } from "../lib/ui-types";
import type { ReceiptAction } from "../lib/params-diff";

interface Props {
  message: ChatMessageData;
}

const TAG_STYLES: Record<ReceiptAction["kind"], string> = {
  add: "bg-[#E4F2EA] text-[#2F7D50]",
  rem: "bg-[#FBE6E3] text-[#B84135]",
  mod: "bg-[#FDF4E6] text-[#8A5A0B]",
};

export default function ChatMessage({ message }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end w-full">
        <div className="max-w-[260px] rounded-2xl bg-plum px-3.5 py-2.5 text-[13px] font-medium text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const bubbleClass = message.error
    ? "bg-[#fef1f0] border border-[#f58d85] text-[#b84135]"
    : "bg-[#F7F5FA] text-[#544A78]";

  const actions = message.receipt?.actions ?? [];

  return (
    <div className="flex w-full">
      <div className={`max-w-[300px] rounded-2xl px-3.5 py-3 text-[13px] ${bubbleClass}`}>
        <p className="font-normal">{message.content}</p>
        {actions.length > 0 && (
          <ul className="mt-2 rounded-lg border border-[#E2DEEC] bg-white px-2.5 py-2 space-y-1">
            {actions.map((a, i) => (
              <li
                key={`${a.kind}-${a.field}-${a.label}-${i}`}
                className="flex items-baseline gap-1.5 text-[11.5px] leading-[1.4] text-[#544A78]"
              >
                <span
                  className={`inline-flex shrink-0 px-1.5 py-[1px] rounded text-[9.5px] font-bold uppercase tracking-[0.3px] ${TAG_STYLES[a.kind]}`}
                >
                  {a.kind}
                </span>
                <span className="text-[10.5px] uppercase text-[#A69DC0] tracking-[0.3px] shrink-0">
                  {a.field}
                </span>
                <span className="font-medium break-words">{a.label}</span>
                {a.detail && (
                  <span className="text-[10.5px] text-[#A69DC0] break-words">
                    {a.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5.4: Run component tests to verify they pass**

Run: `npx vitest run src/features/reports/components/__tests__/ChatMessage.test.tsx`
Expected: PASS — all 4 tests green.

**Do not commit yet** — `ReportsView.tsx` still constructs the old receipt shape. Commit after Task 6.

---

## Task 6: `ReportsView.handleSend` — send new fields, branch on `kind`

**Files:**
- Modify: `src/features/reports/components/ReportsView.tsx`

- [ ] **Step 6.1: Update `handleSend` to use new request + response**

In `src/features/reports/components/ReportsView.tsx`, find the `handleSend` callback (around line 83) and replace it with:

```tsx
  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      const priorMessages = messages;
      setMessages((m) => [...m, userMsg]);
      try {
        const res = await suggest.mutateAsync({
          question: text,
          currentParams: params.table ? params : undefined,
          chatHistory: priorMessages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        });
        if (res.kind === "params") {
          const actions = diffParams(params.table ? params : null, res.params);
          await setParams(res.params);
          const assistantMsg: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: res.explanation,
            timestamp: new Date().toISOString(),
            receipt: { actions },
          };
          setMessages((m) => [...m, assistantMsg]);
        } else {
          // kind: "clarify"
          const assistantMsg: ChatMessage = {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: res.question,
            timestamp: new Date().toISOString(),
          };
          setMessages((m) => [...m, assistantMsg]);
        }
      } catch (err: unknown) {
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content:
              err instanceof Error && err.message
                ? `I couldn't translate that — ${err.message}. Try rephrasing or edit the chips manually.`
                : "I couldn't translate that — try rephrasing or edit the chips manually.",
            timestamp: new Date().toISOString(),
            error: true,
          },
        ]);
      }
    },
    [suggest, setParams, messages, params],
  );
```

- [ ] **Step 6.2: Add the `diffParams` import**

At the top of `src/features/reports/components/ReportsView.tsx`, add:

```tsx
import { diffParams } from "../lib/params-diff";
```

- [ ] **Step 6.3: Remove stale `ChatMessage` field assignments**

No separate edit required — the new `handleSend` above no longer constructs the `summary`/`counts` shape. Double-check by grepping.

Run: `grep -n "summary:\|counts:" src/features/reports/components/ReportsView.tsx`
Expected: no matches.

- [ ] **Step 6.4: Run typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: No errors in `ReportsView.tsx`, `ChatMessage.tsx`, `ui-types.ts`, `queries.ts`, or the suggest route.

- [ ] **Step 6.5: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests green (prior + new suggest + params-diff + ChatMessage).

- [ ] **Step 6.6: Commit the client changes together**

```bash
git add src/features/reports/lib/ui-types.ts src/features/reports/lib/queries.ts src/features/reports/components/ChatMessage.tsx src/features/reports/components/__tests__/ChatMessage.test.tsx src/features/reports/components/ReportsView.tsx
git commit -m "feat(reports): iterative chat — diff receipts + refine-aware handleSend"
```

---

## Task 7: Manual verification

**Purpose:** The behavioral fix can't be fully verified by unit tests — needs an eyes-on check against the real Anthropic API and DB. Do this on the dev server.

- [ ] **Step 7.1: Start the dev server**

Run: `npm run dev`

Expected: Server starts on http://localhost:3005.

- [ ] **Step 7.2: Reproduce the regression scenario**

1. Navigate to the Reports tab.
2. Click "+ New report" to start fresh.
3. Type: `top 40 customers by revenue this fiscal year` → send.
4. Wait for the builder to populate and the receipt to show the initial add-actions.
5. Type: `can we show the latest opp owner` → send.

Expected:
- The builder still shows opportunities as the source (not replaced).
- The filters and sort from the top-40 query are preserved.
- A new column (`owner_name` or similar) is added.
- The assistant message shows a receipt with `add column <owner_name>` (and nothing else unexpected).

If the builder gets replaced with a fresh "latest opp" query, the refine behavior is broken — inspect the schema prompt or the `<CURRENT_BUILDER>` block contents in the server's query_log.

- [ ] **Step 7.3: Verify the clarify path**

1. Click "+ New report".
2. Type something genuinely ambiguous: `show me the numbers` → send.

Expected: Assistant replies with a clarifying question in text. No builder changes, no action block.

- [ ] **Step 7.4: Verify the reset button**

1. After any successful turn, click "+ New report".

Expected: Builder is empty, chat is empty, draft is gone. The next message starts a fresh conversation.

- [ ] **Step 7.5: Take screenshots for the PR description (optional)**

Capture:
- A refine turn with an action-list receipt.
- A clarify turn.

These go in the PR description so reviewers don't have to rebuild the state locally.

---

## Self-Review Notes

**Spec coverage:**
- Refine-by-default behavior → Tasks 2, 3, 6 ✓
- Full chat history passed to Claude → Task 3, 6 ✓
- `<CURRENT_BUILDER>` block → Task 3 ✓
- `tool_choice: auto` + clarify path → Task 3 ✓
- Client-side diff → Task 1 ✓
- Action-list receipt (option B) → Task 5 ✓
- Legacy receipt backward-compat → Task 5 (renders `actions ?? []`) ✓
- Query-log marker on clarify → Task 3 ✓
- Unit + component + route tests → Tasks 1, 3, 5 ✓
- Schema prompt tests → Task 2 ✓
- Manual verification → Task 7 ✓

**Placeholder scan:** No TBDs, TODOs, or "write appropriate tests" — every code step has the actual code.

**Type consistency:** `ReceiptAction`, `SuggestResponse`, `ChatMessageReceipt` all named the same across tasks. `diffParams` signature consistent.

**Execution note:** Tasks 4-6 leave the tree in a broken typecheck state between steps. The plan explicitly batches the commit at the end of Task 6 so no in-tree commit fails typecheck or tests. If executing via subagent-driven development, keep tasks 4, 5, 6 in a single subagent session (or commit manually at the end).
