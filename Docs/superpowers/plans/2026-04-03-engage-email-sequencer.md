# Engage Email Sequencer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Engage tab — a multi-channel sequence execution tool with template library, merge field resolution, playlist-style send flow, and analytics.

**Architecture:** Sequence-First — design-time entities (Template, Sequence, SequenceStep) are reusable blueprints; run-time entities (SequenceExecution, StepExecution) are created per execution. Steps can use inline content or reference a Template (live). Content snapshots into StepExecution at launch. Every completed step creates an Activity.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Prisma/PostgreSQL, TanStack Query, Zustand, Gmail API (googleapis), Vitest

**Spec:** `docs/superpowers/specs/2026-04-03-engage-email-sequencer-spec.md`

---

## File Structure

### New files

```
src/features/engage/
├── types.ts                          — Type definitions (StepType, ExecutionStatus, etc.)
├── lib/
│   ├── queries.ts                    — TanStack Query hooks for all Engage API calls
│   └── merge-fields.ts              — Merge field resolution engine
├── components/
│   ├── EngageView.tsx                — Top-level view with sub-tab routing
│   ├── SequencesTab.tsx              — Sequence library (card grid + empty state)
│   ├── SequenceCard.tsx              — Individual sequence card
│   ├── SequenceEditor.tsx            — Create/edit sequence with step list
│   ├── StepCard.tsx                  — Step card within sequence editor
│   ├── AddStepModal.tsx              — Modal: choose template or write inline
│   ├── InlineStepEditor.tsx          — Inline subject + body editor for steps
│   ├── MergeFieldSection.tsx         — Merge field management in sequence editor
│   ├── TemplatesTab.tsx              — Template library (card grid + empty state)
│   ├── TemplateCard.tsx              — Individual template card
│   ├── TemplateEditor.tsx            — Create/edit template with merge field toolbar
│   ├── MergeFieldToolbar.tsx         — Clickable merge field insertion buttons
│   ├── ActiveRunsTab.tsx             — In-progress executions list
│   ├── ActiveRunCard.tsx             — Execution progress card
│   ├── ContactSelector.tsx           — Contact picker for execution launch
│   ├── ExecutionPanel.tsx            — The step-through send experience
│   ├── EmailStepView.tsx             — Email editor within execution panel
│   ├── ManualStepView.tsx            — Call/text/LinkedIn action prompt
│   ├── HistoryTab.tsx                — Completed runs table with analytics
│   ├── ExecutionDetailView.tsx       — Per-run analytics + contact grid
│   └── TemplateChangeBanner.tsx      — Dismissable "template recently modified" warning
```

### Modified files

```
prisma/schema.prisma                                    — 6 new models
src/features/shared/lib/app-store.ts:5                  — Add "engage" to TabId
src/features/shared/components/navigation/Sidebar.tsx   — Add Engage tab + icon to MAIN_TABS
src/app/page.tsx:33,182-216                             — Add "engage" to VALID_TABS + renderContent case
```

### New API routes

```
src/app/api/engage/templates/route.ts                   — GET list, POST create
src/app/api/engage/templates/[id]/route.ts              — GET one, PATCH update, DELETE archive
src/app/api/engage/sequences/route.ts                   — GET list, POST create
src/app/api/engage/sequences/[id]/route.ts              — GET one, PATCH update, DELETE archive
src/app/api/engage/sequences/[id]/steps/route.ts        — POST add step, PATCH reorder
src/app/api/engage/sequences/[id]/steps/[stepId]/route.ts — PATCH update, DELETE remove
src/app/api/engage/sequences/[id]/execute/route.ts      — POST launch execution
src/app/api/engage/executions/route.ts                  — GET list (active + history)
src/app/api/engage/executions/[id]/route.ts             — GET detail, PATCH update status
src/app/api/engage/executions/[id]/send/route.ts        — POST send current step (email via Gmail)
src/app/api/engage/executions/[id]/complete/route.ts    — POST complete current step (manual)
src/app/api/engage/executions/[id]/skip/route.ts        — POST skip current step
```

---

## Task 1: Prisma Schema — New Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the EngageTemplate model**

Add after the `UserIntegration` model (around line 823):

```prisma
model EngageTemplate {
  id              Int       @id @default(autoincrement())
  name            String    @db.VarChar(255)
  type            String    @db.VarChar(20) // "email", "call", "text", "linkedin"
  subject         String?   @db.VarChar(500)
  body            String    @db.Text
  createdByUserId String    @map("created_by_user_id") @db.Uuid
  isArchived      Boolean   @default(false) @map("is_archived")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  createdBy UserProfile    @relation("EngageTemplatesCreated", fields: [createdByUserId], references: [id])
  steps     SequenceStep[]

  @@index([createdByUserId])
  @@index([isArchived])
  @@map("engage_templates")
}
```

- [ ] **Step 2: Add the Sequence model**

```prisma
model Sequence {
  id              Int       @id @default(autoincrement())
  name            String    @db.VarChar(255)
  description     String?   @db.Text
  createdByUserId String    @map("created_by_user_id") @db.Uuid
  isArchived      Boolean   @default(false) @map("is_archived")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  createdBy      UserProfile          @relation("SequencesCreated", fields: [createdByUserId], references: [id])
  steps          SequenceStep[]
  executions     SequenceExecution[]
  mergeFieldDefs MergeFieldDefinition[]

  @@index([createdByUserId])
  @@index([isArchived])
  @@map("sequences")
}
```

- [ ] **Step 3: Add the SequenceStep model**

```prisma
model SequenceStep {
  id         Int      @id @default(autoincrement())
  sequenceId Int      @map("sequence_id")
  templateId Int?     @map("template_id")
  type       String   @db.VarChar(20) // "email", "call", "text", "linkedin"
  subject    String?  @db.VarChar(500)
  body       String?  @db.Text
  position   Int
  delayDays  Int      @default(0) @map("delay_days")
  metadata   Json?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  sequence       Sequence        @relation(fields: [sequenceId], references: [id], onDelete: Cascade)
  template       EngageTemplate? @relation(fields: [templateId], references: [id])
  stepExecutions StepExecution[]

  @@unique([sequenceId, position])
  @@index([sequenceId])
  @@map("sequence_steps")
}
```

- [ ] **Step 4: Add the SequenceExecution model**

```prisma
model SequenceExecution {
  id                   Int       @id @default(autoincrement())
  sequenceId           Int       @map("sequence_id")
  userId               String    @map("user_id") @db.Uuid
  status               String    @default("active") @db.VarChar(20) // "active", "paused", "completed", "cancelled"
  currentStepPosition  Int       @default(1) @map("current_step_position")
  currentContactIndex  Int       @default(0) @map("current_contact_index")
  contactCount         Int       @map("contact_count")
  completedCount       Int       @default(0) @map("completed_count")
  startedAt            DateTime  @default(now()) @map("started_at")
  completedAt          DateTime? @map("completed_at")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  sequence       Sequence        @relation(fields: [sequenceId], references: [id])
  user           UserProfile     @relation("SequenceExecutions", fields: [userId], references: [id])
  stepExecutions StepExecution[]

  @@index([userId])
  @@index([sequenceId])
  @@index([status])
  @@map("sequence_executions")
}
```

- [ ] **Step 5: Add the StepExecution model**

```prisma
model StepExecution {
  id             Int       @id @default(autoincrement())
  executionId    Int       @map("execution_id")
  stepId         Int       @map("step_id")
  contactId      Int       @map("contact_id")
  status         String    @default("pending") @db.VarChar(20) // "pending", "completed", "skipped", "failed"
  sentBody       String?   @map("sent_body") @db.Text
  sentSubject    String?   @map("sent_subject") @db.VarChar(500)
  gmailMessageId String?   @unique @map("gmail_message_id")
  activityId     String?   @map("activity_id")
  notes          String?   @db.Text
  completedAt    DateTime? @map("completed_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  execution SequenceExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  step      SequenceStep      @relation(fields: [stepId], references: [id])
  contact   Contact           @relation(fields: [contactId], references: [id])
  activity  Activity?         @relation(fields: [activityId], references: [id])

  @@unique([executionId, stepId, contactId])
  @@index([executionId])
  @@index([contactId])
  @@index([status])
  @@map("step_executions")
}
```

- [ ] **Step 6: Add the MergeFieldDefinition model**

```prisma
model MergeFieldDefinition {
  id           Int      @id @default(autoincrement())
  sequenceId   Int      @map("sequence_id")
  name         String   @db.VarChar(100)
  label        String   @db.VarChar(255)
  type         String   @db.VarChar(20) // "system", "custom"
  sourceField  String?  @map("source_field") @db.VarChar(100)
  defaultValue String?  @map("default_value") @db.Text
  createdAt    DateTime @default(now()) @map("created_at")

  sequence Sequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)

  @@index([sequenceId])
  @@map("merge_field_definitions")
}
```

- [ ] **Step 7: Add reverse relations to existing models**

Add to the `UserProfile` model:

```prisma
engageTemplates    EngageTemplate[]     @relation("EngageTemplatesCreated")
sequences          Sequence[]           @relation("SequencesCreated")
sequenceExecutions SequenceExecution[]  @relation("SequenceExecutions")
```

Add to the `Contact` model:

```prisma
stepExecutions StepExecution[]
```

Add to the `Activity` model:

```prisma
stepExecution StepExecution?
```

- [ ] **Step 8: Run Prisma migration**

Run: `npx prisma migrate dev --name add-engage-models`
Expected: Migration created successfully, database updated.

- [ ] **Step 9: Verify schema compiles**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully.

- [ ] **Step 10: Commit**

```bash
git add prisma/
git commit -m "feat(engage): add Prisma models for templates, sequences, executions, merge fields"
```

---

## Task 2: Types & Merge Field Engine

**Files:**
- Create: `src/features/engage/types.ts`
- Create: `src/features/engage/lib/merge-fields.ts`
- Test: `src/features/engage/lib/__tests__/merge-fields.test.ts`

- [ ] **Step 1: Write the type definitions**

Create `src/features/engage/types.ts`:

```typescript
export type StepType = "email" | "call" | "text" | "linkedin";
export type ExecutionStatus = "active" | "paused" | "completed" | "cancelled";
export type StepExecutionStatus = "pending" | "completed" | "skipped" | "failed";
export type MergeFieldType = "system" | "custom";

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  email: "Email",
  call: "Phone Call",
  text: "Text Message",
  linkedin: "LinkedIn",
};

export const EXECUTION_STATUS_CONFIG: Record<
  ExecutionStatus,
  { label: string; color: string; bgColor: string }
> = {
  active: { label: "Active", color: "#22C55E", bgColor: "#F0FDF4" },
  paused: { label: "Paused", color: "#F59E0B", bgColor: "#FFFBEB" },
  completed: { label: "Completed", color: "#6EA3BE", bgColor: "#EEF5F8" },
  cancelled: { label: "Cancelled", color: "#94A3B8", bgColor: "#F1F5F9" },
};

// System merge fields that auto-resolve from database entities
export const SYSTEM_MERGE_FIELDS = {
  // Contact fields
  "contact.first_name": { label: "First Name", source: "contact" },
  "contact.last_name": { label: "Last Name", source: "contact" },
  "contact.full_name": { label: "Full Name", source: "contact" },
  "contact.title": { label: "Job Title", source: "contact" },
  "contact.email": { label: "Email", source: "contact" },
  "contact.phone": { label: "Phone", source: "contact" },
  // District fields
  "district.name": { label: "District Name", source: "district" },
  "district.state": { label: "State", source: "district" },
  "district.city": { label: "City", source: "district" },
  "district.enrollment": { label: "Enrollment", source: "district" },
  "district.leaid": { label: "LEA ID", source: "district" },
  // Financial fields
  "district.pipeline": { label: "Pipeline", source: "district" },
  "district.bookings": { label: "Bookings", source: "district" },
  "district.invoicing": { label: "Invoicing", source: "district" },
  "district.sessions_revenue": { label: "Sessions Revenue", source: "district" },
  // Sender fields
  "sender.name": { label: "My Name", source: "sender" },
  "sender.email": { label: "My Email", source: "sender" },
  "sender.title": { label: "My Title", source: "sender" },
  // Date fields
  "date.today": { label: "Today's Date", source: "date" },
  "date.current_month": { label: "Current Month", source: "date" },
  "date.current_year": { label: "Current Year", source: "date" },
} as const;

export type SystemMergeFieldKey = keyof typeof SYSTEM_MERGE_FIELDS;

// API response types
export interface EngageTemplate {
  id: number;
  name: string;
  type: StepType;
  subject: string | null;
  body: string;
  createdByUserId: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStepData {
  id: number;
  sequenceId: number;
  templateId: number | null;
  type: StepType;
  subject: string | null;
  body: string | null;
  position: number;
  delayDays: number;
  template: EngageTemplate | null;
}

export interface SequenceData {
  id: number;
  name: string;
  description: string | null;
  createdByUserId: string;
  isArchived: boolean;
  steps: SequenceStepData[];
  mergeFieldDefs: MergeFieldDefData[];
  createdAt: string;
  updatedAt: string;
  _count?: { executions: number };
}

export interface MergeFieldDefData {
  id: number;
  sequenceId: number;
  name: string;
  label: string;
  type: MergeFieldType;
  sourceField: string | null;
  defaultValue: string | null;
}

export interface SequenceExecutionData {
  id: number;
  sequenceId: number;
  userId: string;
  status: ExecutionStatus;
  currentStepPosition: number;
  currentContactIndex: number;
  contactCount: number;
  completedCount: number;
  startedAt: string;
  completedAt: string | null;
  sequence: { name: string; steps: SequenceStepData[] };
}

export interface StepExecutionData {
  id: number;
  executionId: number;
  stepId: number;
  contactId: number;
  status: StepExecutionStatus;
  sentBody: string | null;
  sentSubject: string | null;
  gmailMessageId: string | null;
  activityId: string | null;
  notes: string | null;
  completedAt: string | null;
  contact: { id: number; name: string; email: string | null; title: string | null; leaid: string };
}

// Contact with merge field data for execution
export interface ExecutionContact {
  contactId: number;
  name: string;
  email: string | null;
  title: string | null;
  leaid: string;
  districtName: string;
  customFields: Record<string, string>; // custom merge field values
}
```

- [ ] **Step 2: Write failing tests for merge field resolution**

Create `src/features/engage/lib/__tests__/merge-fields.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveMergeFields, extractMergeFieldKeys, hasUnresolvedFields } from "../merge-fields";

describe("extractMergeFieldKeys", () => {
  it("extracts merge field keys from template text", () => {
    const text = "Hi {{contact.first_name}}, your district {{district.name}} has {{district.enrollment}} students.";
    const keys = extractMergeFieldKeys(text);
    expect(keys).toEqual(["contact.first_name", "district.name", "district.enrollment"]);
  });

  it("returns empty array for text with no merge fields", () => {
    expect(extractMergeFieldKeys("Hello world")).toEqual([]);
  });

  it("handles duplicate keys", () => {
    const text = "{{contact.first_name}} and {{contact.first_name}} again";
    const keys = extractMergeFieldKeys(text);
    expect(keys).toEqual(["contact.first_name"]);
  });
});

describe("resolveMergeFields", () => {
  const context = {
    contact: {
      first_name: "Jane",
      last_name: "Smith",
      full_name: "Jane Smith",
      title: "Superintendent",
      email: "jane@lincoln.edu",
      phone: "(555) 123-4567",
    },
    district: {
      name: "Lincoln Unified",
      state: "CA",
      city: "Sacramento",
      enrollment: "14200",
      leaid: "0612345",
      pipeline: "$50,000",
      bookings: "$25,000",
      invoicing: "$10,000",
      sessions_revenue: "$8,000",
    },
    sender: {
      name: "Aston Furious",
      email: "aston@fullmind.com",
      title: "Account Executive",
    },
    date: {
      today: "April 3, 2026",
      current_month: "April",
      current_year: "2026",
    },
    custom: {
      talking_point: "budget season priorities",
    },
  };

  it("resolves system merge fields", () => {
    const template = "Hi {{contact.first_name}}, I'm {{sender.name}} from Fullmind.";
    const result = resolveMergeFields(template, context);
    expect(result).toBe("Hi Jane, I'm Aston Furious from Fullmind.");
  });

  it("resolves custom merge fields", () => {
    const template = "Let's discuss {{talking_point}}.";
    const result = resolveMergeFields(template, context);
    expect(result).toBe("Let's discuss budget season priorities.");
  });

  it("leaves unresolved fields as-is", () => {
    const template = "Hi {{contact.first_name}}, about {{unknown_field}}.";
    const result = resolveMergeFields(template, context);
    expect(result).toBe("Hi Jane, about {{unknown_field}}.");
  });

  it("handles empty template", () => {
    expect(resolveMergeFields("", context)).toBe("");
  });
});

describe("hasUnresolvedFields", () => {
  it("returns true when unresolved fields exist", () => {
    expect(hasUnresolvedFields("Hi {{contact.first_name}}")).toBe(true);
  });

  it("returns false when no merge fields", () => {
    expect(hasUnresolvedFields("Hi Jane")).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/features/engage/lib/__tests__/merge-fields.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement the merge field engine**

Create `src/features/engage/lib/merge-fields.ts`:

```typescript
const MERGE_FIELD_REGEX = /\{\{(\w+(?:\.\w+)*)\}\}/g;

/**
 * Extract unique merge field keys from template text.
 * "Hi {{contact.first_name}}" → ["contact.first_name"]
 */
export function extractMergeFieldKeys(text: string): string[] {
  const keys = new Set<string>();
  let match;
  while ((match = MERGE_FIELD_REGEX.exec(text)) !== null) {
    keys.add(match[1]);
  }
  MERGE_FIELD_REGEX.lastIndex = 0;
  return Array.from(keys);
}

export interface MergeContext {
  contact: Record<string, string>;
  district: Record<string, string>;
  sender: Record<string, string>;
  date: Record<string, string>;
  custom: Record<string, string>;
}

/**
 * Resolve merge fields in template text using the provided context.
 * System fields use dotted notation: {{contact.first_name}} → context.contact.first_name
 * Custom fields use plain names: {{talking_point}} → context.custom.talking_point
 * Unresolved fields are left as-is: {{unknown}} stays as {{unknown}}
 */
export function resolveMergeFields(template: string, context: MergeContext): string {
  if (!template) return template;

  return template.replace(MERGE_FIELD_REGEX, (match, key: string) => {
    // Try dotted system field first: "contact.first_name" → context.contact.first_name
    const dotIndex = key.indexOf(".");
    if (dotIndex !== -1) {
      const category = key.slice(0, dotIndex) as keyof Omit<MergeContext, "custom">;
      const field = key.slice(dotIndex + 1);
      const value = context[category]?.[field];
      if (value !== undefined && value !== null && value !== "") return value;
    }

    // Try custom field: "talking_point" → context.custom.talking_point
    const customValue = context.custom[key];
    if (customValue !== undefined && customValue !== null && customValue !== "") return customValue;

    // Leave unresolved
    return match;
  });
}

/**
 * Check if text contains any unresolved merge field placeholders.
 */
export function hasUnresolvedFields(text: string): boolean {
  MERGE_FIELD_REGEX.lastIndex = 0;
  return MERGE_FIELD_REGEX.test(text);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/features/engage/lib/__tests__/merge-fields.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/features/engage/types.ts src/features/engage/lib/merge-fields.ts src/features/engage/lib/__tests__/merge-fields.test.ts
git commit -m "feat(engage): add type definitions and merge field resolution engine"
```

---

## Task 3: Template CRUD API Routes

**Files:**
- Create: `src/app/api/engage/templates/route.ts`
- Create: `src/app/api/engage/templates/[id]/route.ts`

- [ ] **Step 1: Create template list + create route**

Create `src/app/api/engage/templates/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (!includeArchived) where.isArchived = false;

    const templates = await prisma.engageTemplate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, subject, body: templateBody } = body;

    if (!name || !type || !templateBody) {
      return NextResponse.json(
        { error: "name, type, and body are required" },
        { status: 400 }
      );
    }

    const validTypes = ["email", "call", "text", "linkedin"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const template = await prisma.engageTemplate.create({
      data: {
        name,
        type,
        subject: type === "email" ? subject || null : null,
        body: templateBody,
        createdByUserId: user.id,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create single template route (get, update, archive)**

Create `src/app/api/engage/templates/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await prisma.engageTemplate.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, type, subject, body: templateBody, isArchived } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (subject !== undefined) data.subject = subject;
    if (templateBody !== undefined) data.body = templateBody;
    if (isArchived !== undefined) data.isArchived = isArchived;

    const template = await prisma.engageTemplate.update({
      where: { id: parseInt(id, 10) },
      data,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    // Soft delete
    await prisma.engageTemplate.update({
      where: { id: parseInt(id, 10) },
      data: { isArchived: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error archiving template:", error);
    return NextResponse.json(
      { error: "Failed to archive template" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/engage/templates/
git commit -m "feat(engage): add template CRUD API routes"
```

---

## Task 4: Sequence CRUD API Routes

**Files:**
- Create: `src/app/api/engage/sequences/route.ts`
- Create: `src/app/api/engage/sequences/[id]/route.ts`
- Create: `src/app/api/engage/sequences/[id]/steps/route.ts`
- Create: `src/app/api/engage/sequences/[id]/steps/[stepId]/route.ts`

- [ ] **Step 1: Create sequence list + create route**

Create `src/app/api/engage/sequences/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const where: Record<string, unknown> = {};
    if (!includeArchived) where.isArchived = false;

    const sequences = await prisma.sequence.findMany({
      where,
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
        mergeFieldDefs: true,
        _count: { select: { executions: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ sequences });
  } catch (error) {
    console.error("Error fetching sequences:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequences" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const sequence = await prisma.sequence.create({
      data: {
        name,
        description: description || null,
        createdByUserId: user.id,
      },
      include: {
        steps: { orderBy: { position: "asc" }, include: { template: true } },
        mergeFieldDefs: true,
        _count: { select: { executions: true } },
      },
    });

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("Error creating sequence:", error);
    return NextResponse.json(
      { error: "Failed to create sequence" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create single sequence route**

Create `src/app/api/engage/sequences/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sequence = await prisma.sequence.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
        mergeFieldDefs: true,
        _count: { select: { executions: true } },
      },
    });

    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("Error fetching sequence:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequence" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, isArchived } = body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (isArchived !== undefined) data.isArchived = isArchived;

    const sequence = await prisma.sequence.update({
      where: { id: parseInt(id, 10) },
      data,
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
        mergeFieldDefs: true,
        _count: { select: { executions: true } },
      },
    });

    return NextResponse.json(sequence);
  } catch (error) {
    console.error("Error updating sequence:", error);
    return NextResponse.json(
      { error: "Failed to update sequence" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.sequence.update({
      where: { id: parseInt(id, 10) },
      data: { isArchived: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error archiving sequence:", error);
    return NextResponse.json(
      { error: "Failed to archive sequence" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create step management routes**

Create `src/app/api/engage/sequences/[id]/steps/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST: add a new step to the sequence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sequenceId = parseInt(id, 10);
    const body = await request.json();
    const { templateId, type, subject, body: stepBody } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    // Validate: must have templateId OR inline content
    if (!templateId && !stepBody) {
      return NextResponse.json(
        { error: "Either templateId or body is required" },
        { status: 400 }
      );
    }

    // Get next position
    const maxStep = await prisma.sequenceStep.findFirst({
      where: { sequenceId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const nextPosition = (maxStep?.position ?? 0) + 1;

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId,
        templateId: templateId || null,
        type,
        subject: templateId ? null : subject || null,
        body: templateId ? null : stepBody || null,
        position: nextPosition,
      },
      include: { template: true },
    });

    return NextResponse.json(step);
  } catch (error) {
    console.error("Error adding step:", error);
    return NextResponse.json(
      { error: "Failed to add step" },
      { status: 500 }
    );
  }
}

// PATCH: reorder steps
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sequenceId = parseInt(id, 10);
    const body = await request.json();
    const { stepOrder } = body as { stepOrder: number[] }; // array of step IDs in new order

    if (!stepOrder || !Array.isArray(stepOrder)) {
      return NextResponse.json(
        { error: "stepOrder array is required" },
        { status: 400 }
      );
    }

    // Update positions in a transaction
    await prisma.$transaction(
      stepOrder.map((stepId, index) =>
        prisma.sequenceStep.update({
          where: { id: stepId },
          data: { position: index + 1 },
        })
      )
    );

    // Return updated steps
    const steps = await prisma.sequenceStep.findMany({
      where: { sequenceId },
      orderBy: { position: "asc" },
      include: { template: true },
    });

    return NextResponse.json({ steps });
  } catch (error) {
    console.error("Error reordering steps:", error);
    return NextResponse.json(
      { error: "Failed to reorder steps" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Create single step route**

Create `src/app/api/engage/sequences/[id]/steps/[stepId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { stepId } = await params;
    const body = await request.json();
    const { templateId, type, subject, body: stepBody } = body;

    const data: Record<string, unknown> = {};
    if (type !== undefined) data.type = type;

    // If switching to template-based, clear inline fields
    if (templateId !== undefined) {
      data.templateId = templateId || null;
      if (templateId) {
        data.subject = null;
        data.body = null;
      }
    }

    // If updating inline content
    if (subject !== undefined && !templateId) data.subject = subject;
    if (stepBody !== undefined && !templateId) data.body = stepBody;

    const step = await prisma.sequenceStep.update({
      where: { id: parseInt(stepId, 10) },
      data,
      include: { template: true },
    });

    return NextResponse.json(step);
  } catch (error) {
    console.error("Error updating step:", error);
    return NextResponse.json(
      { error: "Failed to update step" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, stepId } = await params;
    const sequenceId = parseInt(id, 10);

    await prisma.sequenceStep.delete({
      where: { id: parseInt(stepId, 10) },
    });

    // Reindex remaining steps
    const remaining = await prisma.sequenceStep.findMany({
      where: { sequenceId },
      orderBy: { position: "asc" },
    });

    if (remaining.length > 0) {
      await prisma.$transaction(
        remaining.map((step, index) =>
          prisma.sequenceStep.update({
            where: { id: step.id },
            data: { position: index + 1 },
          })
        )
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting step:", error);
    return NextResponse.json(
      { error: "Failed to delete step" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/engage/sequences/
git commit -m "feat(engage): add sequence and step CRUD API routes"
```

---

## Task 5: Execution Engine API Routes

**Files:**
- Create: `src/app/api/engage/sequences/[id]/execute/route.ts`
- Create: `src/app/api/engage/executions/route.ts`
- Create: `src/app/api/engage/executions/[id]/route.ts`
- Create: `src/app/api/engage/executions/[id]/send/route.ts`
- Create: `src/app/api/engage/executions/[id]/complete/route.ts`
- Create: `src/app/api/engage/executions/[id]/skip/route.ts`

- [ ] **Step 1: Create the execution launch route**

Create `src/app/api/engage/sequences/[id]/execute/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { resolveMergeFields, type MergeContext } from "@/features/engage/lib/merge-fields";

export const dynamic = "force-dynamic";

interface ExecuteBody {
  contacts: Array<{
    contactId: number;
    customFields?: Record<string, string>;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sequenceId = parseInt(id, 10);
    const body: ExecuteBody = await request.json();
    const { contacts } = body;

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: "At least one contact is required" },
        { status: 400 }
      );
    }

    // Load sequence with steps and templates
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
      },
    });

    if (!sequence || sequence.isArchived) {
      return NextResponse.json(
        { error: "Sequence not found or archived" },
        { status: 404 }
      );
    }

    if (sequence.steps.length === 0) {
      return NextResponse.json(
        { error: "Sequence has no steps" },
        { status: 400 }
      );
    }

    // Load contact + district data for merge field resolution
    const contactIds = contacts.map((c) => c.contactId);
    const contactRecords = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      include: {
        district: {
          select: {
            name: true,
            stateAbbrev: true,
            cityLocation: true,
            enrollment: true,
            leaid: true,
          },
        },
      },
    });

    // Load user profile for sender fields
    const profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { fullName: true, email: true, title: true },
    });

    // Build custom fields map keyed by contactId
    const customFieldsMap = new Map(
      contacts.map((c) => [c.contactId, c.customFields || {}])
    );

    // Create execution + all step executions in a transaction
    const execution = await prisma.$transaction(async (tx) => {
      const exec = await tx.sequenceExecution.create({
        data: {
          sequenceId,
          userId: user.id,
          status: "active",
          currentStepPosition: 1,
          currentContactIndex: 0,
          contactCount: contacts.length,
          completedCount: 0,
        },
      });

      // Create StepExecutions for every contact × step combination
      const stepExecData = [];
      for (const step of sequence.steps) {
        for (const contactRecord of contactRecords) {
          const custom = customFieldsMap.get(contactRecord.id) || {};

          // Parse contact name into first/last
          const nameParts = contactRecord.name.split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          const now = new Date();
          const mergeContext: MergeContext = {
            contact: {
              first_name: firstName,
              last_name: lastName,
              full_name: contactRecord.name,
              title: contactRecord.title || "",
              email: contactRecord.email || "",
              phone: contactRecord.phone || "",
            },
            district: {
              name: contactRecord.district?.name || "",
              state: contactRecord.district?.stateAbbrev || "",
              city: contactRecord.district?.cityLocation || "",
              enrollment: contactRecord.district?.enrollment?.toLocaleString() || "",
              leaid: contactRecord.district?.leaid || "",
              pipeline: "",
              bookings: "",
              invoicing: "",
              sessions_revenue: "",
            },
            sender: {
              name: profile?.fullName || "",
              email: profile?.email || user.email || "",
              title: profile?.title || "",
            },
            date: {
              today: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
              current_month: now.toLocaleDateString("en-US", { month: "long" }),
              current_year: now.getFullYear().toString(),
            },
            custom,
          };

          // Resolve content from template or inline step
          const rawBody = step.template?.body || step.body || "";
          const rawSubject = step.template?.subject || step.subject || null;

          stepExecData.push({
            executionId: exec.id,
            stepId: step.id,
            contactId: contactRecord.id,
            status: "pending",
            sentBody: resolveMergeFields(rawBody, mergeContext),
            sentSubject: rawSubject ? resolveMergeFields(rawSubject, mergeContext) : null,
          });
        }
      }

      await tx.stepExecution.createMany({ data: stepExecData });

      return exec;
    });

    // Return execution with first step data
    const fullExecution = await prisma.sequenceExecution.findUnique({
      where: { id: execution.id },
      include: {
        sequence: {
          select: {
            name: true,
            steps: {
              orderBy: { position: "asc" },
              include: { template: true },
            },
          },
        },
      },
    });

    return NextResponse.json(fullExecution);
  } catch (error) {
    console.error("Error launching execution:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to launch execution: ${detail}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create executions list route**

Create `src/app/api/engage/executions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "active", "completed", etc.
    const sequenceId = searchParams.get("sequenceId");

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;
    if (sequenceId) where.sequenceId = parseInt(sequenceId, 10);

    const executions = await prisma.sequenceExecution.findMany({
      where,
      include: {
        sequence: {
          select: {
            name: true,
            steps: {
              orderBy: { position: "asc" },
              select: { id: true, type: true, position: true },
            },
          },
        },
        _count: {
          select: { stepExecutions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ executions });
  } catch (error) {
    console.error("Error fetching executions:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create single execution route (detail + status update)**

Create `src/app/api/engage/executions/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const execution = await prisma.sequenceExecution.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        sequence: {
          select: {
            name: true,
            steps: {
              orderBy: { position: "asc" },
              include: { template: true },
            },
          },
        },
        stepExecutions: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, title: true, leaid: true },
            },
            step: { select: { position: true, type: true } },
          },
          orderBy: [{ step: { position: "asc" } }, { contactId: "asc" }],
        },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    return NextResponse.json(execution);
  } catch (error) {
    console.error("Error fetching execution:", error);
    return NextResponse.json(
      { error: "Failed to fetch execution" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const validStatuses = ["active", "paused", "completed", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (status) {
      data.status = status;
      if (status === "completed" || status === "cancelled") {
        data.completedAt = new Date();
      }
    }

    const execution = await prisma.sequenceExecution.update({
      where: { id: parseInt(id, 10) },
      data,
    });

    return NextResponse.json(execution);
  } catch (error) {
    console.error("Error updating execution:", error);
    return NextResponse.json(
      { error: "Failed to update execution" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Create the email send route**

Create `src/app/api/engage/executions/[id]/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { decrypt, encrypt } from "@/features/integrations/lib/encryption";
import { refreshGmailToken, isTokenExpired } from "@/features/integrations/lib/google-gmail";

export const dynamic = "force-dynamic";

interface SendBody {
  stepExecutionId: number;
  subject: string;
  body: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const executionId = parseInt(id, 10);
    const { stepExecutionId, subject, body: emailBody }: SendBody = await request.json();

    // Load step execution with contact
    const stepExec = await prisma.stepExecution.findUnique({
      where: { id: stepExecutionId },
      include: {
        contact: { select: { id: true, email: true, name: true, leaid: true } },
        step: { select: { type: true } },
      },
    });

    if (!stepExec || stepExec.executionId !== executionId) {
      return NextResponse.json(
        { error: "Step execution not found" },
        { status: 404 }
      );
    }

    if (stepExec.status === "completed") {
      return NextResponse.json(
        { error: "Step already completed" },
        { status: 400 }
      );
    }

    if (!stepExec.contact.email) {
      return NextResponse.json(
        { error: "Contact has no email address" },
        { status: 400 }
      );
    }

    // Get Gmail integration
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "gmail" } },
    });

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Gmail is not connected" },
        { status: 400 }
      );
    }

    // Get valid access token
    let accessToken = decrypt(integration.accessToken);
    if (integration.tokenExpiresAt && isTokenExpired(integration.tokenExpiresAt)) {
      const refreshToken = integration.refreshToken
        ? decrypt(integration.refreshToken)
        : null;
      if (!refreshToken) {
        return NextResponse.json(
          { error: "Gmail token expired and no refresh token available" },
          { status: 400 }
        );
      }

      const refreshed = await refreshGmailToken(refreshToken);
      await prisma.userIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          tokenExpiresAt: refreshed.expiresAt,
          status: "connected",
        },
      });
      accessToken = refreshed.accessToken;
    }

    // Construct and send email
    const fromEmail = integration.accountEmail || user.email || "";
    const messageParts = [
      `From: ${fromEmail}`,
      `To: ${stepExec.contact.email}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      emailBody,
    ];
    const rawMessage = messageParts.join("\r\n");
    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    // Create Activity record
    const activity = await prisma.activity.create({
      data: {
        type: "email_sent",
        title: subject,
        source: "engage",
        gmailMessageId: sent.data.id || undefined,
        startDate: new Date(),
        status: "completed",
        createdByUserId: user.id,
      },
    });

    // Link activity to contact and district
    await Promise.all([
      prisma.activityContact.create({
        data: { activityId: activity.id, contactId: stepExec.contact.id },
      }),
      stepExec.contact.leaid
        ? prisma.activityDistrict.create({
            data: { activityId: activity.id, districtLeaid: stepExec.contact.leaid },
          })
        : Promise.resolve(),
    ]);

    // Update step execution
    await prisma.stepExecution.update({
      where: { id: stepExecutionId },
      data: {
        status: "completed",
        sentBody: emailBody,
        sentSubject: subject,
        gmailMessageId: sent.data.id || null,
        activityId: activity.id,
        completedAt: new Date(),
      },
    });

    // Advance execution position
    await advanceExecution(executionId);

    return NextResponse.json({ success: true, activityId: activity.id });
  } catch (error) {
    console.error("Engage send error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to send email: ${detail}` },
      { status: 500 }
    );
  }
}

async function advanceExecution(executionId: number) {
  const execution = await prisma.sequenceExecution.findUnique({
    where: { id: executionId },
    include: {
      sequence: {
        select: {
          steps: { orderBy: { position: "asc" }, select: { id: true, position: true } },
        },
      },
    },
  });

  if (!execution) return;

  const completedCount = await prisma.stepExecution.count({
    where: { executionId, status: { in: ["completed", "skipped"] } },
  });

  // Find next pending step execution
  const nextPending = await prisma.stepExecution.findFirst({
    where: { executionId, status: "pending" },
    include: { step: { select: { position: true } } },
    orderBy: [{ step: { position: "asc" } }, { contactId: "asc" }],
  });

  if (!nextPending) {
    // All done
    await prisma.sequenceExecution.update({
      where: { id: executionId },
      data: {
        status: "completed",
        completedCount,
        completedAt: new Date(),
      },
    });
  } else {
    // Find the contact index within this step
    const pendingForStep = await prisma.stepExecution.findMany({
      where: { executionId, stepId: nextPending.stepId, status: "pending" },
      orderBy: { contactId: "asc" },
      select: { id: true },
    });
    const allForStep = await prisma.stepExecution.findMany({
      where: { executionId, stepId: nextPending.stepId },
      orderBy: { contactId: "asc" },
      select: { id: true, status: true },
    });
    const contactIndex = allForStep.findIndex((se) => se.id === pendingForStep[0]?.id);

    await prisma.sequenceExecution.update({
      where: { id: executionId },
      data: {
        completedCount,
        currentStepPosition: nextPending.step.position,
        currentContactIndex: Math.max(0, contactIndex),
      },
    });
  }
}
```

- [ ] **Step 5: Create the manual step completion route**

Create `src/app/api/engage/executions/[id]/complete/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const executionId = parseInt(id, 10);
    const body = await request.json();
    const { stepExecutionId, notes } = body;

    const stepExec = await prisma.stepExecution.findUnique({
      where: { id: stepExecutionId },
      include: {
        contact: { select: { id: true, name: true, leaid: true } },
        step: { select: { type: true } },
      },
    });

    if (!stepExec || stepExec.executionId !== executionId) {
      return NextResponse.json(
        { error: "Step execution not found" },
        { status: 404 }
      );
    }

    if (stepExec.status === "completed") {
      return NextResponse.json(
        { error: "Step already completed" },
        { status: 400 }
      );
    }

    // Create Activity for manual step
    const activityType = stepExec.step.type === "call" ? "call" : `${stepExec.step.type}_sent`;
    const activity = await prisma.activity.create({
      data: {
        type: activityType,
        title: `${stepExec.step.type} — ${stepExec.contact.name}`,
        notes: notes || null,
        source: "engage",
        startDate: new Date(),
        status: "completed",
        createdByUserId: user.id,
      },
    });

    // Link to contact and district
    await Promise.all([
      prisma.activityContact.create({
        data: { activityId: activity.id, contactId: stepExec.contact.id },
      }),
      stepExec.contact.leaid
        ? prisma.activityDistrict.create({
            data: { activityId: activity.id, districtLeaid: stepExec.contact.leaid },
          })
        : Promise.resolve(),
    ]);

    // Update step execution
    await prisma.stepExecution.update({
      where: { id: stepExecutionId },
      data: {
        status: "completed",
        notes: notes || null,
        activityId: activity.id,
        completedAt: new Date(),
      },
    });

    // Advance execution (reuse same logic from send route — extract to shared util in implementation)
    // For now, inline the advancement logic
    const execution = await prisma.sequenceExecution.findUnique({
      where: { id: executionId },
    });
    if (!execution) return NextResponse.json({ success: true, activityId: activity.id });

    const completedCount = await prisma.stepExecution.count({
      where: { executionId, status: { in: ["completed", "skipped"] } },
    });

    const nextPending = await prisma.stepExecution.findFirst({
      where: { executionId, status: "pending" },
      include: { step: { select: { position: true } } },
      orderBy: [{ step: { position: "asc" } }, { contactId: "asc" }],
    });

    if (!nextPending) {
      await prisma.sequenceExecution.update({
        where: { id: executionId },
        data: { status: "completed", completedCount, completedAt: new Date() },
      });
    } else {
      const allForStep = await prisma.stepExecution.findMany({
        where: { executionId, stepId: nextPending.stepId },
        orderBy: { contactId: "asc" },
        select: { id: true },
      });
      const contactIndex = allForStep.findIndex((se) => se.id === nextPending.id);

      await prisma.sequenceExecution.update({
        where: { id: executionId },
        data: {
          completedCount,
          currentStepPosition: nextPending.step.position,
          currentContactIndex: Math.max(0, contactIndex),
        },
      });
    }

    return NextResponse.json({ success: true, activityId: activity.id });
  } catch (error) {
    console.error("Error completing step:", error);
    return NextResponse.json(
      { error: "Failed to complete step" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 6: Create the skip step route**

Create `src/app/api/engage/executions/[id]/skip/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const executionId = parseInt(id, 10);
    const body = await request.json();
    const { stepExecutionId } = body;

    const stepExec = await prisma.stepExecution.findUnique({
      where: { id: stepExecutionId },
    });

    if (!stepExec || stepExec.executionId !== executionId) {
      return NextResponse.json(
        { error: "Step execution not found" },
        { status: 404 }
      );
    }

    await prisma.stepExecution.update({
      where: { id: stepExecutionId },
      data: { status: "skipped", completedAt: new Date() },
    });

    // Advance execution
    const completedCount = await prisma.stepExecution.count({
      where: { executionId, status: { in: ["completed", "skipped"] } },
    });

    const nextPending = await prisma.stepExecution.findFirst({
      where: { executionId, status: "pending" },
      include: { step: { select: { position: true } } },
      orderBy: [{ step: { position: "asc" } }, { contactId: "asc" }],
    });

    if (!nextPending) {
      await prisma.sequenceExecution.update({
        where: { id: executionId },
        data: { status: "completed", completedCount, completedAt: new Date() },
      });
    } else {
      const allForStep = await prisma.stepExecution.findMany({
        where: { executionId, stepId: nextPending.stepId },
        orderBy: { contactId: "asc" },
        select: { id: true },
      });
      const contactIndex = allForStep.findIndex((se) => se.id === nextPending.id);

      await prisma.sequenceExecution.update({
        where: { id: executionId },
        data: {
          completedCount,
          currentStepPosition: nextPending.step.position,
          currentContactIndex: Math.max(0, contactIndex),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error skipping step:", error);
    return NextResponse.json(
      { error: "Failed to skip step" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/engage/executions/ src/app/api/engage/sequences/[id]/execute/
git commit -m "feat(engage): add execution engine API routes (launch, send, complete, skip)"
```

---

## Task 6: TanStack Query Hooks

**Files:**
- Create: `src/features/engage/lib/queries.ts`

- [ ] **Step 1: Create all query hooks**

Create `src/features/engage/lib/queries.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/features/shared/lib/api-client";
import type {
  EngageTemplate,
  SequenceData,
  SequenceExecutionData,
  StepExecutionData,
  SequenceStepData,
} from "../types";

const API = "/api/engage";

// ===== Templates =====

export function useEngageTemplates(type?: string) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  const qs = params.toString();

  return useQuery<{ templates: EngageTemplate[] }>({
    queryKey: ["engage-templates", type],
    queryFn: () => fetchJson(`${API}/templates${qs ? `?${qs}` : ""}`),
    staleTime: 2 * 60_000,
  });
}

export function useEngageTemplate(id: number | null) {
  return useQuery<EngageTemplate>({
    queryKey: ["engage-template", id],
    queryFn: () => fetchJson(`${API}/templates/${id}`),
    enabled: id !== null,
    staleTime: 2 * 60_000,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; type: string; subject?: string; body: string }) =>
      fetchJson<EngageTemplate>(`${API}/templates`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engage-templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; type?: string; subject?: string; body?: string; isArchived?: boolean }) =>
      fetchJson<EngageTemplate>(`${API}/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-templates"] });
      qc.invalidateQueries({ queryKey: ["engage-template", vars.id] });
    },
  });
}

export function useArchiveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetchJson(`${API}/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engage-templates"] });
    },
  });
}

// ===== Sequences =====

export function useSequences() {
  return useQuery<{ sequences: SequenceData[] }>({
    queryKey: ["engage-sequences"],
    queryFn: () => fetchJson(`${API}/sequences`),
    staleTime: 2 * 60_000,
  });
}

export function useSequence(id: number | null) {
  return useQuery<SequenceData>({
    queryKey: ["engage-sequence", id],
    queryFn: () => fetchJson(`${API}/sequences/${id}`),
    enabled: id !== null,
    staleTime: 2 * 60_000,
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      fetchJson<SequenceData>(`${API}/sequences`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engage-sequences"] });
    },
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; description?: string; isArchived?: boolean }) =>
      fetchJson<SequenceData>(`${API}/sequences/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-sequences"] });
      qc.invalidateQueries({ queryKey: ["engage-sequence", vars.id] });
    },
  });
}

// ===== Steps =====

export function useAddStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, ...data }: { sequenceId: number; templateId?: number; type: string; subject?: string; body?: string }) =>
      fetchJson<SequenceStepData>(`${API}/sequences/${sequenceId}/steps`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-sequence", vars.sequenceId] });
      qc.invalidateQueries({ queryKey: ["engage-sequences"] });
    },
  });
}

export function useReorderSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, stepOrder }: { sequenceId: number; stepOrder: number[] }) =>
      fetchJson(`${API}/sequences/${sequenceId}/steps`, {
        method: "PATCH",
        body: JSON.stringify({ stepOrder }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-sequence", vars.sequenceId] });
    },
  });
}

export function useUpdateStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, stepId, ...data }: { sequenceId: number; stepId: number; templateId?: number | null; type?: string; subject?: string; body?: string }) =>
      fetchJson(`${API}/sequences/${sequenceId}/steps/${stepId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-sequence", vars.sequenceId] });
    },
  });
}

export function useDeleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, stepId }: { sequenceId: number; stepId: number }) =>
      fetchJson(`${API}/sequences/${sequenceId}/steps/${stepId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-sequence", vars.sequenceId] });
      qc.invalidateQueries({ queryKey: ["engage-sequences"] });
    },
  });
}

// ===== Executions =====

export function useExecutions(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const qs = params.toString();

  return useQuery<{ executions: SequenceExecutionData[] }>({
    queryKey: ["engage-executions", status],
    queryFn: () => fetchJson(`${API}/executions${qs ? `?${qs}` : ""}`),
    staleTime: 30_000,
  });
}

export function useExecution(id: number | null) {
  return useQuery({
    queryKey: ["engage-execution", id],
    queryFn: () => fetchJson<SequenceExecutionData & { stepExecutions: StepExecutionData[] }>(`${API}/executions/${id}`),
    enabled: id !== null,
    staleTime: 10_000,
  });
}

export function useLaunchExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sequenceId, contacts }: { sequenceId: number; contacts: Array<{ contactId: number; customFields?: Record<string, string> }> }) =>
      fetchJson<SequenceExecutionData>(`${API}/sequences/${sequenceId}/execute`, {
        method: "POST",
        body: JSON.stringify({ contacts }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engage-executions"] });
    },
  });
}

export function useSendStepEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, stepExecutionId, subject, body }: { executionId: number; stepExecutionId: number; subject: string; body: string }) =>
      fetchJson(`${API}/executions/${executionId}/send`, {
        method: "POST",
        body: JSON.stringify({ stepExecutionId, subject, body }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-execution", vars.executionId] });
      qc.invalidateQueries({ queryKey: ["engage-executions"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useCompleteStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, stepExecutionId, notes }: { executionId: number; stepExecutionId: number; notes?: string }) =>
      fetchJson(`${API}/executions/${executionId}/complete`, {
        method: "POST",
        body: JSON.stringify({ stepExecutionId, notes }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-execution", vars.executionId] });
      qc.invalidateQueries({ queryKey: ["engage-executions"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

export function useSkipStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, stepExecutionId }: { executionId: number; stepExecutionId: number }) =>
      fetchJson(`${API}/executions/${executionId}/skip`, {
        method: "POST",
        body: JSON.stringify({ stepExecutionId }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-execution", vars.executionId] });
      qc.invalidateQueries({ queryKey: ["engage-executions"] });
    },
  });
}

export function useUpdateExecutionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ executionId, status }: { executionId: number; status: string }) =>
      fetchJson(`${API}/executions/${executionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["engage-execution", vars.executionId] });
      qc.invalidateQueries({ queryKey: ["engage-executions"] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/engage/lib/queries.ts
git commit -m "feat(engage): add TanStack Query hooks for all Engage API endpoints"
```

---

## Task 7: Navigation — Add Engage Tab

**Files:**
- Modify: `src/features/shared/lib/app-store.ts:5`
- Modify: `src/features/shared/components/navigation/Sidebar.tsx:10,156-165`
- Modify: `src/app/page.tsx:17,33,182-216`
- Create: `src/features/shared/components/views/EngageView.tsx` (thin wrapper)

- [ ] **Step 1: Add "engage" to TabId in app-store.ts**

In `src/features/shared/lib/app-store.ts` line 5, change:

```typescript
export type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "progress" | "leaderboard" | "resources" | "profile" | "admin";
```

to:

```typescript
export type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "engage" | "progress" | "leaderboard" | "resources" | "profile" | "admin";
```

- [ ] **Step 2: Add "engage" to TabId in Sidebar.tsx**

In `src/features/shared/components/navigation/Sidebar.tsx` line 10, change:

```typescript
type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "progress" | "leaderboard" | "resources" | "profile" | "admin";
```

to:

```typescript
type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "engage" | "progress" | "leaderboard" | "resources" | "profile" | "admin";
```

- [ ] **Step 3: Add EngageIcon and tab to MAIN_TABS in Sidebar.tsx**

Add the EngageIcon component after the existing icons (before `MAIN_TABS`):

```typescript
const EngageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
```

Add to `MAIN_TABS` array after tasks:

```typescript
{ id: "engage", label: "Engage", icon: <EngageIcon /> },
```

- [ ] **Step 4: Create the EngageView wrapper**

Create `src/features/shared/components/views/EngageView.tsx`:

```typescript
"use client";

import EngageViewContent from "@/features/engage/components/EngageView";

export default function EngageView() {
  return <EngageViewContent />;
}
```

- [ ] **Step 5: Wire up in page.tsx**

In `src/app/page.tsx`, add import:

```typescript
import EngageView from "@/features/shared/components/views/EngageView";
```

Add `"engage"` to the `VALID_TABS` array:

```typescript
const VALID_TABS: TabId[] = ["home", "map", "plans", "activities", "tasks", "engage", "progress", "resources", "profile", "admin"];
```

Add case in `renderContent()` switch, after the `tasks` case:

```typescript
case "engage":
  return <EngageView />;
```

- [ ] **Step 6: Create the placeholder EngageView component**

Create `src/features/engage/components/EngageView.tsx`:

```typescript
"use client";

import { useState } from "react";

type EngageSubTab = "sequences" | "active-runs" | "templates" | "history";

const SUB_TABS: { id: EngageSubTab; label: string }[] = [
  { id: "sequences", label: "Sequences" },
  { id: "active-runs", label: "Active Runs" },
  { id: "templates", label: "Templates" },
  { id: "history", label: "History" },
];

export default function EngageView() {
  const [activeSubTab, setActiveSubTab] = useState<EngageSubTab>("sequences");

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#403770]">Engage</h1>
          <p className="text-sm text-[#6B5F8A] mt-1">
            Create sequences, manage templates, and track outreach
          </p>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex gap-1 border-b border-[#E2DEEC] mb-6">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSubTab === tab.id
                  ? "border-[#F37167] text-[#403770]"
                  : "border-transparent text-[#6B5F8A] hover:text-[#403770] hover:border-[#E2DEEC]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sub-tab content — placeholder for now */}
        <div className="text-sm text-[#6B5F8A]">
          {activeSubTab === "sequences" && <p>Sequences tab — coming next</p>}
          {activeSubTab === "active-runs" && <p>Active runs tab — coming next</p>}
          {activeSubTab === "templates" && <p>Templates tab — coming next</p>}
          {activeSubTab === "history" && <p>History tab — coming next</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify the tab renders**

Run: `npm run dev` (port 3005)
Navigate to `http://localhost:3005/?tab=engage`
Expected: Engage tab is visible in sidebar, clicking it shows the sub-tab layout with placeholder content.

- [ ] **Step 8: Commit**

```bash
git add src/features/shared/lib/app-store.ts src/features/shared/components/navigation/Sidebar.tsx src/app/page.tsx src/features/shared/components/views/EngageView.tsx src/features/engage/components/EngageView.tsx
git commit -m "feat(engage): add Engage tab to sidebar navigation and app routing"
```

---

## Task 8: Templates Tab UI

**Files:**
- Create: `src/features/engage/components/TemplatesTab.tsx`
- Create: `src/features/engage/components/TemplateCard.tsx`
- Create: `src/features/engage/components/TemplateEditor.tsx`
- Create: `src/features/engage/components/MergeFieldToolbar.tsx`
- Modify: `src/features/engage/components/EngageView.tsx`

This task builds the Templates sub-tab: card grid listing all templates, empty state, and the create/edit template editor with merge field insertion toolbar. Follow the spec's UI Design > Template editor section. Use existing Fullmind brand tokens from `Documentation/UI Framework/tokens.md`. Wire up to the TanStack Query hooks from Task 6.

- [ ] **Step 1: Build MergeFieldToolbar** — clickable buttons that insert `{{field_name}}` at cursor position. Display system fields grouped by category (Contact, District, Financial, Sender, Date). Accept an `onInsert: (fieldKey: string) => void` prop.

- [ ] **Step 2: Build TemplateEditor** — form with name, type selector (email/call/text/linkedin), subject (email only), body textarea, and MergeFieldToolbar. Uses `useCreateTemplate` and `useUpdateTemplate` mutations. Accept optional `templateId` prop for edit mode.

- [ ] **Step 3: Build TemplateCard** — displays template name, type icon, body preview (truncated), last updated date. Click opens TemplateEditor. Overflow menu with Archive action.

- [ ] **Step 4: Build TemplatesTab** — fetches templates via `useEngageTemplates()`. Renders card grid. Empty state: "Create reusable email templates with merge fields" CTA. "+ New Template" button opens TemplateEditor. Skeleton loading state.

- [ ] **Step 5: Wire into EngageView** — replace `templates` placeholder with `<TemplatesTab />`.

- [ ] **Step 6: Verify** — navigate to `/?tab=engage`, click Templates sub-tab. Create a template, verify it appears in the list.

- [ ] **Step 7: Commit**

```bash
git add src/features/engage/components/
git commit -m "feat(engage): add Templates tab with CRUD, merge field toolbar"
```

---

## Task 9: Sequences Tab UI

**Files:**
- Create: `src/features/engage/components/SequencesTab.tsx`
- Create: `src/features/engage/components/SequenceCard.tsx`
- Create: `src/features/engage/components/SequenceEditor.tsx`
- Create: `src/features/engage/components/StepCard.tsx`
- Create: `src/features/engage/components/AddStepModal.tsx`
- Create: `src/features/engage/components/InlineStepEditor.tsx`
- Create: `src/features/engage/components/MergeFieldSection.tsx`
- Create: `src/features/engage/components/TemplateChangeBanner.tsx`
- Modify: `src/features/engage/components/EngageView.tsx`

This task builds the Sequences sub-tab: card grid, sequence editor with step list, add step modal (choose template OR write inline), drag-to-reorder, merge field management, and the template recently modified warning banner. Follow the spec's UI Design > Sequence editor section.

- [ ] **Step 1: Build StepCard** — displays step type icon, template name (or "Custom"), subject preview, drag handle, overflow menu (edit, remove, duplicate). Click expands to show/edit inline content.

- [ ] **Step 2: Build InlineStepEditor** — subject + body editor for steps that don't use a template. Includes MergeFieldToolbar for inserting merge tags. "Save as Template" button that calls `useCreateTemplate` to promote inline content.

- [ ] **Step 3: Build AddStepModal** — modal with two options: "Choose a Template" (shows filtered template list by step type) or "Write Custom" (opens InlineStepEditor). Step type selector at top. Uses `useAddStep` mutation on save.

- [ ] **Step 4: Build MergeFieldSection** — lists auto-detected system fields from step bodies/templates. "+ Add Custom Field" form for name, label, default value. Uses sequence's `mergeFieldDefs`.

- [ ] **Step 5: Build TemplateChangeBanner** — checks each step's template `updatedAt`. If within 7 days, shows dismissable info banner. Dismiss stored in localStorage keyed by `templateId-${updatedAt}`.

- [ ] **Step 6: Build SequenceEditor** — full editor view: name/description header, ordered StepCard list with drag-to-reorder (use `useReorderSteps`), AddStepModal trigger, MergeFieldSection, TemplateChangeBanner, Save/Archive buttons, "Run Sequence →" button. Uses `useSequence`, `useUpdateSequence`, `useAddStep`, `useDeleteStep`.

- [ ] **Step 7: Build SequenceCard** — displays sequence name, step count with type icons, total executions count, last updated. Click opens SequenceEditor. Overflow menu with Archive/Duplicate.

- [ ] **Step 8: Build SequencesTab** — fetches sequences via `useSequences()`. Card grid with empty state. "+ New Sequence" button.

- [ ] **Step 9: Wire into EngageView** — replace `sequences` placeholder with `<SequencesTab />`.

- [ ] **Step 10: Verify** — create a sequence with mixed template and inline steps. Reorder steps. Verify save works.

- [ ] **Step 11: Commit**

```bash
git add src/features/engage/components/
git commit -m "feat(engage): add Sequences tab with editor, step management, drag reorder"
```

---

## Task 10: Execution Flow — Contact Selector & Launch

**Files:**
- Create: `src/features/engage/components/ContactSelector.tsx`
- Modify: `src/features/engage/components/SequenceEditor.tsx`

This task builds the contact selection modal that opens when "Run Sequence →" is clicked. Follow the spec's Execution flow > Contact selector section.

- [ ] **Step 1: Build ContactSelector** — modal/panel that lets users search and select contacts from territory plan districts. Uses existing contact search API (`/api/contacts`). Shows contact name, email, title, district. Warning icon for contacts missing email. Custom merge field columns for manual fill (from sequence's `mergeFieldDefs`). Review screen with merge field preview. "Launch" button calls `useLaunchExecution`. Manual add option for one-off recipients (name + email input).

- [ ] **Step 2: Wire "Run Sequence →"** — in SequenceEditor, the button opens ContactSelector. On launch success, navigate to the execution panel (Active Runs tab).

- [ ] **Step 3: Verify** — open a sequence, click Run, select contacts, fill custom fields, launch. Verify SequenceExecution and StepExecution records are created.

- [ ] **Step 4: Commit**

```bash
git add src/features/engage/components/ContactSelector.tsx src/features/engage/components/SequenceEditor.tsx
git commit -m "feat(engage): add contact selector and execution launch flow"
```

---

## Task 11: Execution Panel — The Step-Through Send Experience

**Files:**
- Create: `src/features/engage/components/ExecutionPanel.tsx`
- Create: `src/features/engage/components/EmailStepView.tsx`
- Create: `src/features/engage/components/ManualStepView.tsx`
- Modify: `src/features/engage/components/EngageView.tsx`

This is the core UX — the playlist-style step-through panel. Follow the spec's Execution flow > Step-through panel section.

- [ ] **Step 1: Build EmailStepView** — email editor for execution. Props: `stepExecution: StepExecutionData`. Shows To (read-only), editable subject, editable body (textarea or rich text). Collapsible merge field reference showing resolved values. "Send & Next" button (calls `useSendStepEmail`, shows spinner, disables during send). "Skip" button (calls `useSkipStep`). Error handling: display inline error on Gmail failure with Retry option.

- [ ] **Step 2: Build ManualStepView** — for call/text/linkedin steps. Shows contact info (name, phone, email, district). Talking points from template/inline body. Notes textarea. "Complete & Next" button (calls `useCompleteStep`). "Skip" button.

- [ ] **Step 3: Build ExecutionPanel** — orchestrates the step-through flow. Loads execution via `useExecution(executionId)`. Header shows sequence name, current step label, contact progress (e.g., "8 of 30"). Renders EmailStepView or ManualStepView based on current step type. Progress bar/dots. On step completion, auto-advances to next pending StepExecution. When all done, shows completion summary. Handles Gmail not connected and token expired errors per spec.

- [ ] **Step 4: Wire into EngageView** — add state for `activeExecutionId`. When set, render ExecutionPanel instead of sub-tab content. Back button returns to Active Runs.

- [ ] **Step 5: Verify** — launch an execution, step through email sends and manual steps. Verify Activities are created for each completion. Verify auto-advance works. Verify pause/resume by navigating away and returning.

- [ ] **Step 6: Commit**

```bash
git add src/features/engage/components/ExecutionPanel.tsx src/features/engage/components/EmailStepView.tsx src/features/engage/components/ManualStepView.tsx src/features/engage/components/EngageView.tsx
git commit -m "feat(engage): add execution panel with email send, manual steps, auto-advance"
```

---

## Task 12: Active Runs Tab

**Files:**
- Create: `src/features/engage/components/ActiveRunsTab.tsx`
- Create: `src/features/engage/components/ActiveRunCard.tsx`
- Modify: `src/features/engage/components/EngageView.tsx`

- [ ] **Step 1: Build ActiveRunCard** — shows sequence name, progress (e.g., "12/30 contacts"), current step info, status badge. Click resumes execution (sets `activeExecutionId` in EngageView). Pause/Cancel actions via `useUpdateExecutionStatus`.

- [ ] **Step 2: Build ActiveRunsTab** — fetches active executions via `useExecutions("active")`. Also fetches paused. Renders cards. Empty state: "No active runs. Start a sequence from the Sequences tab." Badge count shown on the sub-tab header.

- [ ] **Step 3: Wire into EngageView** — replace `active-runs` placeholder. Add badge count to Active Runs sub-tab label. Click on a card sets `activeExecutionId` to show ExecutionPanel.

- [ ] **Step 4: Verify** — launch an execution, pause it, see it in Active Runs. Resume and complete it.

- [ ] **Step 5: Commit**

```bash
git add src/features/engage/components/ActiveRunsTab.tsx src/features/engage/components/ActiveRunCard.tsx src/features/engage/components/EngageView.tsx
git commit -m "feat(engage): add Active Runs tab with resume, pause, cancel"
```

---

## Task 13: History Tab & Analytics

**Files:**
- Create: `src/features/engage/components/HistoryTab.tsx`
- Create: `src/features/engage/components/ExecutionDetailView.tsx`
- Modify: `src/features/engage/components/EngageView.tsx`

- [ ] **Step 1: Build HistoryTab** — fetches completed/cancelled executions via `useExecutions("completed")` + `useExecutions("cancelled")`. Renders filterable table: sequence name, contact count, sent, opened (placeholder), clicked (placeholder), status, date. Filter by sequence name and date range. CSV export button. Empty state message.

- [ ] **Step 2: Build ExecutionDetailView** — loads full execution with step executions via `useExecution(id)`. Summary stats (sent, skipped counts). Per-step breakdown. Per-contact grid: contact × step matrix with status icons. Click any cell to view `sentBody`/`sentSubject` or notes in a modal.

- [ ] **Step 3: Wire into EngageView** — replace `history` placeholder. Click on history row opens ExecutionDetailView.

- [ ] **Step 4: Verify** — complete an execution, navigate to History, see it listed. Click into detail view, verify per-contact breakdown.

- [ ] **Step 5: Commit**

```bash
git add src/features/engage/components/HistoryTab.tsx src/features/engage/components/ExecutionDetailView.tsx src/features/engage/components/EngageView.tsx
git commit -m "feat(engage): add History tab with analytics and execution detail view"
```

---

## Task 14: Final Integration & Verification

**Files:**
- Modify: various (fixes from integration testing)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (including new merge field tests).

- [ ] **Step 3: End-to-end manual verification**

1. Navigate to `/?tab=engage`
2. Create a template with merge fields
3. Create a sequence with mixed template + inline steps
4. Run the sequence against contacts
5. Step through: send emails, complete calls, skip one
6. Verify Activities created in Activities tab
7. Check History tab shows the completed run
8. Click into detail view, verify per-contact data

- [ ] **Step 4: Fix any issues found**

Address any bugs or UI issues discovered during verification.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(engage): integration fixes and final verification"
```
