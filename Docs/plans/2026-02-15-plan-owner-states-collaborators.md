# Plan Owner, States & Collaborators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace free-text owner with a user FK, support multi-state plan associations via junction table, and add a collaborator junction table — then wire into API and UI.

**Architecture:** Three schema changes (ownerId FK, TerritoryPlanState junction, TerritoryPlanCollaborator junction) with a migration that preserves existing data. A new `/api/users` endpoint powers user pickers. The existing plan API endpoints are extended to accept/return the new fields. UI changes in PlanEditForm (right panel) and PlanWorkspace header.

**Tech Stack:** Prisma + PostgreSQL, Next.js API routes, React + TanStack Query, Zustand store, Tailwind CSS

---

### Task 1: Prisma Schema — Add ownerId, TerritoryPlanState, TerritoryPlanCollaborator

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add ownerId to TerritoryPlan model**

In the `TerritoryPlan` model (currently lines 429-454), add `ownerId` field and relation:

```prisma
model TerritoryPlan {
  id          String    @id @default(uuid())
  name        String    @db.VarChar(255)
  description String?
  owner       String?   @db.VarChar(100) // KEEP for now — drop in Task 2 migration
  ownerId     String?   @map("owner_id") @db.Uuid
  color       String    @default("#403770") @db.VarChar(7)
  status      String    @default("planning") @db.VarChar(20)
  fiscalYear  Int       @map("fiscal_year")
  startDate   DateTime? @map("start_date")
  endDate     DateTime? @map("end_date")
  userId      String?   @map("user_id") @db.Uuid
  stateFips   String?   @map("state_fips") @db.VarChar(2) // KEEP for now — drop in Task 2 migration
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  ownerUser     UserProfile?            @relation("PlanOwner", fields: [ownerId], references: [id])
  districts     TerritoryPlanDistrict[]
  state         State?                  @relation(fields: [stateFips], references: [fips])
  states        TerritoryPlanState[]
  collaborators TerritoryPlanCollaborator[]
  activityLinks ActivityPlan[]
  taskLinks     TaskPlan[]

  @@index([userId])
  @@index([userId, fiscalYear])
  @@index([stateFips])
  @@index([ownerId])
  @@map("territory_plans")
}
```

**Step 2: Add TerritoryPlanState model**

After the TerritoryPlanDistrict model, add:

```prisma
model TerritoryPlanState {
  planId    String @map("plan_id") @db.Uuid
  stateFips String @map("state_fips") @db.VarChar(2)

  plan  TerritoryPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  state State         @relation("PlanStates", fields: [stateFips], references: [fips])

  @@id([planId, stateFips])
  @@map("territory_plan_states")
}
```

Also add `planStateLinks TerritoryPlanState[] @relation("PlanStates")` to the State model's relations section.

**Step 3: Add TerritoryPlanCollaborator model**

```prisma
model TerritoryPlanCollaborator {
  planId  String   @map("plan_id") @db.Uuid
  userId  String   @map("user_id") @db.Uuid
  addedAt DateTime @default(now()) @map("added_at")

  plan TerritoryPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  user UserProfile   @relation("PlanCollaborator", fields: [userId], references: [id])

  @@id([planId, userId])
  @@map("territory_plan_collaborators")
}
```

Also add to `UserProfile` model's relations:
```prisma
  ownedPlans       TerritoryPlan[]              @relation("PlanOwner")
  collaboratingOn  TerritoryPlanCollaborator[]   @relation("PlanCollaborator")
```

**Step 4: Generate Prisma client**

Run: `npx prisma generate`

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add ownerId FK, TerritoryPlanState, TerritoryPlanCollaborator"
```

---

### Task 2: Database Migration SQL

**Files:**
- Create: `prisma/migrations/20260215_add_owner_states_collaborators/migration.sql`

**Step 1: Write migration SQL**

```sql
-- 1. Add ownerId column
ALTER TABLE territory_plans ADD COLUMN owner_id UUID REFERENCES user_profiles(id);
CREATE INDEX idx_territory_plans_owner_id ON territory_plans(owner_id);

-- 2. Migrate existing owner string → ownerId where possible
-- Match owner text to user_profiles.full_name
UPDATE territory_plans tp
SET owner_id = up.id
FROM user_profiles up
WHERE tp.owner IS NOT NULL
  AND lower(trim(tp.owner)) = lower(trim(up.full_name));

-- 3. Create territory_plan_states junction table
CREATE TABLE territory_plan_states (
  plan_id UUID NOT NULL REFERENCES territory_plans(id) ON DELETE CASCADE,
  state_fips VARCHAR(2) NOT NULL REFERENCES states(fips),
  PRIMARY KEY (plan_id, state_fips)
);

-- 4. Migrate existing stateFips into junction table
INSERT INTO territory_plan_states (plan_id, state_fips)
SELECT id, state_fips FROM territory_plans
WHERE state_fips IS NOT NULL;

-- 5. Create territory_plan_collaborators junction table
CREATE TABLE territory_plan_collaborators (
  plan_id UUID NOT NULL REFERENCES territory_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

-- 6. Drop old columns (owner text, single stateFips)
ALTER TABLE territory_plans DROP COLUMN owner;
ALTER TABLE territory_plans DROP COLUMN state_fips;
```

**Step 2: Execute the migration**

Run: `npx prisma db execute --file prisma/migrations/20260215_add_owner_states_collaborators/migration.sql`

**Step 3: After migration succeeds, update schema.prisma**

Remove the old `owner` field and `stateFips` field from the TerritoryPlan model. Remove the `state` relation (replaced by `states`). Remove the `@@index([stateFips])`. The model should now look like:

```prisma
model TerritoryPlan {
  id          String    @id @default(uuid())
  name        String    @db.VarChar(255)
  description String?
  ownerId     String?   @map("owner_id") @db.Uuid
  color       String    @default("#403770") @db.VarChar(7)
  status      String    @default("planning") @db.VarChar(20)
  fiscalYear  Int       @map("fiscal_year")
  startDate   DateTime? @map("start_date")
  endDate     DateTime? @map("end_date")
  userId      String?   @map("user_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  ownerUser     UserProfile?            @relation("PlanOwner", fields: [ownerId], references: [id])
  districts     TerritoryPlanDistrict[]
  states        TerritoryPlanState[]
  collaborators TerritoryPlanCollaborator[]
  activityLinks ActivityPlan[]
  taskLinks     TaskPlan[]

  @@index([userId])
  @@index([userId, fiscalYear])
  @@index([ownerId])
  @@map("territory_plans")
}
```

Also remove `territoryPlans TerritoryPlan[]` from the State model (the old single-FK relation). Keep the new `planStateLinks` relation.

Run: `npx prisma generate`

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(db): migrate owner→ownerId, stateFips→junction, add collaborators"
```

---

### Task 3: GET /api/users endpoint

**Files:**
- Create: `src/app/api/users/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/users - List all user profiles (for owner/collaborator pickers)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const users = await prisma.userProfile.findMany({
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        email: true,
        jobTitle: true,
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
```

**Step 2: Add TanStack Query hook in `src/lib/api.ts`**

Add near the other hooks (after `useTerritoryPlans`):

```typescript
export interface UserSummary {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  email: string;
  jobTitle: string | null;
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => fetchJson<UserSummary[]>(`${API_BASE}/users`),
    staleTime: 10 * 60 * 1000, // 10 minutes — users don't change often
  });
}
```

**Step 3: Commit**

```bash
git add src/app/api/users/route.ts src/lib/api.ts
git commit -m "feat(api): add GET /api/users endpoint and useUsers hook"
```

---

### Task 4: Update TerritoryPlan TypeScript types

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Update TerritoryPlan interface (line ~216)**

Replace the current `owner: string | null` with the new nested objects:

```typescript
export interface PlanOwner {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface PlanState {
  fips: string;
  abbrev: string;
  name: string;
}

export interface PlanCollaborator {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface TerritoryPlan {
  id: string;
  name: string;
  description: string | null;
  owner: PlanOwner | null;        // was: string | null
  color: string;
  status: "planning" | "working" | "stale" | "archived";
  fiscalYear: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  districtCount: number;
  totalEnrollment: number;
  stateCount: number;
  states: PlanState[];             // NEW
  collaborators: PlanCollaborator[]; // NEW
  taskCount: number;
  completedTaskCount: number;
}
```

**Step 2: Update useCreateTerritoryPlan mutation params (line ~602)**

Replace `owner?: string` with:
```typescript
mutationFn: (plan: {
  name: string;
  description?: string;
  ownerId?: string;                // was: owner?: string
  color?: string;
  status?: "planning" | "working" | "stale" | "archived";
  fiscalYear: number;
  startDate?: string;
  endDate?: string;
  stateFips?: string[];            // NEW
  collaboratorIds?: string[];      // NEW
}) =>
```

**Step 3: Update useUpdateTerritoryPlan mutation params (line ~630)**

Replace `owner?: string` with:
```typescript
{
  id: string;
  name?: string;
  description?: string;
  ownerId?: string | null;         // was: owner?: string
  color?: string;
  status?: "planning" | "working" | "stale" | "archived";
  fiscalYear?: number;
  startDate?: string;
  endDate?: string;
  stateFips?: string[];            // NEW
  collaboratorIds?: string[];      // NEW
}
```

**Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(types): update TerritoryPlan types for owner/states/collaborators"
```

---

### Task 5: Update GET /api/territory-plans (list) to return new fields

**Files:**
- Modify: `src/app/api/territory-plans/route.ts`

**Step 1: Update the Prisma query include (line ~16)**

Add to the `include` block:

```typescript
include: {
  _count: {
    select: { districts: true },
  },
  ownerUser: {
    select: { id: true, fullName: true, avatarUrl: true },
  },
  states: {
    select: {
      state: { select: { fips: true, abbrev: true, name: true } },
    },
  },
  collaborators: {
    select: {
      user: { select: { id: true, fullName: true, avatarUrl: true } },
    },
  },
  districts: {
    select: {
      district: {
        select: { enrollment: true, stateAbbrev: true },
      },
    },
  },
  taskLinks: {
    select: {
      task: { select: { status: true } },
    },
  },
},
```

**Step 2: Update the response mapping (line ~40)**

Replace `owner: plan.owner,` with the new fields:

```typescript
return {
  id: plan.id,
  name: plan.name,
  description: plan.description,
  owner: plan.ownerUser
    ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
    : null,
  color: plan.color,
  status: plan.status,
  fiscalYear: plan.fiscalYear,
  startDate: plan.startDate?.toISOString() ?? null,
  endDate: plan.endDate?.toISOString() ?? null,
  createdAt: plan.createdAt.toISOString(),
  updatedAt: plan.updatedAt.toISOString(),
  districtCount: plan._count.districts,
  totalEnrollment,
  stateCount: plan.states.length,
  states: plan.states.map((ps) => ({
    fips: ps.state.fips,
    abbrev: ps.state.abbrev,
    name: ps.state.name,
  })),
  collaborators: plan.collaborators.map((pc) => ({
    id: pc.user.id,
    fullName: pc.user.fullName,
    avatarUrl: pc.user.avatarUrl,
  })),
  taskCount,
  completedTaskCount,
};
```

**Step 3: Update POST handler to accept new fields (line ~86)**

Destructure new fields from body:
```typescript
const { name, description, ownerId, color, status, fiscalYear, startDate, endDate, stateFips, collaboratorIds } = body;
```

Remove old `owner` from `prisma.territoryPlan.create`:
```typescript
const plan = await prisma.territoryPlan.create({
  data: {
    name: name.trim(),
    description: description?.trim() || null,
    ownerId: ownerId || null,
    color: color || "#403770",
    status: status || "planning",
    fiscalYear,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    userId: user.id,
    // Create state associations
    ...(stateFips?.length && {
      states: {
        createMany: {
          data: stateFips.map((fips: string) => ({ stateFips: fips })),
          skipDuplicates: true,
        },
      },
    }),
    // Create collaborator associations
    ...(collaboratorIds?.length && {
      collaborators: {
        createMany: {
          data: collaboratorIds.map((uid: string) => ({ userId: uid })),
          skipDuplicates: true,
        },
      },
    }),
  },
  include: {
    ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
    states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
    collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
  },
});
```

Update the POST response to match the new shape:
```typescript
return NextResponse.json(
  {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    owner: plan.ownerUser
      ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
      : null,
    color: plan.color,
    status: plan.status,
    fiscalYear: plan.fiscalYear,
    startDate: plan.startDate?.toISOString() ?? null,
    endDate: plan.endDate?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    districtCount: 0,
    totalEnrollment: 0,
    stateCount: plan.states.length,
    states: plan.states.map((ps) => ({ fips: ps.state.fips, abbrev: ps.state.abbrev, name: ps.state.name })),
    collaborators: plan.collaborators.map((pc) => ({ id: pc.user.id, fullName: pc.user.fullName, avatarUrl: pc.user.avatarUrl })),
    taskCount: 0,
    completedTaskCount: 0,
  },
  { status: 201 }
);
```

**Step 4: Commit**

```bash
git add src/app/api/territory-plans/route.ts
git commit -m "feat(api): return owner/states/collaborators from plan list and create"
```

---

### Task 6: Update GET/PUT /api/territory-plans/[id] for new fields

**Files:**
- Modify: `src/app/api/territory-plans/[id]/route.ts`

**Step 1: Update GET include (line ~16)**

Add to the existing include block:
```typescript
ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
```

**Step 2: Update GET response (line ~54)**

Replace `owner: plan.owner,` with:
```typescript
owner: plan.ownerUser
  ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
  : null,
states: plan.states.map((ps) => ({ fips: ps.state.fips, abbrev: ps.state.abbrev, name: ps.state.name })),
collaborators: plan.collaborators.map((pc) => ({ id: pc.user.id, fullName: pc.user.fullName, avatarUrl: pc.user.avatarUrl })),
```

**Step 3: Update PUT handler (line ~97)**

Destructure new fields:
```typescript
const { name, description, ownerId, color, status, fiscalYear, startDate, endDate, stateFips, collaboratorIds } = body;
```

Update the updateData building section — replace `owner` with `ownerId`:
```typescript
if (ownerId !== undefined) updateData.ownerId = ownerId || null;
```
Remove: `if (owner !== undefined) updateData.owner = owner?.trim() || null;`

After the scalar update, handle states and collaborators with a transaction:
```typescript
const plan = await prisma.$transaction(async (tx) => {
  // Update scalar fields
  const updated = await tx.territoryPlan.update({
    where: { id },
    data: updateData,
  });

  // Replace states if provided
  if (stateFips !== undefined) {
    await tx.territoryPlanState.deleteMany({ where: { planId: id } });
    if (stateFips.length > 0) {
      await tx.territoryPlanState.createMany({
        data: stateFips.map((fips: string) => ({ planId: id, stateFips: fips })),
        skipDuplicates: true,
      });
    }
  }

  // Replace collaborators if provided
  if (collaboratorIds !== undefined) {
    await tx.territoryPlanCollaborator.deleteMany({ where: { planId: id } });
    if (collaboratorIds.length > 0) {
      await tx.territoryPlanCollaborator.createMany({
        data: collaboratorIds.map((uid: string) => ({ planId: id, userId: uid })),
        skipDuplicates: true,
      });
    }
  }

  // Re-fetch with relations
  return tx.territoryPlan.findUnique({
    where: { id },
    include: {
      _count: { select: { districts: true } },
      ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
      states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
      collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
    },
  });
});
```

Update PUT response to match new shape (same pattern as GET).

**Step 4: Commit**

```bash
git add src/app/api/territory-plans/[id]/route.ts
git commit -m "feat(api): return owner/states/collaborators from plan detail and update"
```

---

### Task 7: Fix all UI files that reference `plan.owner` as string

**Files:**
- Modify: `src/components/plans/PlanCard.tsx` — `plan.owner` is now `PlanOwner | null`, display `plan.owner?.fullName`
- Modify: `src/components/plans/PlansTable.tsx` — owner InlineEditCell becomes display-only (or remove since editing is now via picker)
- Modify: `src/components/views/PlansView.tsx` — any owner references
- Modify: `src/components/panel/tabs/PlansTabContent.tsx` — any owner references
- Modify: `src/components/map-v2/panels/PlansListPanel.tsx` — fix STATUS_STYLE to use new status names (planning/working/stale)
- Modify: `src/lib/calendar-sync.ts` — remove `owner` reference if still present
- Modify: `src/app/api/progress/outcomes/route.ts` — remove any `owner` query field
- Modify: `src/app/api/progress/plans/route.ts` — remove any `owner` query field

For each file, find any usage of `plan.owner` (which was `string | null`) and update it:
- Display: `plan.owner?.fullName ?? "Unassigned"`
- Any place passing `owner` as string to mutation: change to `ownerId`

Also fix `PlansListPanel.tsx` STATUS_STYLE which still uses old status names:
```typescript
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  working: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  planning: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  stale: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  archived: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};
```

**Step: Commit**

```bash
git commit -m "fix(ui): update all owner references from string to PlanOwner object"
```

---

### Task 8: PlanEditForm — Owner picker, State multi-select, Collaborators

**Files:**
- Modify: `src/components/map-v2/right-panels/PlanEditForm.tsx`

**Step 1: Replace owner text input with user picker**

Import `useUsers` from api. Replace the `owner` state variable:
```typescript
const [ownerId, setOwnerId] = useState<string | null>(null);
```

Pre-fill from plan data:
```typescript
setOwnerId(plan.owner?.id ?? null);
```

Replace the owner `<input>` with a `<select>`:
```tsx
<div>
  <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
    Owner
  </label>
  <select
    value={ownerId ?? ""}
    onChange={(e) => setOwnerId(e.target.value || null)}
    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors text-gray-700"
  >
    <option value="">Unassigned</option>
    {users?.map((u) => (
      <option key={u.id} value={u.id}>
        {u.fullName || u.email}
      </option>
    ))}
  </select>
</div>
```

Update `handleSave` to send `ownerId` instead of `owner`.

**Step 2: Add state multi-select**

Add state for selected states:
```typescript
const [selectedStates, setSelectedStates] = useState<string[]>([]);
```

Fetch states from existing API or use a static US states list. Pre-fill from `plan.states`.

Add a multi-select UI with checkboxes:
```tsx
<div>
  <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
    States
  </label>
  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
    {allStates?.map((state) => (
      <label key={state.fips} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
        <input
          type="checkbox"
          checked={selectedStates.includes(state.fips)}
          onChange={(e) => {
            if (e.target.checked) setSelectedStates([...selectedStates, state.fips]);
            else setSelectedStates(selectedStates.filter((f) => f !== state.fips));
          }}
          className="rounded border-gray-300 text-plum focus:ring-plum/20"
        />
        {state.abbrev} — {state.name}
      </label>
    ))}
  </div>
</div>
```

Use `useStates()` hook if it exists, or add a new `GET /api/states` list endpoint (check if it already exists — likely does at `src/app/api/states/route.ts`).

Update `handleSave` to include `stateFips: selectedStates`.

**Step 3: Add collaborators section**

Add state for collaborators:
```typescript
const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
```

Pre-fill from `plan.collaborators`. Add a section showing chips + add dropdown:

```tsx
<div>
  <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
    Collaborators
  </label>
  {/* Chips for current collaborators */}
  <div className="flex flex-wrap gap-1 mb-2">
    {collaboratorIds.map((uid) => {
      const user = users?.find((u) => u.id === uid);
      return (
        <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700">
          {user?.fullName || "Unknown"}
          <button onClick={() => setCollaboratorIds(collaboratorIds.filter((id) => id !== uid))} className="hover:text-red-500">
            ×
          </button>
        </span>
      );
    })}
  </div>
  {/* Add dropdown */}
  <select
    value=""
    onChange={(e) => {
      if (e.target.value && !collaboratorIds.includes(e.target.value)) {
        setCollaboratorIds([...collaboratorIds, e.target.value]);
      }
    }}
    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors text-gray-700"
  >
    <option value="">Add collaborator...</option>
    {users?.filter((u) => !collaboratorIds.includes(u.id) && u.id !== ownerId).map((u) => (
      <option key={u.id} value={u.id}>{u.fullName || u.email}</option>
    ))}
  </select>
</div>
```

Update `handleSave` to include `collaboratorIds`.

**Step 4: Commit**

```bash
git add src/components/map-v2/right-panels/PlanEditForm.tsx
git commit -m "feat(map-v2): add owner picker, state multi-select, collaborators to PlanEditForm"
```

---

### Task 9: PlanWorkspace header — show owner, states, collaborators

**Files:**
- Modify: `src/components/map-v2/panels/PlanWorkspace.tsx`

**Step 1: Update badge row (line ~123)**

After the existing FY and district count badges, add state badges and owner/collaborator display:

```tsx
{/* State badges */}
{plan.states?.map((s) => (
  <span key={s.fips} className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-600">
    {s.abbrev}
  </span>
))}

{/* Owner */}
{plan.owner && (
  <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-50 text-gray-600 flex items-center gap-1">
    {plan.owner.avatarUrl ? (
      <img src={plan.owner.avatarUrl} className="w-3 h-3 rounded-full" alt="" />
    ) : null}
    {plan.owner.fullName || "Owner"}
  </span>
)}

{/* Collaborator count */}
{plan.collaborators?.length > 0 && (
  <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-50 text-purple-600">
    +{plan.collaborators.length} collab{plan.collaborators.length !== 1 ? "s" : ""}
  </span>
)}
```

**Step 2: Commit**

```bash
git add src/components/map-v2/panels/PlanWorkspace.tsx
git commit -m "feat(map-v2): show owner, state badges, collaborator count in plan header"
```

---

### Task 10: Update PlanFormModal and PlanFormPanel for new fields

**Files:**
- Modify: `src/components/plans/PlanFormModal.tsx` — add owner picker and state multi-select
- Modify: `src/components/map-v2/panels/PlanFormPanel.tsx` — optionally add owner picker

**Step 1: Update PlanFormData interface**

```typescript
export interface PlanFormData {
  name: string;
  description: string;
  ownerId: string | null;  // was: owner: string
  color: string;
  status: "planning" | "working" | "stale" | "archived";
  fiscalYear: number;
  startDate: string;
  endDate: string;
  stateFips: string[];     // NEW
  collaboratorIds: string[]; // NEW
}
```

**Step 2: Add user picker and state multi-select to PlanFormModal**

Same pattern as PlanEditForm — `useUsers()` for owner/collaborator pickers, state checkbox list.

**Step 3: Update PlansView and any other callers of PlanFormModal**

Ensure `handleCreatePlan` and `handleUpdatePlan` pass the new fields (ownerId, stateFips, collaboratorIds) instead of the old `owner` string.

**Step 4: Commit**

```bash
git commit -m "feat(ui): add owner/state/collaborator fields to PlanFormModal"
```

---

### Task 11: Update TerritoryPlanDetail type and plan detail API response

**Files:**
- Modify: `src/lib/api.ts` — ensure TerritoryPlanDetail includes states/collaborators/owner

The `TerritoryPlanDetail` interface extends `TerritoryPlan` (which already has the new fields from Task 4). Just verify it works.

**Step: Commit if any changes needed**

---

### Task 12: Final cleanup — remove stale references, verify build

**Files:**
- Any remaining files with old `owner: string` patterns
- Any remaining `stateFips` references on TerritoryPlan

**Step 1: Search for stale references**

Run: `grep -rn '"owner"' src/ --include='*.ts' --include='*.tsx' | grep -v node_modules`

Fix any remaining string-based owner references.

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Fix any type errors.

**Step 3: Verify dev server starts**

Run: `npm run dev` — confirm no runtime errors.

**Step 4: Final commit**

```bash
git commit -m "chore: cleanup stale owner/stateFips references after migration"
```
