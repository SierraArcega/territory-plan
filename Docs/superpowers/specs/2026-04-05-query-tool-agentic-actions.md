# Query Tool Agentic Actions — Design Spec

**Date:** 2026-04-05
**Status:** Design approved
**Linear:** MAP-3
**Branch:** TBD
**Depends on:** MAP-5 (Claude Query Tool)

## Summary

Extends the Claude Query Tool (MAP-5) with write capabilities. Users can take actions on their data through natural language in the chat panel or through action buttons on query result tables. Claude uses structured tool_use to propose actions, the user confirms via a preview card, and the system executes against existing API logic. All actions are logged and auditable.

## Motivation

- Sales reps find insights via the query tool but then have to context-switch to the regular UI to act on them
- "Show me districts in Ohio with pipeline > $50K" → manually navigate to each district to add it to a plan
- Closing the loop between insight and action in one interface saves significant time
- Natural language actions ("add all these to my Q3 plan with $10K renewal targets") handle bulk operations that are tedious in the standard UI

## Architecture

### System Flow

```
User requests an action (chat or table)
  → POST /api/ai/query { question, conversationId, history[] }
  → Claude returns tool_use for an action tool (not generate_query)
  → Frontend renders ActionConfirmation card with preview
  → User clicks Confirm
  → POST /api/ai/query/action { action, params, conversationId }
  → Validate action name against whitelist
  → Validate params (same rules as existing routes)
  → Execute via Prisma (same logic as existing routes)
  → Log to query_log (with action column)
  → Return { success, message, details }
  → Chat shows success/failure message
  → Action + result added to conversation history
```

### Table Action Flow (no Claude)

```
User clicks row action or selects rows + toolbar action
  → Frontend constructs action params directly from row data
  → Frontend renders ActionConfirmation card with preview
  → User clicks Confirm
  → POST /api/ai/query/action { action, params, conversationId }
  → Same validation → execution → logging path
```

### Query + Action Chaining

When the user requests both a query and an action in one message ("find districts in Ohio with SPED vacancies and add them to my Q3 plan"):

1. Claude returns `generate_query` tool_use first (recognizes the message needs data before acting)
2. Frontend executes query, shows results in table
3. Frontend sends a follow-up message to Claude: the original user message + a system note with the query results (columns + rows as JSON, capped at 50 rows). The original action intent is preserved in the conversation history.
4. Claude returns the action tool_use with resolved data (e.g., leaids from the result set)
5. Frontend shows ActionConfirmation card
6. User confirms → action executes

Each step requires its own round-trip. No multi-action execution without confirmation between each.

## Action Tools

### 1. Territory Plan Districts

**`add_districts_to_plan`**
```typescript
{
  planId: string,
  districts: Array<{
    leaid: string,
    renewalTarget?: number,
    winbackTarget?: number,
    expansionTarget?: number,
    newBusinessTarget?: number,
    notes?: string
  }>
}
```
Maps to: `POST /api/territory-plans/[id]/districts` logic (upsert with skipDuplicates)

**`remove_districts_from_plan`**
```typescript
{
  planId: string,
  leaids: string[]
}
```
Maps to: `DELETE /api/territory-plans/[id]/districts/[leaid]` logic (batch)

**`update_district_targets`**
```typescript
{
  planId: string,
  districts: Array<{
    leaid: string,
    renewalTarget?: number,
    winbackTarget?: number,
    expansionTarget?: number,
    newBusinessTarget?: number,
    notes?: string
  }>
}
```
Maps to: `PUT /api/territory-plans/[id]/districts/[leaid]` logic (batch)

### 2. Activities

**`create_activity`**
```typescript
{
  type: string,          // from ALL_ACTIVITY_TYPES
  title: string,
  startDate?: string,    // ISO8601
  endDate?: string,
  notes?: string,
  status?: string,       // default "planned"
  planIds?: string[],
  districtLeaids?: string[],
  contactIds?: number[]
}
```
Maps to: `POST /api/activities` logic

**`update_activity`**
```typescript
{
  activityId: string,
  title?: string,
  status?: string,
  startDate?: string,
  endDate?: string,
  notes?: string,
  outcome?: string,
  outcomeType?: string,
  rating?: number,
  planIds?: string[],
  districtLeaids?: string[],
  contactIds?: number[]
}
```
Maps to: `PATCH /api/activities/[id]` logic

### 3. Tasks

**`create_task`**
```typescript
{
  title: string,
  description?: string,
  priority?: string,     // "low" | "medium" | "high" | "urgent"
  dueDate?: string,      // ISO8601
  planIds?: string[],
  leaids?: string[],
  contactIds?: number[]
}
```
Maps to: `POST /api/tasks` logic

**`update_task`**
```typescript
{
  taskId: string,
  title?: string,
  description?: string,
  status?: string,       // "todo" | "in_progress" | "done"
  priority?: string,
  dueDate?: string,
  planIds?: string[],
  leaids?: string[],
  contactIds?: number[]
}
```
Maps to: `PATCH /api/tasks/[id]` logic

### 4. Contacts

**`create_contact`**
```typescript
{
  leaid: string,
  name: string,
  title?: string,
  email?: string,
  phone?: string,
  isPrimary?: boolean,
  linkedinUrl?: string,
  persona?: string,
  seniorityLevel?: string
}
```
Maps to: `POST /api/contacts` logic

**`update_contact`**
```typescript
{
  contactId: number,
  name?: string,
  title?: string,
  email?: string,
  phone?: string,
  isPrimary?: boolean,
  linkedinUrl?: string,
  persona?: string,
  seniorityLevel?: string
}
```
Maps to: `PUT /api/contacts/[id]` logic

## Data Model Changes

### query_log — add action column

```sql
ALTER TABLE query_log ADD COLUMN action TEXT;
ALTER TABLE query_log ADD COLUMN action_params JSONB;
ALTER TABLE query_log ADD COLUMN action_success BOOLEAN;
```

- `action`: tool name (e.g., `"add_districts_to_plan"`) — NULL for read-only queries
- `action_params`: JSON of the parameters passed to the action
- `action_success`: whether the action executed successfully

No new tables needed. All action targets (territory_plan_districts, activities, tasks, contacts) already exist.

## API Route

### `POST /api/ai/query/action`

**Request:**
```typescript
{
  action: string,                    // tool name from whitelist
  params: Record<string, unknown>,   // tool parameters
  conversationId?: string            // for logging
}
```

**Response:**
```typescript
{
  success: boolean,
  message: string,      // "Added 12 districts to Q3 Territory Plan"
  details?: unknown     // returned data from the operation
}
```

**Implementation:**
- Auth check via `getUser()`
- Validate `action` against `ACTION_WHITELIST` set
- Dispatch to handler function based on action name
- Each handler:
  1. Validates params (same rules as existing routes)
  2. Checks ownership/permissions
  3. Executes Prisma operations
  4. Returns `{ success, message, details }`
- Log to `query_log` with action columns
- Rate limit: 50 actions per user per hour (count from query_log)

**Handler structure** (`src/features/reports/lib/action-handlers.ts`):
```typescript
const ACTION_HANDLERS: Record<string, (user: User, params: any) => Promise<ActionResult>> = {
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
```

## UI Components

### New Components

1. **`ActionConfirmation.tsx`** — Confirmation card rendered in chat
   - Action title and description
   - Preview table/detail card of affected entities
   - Confirm and Cancel buttons
   - Loading state during execution
   - Success/failure result display

2. **`TableActionMenu.tsx`** — Row-level action dropdown
   - Kebab menu on each row
   - Context-aware options based on result data type
   - Opens ActionConfirmation when clicked

3. **`BulkActionToolbar.tsx`** — Toolbar above table when rows are selected
   - Checkbox column in DataTable
   - Selection count display
   - Action buttons relevant to the data type
   - "Select all" / "Clear selection"

4. **`PlanPicker.tsx`** — Dropdown/modal for selecting a territory plan
   - Used by table actions that need a plan target
   - Shows user's active plans
   - Search/filter support

### Modified Components

- **`ChatPanel.tsx`** — Handle action tool_use responses, render ActionConfirmation
- **`ChatMessage.tsx`** — New message type for action confirmations and results
- **`DataTable.tsx`** — Add checkbox column, row action menu, detect result data type
- **`ReportsView.tsx`** — Wire up BulkActionToolbar

### Table Action Context Detection

The system determines available actions by inspecting the result columns:

| Columns contain | Available row actions | Available bulk actions |
|---|---|---|
| `leaid` or `district_leaid` | Add to plan, Create task, Create activity | Add selected to plan, Create tasks |
| `id` + activity columns (`type`, `status`, `start_date`) | Update status, Update outcome | — |
| `id` + task columns (`priority`, `due_date`) | Mark complete, Update priority | — |
| `id` + contact columns (`email`, `phone`, `persona`) | Update contact | — |

### Claude System Prompt Changes

Add to the existing system prompt in `query-engine.ts`:

- Action tool definitions (9 tools) with schemas
- Instructions: "When the user asks you to take an action, use the appropriate action tool. Always include all required fields. For bulk operations, include all affected entities."
- Context injection: "The current query results are: [columns] [first 50 rows as JSON]" — so Claude can reference result data when constructing actions
- Disambiguation: "If the user's intent is ambiguous between a query and an action, ask for clarification."

## Safety Guardrails

1. **Action whitelist** — Only the 9 defined action tools are accepted. API route rejects unknown action names with 400.
2. **Always-confirm** — Every action renders a confirmation card. No auto-execute path exists in the frontend.
3. **Parameter validation** — Same validation rules as existing routes (valid types, valid statuses, ID existence checks).
4. **Ownership scoping** — Actions execute as the authenticated user with same ownership/permission checks.
5. **Rate limiting** — Max 50 actions per user per hour. Counted from `query_log` WHERE `action IS NOT NULL` AND `created_at > NOW() - INTERVAL '1 hour'`.
6. **Audit trail** — Every action logged to `query_log` with action name, params, and success/failure.
7. **No cascading** — Claude proposes one action at a time. Multi-step flows require user confirmation between each step.
8. **Bulk limits** — Operations capped at 100 items per action. API returns 400 if exceeded.
9. **No deletes** — Activities, tasks, and contacts cannot be deleted through the action system. Only district-plan links can be removed.

## Token Cost Impact

- Action requests use the same Claude API call as queries — no additional cost per action proposal
- Context grows slightly due to action tool definitions in system prompt (~500 additional tokens)
- Result context injection for action resolution adds ~1000-2000 tokens for typical result sets
- Table-driven actions (row/bulk) bypass Claude entirely — zero token cost
- Estimated per-action cost: same as a follow-up query ($0.01-0.03)

## File Structure

New and modified files:

```
src/features/reports/
  components/
    ActionConfirmation.tsx     — NEW: Confirmation card for actions
    TableActionMenu.tsx        — NEW: Row-level action dropdown
    BulkActionToolbar.tsx      — NEW: Bulk selection toolbar
    PlanPicker.tsx             — NEW: Plan selection dropdown
    ChatPanel.tsx              — MODIFIED: Handle action tool_use
    ChatMessage.tsx            — MODIFIED: Action message types
    DataTable.tsx              — MODIFIED: Checkboxes, row actions
    ReportsView.tsx            — MODIFIED: Wire bulk toolbar
  lib/
    action-handlers.ts         — NEW: Action execution handlers
    action-tools.ts            — NEW: Tool definitions for Claude prompt
    query-engine.ts            — MODIFIED: Add action tools to system prompt
    types.ts                   — MODIFIED: Action types
    queries.ts                 — MODIFIED: useExecuteAction hook
src/app/api/ai/
  query/action/route.ts        — NEW: POST /api/ai/query/action
```

## Out of Scope

- Delete operations for activities, tasks, contacts (too destructive for chat)
- Vendor financials mutations (no existing write API)
- Multi-action execution without confirmation (always one at a time)
- Undo/rollback after execution
- Action scheduling ("add these districts next Monday")
- Action templates/macros
- Cross-user actions (always scoped to authenticated user)
