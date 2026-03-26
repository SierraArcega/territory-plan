# Hide System Activities from Frontend Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter out system-generated activities (like Bulk Contact Enrichment) from all user-facing activity lists while preserving them in the database for direct querying.

**Architecture:** Add a default `source != 'system'` filter to the `GET /api/activities` endpoint. Remove the `system` category and `contact_enrichment` type from all UI-facing type definitions so they can't appear in creation forms or filter UI. Add activity source type documentation to README.

**Tech Stack:** Next.js App Router API routes, Prisma, TypeScript

**Spec:** `Docs/superpowers/specs/2026-03-25-hide-system-activities-design.md`

---

### Task 1: Create feature branch

**Files:** None

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feat/hide-system-activities
```

- [ ] **Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `feat/hide-system-activities`

---

### Task 2: Filter system activities from the API list endpoint

**Files:**
- Modify: `src/app/api/activities/route.ts:37-39`

- [ ] **Step 1: Add system source exclusion to the where clause**

In `src/app/api/activities/route.ts`, modify the initial `where` clause (line 37-39) from:

```typescript
    const where: Prisma.ActivityWhereInput = {
      createdByUserId: user.id,
    };
```

to:

```typescript
    const where: Prisma.ActivityWhereInput = {
      createdByUserId: user.id,
      source: { not: "system" },
    };
```

This filters out all system-sourced activities (past and future) from every list query. The existing `source` filter (line 76-78) still works — if a user explicitly requests `?source=manual`, the `not: "system"` is redundant but harmless since Prisma ANDs conditions on the same field.

- [ ] **Step 2: Verify the dev server starts without errors**

```bash
npm run dev
```

Expected: No TypeScript or runtime errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/activities/route.ts
git commit -m "feat: filter system activities from GET /api/activities endpoint"
```

---

### Task 3: Remove system category from UI type definitions

**Files:**
- Modify: `src/features/activities/types.ts:3-22, 41-65, 68-92, 95-102, 105-112, 115-122, 219-226`
- Modify: `src/features/activities/outcome-types.ts:146-153`

- [ ] **Step 1: Remove `system` from `ACTIVITY_CATEGORIES`**

In `src/features/activities/types.ts`, remove line 21:

```typescript
  system: ["contact_enrichment"],
```

The `ACTIVITY_CATEGORIES` object should end with:

```typescript
  thought_leadership: ["webinar", "speaking_engagement", "professional_development", "course"],
} as const;
```

- [ ] **Step 2: Remove `contact_enrichment` from `ACTIVITY_TYPE_LABELS`**

Remove lines 63-64:

```typescript
  // System
  contact_enrichment: "Contact Enrichment",
```

- [ ] **Step 3: Remove `contact_enrichment` from `ACTIVITY_TYPE_ICONS`**

Remove lines 90-91:

```typescript
  // System
  contact_enrichment: "🔍",
```

- [ ] **Step 4: Remove `system` from `CATEGORY_LABELS`**

Remove line 101:

```typescript
  system: "System",
```

- [ ] **Step 5: Remove `system` from `CATEGORY_ICONS`**

Remove line 111:

```typescript
  system: "⚙️",
```

- [ ] **Step 6: Remove `system` from `CATEGORY_DESCRIPTIONS`**

Remove line 121:

```typescript
  system: "Automated system activities",
```

- [ ] **Step 7: Remove `system` from `DEFAULT_TYPE_FOR_CATEGORY`**

Remove line 225:

```typescript
  system: "contact_enrichment",
```

- [ ] **Step 8: Remove `system` from `OUTCOMES_BY_CATEGORY`**

In `src/features/activities/outcome-types.ts`, remove line 152:

```typescript
  system: [],
```

- [ ] **Step 9: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: No new errors introduced. (There may be pre-existing errors — check that none reference `system` or `contact_enrichment`.)

- [ ] **Step 10: Commit**

```bash
git add src/features/activities/types.ts src/features/activities/outcome-types.ts
git commit -m "feat: remove system category and contact_enrichment from UI type definitions"
```

---

### Task 4: Verify filter chips don't expose system source

**Files:**
- Read-only: `src/features/activities/components/ActivityFilterChips.tsx`

- [ ] **Step 1: Confirm ActivityFilterChips does not include "system"**

Read `src/features/activities/components/ActivityFilterChips.tsx` and verify the `FILTER_OPTIONS` array only contains:

```typescript
const FILTER_OPTIONS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Email", value: "gmail_sync" },
  { label: "Calendar", value: "calendar_sync" },
  { label: "Slack", value: "slack_sync" },
  { label: "Manual", value: "manual" },
];
```

Expected: No "system" entry. No code change needed — this is a verification step only.

- [ ] **Step 2: Confirm no other component dynamically generates source filters from the type system**

Search the codebase for any dynamic source filter generation:

```bash
grep -r "source.*filter\|FILTER_OPTIONS\|sourceFilter" src/ --include="*.tsx" --include="*.ts"
```

Expected: Only `ActivityFilterChips.tsx` defines source filter options, and they're hardcoded without "system".

---

### Task 5: Add activity source types documentation to README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Activity Source Types section to README**

Add the following section after the "API Endpoints" section (after line 183) in `README.md`:

```markdown
## Activity Source Types

Activities are tagged with a `source` field indicating how they were created. Some sources are internal-only and hidden from the user-facing UI.

| Source | Origin | Visible in UI |
|--------|--------|---------------|
| `manual` | Created by users via the Activity Form | Yes |
| `calendar_sync` | Imported from Google Calendar | Yes |
| `gmail_sync` | Imported from Gmail | Yes |
| `slack_sync` | Imported from Slack | Yes |
| `system` | Generated by platform operations (e.g., bulk contact enrichment) | No — database-only |

System activities are excluded from `GET /api/activities` by default. They remain in the database and can be queried directly via Prisma or SQL for auditing purposes.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add activity source types and visibility to README"
```

---

### Task 6: Manual smoke test

- [ ] **Step 1: Start dev server and verify activities load**

```bash
npm run dev
```

Open the app, navigate to a plan's Activities tab. Verify:
- Activities list loads without errors
- No "Contact Enrichment" activities appear (if any existed before)
- Activity creation form does not show "System" category or "Contact Enrichment" type
- Source filter chips show: All, Email, Calendar, Slack, Manual (no "System")

- [ ] **Step 2: Verify bulk enrichment still works (if testable)**

If a plan with contacts is available, trigger a bulk enrichment from the Contacts tab. Verify:
- Enrichment starts and progress polls correctly
- The created activity does NOT appear in the Activities tab
- The activity IS visible in the database: `SELECT * FROM "Activity" WHERE source = 'system' ORDER BY "createdAt" DESC LIMIT 5;`
