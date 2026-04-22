# Query Tool Agentic Actions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let reps take write actions on query results (add districts to a territory plan, create activities, create tasks, add contacts) through natural language in chat or through row/bulk menus on the result table. All actions require explicit confirmation. Actions plug into Plan 2's multi-turn agent loop as additional tools.

**Design spec:** `docs/superpowers/specs/2026-04-21-query-tool-agentic-redesign.md`.

**Depends on:** Plan 2 (Agent Loop Redesign) landed and merged. The framework from Plan 2 (`src/features/reports/lib/agent/`, `AGENT_TOOLS`, the chat route) is the foundation this plan extends.

**Architecture:** Two entry points to the same action pipeline:

1. **NL path:** Claude (in the agent loop) calls one of the new action tools with proposed params. The agent loop treats action-tool calls as *terminal proposals* — they don't execute; they return a proposal payload to the UI. The UI renders a confirmation card. On confirm, the frontend POSTs `/api/ai/query/action` which validates and executes.
2. **Direct path:** Table row menus + bulk action toolbar construct the action payload from selected rows and POST directly — no Claude call. Same validation + execution path, same confirmation UI.

**MVP action set (this plan):**
- `add_districts_to_plan`
- `create_task`
- `create_activity`
- `create_contact`

Additional actions (update district notes, etc.) follow the same framework and are out of scope for this plan.

---

## File Structure

### New files

- `src/features/reports/lib/actions/types.ts` — action discriminated union, request shapes
- `src/features/reports/lib/actions/action-tool-definitions.ts` — `Anthropic.Tool[]` entries
- `src/features/reports/lib/actions/handlers/add-districts-to-plan.ts`
- `src/features/reports/lib/actions/handlers/create-task.ts`
- `src/features/reports/lib/actions/handlers/create-activity.ts`
- `src/features/reports/lib/actions/handlers/create-contact.ts`
- `src/features/reports/lib/actions/handlers/dispatch.ts` — validates + routes to per-action handler
- `src/app/api/ai/query/action/route.ts` — POST the action executor
- `src/features/reports/components/ActionConfirmation.tsx`
- `src/features/reports/components/TableActionMenu.tsx`
- `src/features/reports/components/BulkActionToolbar.tsx`
- Tests colocated.

### Modified files

- `src/features/reports/lib/agent/tool-definitions.ts` — extend `AGENT_TOOLS` with action tools
- `src/features/reports/lib/agent/agent-loop.ts` — treat action-tool calls as terminal proposals
- `src/features/reports/lib/agent/types.ts` — add `ActionProposal` to `AgentResult`-equivalent return
- `src/app/api/ai/query/chat/route.ts` + `edit/route.ts` — return action proposals in the response
- `src/features/reports/hooks/useChatTurn.ts` — add action proposal on `ChatTurnResult`
- `src/features/reports/components/ReportsView.tsx` — render confirmation card; pass row selection
- `src/features/reports/components/ResultsTable.tsx` — row-level checkboxes + row action menu

---

## Task 1: Action types

**Files:**
- Create: `src/features/reports/lib/actions/types.ts`
- Create: `src/features/reports/lib/actions/__tests__/types.test.ts`

- [ ] **Step 1: Write types**

```ts
// src/features/reports/lib/actions/types.ts

export type ActionName =
  | "add_districts_to_plan"
  | "create_task"
  | "create_activity"
  | "create_contact";

export interface AddDistrictsToPlanParams {
  planId: number;
  districtLeaids: string[];
  notes?: string;
}

export interface CreateTaskParams {
  districtLeaid: string;
  title: string;
  dueDate?: string; // ISO
  assigneeEmail?: string;
  notes?: string;
}

export interface CreateActivityParams {
  districtLeaid: string;
  activityType: string;
  occurredAt: string; // ISO
  notes?: string;
  contactEmail?: string;
}

export interface CreateContactParams {
  districtLeaid: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
}

export type ActionParams =
  | { action: "add_districts_to_plan"; params: AddDistrictsToPlanParams }
  | { action: "create_task"; params: CreateTaskParams }
  | { action: "create_activity"; params: CreateActivityParams }
  | { action: "create_contact"; params: CreateContactParams };

/** What Claude proposes (or a row/bulk menu constructs) — to be confirmed before execution. */
export interface ActionProposal {
  action: ActionName;
  params: AddDistrictsToPlanParams | CreateTaskParams | CreateActivityParams | CreateContactParams;
  /** Rep-language preview lines for the confirmation card. */
  preview: string[];
}

export interface ActionExecutionResult {
  success: boolean;
  message: string;
  /** Optional details for the chat rail, e.g. {"createdId": 42}. */
  details?: Record<string, unknown>;
}
```

- [ ] **Step 2: Basic test**

```ts
// src/features/reports/lib/actions/__tests__/types.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type { ActionParams, ActionProposal } from "../types";

describe("action types", () => {
  it("ActionParams is a discriminated union", () => {
    const a: ActionParams = {
      action: "create_task",
      params: { districtLeaid: "3100009", title: "Follow up" },
    };
    expectTypeOf(a).toMatchTypeOf<ActionParams>();
  });

  it("ActionProposal has a preview array", () => {
    const p: ActionProposal = {
      action: "add_districts_to_plan",
      params: { planId: 1, districtLeaids: ["3100009"] },
      preview: ["Add 1 district to plan #1"],
    };
    expectTypeOf(p).toMatchTypeOf<ActionProposal>();
  });
});
```

- [ ] **Step 3: Commit**

```bash
npx vitest run src/features/reports/lib/actions/__tests__/types.test.ts
git add src/features/reports/lib/actions/
git commit -m "feat(actions): action types + proposal shape"
```

---

## Task 2: Action tool definitions

**Files:**
- Create: `src/features/reports/lib/actions/action-tool-definitions.ts`
- Create: `src/features/reports/lib/actions/__tests__/action-tool-definitions.test.ts`

- [ ] **Step 1: Test**

```ts
// src/features/reports/lib/actions/__tests__/action-tool-definitions.test.ts
import { describe, it, expect } from "vitest";
import { ACTION_TOOLS, ACTION_TOOL_NAMES } from "../action-tool-definitions";

describe("ACTION_TOOLS", () => {
  it("exposes the 4 MVP actions", () => {
    expect(ACTION_TOOLS.map((t) => t.name).sort()).toEqual([
      "add_districts_to_plan",
      "create_activity",
      "create_contact",
      "create_task",
    ]);
  });

  it("ACTION_TOOL_NAMES is a frozen Set for lookup", () => {
    expect(ACTION_TOOL_NAMES.has("create_task")).toBe(true);
    expect(ACTION_TOOL_NAMES.has("run_sql")).toBe(false);
  });

  it("every action has a clear description with 'confirmation' or 'approve'", () => {
    for (const tool of ACTION_TOOLS) {
      expect(tool.description!.toLowerCase()).toMatch(/confirm|approv/);
    }
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/features/reports/lib/actions/action-tool-definitions.ts
import type Anthropic from "@anthropic-ai/sdk";

const CONFIRMATION_NOTE =
  "This is a proposal only — the user will be asked to confirm before it runs. Do NOT assume success.";

const addDistrictsToPlan: Anthropic.Tool = {
  name: "add_districts_to_plan",
  description: `Propose adding one or more districts to an existing territory plan. ${CONFIRMATION_NOTE}`,
  input_schema: {
    type: "object" as const,
    properties: {
      planId: { type: "integer", description: "Territory plan id." },
      districtLeaids: {
        type: "array",
        items: { type: "string" },
        description: "List of district leaids to add.",
      },
      notes: { type: "string", description: "Optional notes." },
    },
    required: ["planId", "districtLeaids"],
  },
};

const createTask: Anthropic.Tool = {
  name: "create_task",
  description: `Propose creating a follow-up task linked to a district. ${CONFIRMATION_NOTE}`,
  input_schema: {
    type: "object" as const,
    properties: {
      districtLeaid: { type: "string" },
      title: { type: "string" },
      dueDate: { type: "string", description: "ISO 8601 date." },
      assigneeEmail: { type: "string" },
      notes: { type: "string" },
    },
    required: ["districtLeaid", "title"],
  },
};

const createActivity: Anthropic.Tool = {
  name: "create_activity",
  description: `Propose logging an activity (call, email, meeting) against a district. ${CONFIRMATION_NOTE}`,
  input_schema: {
    type: "object" as const,
    properties: {
      districtLeaid: { type: "string" },
      activityType: { type: "string", description: "e.g. 'call', 'email', 'meeting'." },
      occurredAt: { type: "string", description: "ISO 8601 datetime." },
      notes: { type: "string" },
      contactEmail: { type: "string" },
    },
    required: ["districtLeaid", "activityType", "occurredAt"],
  },
};

const createContact: Anthropic.Tool = {
  name: "create_contact",
  description: `Propose creating a new contact on a district. ${CONFIRMATION_NOTE}`,
  input_schema: {
    type: "object" as const,
    properties: {
      districtLeaid: { type: "string" },
      firstName: { type: "string" },
      lastName: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      title: { type: "string", description: "Job title (not the contact's display name)." },
    },
    required: ["districtLeaid", "firstName", "lastName"],
  },
};

export const ACTION_TOOLS: Anthropic.Tool[] = [
  addDistrictsToPlan,
  createTask,
  createActivity,
  createContact,
];

export const ACTION_TOOL_NAMES: ReadonlySet<string> = new Set(
  ACTION_TOOLS.map((t) => t.name),
);
```

- [ ] **Step 3: Test + commit**

```bash
npx vitest run src/features/reports/lib/actions/__tests__/action-tool-definitions.test.ts
git add src/features/reports/lib/actions/action-tool-definitions.ts src/features/reports/lib/actions/__tests__/action-tool-definitions.test.ts
git commit -m "feat(actions): Anthropic tool definitions for 4 actions"
```

---

## Task 3: Extend `AGENT_TOOLS` and agent loop to treat actions as terminal

**Files:**
- Modify: `src/features/reports/lib/agent/tool-definitions.ts`
- Modify: `src/features/reports/lib/agent/agent-loop.ts`
- Modify: `src/features/reports/lib/agent/__tests__/agent-loop.test.ts`

- [ ] **Step 1: Extend AGENT_TOOLS**

In `tool-definitions.ts`, append:

```ts
import { ACTION_TOOLS, ACTION_TOOL_NAMES } from "../actions/action-tool-definitions";

// append to the existing AGENT_TOOLS array
export const AGENT_TOOLS: Anthropic.Tool[] = [
  listTables,
  describeTable,
  searchMetadata,
  getColumnValues,
  countRows,
  sampleRows,
  runSql,
  searchSavedReports,
  getSavedReport,
  ...ACTION_TOOLS,
];

export { ACTION_TOOL_NAMES };
```

Keep `RUN_SQL_TOOL_NAME` exported as-is.

- [ ] **Step 2: Extend `AgentResult` union**

In `agent-loop.ts` types:

```ts
import type { ActionProposal } from "../actions/types";

export type AgentResult =
  | { kind: "result"; /* ...existing... */ }
  | { kind: "action_proposed"; proposal: ActionProposal; assistantText: string }
  | { kind: "clarifying"; text: string }
  | { kind: "surrender"; text: string };
```

- [ ] **Step 3: Detect action tool calls in the loop**

Inside `runAgentLoop`, after detecting `toolUse`, before the `RUN_SQL_TOOL_NAME` branch, add:

```ts
import { ACTION_TOOL_NAMES } from "./tool-definitions";
import { buildActionPreview } from "../actions/handlers/dispatch";

// ...inside the loop, after `if (!toolUse) { return { kind: "clarifying", ... }; }`
if (ACTION_TOOL_NAMES.has(toolUse.name)) {
  const proposal: ActionProposal = {
    action: toolUse.name as ActionProposal["action"],
    params: toolUse.input as ActionProposal["params"],
    preview: buildActionPreview(
      toolUse.name as ActionProposal["action"],
      toolUse.input as ActionProposal["params"],
    ),
  };
  return { kind: "action_proposed", proposal, assistantText };
}
```

(`buildActionPreview` is added in Task 5; the import will red-flag until then — fine for TDD order.)

- [ ] **Step 4: Add test for action-proposal return**

Append to `agent-loop.test.ts`:

```ts
it("returns action_proposed when Claude calls an action tool", async () => {
  const anthropic = makeScriptedAnthropic([
    {
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "create_task",
          input: { districtLeaid: "3100009", title: "Follow up with Houston ISD" },
        },
      ],
    },
  ]);
  const result = await runAgentLoop({
    anthropic: anthropic as never,
    userMessage: "Create a task to follow up with Houston ISD",
    priorTurns: [],
    userId: "u1",
  });
  expect(result.kind).toBe("action_proposed");
  if (result.kind === "action_proposed") {
    expect(result.proposal.action).toBe("create_task");
  }
});
```

- [ ] **Step 5: Commit (will re-test after Task 5 lands `buildActionPreview`)**

```bash
git add src/features/reports/lib/agent/
git commit -m "feat(actions): treat action tool calls as terminal proposals"
```

---

## Task 4: Action dispatcher + preview builder

**Files:**
- Create: `src/features/reports/lib/actions/handlers/dispatch.ts`
- Create: `src/features/reports/lib/actions/handlers/__tests__/dispatch.test.ts`

- [ ] **Step 1: Test**

```ts
// src/features/reports/lib/actions/handlers/__tests__/dispatch.test.ts
import { describe, it, expect } from "vitest";
import { buildActionPreview, validateActionParams } from "../dispatch";

describe("buildActionPreview", () => {
  it("previews add_districts_to_plan with count", () => {
    const lines = buildActionPreview("add_districts_to_plan", {
      planId: 7,
      districtLeaids: ["a", "b", "c"],
    });
    expect(lines.join("\n")).toMatch(/3 district/);
    expect(lines.join("\n")).toContain("plan");
  });

  it("previews create_task with title and district", () => {
    const lines = buildActionPreview("create_task", {
      districtLeaid: "3100009",
      title: "Follow up",
    });
    expect(lines.some((l) => l.includes("Follow up"))).toBe(true);
    expect(lines.some((l) => l.includes("3100009"))).toBe(true);
  });
});

describe("validateActionParams", () => {
  it("rejects create_task without title", () => {
    const r = validateActionParams({
      action: "create_task",
      params: { districtLeaid: "3100009", title: "" } as never,
    });
    expect(r.valid).toBe(false);
  });

  it("accepts a valid add_districts_to_plan", () => {
    const r = validateActionParams({
      action: "add_districts_to_plan",
      params: { planId: 1, districtLeaids: ["a"] },
    });
    expect(r.valid).toBe(true);
  });

  it("rejects an unknown action", () => {
    const r = validateActionParams({ action: "nuke_database" as never, params: {} as never });
    expect(r.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/features/reports/lib/actions/handlers/dispatch.ts
import type {
  ActionParams,
  ActionProposal,
  AddDistrictsToPlanParams,
  CreateActivityParams,
  CreateContactParams,
  CreateTaskParams,
} from "../types";

export function buildActionPreview(
  action: ActionProposal["action"],
  params: ActionProposal["params"],
): string[] {
  switch (action) {
    case "add_districts_to_plan": {
      const p = params as AddDistrictsToPlanParams;
      return [
        `Add ${p.districtLeaids.length} district${p.districtLeaids.length === 1 ? "" : "s"} to plan #${p.planId}.`,
        ...(p.notes ? [`Notes: ${p.notes}`] : []),
      ];
    }
    case "create_task": {
      const p = params as CreateTaskParams;
      return [
        `Create task "${p.title}"`,
        `District: ${p.districtLeaid}`,
        ...(p.dueDate ? [`Due: ${p.dueDate}`] : []),
        ...(p.assigneeEmail ? [`Assigned to: ${p.assigneeEmail}`] : []),
      ];
    }
    case "create_activity": {
      const p = params as CreateActivityParams;
      return [
        `Log ${p.activityType} activity`,
        `District: ${p.districtLeaid}`,
        `At: ${p.occurredAt}`,
        ...(p.notes ? [`Notes: ${p.notes}`] : []),
      ];
    }
    case "create_contact": {
      const p = params as CreateContactParams;
      return [
        `Create contact ${p.firstName} ${p.lastName}`,
        `District: ${p.districtLeaid}`,
        ...(p.email ? [`Email: ${p.email}`] : []),
        ...(p.title ? [`Title: ${p.title}`] : []),
      ];
    }
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateActionParams(req: ActionParams): ValidationResult {
  const errors: string[] = [];
  switch (req.action) {
    case "add_districts_to_plan": {
      const p = req.params;
      if (!Number.isInteger(p.planId) || p.planId <= 0) errors.push("planId must be a positive integer");
      if (!Array.isArray(p.districtLeaids) || p.districtLeaids.length === 0)
        errors.push("districtLeaids must be a non-empty array");
      if (p.districtLeaids.length > 500)
        errors.push("districtLeaids cannot exceed 500 per action");
      break;
    }
    case "create_task": {
      const p = req.params;
      if (!p.districtLeaid) errors.push("districtLeaid is required");
      if (!p.title || !p.title.trim()) errors.push("title is required");
      break;
    }
    case "create_activity": {
      const p = req.params;
      if (!p.districtLeaid) errors.push("districtLeaid is required");
      if (!p.activityType) errors.push("activityType is required");
      if (!p.occurredAt) errors.push("occurredAt is required");
      break;
    }
    case "create_contact": {
      const p = req.params;
      if (!p.districtLeaid) errors.push("districtLeaid is required");
      if (!p.firstName || !p.lastName) errors.push("firstName and lastName are required");
      break;
    }
    default:
      errors.push(`Unknown action: ${(req as { action: string }).action}`);
  }
  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 3: Commit**

```bash
npx vitest run src/features/reports/lib/actions/handlers/__tests__/dispatch.test.ts
git add src/features/reports/lib/actions/handlers/dispatch.ts src/features/reports/lib/actions/handlers/__tests__/dispatch.test.ts
git commit -m "feat(actions): action dispatcher with preview + validation"
```

Now rerun the agent-loop test from Task 3 and ensure it passes.

```bash
npx vitest run src/features/reports/lib/agent/__tests__/agent-loop.test.ts
```

---

## Task 5: `add_districts_to_plan` handler

**Files:**
- Create: `src/features/reports/lib/actions/handlers/add-districts-to-plan.ts`
- Create: `src/features/reports/lib/actions/handlers/__tests__/add-districts-to-plan.test.ts`

- [ ] **Step 1: Test**

```ts
// src/features/reports/lib/actions/handlers/__tests__/add-districts-to-plan.test.ts
import { describe, it, expect, vi } from "vitest";

const findPlanMock = vi.fn();
const createManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: { findUnique: findPlanMock },
    territoryPlanDistrict: { createMany: createManyMock },
  },
}));

import { handleAddDistrictsToPlan } from "../add-districts-to-plan";

describe("handleAddDistrictsToPlan", () => {
  it("fails when plan doesn't belong to user", async () => {
    findPlanMock.mockResolvedValueOnce({ id: 1, userId: "someone-else" });
    const res = await handleAddDistrictsToPlan(
      { planId: 1, districtLeaids: ["a"] },
      "me",
    );
    expect(res.success).toBe(false);
  });

  it("creates join rows and reports count", async () => {
    findPlanMock.mockResolvedValueOnce({ id: 1, userId: "me" });
    createManyMock.mockResolvedValueOnce({ count: 3 });
    const res = await handleAddDistrictsToPlan(
      { planId: 1, districtLeaids: ["a", "b", "c"] },
      "me",
    );
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/3/);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/features/reports/lib/actions/handlers/add-districts-to-plan.ts
import prisma from "@/lib/prisma";
import type {
  AddDistrictsToPlanParams,
  ActionExecutionResult,
} from "../types";

export async function handleAddDistrictsToPlan(
  params: AddDistrictsToPlanParams,
  userId: string,
): Promise<ActionExecutionResult> {
  const plan = await prisma.territoryPlan.findUnique({
    where: { id: params.planId },
  });
  if (!plan || plan.userId !== userId) {
    return { success: false, message: `Plan #${params.planId} not found.` };
  }

  const result = await prisma.territoryPlanDistrict.createMany({
    data: params.districtLeaids.map((leaid) => ({
      planId: plan.id,
      leaid,
      notes: params.notes ?? null,
    })),
    skipDuplicates: true,
  });

  return {
    success: true,
    message: `Added ${result.count} district${result.count === 1 ? "" : "s"} to plan "${plan.name ?? plan.id}".`,
    details: { planId: plan.id, addedCount: result.count },
  };
}
```

> **Note:** If the actual Prisma model or field names differ (e.g., `name` vs `title`, or no `territoryPlanDistrict` relation name), adjust to match `prisma/schema.prisma`. Run `npx prisma studio` or grep the schema to verify before implementing.

- [ ] **Step 3: Commit**

```bash
npx vitest run src/features/reports/lib/actions/handlers/__tests__/add-districts-to-plan.test.ts
git add src/features/reports/lib/actions/handlers/add-districts-to-plan.ts src/features/reports/lib/actions/handlers/__tests__/add-districts-to-plan.test.ts
git commit -m "feat(actions): add_districts_to_plan handler"
```

---

## Task 6: `create_task` handler

**Files:**
- Create: `src/features/reports/lib/actions/handlers/create-task.ts`
- Create: `src/features/reports/lib/actions/handlers/__tests__/create-task.test.ts`

- [ ] **Step 1: Locate the Task model**

```bash
grep -A 20 "^model Task\b\|^model ActivityTask\b\|^model FollowUpTask\b" prisma/schema.prisma
```

Identify the correct model name and required fields. The snippet below assumes `model Task` with `districtLeaid`, `title`, `dueDate`, `assigneeEmail`, `userId`. Adjust accordingly.

- [ ] **Step 2: Test**

```ts
// src/features/reports/lib/actions/handlers/__tests__/create-task.test.ts
import { describe, it, expect, vi } from "vitest";

const createMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: { task: { create: createMock } },
}));

import { handleCreateTask } from "../create-task";

describe("handleCreateTask", () => {
  it("creates a task and returns the id", async () => {
    createMock.mockResolvedValueOnce({ id: 42 });
    const res = await handleCreateTask(
      { districtLeaid: "3100009", title: "Follow up", dueDate: "2026-05-01" },
      "user-1",
    );
    expect(res.success).toBe(true);
    expect(res.details?.id).toBe(42);
  });

  it("rejects empty title", async () => {
    const res = await handleCreateTask(
      { districtLeaid: "3100009", title: "" } as never,
      "user-1",
    );
    expect(res.success).toBe(false);
  });
});
```

- [ ] **Step 3: Implement**

```ts
// src/features/reports/lib/actions/handlers/create-task.ts
import prisma from "@/lib/prisma";
import type { ActionExecutionResult, CreateTaskParams } from "../types";

export async function handleCreateTask(
  params: CreateTaskParams,
  userId: string,
): Promise<ActionExecutionResult> {
  if (!params.title?.trim()) {
    return { success: false, message: "Task title is required." };
  }
  const task = await prisma.task.create({
    data: {
      userId,
      leaid: params.districtLeaid,
      title: params.title,
      dueDate: params.dueDate ? new Date(params.dueDate) : null,
      assigneeEmail: params.assigneeEmail ?? null,
      notes: params.notes ?? null,
    },
  });
  return {
    success: true,
    message: `Task "${params.title}" created.`,
    details: { id: task.id },
  };
}
```

- [ ] **Step 4: Commit**

```bash
npx vitest run src/features/reports/lib/actions/handlers/__tests__/create-task.test.ts
git add src/features/reports/lib/actions/handlers/create-task.ts src/features/reports/lib/actions/handlers/__tests__/create-task.test.ts
git commit -m "feat(actions): create_task handler"
```

---

## Task 7: `create_activity` and `create_contact` handlers

**Files:**
- Create: `src/features/reports/lib/actions/handlers/create-activity.ts`
- Create: `src/features/reports/lib/actions/handlers/create-contact.ts`
- Create: Matching test files

- [ ] **Step 1: Verify model shapes**

```bash
grep -A 25 "^model Activity\b\|^model Contact\b" prisma/schema.prisma
```

Adjust field names in the snippets below if they differ.

- [ ] **Step 2: Implement `create-activity.ts`**

```ts
// src/features/reports/lib/actions/handlers/create-activity.ts
import prisma from "@/lib/prisma";
import type { ActionExecutionResult, CreateActivityParams } from "../types";

export async function handleCreateActivity(
  params: CreateActivityParams,
  userId: string,
): Promise<ActionExecutionResult> {
  const activity = await prisma.activity.create({
    data: {
      userId,
      leaid: params.districtLeaid,
      activityType: params.activityType,
      occurredAt: new Date(params.occurredAt),
      notes: params.notes ?? null,
      contactEmail: params.contactEmail ?? null,
    },
  });
  return {
    success: true,
    message: `Activity logged.`,
    details: { id: activity.id },
  };
}
```

- [ ] **Step 3: Implement `create-contact.ts`**

```ts
// src/features/reports/lib/actions/handlers/create-contact.ts
import prisma from "@/lib/prisma";
import type { ActionExecutionResult, CreateContactParams } from "../types";

export async function handleCreateContact(
  params: CreateContactParams,
  _userId: string,
): Promise<ActionExecutionResult> {
  const contact = await prisma.contact.create({
    data: {
      leaid: params.districtLeaid,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email ?? null,
      phone: params.phone ?? null,
      jobTitle: params.title ?? null,
    },
  });
  return {
    success: true,
    message: `Contact ${params.firstName} ${params.lastName} created.`,
    details: { id: contact.id },
  };
}
```

- [ ] **Step 4: Tests (mirror create-task.test.ts for both)**

Follow the same pattern as Task 6 step 2. Mock `prisma.activity.create` / `prisma.contact.create`. Assert success + details.id and handle missing required fields.

- [ ] **Step 5: Commit**

```bash
npx vitest run src/features/reports/lib/actions/handlers/__tests__/create-activity.test.ts src/features/reports/lib/actions/handlers/__tests__/create-contact.test.ts
git add src/features/reports/lib/actions/handlers/create-activity.ts src/features/reports/lib/actions/handlers/create-contact.ts src/features/reports/lib/actions/handlers/__tests__/create-activity.test.ts src/features/reports/lib/actions/handlers/__tests__/create-contact.test.ts
git commit -m "feat(actions): create_activity + create_contact handlers"
```

---

## Task 8: Action API route

**Files:**
- Create: `src/app/api/ai/query/action/route.ts`
- Create: `src/app/api/ai/query/action/__tests__/route.test.ts`

- [ ] **Step 1: Test**

```ts
// src/app/api/ai/query/action/__tests__/route.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/features/reports/lib/actions/handlers/add-districts-to-plan", () => ({
  handleAddDistrictsToPlan: vi.fn(async () => ({ success: true, message: "Added" })),
}));
vi.mock("@/features/reports/lib/actions/handlers/create-task", () => ({
  handleCreateTask: vi.fn(async () => ({ success: true, message: "Created" })),
}));
vi.mock("@/features/reports/lib/actions/handlers/create-activity", () => ({
  handleCreateActivity: vi.fn(async () => ({ success: true, message: "Logged" })),
}));
vi.mock("@/features/reports/lib/actions/handlers/create-contact", () => ({
  handleCreateContact: vi.fn(async () => ({ success: true, message: "Created" })),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    queryLog: { create: vi.fn(async () => ({ id: 1 })) },
  },
}));

import { POST } from "../route";
import { NextRequest } from "next/server";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/ai/query/action", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/query/action", () => {
  it("rejects unknown actions", async () => {
    const res = await POST(req({ action: "nuke", params: {} }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid params", async () => {
    const res = await POST(
      req({ action: "add_districts_to_plan", params: { planId: 0, districtLeaids: [] } }),
    );
    expect(res.status).toBe(400);
  });

  it("executes a valid action", async () => {
    const res = await POST(
      req({
        action: "add_districts_to_plan",
        params: { planId: 1, districtLeaids: ["a"] },
      }),
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/app/api/ai/query/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { validateActionParams } from "@/features/reports/lib/actions/handlers/dispatch";
import { handleAddDistrictsToPlan } from "@/features/reports/lib/actions/handlers/add-districts-to-plan";
import { handleCreateTask } from "@/features/reports/lib/actions/handlers/create-task";
import { handleCreateActivity } from "@/features/reports/lib/actions/handlers/create-activity";
import { handleCreateContact } from "@/features/reports/lib/actions/handlers/create-contact";
import type { ActionParams } from "@/features/reports/lib/actions/types";

export const dynamic = "force-dynamic";

interface ActionRequest extends ActionParams {
  conversationId?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ActionRequest;
  try {
    body = (await request.json()) as ActionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateActionParams(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid params", details: validation.errors },
      { status: 400 },
    );
  }

  let result;
  try {
    switch (body.action) {
      case "add_districts_to_plan":
        result = await handleAddDistrictsToPlan(body.params, user.id);
        break;
      case "create_task":
        result = await handleCreateTask(body.params, user.id);
        break;
      case "create_activity":
        result = await handleCreateActivity(body.params, user.id);
        break;
      case "create_contact":
        result = await handleCreateContact(body.params, user.id);
        break;
      default: {
        const _exhaustive: never = body;
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // Log the action
  await prisma.queryLog.create({
    data: {
      userId: user.id,
      conversationId: body.conversationId ?? null,
      question: `(action: ${body.action})`,
      action: body.action,
      actionParams: body.params as object,
      actionSuccess: result.success,
    },
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Commit**

```bash
npx vitest run src/app/api/ai/query/action/__tests__/route.test.ts
git add src/app/api/ai/query/action/
git commit -m "feat(actions): POST /api/ai/query/action executor"
```

---

## Task 9: Update chat + edit routes to return action proposals

**Files:**
- Modify: `src/app/api/ai/query/chat/route.ts`
- Modify: `src/app/api/ai/query/edit/route.ts`
- Modify: `src/features/reports/hooks/useChatTurn.ts`
- Modify: `src/features/reports/hooks/useChipEdit.ts`

- [ ] **Step 1: Chat route returns `proposal` when kind is action_proposed**

In `src/app/api/ai/query/chat/route.ts`, add a branch for the new kind after the `result` branch:

```ts
if (result.kind === "action_proposed") {
  await saveTurn({
    userId: user.id,
    conversationId,
    question: body.message,
  });
  return NextResponse.json({
    conversationId,
    assistantText: result.assistantText,
    result: null,
    proposal: result.proposal,
  });
}
```

- [ ] **Step 2: Same change in `edit/route.ts`**

Apply the identical branch.

- [ ] **Step 3: Extend `ChatTurnResult`**

```ts
// useChatTurn.ts
import type { ActionProposal } from "../lib/actions/types";

export interface ChatTurnResult {
  conversationId: string;
  assistantText: string;
  result: { /* unchanged */ } | null;
  proposal?: ActionProposal;
}
```

Apply the same type change for `useChipEdit`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/query/chat/route.ts src/app/api/ai/query/edit/route.ts src/features/reports/hooks/
git commit -m "feat(actions): chat + edit routes return action proposals"
```

---

## Task 10: ActionConfirmation component

**Files:**
- Create: `src/features/reports/components/ActionConfirmation.tsx`
- Create: `src/features/reports/components/__tests__/ActionConfirmation.test.tsx`

- [ ] **Step 1: Test**

```tsx
// src/features/reports/components/__tests__/ActionConfirmation.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ActionConfirmation } from "../ActionConfirmation";
import type { ActionProposal } from "../../lib/actions/types";

const proposal: ActionProposal = {
  action: "create_task",
  params: { districtLeaid: "3100009", title: "Follow up with Houston ISD" },
  preview: ["Create task \"Follow up with Houston ISD\"", "District: 3100009"],
};

describe("ActionConfirmation", () => {
  it("renders preview lines", () => {
    render(
      <ActionConfirmation
        proposal={proposal}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={false}
      />,
    );
    expect(screen.getByText(/Follow up with Houston ISD/)).toBeInTheDocument();
    expect(screen.getByText(/3100009/)).toBeInTheDocument();
  });

  it("fires onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <ActionConfirmation
        proposal={proposal}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        isSubmitting={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(proposal);
  });

  it("disables buttons when submitting", () => {
    render(
      <ActionConfirmation
        proposal={proposal}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={true}
      />,
    );
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// src/features/reports/components/ActionConfirmation.tsx
"use client";

import { Check, X } from "lucide-react";
import type { ActionProposal } from "../lib/actions/types";

interface Props {
  proposal: ActionProposal;
  onConfirm: (p: ActionProposal) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

const ACTION_LABELS: Record<ActionProposal["action"], string> = {
  add_districts_to_plan: "Add districts to plan",
  create_task: "Create task",
  create_activity: "Log activity",
  create_contact: "Create contact",
};

export function ActionConfirmation({ proposal, onConfirm, onCancel, isSubmitting }: Props) {
  return (
    <section className="rounded-xl border border-[#6B4EFF]/30 bg-[#F7F5FA] p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-[#6B4EFF]">
        Action proposal
      </div>
      <h3 className="mt-2 text-base font-semibold text-[#1F1934]">
        {ACTION_LABELS[proposal.action]}
      </h3>
      <ul className="mt-3 space-y-1 text-sm text-[#1F1934]">
        {proposal.preview.map((line, i) => (
          <li key={i}>• {line}</li>
        ))}
      </ul>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#EFEDF5] bg-white px-4 py-2 text-sm font-medium text-[#4B3F6B] hover:bg-[#F7F5FA] disabled:opacity-50"
        >
          <X size={14} /> Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(proposal)}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#6B4EFF] px-4 py-2 text-sm font-medium text-white hover:bg-[#5A3FE6] disabled:opacity-50"
        >
          <Check size={14} /> {isSubmitting ? "Running…" : "Confirm"}
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
npx vitest run src/features/reports/components/__tests__/ActionConfirmation.test.tsx
git add src/features/reports/components/ActionConfirmation.tsx src/features/reports/components/__tests__/ActionConfirmation.test.tsx
git commit -m "feat(actions): ActionConfirmation card"
```

---

## Task 11: `useExecuteAction` hook

**Files:**
- Create: `src/features/reports/hooks/useExecuteAction.ts`

- [ ] **Step 1: Implement (lean — integration-tested via ReportsView)**

```ts
// src/features/reports/hooks/useExecuteAction.ts
import { useMutation } from "@tanstack/react-query";
import type { ActionExecutionResult, ActionParams } from "../lib/actions/types";

interface Args extends ActionParams {
  conversationId?: string;
}

export function useExecuteAction() {
  return useMutation<ActionExecutionResult, Error, Args>({
    mutationFn: async (args) => {
      const res = await fetch("/api/ai/query/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      return json;
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/hooks/useExecuteAction.ts
git commit -m "feat(actions): useExecuteAction hook"
```

---

## Task 12: TableActionMenu + row selection

**Files:**
- Modify: `src/features/reports/components/ResultsTable.tsx` — add row checkboxes + per-row action menu
- Create: `src/features/reports/components/TableActionMenu.tsx`
- Create: `src/features/reports/components/__tests__/TableActionMenu.test.tsx`

- [ ] **Step 1: Implement `TableActionMenu`**

```tsx
// src/features/reports/components/TableActionMenu.tsx
"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import type { ActionProposal } from "../lib/actions/types";

interface Props {
  row: Record<string, unknown>;
  onPick: (proposal: ActionProposal) => void;
}

export function TableActionMenu({ row, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const leaid = typeof row.leaid === "string" ? row.leaid : null;

  if (!leaid) return null; // rows without a district identifier can't host district-scoped actions

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Row actions"
        className="rounded p-1 text-[#6B5F8A] hover:bg-[#F7F5FA]"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-[#EFEDF5] bg-white py-1 shadow-lg">
          <MenuItem
            label="Create task…"
            onClick={() => {
              setOpen(false);
              onPick({
                action: "create_task",
                params: { districtLeaid: leaid, title: "" },
                preview: [`Create task for district ${leaid}`],
              });
            }}
          />
          <MenuItem
            label="Log activity…"
            onClick={() => {
              setOpen(false);
              onPick({
                action: "create_activity",
                params: {
                  districtLeaid: leaid,
                  activityType: "call",
                  occurredAt: new Date().toISOString(),
                },
                preview: [`Log call for district ${leaid}`],
              });
            }}
          />
          <MenuItem
            label="Create contact…"
            onClick={() => {
              setOpen(false);
              onPick({
                action: "create_contact",
                params: { districtLeaid: leaid, firstName: "", lastName: "" },
                preview: [`Create contact for district ${leaid}`],
              });
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-sm text-[#1F1934] hover:bg-[#F7F5FA]"
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Update `ResultsTable` to include row checkboxes + TableActionMenu**

Replace `ResultsTable.tsx` contents with:

```tsx
// src/features/reports/components/ResultsTable.tsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { TABLE_REGISTRY } from "@/lib/district-column-metadata";
import type { ActionProposal } from "../lib/actions/types";
import { TableActionMenu } from "./TableActionMenu";

interface Props {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  selectedRowIndexes?: Set<number>;
  onSelectionChange?: (next: Set<number>) => void;
  onRowAction?: (proposal: ActionProposal) => void;
}

function isIdColumn(columnName: string): boolean {
  for (const tbl of Object.values(TABLE_REGISTRY)) {
    const match = tbl.columns.find((c) => c.column === columnName);
    if (match && match.format === "id") return true;
  }
  return /^(id|leaid|.*_id|uuid)$/i.test(columnName);
}

export function ResultsTable({
  columns,
  rows,
  selectedRowIndexes,
  onSelectionChange,
  onRowAction,
}: Props) {
  const [showTechnical, setShowTechnical] = useState(false);
  const selectionEnabled = !!onSelectionChange;
  const selected = selectedRowIndexes ?? new Set<number>();

  const visibleColumns = useMemo(
    () => (showTechnical ? columns : columns.filter((c) => !isIdColumn(c))),
    [columns, showTechnical],
  );

  const toggleRow = useCallback(
    (idx: number) => {
      if (!onSelectionChange) return;
      const next = new Set(selected);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      onSelectionChange(next);
    },
    [selected, onSelectionChange],
  );

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (selected.size === rows.length) onSelectionChange(new Set());
    else onSelectionChange(new Set(rows.map((_, i) => i)));
  }, [rows, selected, onSelectionChange]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#EFEDF5] bg-white p-8 text-center text-[#6B5F8A]">
        No rows returned.
      </div>
    );
  }

  const hiddenCount = columns.length - visibleColumns.length;

  return (
    <div className="rounded-xl border border-[#EFEDF5] bg-white">
      <div className="flex items-center justify-between border-b border-[#EFEDF5] p-3">
        <div className="text-sm text-[#6B5F8A]">
          {rows.length} row{rows.length === 1 ? "" : "s"}
          {hiddenCount > 0 && !showTechnical
            ? ` · ${hiddenCount} technical column${hiddenCount === 1 ? "" : "s"} hidden`
            : ""}
          {selectionEnabled && selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </div>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowTechnical((v) => !v)}
            className="text-sm text-[#6B4EFF] hover:underline"
          >
            {showTechnical ? "Hide technical columns" : "Show technical columns"}
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#F7F5FA]">
            <tr>
              {selectionEnabled && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={selected.size === rows.length && rows.length > 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {visibleColumns.map((c) => (
                <th key={c} scope="col" className="px-4 py-2 text-left font-medium text-[#1F1934]">
                  {c}
                </th>
              ))}
              {onRowAction && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-[#EFEDF5]">
                {selectionEnabled && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${i + 1}`}
                      checked={selected.has(i)}
                      onChange={() => toggleRow(i)}
                    />
                  </td>
                )}
                {visibleColumns.map((c) => (
                  <td key={c} className="px-4 py-2 text-[#1F1934]">
                    {formatCell(row[c])}
                  </td>
                ))}
                {onRowAction && (
                  <td className="px-2 py-2">
                    <TableActionMenu row={row} onPick={onRowAction} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
```

- [ ] **Step 3: Test**

```tsx
// src/features/reports/components/__tests__/TableActionMenu.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { TableActionMenu } from "../TableActionMenu";

describe("TableActionMenu", () => {
  it("returns null when row has no leaid", () => {
    const { container } = render(
      <TableActionMenu row={{ name: "Something" }} onPick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("opens menu and fires onPick for Create task", () => {
    const onPick = vi.fn();
    render(<TableActionMenu row={{ leaid: "3100009", name: "Houston" }} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /row actions/i }));
    fireEvent.click(screen.getByText(/create task/i));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create_task" }),
    );
  });
});
```

- [ ] **Step 4: Commit**

```bash
npx vitest run src/features/reports/components/__tests__/TableActionMenu.test.tsx src/features/reports/components/__tests__/ResultsTable.test.tsx
git add src/features/reports/components/ResultsTable.tsx src/features/reports/components/TableActionMenu.tsx src/features/reports/components/__tests__/TableActionMenu.test.tsx
git commit -m "feat(actions): row action menu + selection checkboxes"
```

---

## Task 13: BulkActionToolbar

**Files:**
- Create: `src/features/reports/components/BulkActionToolbar.tsx`
- Create: `src/features/reports/components/__tests__/BulkActionToolbar.test.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/features/reports/components/BulkActionToolbar.tsx
"use client";

import type { ActionProposal } from "../lib/actions/types";

interface Props {
  selectedRows: Array<Record<string, unknown>>;
  onPick: (proposal: ActionProposal) => void;
}

export function BulkActionToolbar({ selectedRows, onPick }: Props) {
  const leaids = selectedRows
    .map((r) => (typeof r.leaid === "string" ? r.leaid : null))
    .filter((x): x is string => x !== null);

  if (leaids.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#6B4EFF]/30 bg-[#F7F5FA] px-4 py-2">
      <div className="text-sm font-medium text-[#1F1934]">
        {leaids.length} district{leaids.length === 1 ? "" : "s"} selected
      </div>
      <button
        type="button"
        onClick={() => {
          const planIdStr = window.prompt("Plan id to add districts to:");
          const planId = planIdStr ? Number(planIdStr) : NaN;
          if (!Number.isFinite(planId)) return;
          onPick({
            action: "add_districts_to_plan",
            params: { planId, districtLeaids: leaids },
            preview: [
              `Add ${leaids.length} district${leaids.length === 1 ? "" : "s"} to plan #${planId}.`,
            ],
          });
        }}
        className="rounded-lg bg-[#6B4EFF] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5A3FE6]"
      >
        Add to plan…
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Test**

```tsx
// src/features/reports/components/__tests__/BulkActionToolbar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BulkActionToolbar } from "../BulkActionToolbar";

describe("BulkActionToolbar", () => {
  it("returns null when no leaids are selected", () => {
    const { container } = render(
      <BulkActionToolbar selectedRows={[{ name: "X" }]} onPick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("fires onPick for add_districts_to_plan", () => {
    const onPick = vi.fn();
    vi.spyOn(window, "prompt").mockReturnValueOnce("7");
    render(
      <BulkActionToolbar
        selectedRows={[{ leaid: "a" }, { leaid: "b" }]}
        onPick={onPick}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "add_districts_to_plan",
        params: expect.objectContaining({ planId: 7 }),
      }),
    );
  });
});
```

- [ ] **Step 3: Commit**

```bash
npx vitest run src/features/reports/components/__tests__/BulkActionToolbar.test.tsx
git add src/features/reports/components/BulkActionToolbar.tsx src/features/reports/components/__tests__/BulkActionToolbar.test.tsx
git commit -m "feat(actions): BulkActionToolbar"
```

---

## Task 14: Wire actions into ReportsView

**Files:**
- Modify: `src/features/reports/components/ReportsView.tsx`

- [ ] **Step 1: Add action state and wiring**

Update the component to track selected rows, pending proposal, and use `useExecuteAction`:

```tsx
// Additions to ReportsView.tsx (incremental — preserve existing logic)
import { ActionConfirmation } from "./ActionConfirmation";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { useExecuteAction } from "../hooks/useExecuteAction";
import type { ActionProposal } from "../lib/actions/types";

// inside ReportsView function body:
const [pendingProposal, setPendingProposal] = useState<ActionProposal | null>(null);
const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(new Set());
const executeAction = useExecuteAction();

// Extend onSuccess handlers of chatTurn + chipEdit to set pendingProposal when data.proposal exists:
onSuccess: (data) => {
  setConversationId(data.conversationId);
  if (data.assistantText) {
    setMessages((m) => [...m, { role: "assistant", content: data.assistantText }]);
  }
  if (data.result) {
    setCurrent({
      summary: data.result.summary,
      columns: data.result.columns,
      rows: data.result.rows,
      sql: data.result.sql,
    });
  }
  if (data.proposal) setPendingProposal(data.proposal);
},

// Handler for confirming a proposal:
const handleConfirmProposal = useCallback(
  (proposal: ActionProposal) => {
    executeAction.mutate(
      { ...proposal, conversationId },
      {
        onSuccess: (res) => {
          setPendingProposal(null);
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: res.success ? `✓ ${res.message}` : `✗ ${res.message}`,
            },
          ]);
        },
        onError: (err) => {
          setPendingProposal(null);
          setMessages((m) => [...m, { role: "error", content: err.message }]);
        },
      },
    );
  },
  [executeAction, conversationId],
);

// Handler when a row/bulk action picks a proposal without going through Claude:
const handleRowOrBulkAction = useCallback((proposal: ActionProposal) => {
  setPendingProposal(proposal);
}, []);

// Compute selected rows for bulk toolbar:
const selectedRows = useMemo(
  () =>
    current ? [...selectedRowIndexes].map((i) => current.rows[i]!).filter(Boolean) : [],
  [current, selectedRowIndexes],
);
```

- [ ] **Step 2: Render the new components**

Inside the results column in the JSX (replace the `<ResultsTable />` block):

```tsx
{pendingProposal && (
  <ActionConfirmation
    proposal={pendingProposal}
    onConfirm={handleConfirmProposal}
    onCancel={() => setPendingProposal(null)}
    isSubmitting={executeAction.isPending}
  />
)}
{selectedRows.length > 0 && (
  <BulkActionToolbar selectedRows={selectedRows} onPick={handleRowOrBulkAction} />
)}
{current && !pendingProposal && (
  <div className="flex-1 overflow-hidden">
    <ResultsTable
      columns={current.columns}
      rows={current.rows}
      selectedRowIndexes={selectedRowIndexes}
      onSelectionChange={setSelectedRowIndexes}
      onRowAction={handleRowOrBulkAction}
    />
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
npx vitest run
git add src/features/reports/components/ReportsView.tsx
git commit -m "feat(actions): wire confirmation, row menu, bulk toolbar into ReportsView"
```

---

## Task 15: Manual integration + PR

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: NL action flow**

At `http://localhost:3005/reports`, type:

> Create a task to follow up with Houston ISD about their renewal.

Verify:
- Claude (possibly after asking a clarifying question) proposes `create_task`
- An ActionConfirmation card appears with the task title and district
- Clicking Confirm executes the action and a success message appears in chat
- Clicking Cancel dismisses the card

- [ ] **Step 3: Row action flow**

Run a districts query. Click the row action menu on a row → "Create task…". Verify:
- ActionConfirmation card appears
- Confirming creates the task
- Check `prisma studio` or the tasks table to verify the row exists

- [ ] **Step 4: Bulk action flow**

Run a districts query. Select 3 rows. The BulkActionToolbar appears. Click "Add to plan…", enter a plan id. Verify:
- ActionConfirmation card appears with the district count
- Confirming creates the plan memberships
- `SELECT * FROM territory_plan_districts WHERE plan_id = <id>` shows the new rows

- [ ] **Step 5: PR**

```bash
git push
gh pr create --title "feat: agentic actions on query results" --body "$(cat <<'EOF'
## Summary
- 4 MVP actions: add_districts_to_plan, create_task, create_activity, create_contact
- NL path: Claude proposes action as terminal tool call → confirmation card → execute
- Direct path: row menu + bulk toolbar → confirmation card → execute
- All actions require explicit user confirmation; all log to query_log

Design: `docs/superpowers/specs/2026-04-21-query-tool-agentic-redesign.md`
Depends on Plan 2 (merged).

## Test plan
- [x] Unit tests for handlers, dispatch validator, action route, UI components
- [ ] Manual: NL create_task flow end-to-end
- [ ] Manual: row-menu create_task flow
- [ ] Manual: bulk add_districts_to_plan with 3 selected rows
- [ ] Manual: action failures surface as chat errors without crashing

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary

15 tasks covering: 4 action types + tool definitions, dispatch validator + preview builder, 4 action handlers, action API route, agent-loop integration for terminal action proposals, chat/edit route updates to return proposals, ActionConfirmation card, useExecuteAction hook, row action menu with selection, bulk toolbar, ReportsView wiring, and PR prep.

## Out of scope / future work

- Additional actions (update district notes, update plan targets, bulk create tasks, merge contacts) — follow the same framework; ~50 lines each
- Undo last action — would require a reverse-action table and per-action reversal logic
- Action-specific confirmation customization (e.g., date picker for `create_task.dueDate`) — MVP asks the user to fill in missing fields via chat
- Row action menu for non-district rows (e.g., opportunities) — only district-scoped actions in MVP
