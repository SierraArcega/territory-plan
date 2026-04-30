# Query Tool Agentic Actions — Implementation Plan

> ⚠️ **Superseded. Will be rewritten as Plan 3 once Plan 2 (agent loop) is landing.**
> See `specs/2026-04-21-query-tool-agentic-redesign.md`. Reasons for rewrite: QueryLog migration bits overlap with shipped db-readiness work; action tools must plug into the new multi-turn agent loop alongside `run_sql`, not the old forced-tool-choice suggest endpoint.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Claude Query Tool with 9 write-action tools so users can add districts to plans, create activities/tasks/contacts, and update records — all through natural language chat or table action buttons, with mandatory confirmation before execution.

**Architecture:** Claude's existing tool_use pattern gains 9 new action tools alongside `generate_query`. When Claude proposes an action, the frontend renders a confirmation card. On confirm, a new `/api/ai/query/action` route dispatches to handler functions that execute the same Prisma mutations as existing API routes. Table rows also expose direct action menus that skip Claude and go straight to the action API.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma, TanStack Query, Tailwind 4, Claude Sonnet 4.6 (Anthropic Messages API with tool_use)

**Spec:** `Docs/superpowers/specs/2026-04-05-query-tool-agentic-actions.md`

**Working directory:** `.claude/worktrees/claude-query-tool/` (all file paths below are relative to this worktree root)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add action columns to QueryLog |
| `src/features/reports/lib/types.ts` | Modify | Add action-related types |
| `src/features/reports/lib/action-tools.ts` | Create | Claude tool definitions for 9 action tools |
| `src/features/reports/lib/action-handlers.ts` | Create | 9 handler functions that execute Prisma mutations |
| `src/features/reports/lib/query-engine.ts` | Modify | Include action tools in Claude system prompt |
| `src/features/reports/lib/queries.ts` | Modify | Add useExecuteAction hook |
| `src/app/api/ai/query/action/route.ts` | Create | POST /api/ai/query/action endpoint |
| `src/features/reports/components/ActionConfirmation.tsx` | Create | Confirmation card with preview + confirm/cancel |
| `src/features/reports/components/PlanPicker.tsx` | Create | Territory plan selection dropdown for table actions |
| `src/features/reports/components/TableActionMenu.tsx` | Create | Row-level action dropdown menu |
| `src/features/reports/components/BulkActionToolbar.tsx` | Create | Toolbar for bulk actions on selected rows |
| `src/features/reports/components/ChatPanel.tsx` | Modify | Handle action tool_use responses, render ActionConfirmation |
| `src/features/reports/components/DataTable.tsx` | Modify | Add checkbox column, row action menu |
| `src/features/reports/components/ReportsView.tsx` | Modify | Wire bulk toolbar, pass action state |
| `src/features/reports/lib/__tests__/action-handlers.test.ts` | Create | Unit tests for action handlers |

---

### Task 1: Add Action Columns to QueryLog (Prisma Schema + Migration)

**Files:**
- Modify: `prisma/schema.prisma:1513-1530`

- [ ] **Step 1: Update the QueryLog model in Prisma schema**

Add three new optional columns to the QueryLog model:

```prisma
model QueryLog {
  id              Int       @id @default(autoincrement())
  userId          String    @map("user_id") @db.Uuid
  conversationId  String    @default(dbgenerated("gen_random_uuid()")) @map("conversation_id") @db.Uuid
  question        String
  sql             String?
  rowCount        Int?      @map("row_count")
  executionTimeMs Int?      @map("execution_time_ms")
  error           String?
  action          String?
  actionParams    Json?     @map("action_params")
  actionSuccess   Boolean?  @map("action_success")
  createdAt       DateTime  @default(now()) @map("created_at")

  user UserProfile @relation("UserQueryLogs", fields: [userId], references: [id])

  @@index([userId])
  @@index([conversationId])
  @@index([createdAt(sort: Desc)])
  @@map("query_log")
}
```

- [ ] **Step 2: Generate and apply the migration**

Run:
```bash
npx prisma migrate dev --name add_action_columns_to_query_log
```

Expected: Migration creates `action`, `action_params`, `action_success` columns on `query_log` table.

- [ ] **Step 3: Verify Prisma client regenerated**

Run:
```bash
npx prisma generate
```

Expected: Prisma client types now include `action`, `actionParams`, `actionSuccess` on `QueryLog`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add action columns to query_log for agentic action tracking"
```

---

### Task 2: Action Types

**Files:**
- Modify: `src/features/reports/lib/types.ts`

- [ ] **Step 1: Add action-related types to types.ts**

Append after the existing `ClarificationResponse` interface:

```typescript
// ── Action Types ──

export const ACTION_NAMES = [
  "add_districts_to_plan",
  "remove_districts_from_plan",
  "update_district_targets",
  "create_activity",
  "update_activity",
  "create_task",
  "update_task",
  "create_contact",
  "update_contact",
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export interface ActionProposal {
  action: ActionName;
  params: Record<string, unknown>;
  description: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  details?: unknown;
}

export interface ActionResponse {
  action: ActionName;
  params: Record<string, unknown>;
  description: string;
  conversationId: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/lib/types.ts
git commit -m "feat: add action type definitions for agentic actions"
```

---

### Task 3: Action Tool Definitions for Claude

**Files:**
- Create: `src/features/reports/lib/action-tools.ts`

- [ ] **Step 1: Create the action tools file with all 9 tool schemas**

```typescript
/**
 * Claude tool definitions for agentic actions.
 * These are included in the Claude API request alongside generate_query.
 */

export const ACTION_TOOLS = [
  {
    name: "add_districts_to_plan",
    description:
      "Add one or more districts to a territory plan, optionally with revenue targets. Use when the user wants to add districts to a plan.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: {
          type: "string" as const,
          description: "The territory plan ID to add districts to",
        },
        districts: {
          type: "array" as const,
          description: "Districts to add",
          items: {
            type: "object" as const,
            properties: {
              leaid: { type: "string" as const, description: "District LEAID (7-character string)" },
              renewalTarget: { type: "number" as const, description: "Renewal revenue target in dollars" },
              winbackTarget: { type: "number" as const, description: "Winback revenue target in dollars" },
              expansionTarget: { type: "number" as const, description: "Expansion revenue target in dollars" },
              newBusinessTarget: { type: "number" as const, description: "New business revenue target in dollars" },
              notes: { type: "string" as const, description: "Notes about this district" },
            },
            required: ["leaid"],
          },
        },
      },
      required: ["planId", "districts"],
    },
  },
  {
    name: "remove_districts_from_plan",
    description:
      "Remove one or more districts from a territory plan. Use when the user wants to remove or unlink districts from a plan.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: {
          type: "string" as const,
          description: "The territory plan ID to remove districts from",
        },
        leaids: {
          type: "array" as const,
          description: "District LEAIDs to remove",
          items: { type: "string" as const },
        },
      },
      required: ["planId", "leaids"],
    },
  },
  {
    name: "update_district_targets",
    description:
      "Update revenue targets for districts already in a territory plan. Use when the user wants to change targets, adjust goals, or set dollar amounts for plan districts.",
    input_schema: {
      type: "object" as const,
      properties: {
        planId: {
          type: "string" as const,
          description: "The territory plan ID containing the districts",
        },
        districts: {
          type: "array" as const,
          description: "Districts with updated targets",
          items: {
            type: "object" as const,
            properties: {
              leaid: { type: "string" as const, description: "District LEAID" },
              renewalTarget: { type: "number" as const, description: "New renewal target in dollars" },
              winbackTarget: { type: "number" as const, description: "New winback target in dollars" },
              expansionTarget: { type: "number" as const, description: "New expansion target in dollars" },
              newBusinessTarget: { type: "number" as const, description: "New new-business target in dollars" },
              notes: { type: "string" as const, description: "Updated notes" },
            },
            required: ["leaid"],
          },
        },
      },
      required: ["planId", "districts"],
    },
  },
  {
    name: "create_activity",
    description:
      "Create a new activity (visit, call, email, event, etc.) linked to districts, plans, or contacts. Use when the user wants to log or schedule an activity.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string" as const,
          enum: [
            "conference", "road_trip", "dinner", "happy_hour", "school_site_visit", "fun_and_games",
            "mixmax_campaign", "discovery_call", "program_check_in", "proposal_review",
            "renewal_conversation", "gift_drop", "booth_exhibit", "conference_sponsor",
            "meal_reception", "charity_event", "webinar", "speaking_engagement",
            "professional_development", "course",
          ],
          description: "Activity type",
        },
        title: { type: "string" as const, description: "Activity title" },
        startDate: { type: "string" as const, description: "Start date (ISO 8601)" },
        endDate: { type: "string" as const, description: "End date (ISO 8601)" },
        notes: { type: "string" as const, description: "Activity notes" },
        status: {
          type: "string" as const,
          enum: ["planned", "requested", "planning", "in_progress", "wrapping_up", "completed", "cancelled"],
          description: "Activity status (default: planned)",
        },
        planIds: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Territory plan IDs to link",
        },
        districtLeaids: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "District LEAIDs to link",
        },
        contactIds: {
          type: "array" as const,
          items: { type: "number" as const },
          description: "Contact IDs to link",
        },
      },
      required: ["type", "title"],
    },
  },
  {
    name: "update_activity",
    description:
      "Update an existing activity's fields (status, dates, outcome, notes, links). Use when the user wants to change an activity's details.",
    input_schema: {
      type: "object" as const,
      properties: {
        activityId: { type: "string" as const, description: "Activity ID to update" },
        title: { type: "string" as const, description: "New title" },
        status: {
          type: "string" as const,
          enum: ["planned", "requested", "planning", "in_progress", "wrapping_up", "completed", "cancelled"],
        },
        startDate: { type: "string" as const, description: "New start date (ISO 8601)" },
        endDate: { type: "string" as const, description: "New end date (ISO 8601)" },
        notes: { type: "string" as const, description: "Updated notes" },
        outcome: { type: "string" as const, description: "Activity outcome description" },
        outcomeType: { type: "string" as const, description: "Outcome category" },
        rating: { type: "number" as const, description: "Activity rating (1-5)" },
      },
      required: ["activityId"],
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task linked to districts, plans, or contacts. Use when the user wants to create a to-do, follow-up, or reminder.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const, description: "Task title" },
        description: { type: "string" as const, description: "Task description" },
        priority: {
          type: "string" as const,
          enum: ["low", "medium", "high", "urgent"],
          description: "Task priority (default: medium)",
        },
        dueDate: { type: "string" as const, description: "Due date (ISO 8601)" },
        planIds: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Territory plan IDs to link",
        },
        leaids: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "District LEAIDs to link",
        },
        contactIds: {
          type: "array" as const,
          items: { type: "number" as const },
          description: "Contact IDs to link",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description:
      "Update an existing task's fields. Use when the user wants to mark a task complete, change priority, update due date, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        taskId: { type: "string" as const, description: "Task ID to update" },
        title: { type: "string" as const, description: "New title" },
        description: { type: "string" as const, description: "Updated description" },
        status: {
          type: "string" as const,
          enum: ["todo", "in_progress", "blocked", "done"],
        },
        priority: {
          type: "string" as const,
          enum: ["low", "medium", "high", "urgent"],
        },
        dueDate: { type: "string" as const, description: "New due date (ISO 8601)" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "create_contact",
    description:
      "Create a new contact at a district. Use when the user wants to add a person they've met or need to reach out to.",
    input_schema: {
      type: "object" as const,
      properties: {
        leaid: { type: "string" as const, description: "District LEAID for this contact" },
        name: { type: "string" as const, description: "Contact's full name" },
        title: { type: "string" as const, description: "Job title" },
        email: { type: "string" as const, description: "Email address" },
        phone: { type: "string" as const, description: "Phone number" },
        isPrimary: { type: "boolean" as const, description: "Whether this is the primary contact for the district" },
        persona: {
          type: "string" as const,
          description: "Contact persona category",
          enum: [
            "Executive Leadership", "Finance & Business Operations", "Student Services & Support",
            "Academic Leadership", "Curriculum & Instruction", "Technology & Information Systems",
            "Human Resources", "Special Education", "Communications & Community Engagement",
            "Federal Programs & Compliance", "Operations & Facilities", "Assessment & Accountability",
            "Administrative Support", "Innovation & Special Programs", "Legal & Compliance",
          ],
        },
        seniorityLevel: {
          type: "string" as const,
          description: "Seniority level",
          enum: [
            "Executive Leadership", "Senior Leadership", "Director Level",
            "Manager/Coordinator Level", "Specialist Level", "Administrative Support",
            "School-Level Leadership",
          ],
        },
      },
      required: ["leaid", "name"],
    },
  },
  {
    name: "update_contact",
    description:
      "Update an existing contact's information. Use when the user wants to change a contact's title, email, phone, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        contactId: { type: "number" as const, description: "Contact ID to update" },
        name: { type: "string" as const, description: "Updated name" },
        title: { type: "string" as const, description: "Updated job title" },
        email: { type: "string" as const, description: "Updated email" },
        phone: { type: "string" as const, description: "Updated phone" },
        isPrimary: { type: "boolean" as const, description: "Set as primary contact" },
        persona: { type: "string" as const, description: "Updated persona" },
        seniorityLevel: { type: "string" as const, description: "Updated seniority level" },
      },
      required: ["contactId"],
    },
  },
];

/**
 * Build the action instructions section for Claude's system prompt.
 */
export function getActionInstructions(): string {
  return `
ACTION TOOLS: You also have action tools to modify data. When the user asks you to take an action (add, remove, update, create), use the appropriate action tool. Rules:
- Always include all required fields
- For bulk operations, include ALL affected entities in a single tool call
- If you need data to complete an action (e.g., plan ID, district LEAIDs), query first using generate_query, then propose the action in a follow-up
- If the user's intent is ambiguous between a query and an action, ask for clarification
- Include a human-readable description of what the action will do

Available actions: add_districts_to_plan, remove_districts_from_plan, update_district_targets, create_activity, update_activity, create_task, update_task, create_contact, update_contact
`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/lib/action-tools.ts
git commit -m "feat: define 9 action tool schemas for Claude API"
```

---

### Task 4: Action Handlers

**Files:**
- Create: `src/features/reports/lib/action-handlers.ts`
- Create: `src/features/reports/lib/__tests__/action-handlers.test.ts`

- [ ] **Step 1: Write tests for action handler validation**

Create `src/features/reports/lib/__tests__/action-handlers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateActionParams } from "../action-handlers";

describe("validateActionParams", () => {
  it("rejects unknown action names", () => {
    expect(() => validateActionParams("drop_tables", {})).toThrow("Unknown action");
  });

  it("requires planId for add_districts_to_plan", () => {
    expect(() =>
      validateActionParams("add_districts_to_plan", { districts: [{ leaid: "1234567" }] })
    ).toThrow("planId is required");
  });

  it("requires districts array for add_districts_to_plan", () => {
    expect(() =>
      validateActionParams("add_districts_to_plan", { planId: "abc" })
    ).toThrow("districts array is required");
  });

  it("enforces bulk limit of 100", () => {
    const districts = Array.from({ length: 101 }, (_, i) => ({ leaid: String(i).padStart(7, "0") }));
    expect(() =>
      validateActionParams("add_districts_to_plan", { planId: "abc", districts })
    ).toThrow("exceeds maximum of 100");
  });

  it("requires title for create_activity", () => {
    expect(() =>
      validateActionParams("create_activity", { type: "conference" })
    ).toThrow("title is required");
  });

  it("requires valid activity type", () => {
    expect(() =>
      validateActionParams("create_activity", { type: "invalid_type", title: "Test" })
    ).toThrow("Invalid activity type");
  });

  it("requires title for create_task", () => {
    expect(() => validateActionParams("create_task", {})).toThrow("title is required");
  });

  it("requires leaid and name for create_contact", () => {
    expect(() => validateActionParams("create_contact", { name: "John" })).toThrow("leaid is required");
    expect(() => validateActionParams("create_contact", { leaid: "1234567" })).toThrow("name is required");
  });

  it("requires activityId for update_activity", () => {
    expect(() => validateActionParams("update_activity", {})).toThrow("activityId is required");
  });

  it("requires taskId for update_task", () => {
    expect(() => validateActionParams("update_task", {})).toThrow("taskId is required");
  });

  it("requires contactId for update_contact", () => {
    expect(() => validateActionParams("update_contact", {})).toThrow("contactId is required");
  });

  it("accepts valid add_districts_to_plan params", () => {
    expect(() =>
      validateActionParams("add_districts_to_plan", {
        planId: "abc",
        districts: [{ leaid: "1234567", renewalTarget: 5000 }],
      })
    ).not.toThrow();
  });

  it("accepts valid create_activity params", () => {
    expect(() =>
      validateActionParams("create_activity", {
        type: "conference",
        title: "EdTech Summit",
      })
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd .claude/worktrees/claude-query-tool && npx vitest run src/features/reports/lib/__tests__/action-handlers.test.ts
```

Expected: FAIL — `validateActionParams` does not exist yet.

- [ ] **Step 3: Create the action handlers file**

Create `src/features/reports/lib/action-handlers.ts`:

```typescript
import prisma from "@/lib/prisma";
import { syncPlanRollups } from "@/features/plans/lib/rollup-sync";
import type { ActionName, ActionResult } from "./types";
import { ACTION_NAMES } from "./types";

const BULK_LIMIT = 100;

const ALL_ACTIVITY_TYPES = [
  "conference", "road_trip", "dinner", "happy_hour", "school_site_visit", "fun_and_games",
  "mixmax_campaign", "discovery_call", "program_check_in", "proposal_review",
  "renewal_conversation", "gift_drop", "booth_exhibit", "conference_sponsor",
  "meal_reception", "charity_event", "webinar", "speaking_engagement",
  "professional_development", "course",
];

const VALID_ACTIVITY_STATUSES = [
  "planned", "requested", "planning", "in_progress", "wrapping_up", "completed", "cancelled",
];

const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"];
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];

interface User {
  id: string;
  email: string;
}

/**
 * Validate action params before execution.
 * Throws descriptive errors for invalid input.
 */
export function validateActionParams(action: string, params: Record<string, unknown>): void {
  if (!ACTION_NAMES.includes(action as ActionName)) {
    throw new Error(`Unknown action: ${action}`);
  }

  switch (action) {
    case "add_districts_to_plan":
    case "update_district_targets": {
      if (!params.planId) throw new Error("planId is required");
      if (!Array.isArray(params.districts) || params.districts.length === 0) {
        throw new Error("districts array is required and must not be empty");
      }
      if (params.districts.length > BULK_LIMIT) {
        throw new Error(`districts array exceeds maximum of ${BULK_LIMIT} items`);
      }
      for (const d of params.districts) {
        if (!d || typeof d !== "object" || !("leaid" in d)) {
          throw new Error("Each district must have a leaid");
        }
      }
      break;
    }
    case "remove_districts_from_plan": {
      if (!params.planId) throw new Error("planId is required");
      if (!Array.isArray(params.leaids) || params.leaids.length === 0) {
        throw new Error("leaids array is required and must not be empty");
      }
      if (params.leaids.length > BULK_LIMIT) {
        throw new Error(`leaids array exceeds maximum of ${BULK_LIMIT} items`);
      }
      break;
    }
    case "create_activity": {
      if (!params.type) throw new Error("type is required");
      if (!ALL_ACTIVITY_TYPES.includes(params.type as string)) {
        throw new Error(`Invalid activity type: ${params.type}`);
      }
      if (!params.title || !(params.title as string).trim()) throw new Error("title is required");
      if (params.status && !VALID_ACTIVITY_STATUSES.includes(params.status as string)) {
        throw new Error(`Invalid activity status: ${params.status}`);
      }
      break;
    }
    case "update_activity": {
      if (!params.activityId) throw new Error("activityId is required");
      if (params.status && !VALID_ACTIVITY_STATUSES.includes(params.status as string)) {
        throw new Error(`Invalid activity status: ${params.status}`);
      }
      if (params.rating != null && (Number(params.rating) < 1 || Number(params.rating) > 5)) {
        throw new Error("rating must be between 1 and 5");
      }
      break;
    }
    case "create_task": {
      if (!params.title || !(params.title as string).trim()) throw new Error("title is required");
      if (params.status && !TASK_STATUSES.includes(params.status as string)) {
        throw new Error(`Invalid task status: ${params.status}`);
      }
      if (params.priority && !TASK_PRIORITIES.includes(params.priority as string)) {
        throw new Error(`Invalid task priority: ${params.priority}`);
      }
      break;
    }
    case "update_task": {
      if (!params.taskId) throw new Error("taskId is required");
      if (params.status && !TASK_STATUSES.includes(params.status as string)) {
        throw new Error(`Invalid task status: ${params.status}`);
      }
      if (params.priority && !TASK_PRIORITIES.includes(params.priority as string)) {
        throw new Error(`Invalid task priority: ${params.priority}`);
      }
      break;
    }
    case "create_contact": {
      if (!params.leaid) throw new Error("leaid is required");
      if (!params.name || !(params.name as string).trim()) throw new Error("name is required");
      break;
    }
    case "update_contact": {
      if (!params.contactId) throw new Error("contactId is required");
      break;
    }
  }
}

// ── Handler Functions ──

async function handleAddDistrictsToPlan(
  user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const planId = params.planId as string;
  const districts = params.districts as Array<{
    leaid: string;
    renewalTarget?: number;
    winbackTarget?: number;
    expansionTarget?: number;
    newBusinessTarget?: number;
    notes?: string;
  }>;

  // Verify plan exists
  const plan = await prisma.territoryPlan.findUnique({
    where: { id: planId },
    select: { id: true, name: true },
  });
  if (!plan) throw new Error(`Territory plan not found: ${planId}`);

  // Use createMany with skipDuplicates for bulk add
  const result = await prisma.territoryPlanDistrict.createMany({
    data: districts.map((d) => ({
      planId,
      districtLeaid: d.leaid,
      renewalTarget: d.renewalTarget ?? null,
      winbackTarget: d.winbackTarget ?? null,
      expansionTarget: d.expansionTarget ?? null,
      newBusinessTarget: d.newBusinessTarget ?? null,
      notes: d.notes ?? null,
    })),
    skipDuplicates: true,
  });

  await syncPlanRollups(planId);

  return {
    success: true,
    message: `Added ${result.count} district${result.count !== 1 ? "s" : ""} to ${plan.name}`,
    details: { added: result.count, planId },
  };
}

async function handleRemoveDistrictsFromPlan(
  _user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const planId = params.planId as string;
  const leaids = params.leaids as string[];

  const plan = await prisma.territoryPlan.findUnique({
    where: { id: planId },
    select: { id: true, name: true },
  });
  if (!plan) throw new Error(`Territory plan not found: ${planId}`);

  const result = await prisma.territoryPlanDistrict.deleteMany({
    where: { planId, districtLeaid: { in: leaids } },
  });

  await syncPlanRollups(planId);

  return {
    success: true,
    message: `Removed ${result.count} district${result.count !== 1 ? "s" : ""} from ${plan.name}`,
    details: { removed: result.count, planId },
  };
}

async function handleUpdateDistrictTargets(
  _user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const planId = params.planId as string;
  const districts = params.districts as Array<{
    leaid: string;
    renewalTarget?: number;
    winbackTarget?: number;
    expansionTarget?: number;
    newBusinessTarget?: number;
    notes?: string;
  }>;

  const plan = await prisma.territoryPlan.findUnique({
    where: { id: planId },
    select: { id: true, name: true },
  });
  if (!plan) throw new Error(`Territory plan not found: ${planId}`);

  let updated = 0;
  for (const d of districts) {
    await prisma.territoryPlanDistrict.update({
      where: { planId_districtLeaid: { planId, districtLeaid: d.leaid } },
      data: {
        ...(d.renewalTarget !== undefined && { renewalTarget: d.renewalTarget }),
        ...(d.winbackTarget !== undefined && { winbackTarget: d.winbackTarget }),
        ...(d.expansionTarget !== undefined && { expansionTarget: d.expansionTarget }),
        ...(d.newBusinessTarget !== undefined && { newBusinessTarget: d.newBusinessTarget }),
        ...(d.notes !== undefined && { notes: d.notes }),
      },
    });
    updated++;
  }

  await syncPlanRollups(planId);

  return {
    success: true,
    message: `Updated targets for ${updated} district${updated !== 1 ? "s" : ""} in ${plan.name}`,
    details: { updated, planId },
  };
}

async function handleCreateActivity(
  user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const type = params.type as string;
  const title = (params.title as string).trim();
  const status = (params.status as string) || "planned";
  const planIds = (params.planIds as string[]) || [];
  const districtLeaids = (params.districtLeaids as string[]) || [];
  const contactIds = (params.contactIds as number[]) || [];

  // Derive states from districts
  let derivedStates: string[] = [];
  if (districtLeaids.length > 0) {
    const districts = await prisma.district.findMany({
      where: { leaid: { in: districtLeaids } },
      select: { stateFips: true },
    });
    derivedStates = [...new Set(districts.map((d) => d.stateFips))];
  }

  const activity = await prisma.activity.create({
    data: {
      type,
      title,
      notes: (params.notes as string)?.trim() || null,
      startDate: params.startDate ? new Date(params.startDate as string) : null,
      endDate: params.endDate ? new Date(params.endDate as string) : null,
      status,
      createdByUserId: user.id,
      plans: { create: planIds.map((planId) => ({ planId })) },
      districts: {
        create: districtLeaids.map((leaid) => ({
          districtLeaid: leaid,
          warningDismissed: false,
          position: 0,
        })),
      },
      contacts: { create: contactIds.map((contactId) => ({ contactId })) },
      states: {
        create: derivedStates.map((stateFips) => ({
          stateFips,
          isExplicit: false,
        })),
      },
    },
    select: { id: true, title: true, type: true },
  });

  return {
    success: true,
    message: `Created ${type.replace(/_/g, " ")} "${activity.title}"`,
    details: { activityId: activity.id },
  };
}

async function handleUpdateActivity(
  user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const activityId = params.activityId as string;

  const existing = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, createdByUserId: true, title: true },
  });
  if (!existing) throw new Error(`Activity not found: ${activityId}`);
  if (existing.createdByUserId && existing.createdByUserId !== user.id) {
    throw new Error("You don't have permission to update this activity");
  }

  const activity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      ...(params.title && { title: (params.title as string).trim() }),
      ...(params.status && { status: params.status as string }),
      ...(params.startDate !== undefined && {
        startDate: params.startDate ? new Date(params.startDate as string) : null,
      }),
      ...(params.endDate !== undefined && {
        endDate: params.endDate ? new Date(params.endDate as string) : null,
      }),
      ...(params.notes !== undefined && { notes: (params.notes as string)?.trim() || null }),
      ...(params.outcome !== undefined && { outcome: (params.outcome as string)?.trim() || null }),
      ...(params.outcomeType !== undefined && { outcomeType: (params.outcomeType as string) || null }),
      ...(params.rating !== undefined && { rating: Number(params.rating) }),
    },
    select: { id: true, title: true },
  });

  return {
    success: true,
    message: `Updated activity "${activity.title}"`,
    details: { activityId: activity.id },
  };
}

async function handleCreateTask(
  user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const title = (params.title as string).trim();
  const planIds = (params.planIds as string[]) || [];
  const leaids = (params.leaids as string[]) || [];
  const contactIds = (params.contactIds as number[]) || [];

  const task = await prisma.task.create({
    data: {
      title,
      description: (params.description as string)?.trim() || null,
      status: (params.status as string) || "todo",
      priority: (params.priority as string) || "medium",
      dueDate: params.dueDate ? new Date(params.dueDate as string) : null,
      createdByUserId: user.id,
      plans: { create: planIds.map((planId) => ({ planId })) },
      districts: { create: leaids.map((leaid) => ({ districtLeaid: leaid })) },
      contacts: { create: contactIds.map((contactId) => ({ contactId })) },
    },
    select: { id: true, title: true },
  });

  return {
    success: true,
    message: `Created task "${task.title}"`,
    details: { taskId: task.id },
  };
}

async function handleUpdateTask(
  user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = params.taskId as string;

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, createdByUserId: true, title: true },
  });
  if (!existing) throw new Error(`Task not found: ${taskId}`);
  if (existing.createdByUserId !== user.id) {
    throw new Error("You don't have permission to update this task");
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(params.title !== undefined && { title: (params.title as string).trim() }),
      ...(params.description !== undefined && { description: (params.description as string)?.trim() || null }),
      ...(params.status && { status: params.status as string }),
      ...(params.priority && { priority: params.priority as string }),
      ...(params.dueDate !== undefined && {
        dueDate: params.dueDate ? new Date(params.dueDate as string) : null,
      }),
    },
    select: { id: true, title: true, status: true },
  });

  return {
    success: true,
    message: `Updated task "${task.title}"${params.status ? ` → ${params.status}` : ""}`,
    details: { taskId: task.id },
  };
}

async function handleCreateContact(
  _user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const leaid = params.leaid as string;
  const name = (params.name as string).trim();
  const isPrimary = params.isPrimary as boolean | undefined;

  // If setting as primary, unset other primary contacts
  if (isPrimary) {
    await prisma.contact.updateMany({
      where: { leaid, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.contact.create({
    data: {
      leaid,
      name,
      title: (params.title as string) || null,
      email: (params.email as string) || null,
      phone: (params.phone as string) || null,
      isPrimary: isPrimary || false,
      linkedinUrl: (params.linkedinUrl as string) || null,
      persona: (params.persona as string) || null,
      seniorityLevel: (params.seniorityLevel as string) || null,
    },
    select: { id: true, name: true },
  });

  return {
    success: true,
    message: `Created contact "${contact.name}"`,
    details: { contactId: contact.id },
  };
}

async function handleUpdateContact(
  _user: User,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const contactId = params.contactId as number;

  const existing = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, name: true, leaid: true, isPrimary: true },
  });
  if (!existing) throw new Error(`Contact not found: ${contactId}`);

  // If setting as primary, unset other primary contacts
  if (params.isPrimary && !existing.isPrimary) {
    await prisma.contact.updateMany({
      where: { leaid: existing.leaid, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.contact.update({
    where: { id: contactId },
    data: {
      ...(params.name !== undefined && { name: (params.name as string).trim() }),
      ...(params.title !== undefined && { title: (params.title as string) || null }),
      ...(params.email !== undefined && { email: (params.email as string) || null }),
      ...(params.phone !== undefined && { phone: (params.phone as string) || null }),
      ...(params.isPrimary !== undefined && { isPrimary: params.isPrimary as boolean }),
      ...(params.linkedinUrl !== undefined && { linkedinUrl: (params.linkedinUrl as string) || null }),
      ...(params.persona !== undefined && { persona: (params.persona as string) || null }),
      ...(params.seniorityLevel !== undefined && { seniorityLevel: (params.seniorityLevel as string) || null }),
    },
    select: { id: true, name: true },
  });

  return {
    success: true,
    message: `Updated contact "${contact.name}"`,
    details: { contactId: contact.id },
  };
}

// ── Dispatch ──

const ACTION_HANDLERS: Record<
  ActionName,
  (user: User, params: Record<string, unknown>) => Promise<ActionResult>
> = {
  add_districts_to_plan: handleAddDistrictsToPlan,
  remove_districts_from_plan: handleRemoveDistrictsFromPlan,
  update_district_targets: handleUpdateDistrictTargets,
  create_activity: handleCreateActivity,
  update_activity: handleUpdateActivity,
  create_task: handleCreateTask,
  update_task: handleUpdateTask,
  create_contact: handleCreateContact,
  update_contact: handleUpdateContact,
};

/**
 * Execute an action by name. Validates params, then dispatches to the handler.
 */
export async function executeAction(
  user: User,
  action: string,
  params: Record<string, unknown>
): Promise<ActionResult> {
  validateActionParams(action, params);
  const handler = ACTION_HANDLERS[action as ActionName];
  return handler(user, params);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
cd .claude/worktrees/claude-query-tool && npx vitest run src/features/reports/lib/__tests__/action-handlers.test.ts
```

Expected: All 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/lib/action-handlers.ts src/features/reports/lib/__tests__/action-handlers.test.ts
git commit -m "feat: add action handler functions for 9 agentic actions with validation"
```

---

### Task 5: Action API Route

**Files:**
- Create: `src/app/api/ai/query/action/route.ts`

- [ ] **Step 1: Create the action API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { executeAction } from "@/features/reports/lib/action-handlers";
import { ACTION_NAMES } from "@/features/reports/lib/types";

export const dynamic = "force-dynamic";

const RATE_LIMIT_PER_HOUR = 50;

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { action, params, conversationId } = body as {
      action: string;
      params: Record<string, unknown>;
      conversationId?: string;
    };

    if (!action || !params) {
      return NextResponse.json({ error: "action and params are required" }, { status: 400 });
    }

    if (!ACTION_NAMES.includes(action as (typeof ACTION_NAMES)[number])) {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Rate limit: count actions in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentActionCount = await prisma.queryLog.count({
      where: {
        userId: user.id,
        action: { not: null },
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentActionCount >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 50 actions per hour." },
        { status: 429 }
      );
    }

    const convId = conversationId || crypto.randomUUID();

    try {
      const result = await executeAction(user, action, params);

      await prisma.queryLog.create({
        data: {
          userId: user.id,
          conversationId: convId,
          question: `[action] ${action}`,
          action,
          actionParams: params,
          actionSuccess: result.success,
        },
      });

      return NextResponse.json(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      await prisma.queryLog.create({
        data: {
          userId: user.id,
          conversationId: convId,
          question: `[action] ${action}`,
          action,
          actionParams: params,
          actionSuccess: false,
          error: errorMsg,
        },
      });

      return NextResponse.json(
        { success: false, message: errorMsg },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error("Action endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ai/query/action/route.ts
git commit -m "feat: add POST /api/ai/query/action endpoint with rate limiting"
```

---

### Task 6: Integrate Action Tools into Query Engine

**Files:**
- Modify: `src/features/reports/lib/query-engine.ts:65-167`

- [ ] **Step 1: Update generateSQL to include action tools and return action proposals**

At the top of `query-engine.ts`, add the import:

```typescript
import { ACTION_TOOLS, getActionInstructions } from "./action-tools";
import type { ActionProposal } from "./types";
```

Update the `generateSQL` function return type and tool list. The function signature changes to:

```typescript
export async function generateSQL(
  question: string,
  history: ChatMessage[],
  resultContext?: string
): Promise<GeneratedQuery | ClarificationResponse | ActionProposal>
```

In the `body` object, add action tools to the `tools` array — append `...ACTION_TOOLS` after the `generate_query` tool.

Add the action instructions to the system prompt by appending `${getActionInstructions()}` after the existing schema section.

If `resultContext` is provided (for chaining), append it to the system prompt:
```
\n\nCURRENT QUERY RESULTS (use these when the user references "these", "this list", "the results", etc.):\n${resultContext}
```

In the response parsing section, after the existing `generate_query` tool_use check, add handling for action tool_use:

```typescript
// Check if it's an action tool
if (toolUse?.name && toolUse.name !== "generate_query") {
  return {
    action: toolUse.name,
    params: toolUse.input || {},
    description: "", // Will be set by the text block below
  } as ActionProposal;
}
```

Also check for a text block alongside the action tool_use — Claude often emits a description before the tool_use:

```typescript
// If action, try to extract description from text blocks
if (toolUse?.name && toolUse.name !== "generate_query") {
  const textBlock = response.content?.find(
    (block: { type: string }) => block.type === "text"
  );
  return {
    action: toolUse.name as ActionName,
    params: toolUse.input || {},
    description: textBlock?.text || `Execute ${toolUse.name.replace(/_/g, " ")}`,
  };
}
```

- [ ] **Step 2: Add isActionProposal type guard**

In `query-engine.ts`, add:

```typescript
export function isActionProposal(
  result: unknown
): result is ActionProposal {
  return typeof result === "object" && result !== null && "action" in result && "params" in result;
}
```

- [ ] **Step 3: Update queryWithRetry to handle action proposals**

The function should pass action proposals through without executing them:

```typescript
export async function queryWithRetry(
  question: string,
  history: ChatMessage[],
  resultContext?: string
): Promise<QueryResult | ClarificationResponse | ActionProposal> {
  const generated = await generateSQL(question, history, resultContext);

  if (isClarification(generated)) return generated;
  if (isActionProposal(generated)) return generated;

  // ... rest of existing query execution logic unchanged
```

- [ ] **Step 4: Update the API route to handle action proposals**

Modify `src/app/api/ai/query/route.ts` to pass action proposals through to the frontend:

Add the import:
```typescript
import { queryWithRetry, isClarification, isActionProposal } from "@/features/reports/lib/query-engine";
```

After the clarification check, add:
```typescript
if (isActionProposal(result)) {
  return NextResponse.json({
    action: result.action,
    params: result.params,
    description: result.description,
    conversationId: convId,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/reports/lib/query-engine.ts src/app/api/ai/query/route.ts
git commit -m "feat: integrate action tools into Claude API calls and query pipeline"
```

---

### Task 7: Frontend Types and useExecuteAction Hook

**Files:**
- Modify: `src/features/reports/lib/queries.ts`

- [ ] **Step 1: Update AskQueryResponse type to include action proposals**

In `queries.ts`, update the `AskQueryResponse` type:

```typescript
export type AskQueryResponse =
  | (QueryResult & { conversationId: string })
  | { clarification: string; conversationId: string }
  | { action: string; params: Record<string, unknown>; description: string; conversationId: string };
```

- [ ] **Step 2: Add useExecuteAction hook**

Append to `queries.ts`:

```typescript
export function useExecuteAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      action: string;
      params: Record<string, unknown>;
      conversationId?: string;
    }) =>
      fetchJson<{ success: boolean; message: string; details?: unknown }>(
        `${API_BASE}/ai/query/action`,
        {
          method: "POST",
          body: JSON.stringify(params),
        }
      ),
    onSuccess: () => {
      // Invalidate relevant queries so the UI refreshes affected data
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["territory-plans"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/reports/lib/queries.ts
git commit -m "feat: add useExecuteAction hook and action response types"
```

---

### Task 8: ActionConfirmation Component

**Files:**
- Create: `src/features/reports/components/ActionConfirmation.tsx`

- [ ] **Step 1: Create the ActionConfirmation component**

```typescript
"use client";

import { useState } from "react";
import { Check, X, Loader2, AlertTriangle } from "lucide-react";
import { useExecuteAction } from "../lib/queries";

interface ActionConfirmationProps {
  action: string;
  params: Record<string, unknown>;
  description: string;
  conversationId?: string;
  onComplete: (success: boolean, message: string) => void;
  onCancel: () => void;
}

function formatActionName(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPreviewItems(action: string, params: Record<string, unknown>): string[] {
  const items: string[] = [];

  switch (action) {
    case "add_districts_to_plan":
    case "update_district_targets": {
      const districts = params.districts as Array<{ leaid: string }>;
      items.push(`Plan: ${params.planId}`);
      items.push(`Districts: ${districts.length}`);
      if (districts.length <= 5) {
        districts.forEach((d) => items.push(`  • ${d.leaid}`));
      } else {
        districts.slice(0, 3).forEach((d) => items.push(`  • ${d.leaid}`));
        items.push(`  • ... and ${districts.length - 3} more`);
      }
      break;
    }
    case "remove_districts_from_plan": {
      const leaids = params.leaids as string[];
      items.push(`Plan: ${params.planId}`);
      items.push(`Removing: ${leaids.length} district${leaids.length !== 1 ? "s" : ""}`);
      break;
    }
    case "create_activity": {
      items.push(`Type: ${(params.type as string).replace(/_/g, " ")}`);
      items.push(`Title: ${params.title}`);
      if (params.startDate) items.push(`Date: ${params.startDate}`);
      if (params.districtLeaids)
        items.push(`Districts: ${(params.districtLeaids as string[]).length}`);
      break;
    }
    case "update_activity": {
      items.push(`Activity: ${params.activityId}`);
      if (params.status) items.push(`Status → ${params.status}`);
      if (params.rating) items.push(`Rating: ${params.rating}/5`);
      break;
    }
    case "create_task": {
      items.push(`Title: ${params.title}`);
      if (params.priority) items.push(`Priority: ${params.priority}`);
      if (params.dueDate) items.push(`Due: ${params.dueDate}`);
      break;
    }
    case "update_task": {
      items.push(`Task: ${params.taskId}`);
      if (params.status) items.push(`Status → ${params.status}`);
      if (params.priority) items.push(`Priority → ${params.priority}`);
      break;
    }
    case "create_contact": {
      items.push(`Name: ${params.name}`);
      items.push(`District: ${params.leaid}`);
      if (params.title) items.push(`Title: ${params.title}`);
      break;
    }
    case "update_contact": {
      items.push(`Contact #${params.contactId}`);
      if (params.name) items.push(`Name → ${params.name}`);
      if (params.title) items.push(`Title → ${params.title}`);
      break;
    }
  }

  return items;
}

export default function ActionConfirmation({
  action,
  params,
  description,
  conversationId,
  onComplete,
  onCancel,
}: ActionConfirmationProps) {
  const executeAction = useExecuteAction();
  const [status, setStatus] = useState<"pending" | "executing" | "done">("pending");

  const previewItems = buildPreviewItems(action, params);
  const isDestructive = action === "remove_districts_from_plan";

  async function handleConfirm() {
    setStatus("executing");
    try {
      const result = await executeAction.mutateAsync({
        action,
        params,
        conversationId,
      });
      setStatus("done");
      onComplete(result.success, result.message);
    } catch (err) {
      setStatus("done");
      const msg = err instanceof Error ? err.message : "Action failed";
      onComplete(false, msg);
    }
  }

  if (status === "done") return null;

  return (
    <div className="bg-white border border-[#D4CFE2] rounded-xl p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        {isDestructive ? (
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        ) : (
          <div className="w-4 h-4 rounded-full bg-[#403770] flex items-center justify-center flex-shrink-0">
            <Check className="w-2.5 h-2.5 text-white" />
          </div>
        )}
        <span className="text-sm font-medium text-[#403770]">
          {formatActionName(action)}
        </span>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-[#6E6390] leading-relaxed">{description}</p>
      )}

      {/* Preview */}
      {previewItems.length > 0 && (
        <div className="bg-[#F7F5FA] rounded-lg px-3 py-2 space-y-0.5">
          {previewItems.map((item, i) => (
            <p key={i} className="text-xs text-[#403770] font-mono">
              {item}
            </p>
          ))}
        </div>
      )}

      {/* Buttons */}
      {status === "pending" && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleConfirm}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors ${
              isDestructive
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-[#403770] hover:bg-[#322a5a]"
            }`}
          >
            <Check className="w-3 h-3" />
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#6E6390] bg-[#F7F5FA] rounded-lg hover:bg-[#EFEDF5] transition-colors"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      )}

      {status === "executing" && (
        <div className="flex items-center gap-2 pt-1">
          <Loader2 className="w-4 h-4 text-[#403770] animate-spin" />
          <span className="text-xs text-[#6E6390]">Executing...</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/components/ActionConfirmation.tsx
git commit -m "feat: add ActionConfirmation component with preview and confirm/cancel"
```

---

### Task 9: Update ChatPanel for Action Handling

**Files:**
- Modify: `src/features/reports/components/ChatPanel.tsx`

- [ ] **Step 1: Update ChatPanel to handle action proposals from Claude**

Add import at top:
```typescript
import ActionConfirmation from "./ActionConfirmation";
```

Update the `DisplayMessage` interface:
```typescript
interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  result?: QueryResult;
  action?: {
    action: string;
    params: Record<string, unknown>;
    description: string;
  };
  actionResult?: { success: boolean; message: string };
}
```

In the `sendQuestion` function, after the clarification check, add handling for action responses:

```typescript
// Action proposal — Claude wants to perform an action
if ("action" in rest) {
  setMessages((prev) => [
    ...prev,
    {
      role: "assistant",
      content: rest.description || `I'd like to ${rest.action.replace(/_/g, " ")}`,
      action: {
        action: rest.action,
        params: rest.params,
        description: rest.description,
      },
    },
  ]);
  return;
}
```

In the message rendering section, after the existing `msg.result` button, add action confirmation rendering:

```typescript
{msg.action && !msg.actionResult && (
  <div className="mt-2">
    <ActionConfirmation
      action={msg.action.action}
      params={msg.action.params}
      description={msg.action.description}
      conversationId={conversationId}
      onComplete={(success, message) => {
        setMessages((prev) =>
          prev.map((m, j) =>
            j === i ? { ...m, actionResult: { success, message } } : m
          )
        );
      }}
      onCancel={() => {
        setMessages((prev) =>
          prev.map((m, j) =>
            j === i
              ? { ...m, action: undefined, actionResult: { success: false, message: "Cancelled" } }
              : m
          )
        );
      }}
    />
  </div>
)}

{msg.actionResult && (
  <p className={`mt-2 text-xs ${msg.actionResult.success ? "text-emerald-600" : "text-red-500"}`}>
    {msg.actionResult.success ? "✓" : "✗"} {msg.actionResult.message}
  </p>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/components/ChatPanel.tsx
git commit -m "feat: handle action proposals and confirmation in ChatPanel"
```

---

### Task 10: PlanPicker Component

**Files:**
- Create: `src/features/reports/components/PlanPicker.tsx`

- [ ] **Step 1: Create the PlanPicker component**

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

interface Plan {
  id: string;
  name: string;
}

interface PlanPickerProps {
  onSelect: (planId: string, planName: string) => void;
  onCancel: () => void;
}

export default function PlanPicker({ onSelect, onCancel }: PlanPickerProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ["territory-plans-picker"],
    queryFn: () =>
      fetchJson<Plan[]>(`${API_BASE}/territory-plans?fields=id,name`),
    staleTime: 60_000,
  });

  const filtered = plans.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <div ref={ref} className="absolute z-50 mt-1 w-64 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden">
      <div className="p-2 border-b border-[#E2DEEC]">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-[#F7F5FA] rounded-lg">
          <Search className="w-3.5 h-3.5 text-[#A69DC0]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plans..."
            className="flex-1 text-xs bg-transparent outline-none text-[#403770] placeholder:text-[#A69DC0]"
            autoFocus
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-[#A69DC0] text-center py-3">No plans found</p>
        ) : (
          filtered.map((plan) => (
            <button
              key={plan.id}
              onClick={() => {
                onSelect(plan.id, plan.name);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-[#403770] rounded-lg hover:bg-[#F7F5FA] transition-colors"
            >
              {plan.name}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/components/PlanPicker.tsx
git commit -m "feat: add PlanPicker dropdown component for table actions"
```

---

### Task 11: TableActionMenu Component

**Files:**
- Create: `src/features/reports/components/TableActionMenu.tsx`

- [ ] **Step 1: Create the TableActionMenu component**

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, MapPin, ClipboardList, CalendarPlus, PenLine } from "lucide-react";
import PlanPicker from "./PlanPicker";

export type TableActionType =
  | "add_to_plan"
  | "create_task"
  | "create_activity"
  | "update_status"
  | "mark_complete";

interface ActionOption {
  id: TableActionType;
  label: string;
  icon: React.ReactNode;
  needsPlan?: boolean;
}

interface TableActionMenuProps {
  row: Record<string, unknown>;
  resultType: "district" | "activity" | "task" | "contact" | "unknown";
  onAction: (action: string, params: Record<string, unknown>) => void;
}

const DISTRICT_ACTIONS: ActionOption[] = [
  { id: "add_to_plan", label: "Add to plan", icon: <MapPin className="w-3.5 h-3.5" />, needsPlan: true },
  { id: "create_task", label: "Create task", icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { id: "create_activity", label: "Create activity", icon: <CalendarPlus className="w-3.5 h-3.5" /> },
];

const ACTIVITY_ACTIONS: ActionOption[] = [
  { id: "update_status", label: "Update status", icon: <PenLine className="w-3.5 h-3.5" /> },
];

const TASK_ACTIONS: ActionOption[] = [
  { id: "mark_complete", label: "Mark complete", icon: <PenLine className="w-3.5 h-3.5" /> },
];

const CONTACT_ACTIONS: ActionOption[] = [
  { id: "update_status", label: "Update contact", icon: <PenLine className="w-3.5 h-3.5" /> },
];

function getActions(resultType: string): ActionOption[] {
  switch (resultType) {
    case "district": return DISTRICT_ACTIONS;
    case "activity": return ACTIVITY_ACTIONS;
    case "task": return TASK_ACTIONS;
    case "contact": return CONTACT_ACTIONS;
    default: return [];
  }
}

export default function TableActionMenu({ row, resultType, onAction }: TableActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const actions = getActions(resultType);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowPlanPicker(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  if (actions.length === 0) return null;

  function handleActionClick(action: ActionOption) {
    if (action.needsPlan) {
      setShowPlanPicker(true);
      return;
    }

    const leaid = (row.leaid || row.district_leaid) as string | undefined;
    const id = row.id as string | undefined;

    switch (action.id) {
      case "create_task":
        onAction("create_task", {
          title: `Follow up: ${row.name || row.district_name || leaid || ""}`.trim(),
          leaids: leaid ? [leaid] : [],
        });
        break;
      case "create_activity":
        onAction("create_activity", {
          type: "school_site_visit",
          title: `Visit: ${row.name || row.district_name || leaid || ""}`.trim(),
          districtLeaids: leaid ? [leaid] : [],
        });
        break;
      case "update_status":
        if (resultType === "activity" && id) {
          onAction("update_activity", { activityId: id, status: "completed" });
        } else if (resultType === "contact" && row.id) {
          onAction("update_contact", { contactId: Number(row.id) });
        }
        break;
      case "mark_complete":
        if (id) {
          onAction("update_task", { taskId: id, status: "done" });
        }
        break;
    }

    setIsOpen(false);
  }

  function handlePlanSelect(planId: string, _planName: string) {
    const leaid = (row.leaid || row.district_leaid) as string | undefined;
    if (leaid) {
      onAction("add_districts_to_plan", {
        planId,
        districts: [{ leaid }],
      });
    }
    setShowPlanPicker(false);
    setIsOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded hover:bg-[#EFEDF5] transition-colors"
      >
        <MoreHorizontal className="w-4 h-4 text-[#A69DC0]" />
      </button>

      {isOpen && !showPlanPicker && (
        <div className="absolute right-0 z-50 mt-1 w-44 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden p-1">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#403770] rounded-lg hover:bg-[#F7F5FA] transition-colors"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}

      {showPlanPicker && (
        <PlanPicker
          onSelect={handlePlanSelect}
          onCancel={() => {
            setShowPlanPicker(false);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/components/TableActionMenu.tsx
git commit -m "feat: add TableActionMenu with row-level actions and plan picker"
```

---

### Task 12: BulkActionToolbar Component

**Files:**
- Create: `src/features/reports/components/BulkActionToolbar.tsx`

- [ ] **Step 1: Create the BulkActionToolbar component**

```typescript
"use client";

import { useState } from "react";
import { MapPin, ClipboardList, X } from "lucide-react";
import PlanPicker from "./PlanPicker";

interface BulkActionToolbarProps {
  selectedCount: number;
  resultType: "district" | "activity" | "task" | "contact" | "unknown";
  onAction: (action: string, params: Record<string, unknown>) => void;
  onClearSelection: () => void;
}

export default function BulkActionToolbar({
  selectedCount,
  resultType,
  onAction,
  onClearSelection,
}: BulkActionToolbarProps) {
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#403770] text-white rounded-lg mx-6 mb-2">
      <span className="text-xs font-medium">
        {selectedCount} selected
      </span>
      <div className="w-px h-4 bg-white/30" />

      {resultType === "district" && (
        <>
          <div className="relative">
            <button
              onClick={() => setShowPlanPicker(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              Add to plan
            </button>
            {showPlanPicker && (
              <PlanPicker
                onSelect={(planId) => {
                  onAction("add_districts_to_plan_bulk", { planId });
                  setShowPlanPicker(false);
                }}
                onCancel={() => setShowPlanPicker(false)}
              />
            )}
          </div>
          <button
            onClick={() => onAction("create_tasks_bulk", {})}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Create tasks
          </button>
        </>
      )}

      <div className="flex-1" />
      <button
        onClick={onClearSelection}
        className="p-1 rounded hover:bg-white/20 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/components/BulkActionToolbar.tsx
git commit -m "feat: add BulkActionToolbar for bulk district actions"
```

---

### Task 13: Update DataTable with Checkboxes and Row Actions

**Files:**
- Modify: `src/features/reports/components/DataTable.tsx`

- [ ] **Step 1: Add result type detection, selection state, and row action menu**

Update the DataTableProps interface:
```typescript
interface DataTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  onRowAction?: (action: string, params: Record<string, unknown>) => void;
  selectedRows?: Set<number>;
  onSelectionChange?: (selected: Set<number>) => void;
}
```

Add a result type detection function:
```typescript
export function detectResultType(
  columns: string[]
): "district" | "activity" | "task" | "contact" | "unknown" {
  const cols = new Set(columns.map((c) => c.toLowerCase()));
  if (cols.has("leaid") || cols.has("district_leaid")) return "district";
  if (cols.has("type") && (cols.has("start_date") || cols.has("status")) && cols.has("id"))
    return "activity";
  if (cols.has("priority") && cols.has("id")) return "task";
  if ((cols.has("email") || cols.has("phone")) && cols.has("id") && cols.has("name"))
    return "contact";
  return "unknown";
}
```

Import `TableActionMenu` and pass `onRowAction` down. Add a checkbox column as the first column when `onSelectionChange` is provided. Add the action menu as the last column when `onRowAction` is provided.

The implementation adds:
- A checkbox `ColumnDef` at position 0 (if `onSelectionChange` is provided)
- An actions `ColumnDef` at the end (if `onRowAction` is provided)
- Both use custom `renderCell` functions

Since DataTable wraps the shared `DataGrid` component, the checkbox and action columns are added to the `columnDefs` array and the `paginatedRows` are augmented with `__selected` and `__rowIndex` fields for the DataGrid to render.

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/components/DataTable.tsx
git commit -m "feat: add selection checkboxes and row action menu to DataTable"
```

---

### Task 14: Wire Everything Together in ReportsView

**Files:**
- Modify: `src/features/reports/components/ReportsView.tsx`

- [ ] **Step 1: Add selection state, action confirmation modal, and bulk toolbar**

Add imports:
```typescript
import BulkActionToolbar from "./BulkActionToolbar";
import ActionConfirmation from "./ActionConfirmation";
import { detectResultType } from "./DataTable";
import { useExecuteAction } from "../lib/queries";
```

Add state:
```typescript
const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
const [pendingAction, setPendingAction] = useState<{
  action: string;
  params: Record<string, unknown>;
  description: string;
} | null>(null);
```

Add a `resultType` computed value:
```typescript
const resultType = currentResult ? detectResultType(currentResult.columns) : "unknown";
```

Add handlers for row and bulk actions:
```typescript
const handleRowAction = useCallback(
  (action: string, params: Record<string, unknown>) => {
    const description = `${action.replace(/_/g, " ")}`;
    setPendingAction({ action, params, description });
  },
  []
);

const handleBulkAction = useCallback(
  (bulkAction: string, extraParams: Record<string, unknown>) => {
    if (!currentResult) return;
    const selected = [...selectedRows];
    const selectedData = selected.map((i) => currentResult.rows[i]);
    const leaids = selectedData
      .map((r) => (r.leaid || r.district_leaid) as string)
      .filter(Boolean);

    if (bulkAction === "add_districts_to_plan_bulk" && extraParams.planId) {
      setPendingAction({
        action: "add_districts_to_plan",
        params: {
          planId: extraParams.planId,
          districts: leaids.map((leaid) => ({ leaid })),
        },
        description: `Add ${leaids.length} districts to plan`,
      });
    } else if (bulkAction === "create_tasks_bulk") {
      // Create individual tasks for each selected district
      for (const leaid of leaids) {
        const row = selectedData.find(
          (r) => (r.leaid || r.district_leaid) === leaid
        );
        setPendingAction({
          action: "create_task",
          params: {
            title: `Follow up: ${row?.name || row?.district_name || leaid}`,
            leaids: [leaid],
          },
          description: `Create task for ${row?.name || row?.district_name || leaid}`,
        });
      }
    }
  },
  [currentResult, selectedRows]
);
```

Clear selection when result changes:
```typescript
// In handleResultReady, add:
setSelectedRows(new Set());
setPendingAction(null);
```

Add BulkActionToolbar above the DataTable:
```typescript
{activeTab === "chat" && currentResult && (
  <div className="p-6">
    <ReportHeader ... />
    <BulkActionToolbar
      selectedCount={selectedRows.size}
      resultType={resultType}
      onAction={handleBulkAction}
      onClearSelection={() => setSelectedRows(new Set())}
    />
    <DataTable
      columns={currentResult.columns}
      rows={currentResult.rows}
      onRowAction={handleRowAction}
      selectedRows={selectedRows}
      onSelectionChange={setSelectedRows}
    />
  </div>
)}
```

Add a floating action confirmation overlay:
```typescript
{pendingAction && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div className="w-96">
      <ActionConfirmation
        action={pendingAction.action}
        params={pendingAction.params}
        description={pendingAction.description}
        onComplete={(success, message) => {
          setPendingAction(null);
          if (success) setSelectedRows(new Set());
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/reports/components/ReportsView.tsx
git commit -m "feat: wire action confirmation, bulk toolbar, and row actions into ReportsView"
```

---

### Task 15: Manual Integration Test

- [ ] **Step 1: Start the dev server**

Run:
```bash
cd .claude/worktrees/claude-query-tool && npm run dev
```

- [ ] **Step 2: Test chat-driven action flow**

1. Navigate to the Reports page
2. Ask: "Show me districts in New York with open pipeline"
3. After results appear, ask: "Add the first 5 to my territory plan"
4. Verify: ActionConfirmation card appears in chat with district preview
5. Click Confirm → verify success message appears
6. Click Cancel on next attempt → verify "Cancelled" message

- [ ] **Step 3: Test table row actions**

1. Run a district query
2. Click the kebab menu (⋯) on a row
3. Select "Add to plan" → PlanPicker appears
4. Select a plan → ActionConfirmation overlay appears
5. Confirm → verify success

- [ ] **Step 4: Test bulk actions**

1. Run a district query
2. Check several rows using checkboxes
3. BulkActionToolbar appears with selection count
4. Click "Add to plan" → PlanPicker appears
5. Select a plan → ActionConfirmation for bulk add
6. Confirm → verify success, selection cleared

- [ ] **Step 5: Test rate limiting**

Verify the action endpoint returns 429 after 50 actions in an hour (can spot-check by querying `query_log` for action count).

- [ ] **Step 6: Commit final cleanup if needed**

```bash
git add -A
git commit -m "chore: integration test fixes and polish"
```

---

## Verification

1. **Unit tests**: `npx vitest run src/features/reports/lib/__tests__/action-handlers.test.ts` — all pass
2. **Prisma**: `npx prisma validate` — schema is valid
3. **Build**: `npm run build` — no TypeScript errors
4. **Dev server**: `npm run dev` — Reports page loads, chat works, actions fire
5. **Manual test**: Execute each of the 9 action types at least once through chat
6. **Table actions**: Verify row and bulk actions work for district result sets
7. **Rate limit**: Confirm 429 response after exceeding limit
