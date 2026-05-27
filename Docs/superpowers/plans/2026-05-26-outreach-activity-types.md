# Outreach Activity Types (Email + Cold Call) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two manually-logged sales activity types — **Email** and **Cold Call** — under a new **Outreach** category, each with a small set of type-specific fields stored in `activity.metadata`.

**Architecture:** All activity types derive from a single `ACTIVITY_CATEGORIES` const in `src/features/activities/types.ts`; `Record<ActivityType, …>` maps enforce completeness at compile time. New per-type fields render via two new presentational components wired into the existing `EventTypeFields` switch. Two consumers (`ActivityFormModal`, `ActivityViewPanel`) gate the type-specific "Details" block by category — both must learn about `outreach`, and the view panel's save path must be widened so it doesn't null out the new metadata.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind 4, Prisma/Postgres (JSON `metadata` column, `VarChar(30)` `type` — no migration), Vitest.

**Spec:** `Docs/superpowers/specs/2026-05-26-outreach-activity-types-design.md`

---

## File Structure

- `src/features/activities/types.ts` — **Modify.** Add `outreach` category, two types, labels, icons, category meta, default type, two metadata interfaces, union members.
- `src/features/activities/__tests__/types.test.ts` — **Create.** Unit test for the new category/type wiring.
- `src/app/api/activities/__tests__/route.test.ts` — **Modify.** Regression tests proving POST accepts the new types.
- `src/features/activities/components/event-fields/EmailFields.tsx` — **Create.** Subject / Direction / Thread link.
- `src/features/activities/components/event-fields/ColdCallFields.tsx` — **Create.** Call result.
- `src/features/activities/components/event-fields/EventTypeFields.tsx` — **Modify.** Imports + two switch cases.
- `src/features/activities/components/ActivityFormModal.tsx` — **Modify.** Details-block gate (`showTypeDetails`).
- `src/features/activities/components/ActivityViewPanel.tsx` — **Modify.** Details render gate + save guard.

---

## Task 1: Extend the type system

**Files:**
- Test: `src/features/activities/__tests__/types.test.ts` (create)
- Modify: `src/features/activities/types.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/activities/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  ACTIVITY_CATEGORIES,
  ALL_ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  CATEGORY_DESCRIPTIONS,
  DEFAULT_TYPE_FOR_CATEGORY,
  getCategoryForType,
} from "../types";

describe("outreach activity category", () => {
  it("registers email and cold_call under the outreach category", () => {
    expect(ACTIVITY_CATEGORIES.outreach).toEqual(["email", "cold_call"]);
  });

  it("includes both types in ALL_ACTIVITY_TYPES", () => {
    expect(ALL_ACTIVITY_TYPES).toContain("email");
    expect(ALL_ACTIVITY_TYPES).toContain("cold_call");
  });

  it("resolves the category for each new type", () => {
    expect(getCategoryForType("email")).toBe("outreach");
    expect(getCategoryForType("cold_call")).toBe("outreach");
  });

  it("has labels and icons for both types", () => {
    expect(ACTIVITY_TYPE_LABELS.email).toBe("Email");
    expect(ACTIVITY_TYPE_LABELS.cold_call).toBe("Cold Call");
    expect(ACTIVITY_TYPE_ICONS.email).toBeTruthy();
    expect(ACTIVITY_TYPE_ICONS.cold_call).toBeTruthy();
  });

  it("has category metadata and a default type", () => {
    expect(CATEGORY_LABELS.outreach).toBe("Outreach");
    expect(CATEGORY_ICONS.outreach).toBeTruthy();
    expect(CATEGORY_DESCRIPTIONS.outreach).toBeTruthy();
    expect(DEFAULT_TYPE_FOR_CATEGORY.outreach).toBe("email");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/activities/__tests__/types.test.ts`
Expected: FAIL — TypeScript/property errors (`ACTIVITY_CATEGORIES.outreach` undefined, `getCategoryForType("email")` returns `"events"` fallback).

- [ ] **Step 3: Edit `types.ts` — add the category**

In `ACTIVITY_CATEGORIES` (currently ends after `thought_leadership`), insert `outreach` immediately after the `meetings` entry so it reads:

```ts
  meetings: [
    "discovery_call",
    "program_check_in",
    "proposal_review",
    "renewal_conversation",
  ],
  outreach: ["email", "cold_call"],
  gift_drop: ["gift_drop"],
```

- [ ] **Step 4: Edit `types.ts` — labels**

In `ACTIVITY_TYPE_LABELS`, after the `// Meetings` block (`renewal_conversation: "Renewal Conversation",`) add:

```ts
  // Outreach
  email: "Email",
  cold_call: "Cold Call",
```

- [ ] **Step 5: Edit `types.ts` — icons**

In `ACTIVITY_TYPE_ICONS`, after the `// Meetings` block (`renewal_conversation: "🔄",`) add:

```ts
  // Outreach
  email: "✉️",
  cold_call: "📞",
```

- [ ] **Step 6: Edit `types.ts` — category maps**

Add an `outreach` entry to each of the three category-keyed maps:

In `CATEGORY_LABELS`, after `meetings: "Meetings",`:
```ts
  outreach: "Outreach",
```
In `CATEGORY_ICONS`, after `meetings: "🤝",`:
```ts
  outreach: "📣",
```
In `CATEGORY_DESCRIPTIONS`, after the `meetings:` line:
```ts
  outreach: "Cold calls and 1:1 email outreach",
```

- [ ] **Step 7: Edit `types.ts` — metadata interfaces + union**

After the `CourseMetadata` interface (just before the `// Road Trip uses no metadata` comment), add:

```ts
export interface EmailMetadata {
  subject?: string;
  direction?: "outbound" | "inbound";
  threadLink?: string;
}

export interface ColdCallMetadata {
  callResult?: "connected" | "voicemail" | "no_answer" | "gatekeeper";
}
```

Then add both to the `ActivityMetadata` union (before `| null`):

```ts
export type ActivityMetadata =
  | ConferenceMetadata
  | SocialEventMetadata
  | WebinarMetadata
  | SpeakingEngagementMetadata
  | SponsorshipMetadata
  | ProfessionalDevelopmentMetadata
  | CourseMetadata
  | EmailMetadata
  | ColdCallMetadata
  | null;
```

- [ ] **Step 8: Edit `types.ts` — default type for category**

In `DEFAULT_TYPE_FOR_CATEGORY`, after `meetings: "discovery_call",` add:

```ts
  outreach: "email",
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/features/activities/__tests__/types.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 10: Commit**

```bash
git add src/features/activities/types.ts src/features/activities/__tests__/types.test.ts
git commit -m "feat(activities): add outreach category with email + cold_call types"
```

---

## Task 2: Confirm the API accepts the new types

The POST handler validates with `ALL_ACTIVITY_TYPES.includes(type)`, so Task 1 already makes the new types valid. These tests are regression coverage that lock that behavior in — they pass on write (data-driven validation), so there is no red phase here.

**Files:**
- Modify: `src/app/api/activities/__tests__/route.test.ts`

- [ ] **Step 1: Add the regression tests**

Inside the `describe("POST /api/activities", …)` block, after the existing `it("creates activity with relations", …)` test (ends ~line 608), add:

```ts
  it("accepts the email outreach type", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.create.mockResolvedValue({
      id: "email-1",
      type: "email",
      title: "Intro email to principal",
      notes: null,
      startDate: new Date("2026-06-01T00:00:00Z"),
      endDate: null,
      status: "planned",
      metadata: { subject: "Hello", direction: "outbound" },
      createdByUserId: "user-1",
      createdAt: new Date("2026-05-26T00:00:00Z"),
      updatedAt: new Date("2026-05-26T00:00:00Z"),
      plans: [],
      districts: [],
      contacts: [],
      states: [],
      expenses: [],
      attendees: [],
      relations: [],
      relatedTo: [],
    } as never);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        type: "email",
        title: "Intro email to principal",
        startDate: "2026-06-01T00:00:00Z",
        metadata: { subject: "Hello", direction: "outbound" },
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("email");
    expect(body.category).toBe("outreach");
  });

  it("accepts the cold_call outreach type", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.create.mockResolvedValue({
      id: "call-1",
      type: "cold_call",
      title: "Cold call: Lincoln HS",
      notes: null,
      startDate: new Date("2026-06-01T00:00:00Z"),
      endDate: null,
      status: "planned",
      metadata: { callResult: "voicemail" },
      createdByUserId: "user-1",
      createdAt: new Date("2026-05-26T00:00:00Z"),
      updatedAt: new Date("2026-05-26T00:00:00Z"),
      plans: [],
      districts: [],
      contacts: [],
      states: [],
      expenses: [],
      attendees: [],
      relations: [],
      relatedTo: [],
    } as never);

    const req = makeRequest("/api/activities", {
      method: "POST",
      body: JSON.stringify({
        type: "cold_call",
        title: "Cold call: Lincoln HS",
        startDate: "2026-06-01T00:00:00Z",
        metadata: { callResult: "voicemail" },
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("cold_call");
    expect(body.category).toBe("outreach");
  });
```

- [ ] **Step 2: Run the route tests**

Run: `npx vitest run src/app/api/activities/__tests__/route.test.ts`
Expected: PASS (50 tests — was 48, +2).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/activities/__tests__/route.test.ts
git commit -m "test(activities): POST accepts email + cold_call types"
```

---

## Task 3: Create the field components

**Files:**
- Create: `src/features/activities/components/event-fields/EmailFields.tsx`
- Create: `src/features/activities/components/event-fields/ColdCallFields.tsx`

- [ ] **Step 1: Create `EmailFields.tsx`**

```tsx
"use client";

import type { EmailMetadata } from "@/features/activities/types";

interface EmailFieldsProps {
  metadata: EmailMetadata;
  onMetadataChange: (metadata: EmailMetadata) => void;
}

export default function EmailFields({
  metadata,
  onMetadataChange,
}: EmailFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Subject & Direction */}
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Subject
          </label>
          <input
            type="text"
            value={metadata.subject || ""}
            onChange={(e) => onMetadataChange({ ...metadata, subject: e.target.value || undefined })}
            placeholder="Email subject line"
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8A80A8] mb-1">
            Direction
          </label>
          <select
            value={metadata.direction || "outbound"}
            onChange={(e) =>
              onMetadataChange({ ...metadata, direction: e.target.value as EmailMetadata["direction"] })
            }
            className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white"
          >
            <option value="outbound">Outbound</option>
            <option value="inbound">Inbound</option>
          </select>
        </div>
      </div>

      {/* Thread link */}
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Thread link
        </label>
        <input
          type="url"
          value={metadata.threadLink || ""}
          onChange={(e) => onMetadataChange({ ...metadata, threadLink: e.target.value || undefined })}
          placeholder="https://mail.google.com/..."
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ColdCallFields.tsx`**

```tsx
"use client";

import type { ColdCallMetadata } from "@/features/activities/types";

interface ColdCallFieldsProps {
  metadata: ColdCallMetadata;
  onMetadataChange: (metadata: ColdCallMetadata) => void;
}

export default function ColdCallFields({
  metadata,
  onMetadataChange,
}: ColdCallFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">
          Call result
        </label>
        <select
          value={metadata.callResult || ""}
          onChange={(e) =>
            onMetadataChange({
              ...metadata,
              callResult: (e.target.value || undefined) as ColdCallMetadata["callResult"],
            })
          }
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white"
        >
          <option value="">Select result…</option>
          <option value="connected">Connected</option>
          <option value="voicemail">Voicemail</option>
          <option value="no_answer">No answer</option>
          <option value="gatekeeper">Gatekeeper</option>
        </select>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck the new files**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). The components are not yet referenced — this only confirms they compile against the Task 1 types.

- [ ] **Step 4: Commit**

```bash
git add src/features/activities/components/event-fields/EmailFields.tsx src/features/activities/components/event-fields/ColdCallFields.tsx
git commit -m "feat(activities): EmailFields + ColdCallFields metadata inputs"
```

---

## Task 4: Wire the field components into `EventTypeFields`

**Files:**
- Modify: `src/features/activities/components/event-fields/EventTypeFields.tsx`

- [ ] **Step 1: Add type imports**

In the `import type { … } from "@/features/activities/types";` block (lines 3–12), add `EmailMetadata` and `ColdCallMetadata` after `SponsorshipMetadata`:

```ts
  SponsorshipMetadata,
  EmailMetadata,
  ColdCallMetadata,
} from "@/features/activities/types";
```

- [ ] **Step 2: Add component imports**

After `import SponsorshipFields from "./SponsorshipFields";` (line 20), add:

```ts
import EmailFields from "./EmailFields";
import ColdCallFields from "./ColdCallFields";
```

- [ ] **Step 3: Add the switch cases**

In the `switch (type)`, immediately before `default:` (line 116), add:

```tsx
    case "email":
      return (
        <EmailFields
          metadata={metadata as EmailMetadata}
          onMetadataChange={(m) => onMetadataChange(m as unknown as Record<string, unknown>)}
        />
      );

    case "cold_call":
      return (
        <ColdCallFields
          metadata={metadata as ColdCallMetadata}
          onMetadataChange={(m) => onMetadataChange(m as unknown as Record<string, unknown>)}
        />
      );

```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/activities/components/event-fields/EventTypeFields.tsx
git commit -m "feat(activities): render email + cold_call fields in EventTypeFields"
```

---

## Task 5: Show the Details block for outreach in the create modal

The Details block at line ~723 is gated by `isEventCategory` (`events || thought_leadership`). We add a dedicated `showTypeDetails` flag that also covers `outreach`, while leaving `isEventCategory` to keep gating the **Fullmind Attendees** picker (line ~712) — outreach activities should NOT get an internal-team attendee picker.

**Files:**
- Modify: `src/features/activities/components/ActivityFormModal.tsx`

- [ ] **Step 1: Add the `showTypeDetails` flag**

Find (line ~433–434):

```ts
  const typeCategory = getCategoryForType(type);
  const isEventCategory = typeCategory === "events" || typeCategory === "thought_leadership";
```

Add a line directly after it:

```ts
  const showTypeDetails = isEventCategory || typeCategory === "outreach";
```

- [ ] **Step 2: Gate the Details block on `showTypeDetails`**

Find the Details block (line ~723):

```tsx
                {/* Type-specific details */}
                {isEventCategory && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">Details</p>
                    <EventTypeFields
```

Change ONLY this conditional from `{isEventCategory && (` to:

```tsx
                {showTypeDetails && (
```

Leave the Fullmind Attendees block (line ~712, also `{isEventCategory && (`) unchanged.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/activities/components/ActivityFormModal.tsx
git commit -m "feat(activities): show type-specific details for outreach in create modal"
```

---

## Task 6: Render + persist outreach fields in the view/edit panel

`ActivityViewPanel` gates the Details block by `=== "events"` only, and on save it nulls `metadata` for any non-events category. Without this change, editing+saving a saved Email/Cold Call would silently wipe its metadata. We widen both to include `outreach`. Scope is strictly `outreach` — `thought_leadership` behavior here is left unchanged (it has the same latent issue, tracked separately).

**Files:**
- Modify: `src/features/activities/components/ActivityViewPanel.tsx`

- [ ] **Step 1: Widen the render gate**

Find (line ~84):

```ts
  const isEventCategory = getCategoryForType(type) === "events";
```

Replace with:

```ts
  const typeCategory = getCategoryForType(type);
  const isEventCategory = typeCategory === "events";
  // Categories whose types surface a "Details" metadata form in this panel.
  const showTypeDetails = typeCategory === "events" || typeCategory === "outreach";
```

Then find the Details block (line ~157):

```tsx
          {isEventCategory && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">Details</p>
              <EventTypeFields
```

Change ONLY this conditional to:

```tsx
          {showTypeDetails && (
```

(If `isEventCategory` is now unused after this edit, leave it only if other code references it; otherwise remove the unused `isEventCategory` line to satisfy lint. Verify with the typecheck/lint steps below.)

- [ ] **Step 2: Widen the save guard**

Find in `handleSave` (lines ~91–92):

```ts
    const isEvent = getCategoryForType(type) === "events";
    const hasMetadata = isEvent && Object.keys(metadata).length > 0;
```

Replace with:

```ts
    const cat = getCategoryForType(type);
    const hasTypeFields = cat === "events" || cat === "outreach";
    const hasMetadata = hasTypeFields && Object.keys(metadata).length > 0;
```

- [ ] **Step 3: Typecheck + lint the file**

Run: `npx tsc --noEmit && npx eslint src/features/activities/components/ActivityViewPanel.tsx`
Expected: PASS (no errors, no unused-var warnings). If `isEventCategory` is reported unused, delete that single line and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/features/activities/components/ActivityViewPanel.tsx
git commit -m "feat(activities): render + persist outreach metadata in view panel"
```

---

## Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Lint the touched files**

Run: `npx eslint src/features/activities/types.ts src/features/activities/components/event-fields/EmailFields.tsx src/features/activities/components/event-fields/ColdCallFields.tsx src/features/activities/components/event-fields/EventTypeFields.tsx src/features/activities/components/ActivityFormModal.tsx src/features/activities/components/ActivityViewPanel.tsx`
Expected: PASS.

- [ ] **Step 3: Run the activities + API test suites**

Run: `npx vitest run src/features/activities src/app/api/activities`
Expected: PASS — previously 127 tests; now 127 + 5 (types) + 2 (route) = 134.

- [ ] **Step 4: Production build smoke**

Run: `npm run build`
Expected: build completes without type errors.

- [ ] **Step 5: Manual verification (the riskiest path — view-panel persistence)**

Run `npm run dev` (port 3005), then:

1. New Activity → confirm an **Outreach** tile (📣) appears in the category grid, after **Meetings**.
2. Click Outreach → confirm two type tiles: **Email** (✉️) and **Cold Call** (📞).
3. Create an **Email**: set a title, add a contact and a district (confirm both pickers work), fill Subject, leave Direction = Outbound, paste a Thread link. Save.
4. Reopen that activity in the view panel → confirm the **Details** section shows Subject / Direction / Thread link with the saved values, AND no "Fullmind Attendees" picker is shown.
5. Edit the title only, Save, reopen → **confirm Subject/Direction/Thread link are still present** (guards the metadata-null bug).
6. Repeat 3–5 for a **Cold Call** with a Call result of "Voicemail".

- [ ] **Step 6: Final commit (only if manual steps required a fix)**

If steps 1–4 surfaced no issues, no commit is needed. Otherwise fix, re-run Steps 1–3, and:

```bash
git add -p
git commit -m "fix(activities): address outreach verification findings"
```

---

## Self-Review

- **Spec coverage:** category + types + labels + icons + descriptions + default (Task 1); EmailMetadata/ColdCallMetadata + union (Task 1, Step 7); field components (Task 3); EventTypeFields wiring (Task 4); create-modal gate decoupled from Attendees (Task 5); view-panel render + save-guard widened, scoped to outreach (Task 6); district/contact linking — no work needed, verified in Task 7 Step 4; no calendar auto-detect (not in any task, per Non-Goals); tests (Tasks 1, 2). All spec sections covered.
- **Placeholder scan:** No TBD/TODO; every code step contains full code; exact paths and run commands throughout.
- **Type consistency:** `EmailMetadata` = `{ subject?, direction?: "outbound"|"inbound", threadLink? }` and `ColdCallMetadata` = `{ callResult?: "connected"|"voicemail"|"no_answer"|"gatekeeper" }` are used identically in Tasks 1, 3, 4, and the route test (Task 2). `showTypeDetails` is the flag name in both Task 5 and Task 6. Category key `outreach` and types `email`/`cold_call` consistent across all tasks.
