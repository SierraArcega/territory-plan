# Account Targets Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace revenue/pipeline targets with four business-category targets (renewal, winback, expansion, new business) and split service selections into return/new categories.

**Architecture:** Widen existing Prisma tables with new columns, add a ServiceCategory enum to the district-service junction table. All 17 affected files updated in dependency order: schema → migration → API routes → types/hooks → UI components.

**Tech Stack:** Next.js 16, React 19, Prisma, Supabase/PostGIS, TypeScript

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:457-474` (TerritoryPlanDistrict)
- Modify: `prisma/schema.prisma:628-639` (TerritoryPlanDistrictService)
- Modify: `prisma/schema.prisma:641-666` (UserGoal)

**Step 1: Add ServiceCategory enum and update TerritoryPlanDistrict**

In `prisma/schema.prisma`, replace the target fields in `TerritoryPlanDistrict` (lines 462-464):

```prisma
// Old:
  revenueTarget  Decimal? @map("revenue_target") @db.Decimal(15, 2)
  pipelineTarget Decimal? @map("pipeline_target") @db.Decimal(15, 2)

// New:
  renewalTarget     Decimal? @map("renewal_target") @db.Decimal(15, 2)
  winbackTarget     Decimal? @map("winback_target") @db.Decimal(15, 2)
  expansionTarget   Decimal? @map("expansion_target") @db.Decimal(15, 2)
  newBusinessTarget Decimal? @map("new_business_target") @db.Decimal(15, 2)
```

**Step 2: Add ServiceCategory enum and update TerritoryPlanDistrictService**

Add before the Service model:

```prisma
enum ServiceCategory {
  return_services @map("return")
  new_services    @map("new")

  @@map("service_category")
}
```

Update `TerritoryPlanDistrictService` (lines 629-639) to add the category field and update the composite key:

```prisma
model TerritoryPlanDistrictService {
  planId        String          @map("plan_id")
  districtLeaid String          @map("district_leaid") @db.VarChar(7)
  serviceId     Int             @map("service_id")
  category      ServiceCategory @default(return_services)

  planDistrict TerritoryPlanDistrict @relation(fields: [planId, districtLeaid], references: [planId, districtLeaid], onDelete: Cascade)
  service      Service               @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@id([planId, districtLeaid, serviceId, category])
  @@map("territory_plan_district_services")
}
```

**Step 3: Update UserGoal model**

In `UserGoal` (lines 648-655), replace:

```prisma
// Old:
  revenueTarget      Decimal? @map("revenue_target") @db.Decimal(15, 2)
  takeTarget         Decimal? @map("take_target") @db.Decimal(15, 2) // Gross margin/take
  pipelineTarget     Decimal? @map("pipeline_target") @db.Decimal(15, 2)

// New:
  renewalTarget      Decimal? @map("renewal_target") @db.Decimal(15, 2)
  winbackTarget      Decimal? @map("winback_target") @db.Decimal(15, 2)
  expansionTarget    Decimal? @map("expansion_target") @db.Decimal(15, 2)
  newBusinessTarget  Decimal? @map("new_business_target") @db.Decimal(15, 2)
  takeTarget         Decimal? @map("take_target") @db.Decimal(15, 2)
```

**Step 4: Generate Prisma client**

Run: `npx prisma generate`

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: update schema for four-target model + service categories"
```

---

### Task 2: Database Migration

**Step 1: Generate migration SQL**

Use the diff approach (shadow DB doesn't work — see MEMORY.md):

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_account_targets_redesign/migration.sql
```

If that fails, write the migration SQL manually:

```sql
-- Create enum type
CREATE TYPE service_category AS ENUM ('return', 'new');

-- TerritoryPlanDistrict: add new target columns
ALTER TABLE territory_plan_districts
  ADD COLUMN renewal_target DECIMAL(15,2),
  ADD COLUMN winback_target DECIMAL(15,2),
  ADD COLUMN expansion_target DECIMAL(15,2),
  ADD COLUMN new_business_target DECIMAL(15,2);

-- Migrate existing data: revenue_target → renewal_target, pipeline_target → new_business_target
UPDATE territory_plan_districts SET renewal_target = revenue_target WHERE revenue_target IS NOT NULL;
UPDATE territory_plan_districts SET new_business_target = pipeline_target WHERE pipeline_target IS NOT NULL;

-- Drop old columns
ALTER TABLE territory_plan_districts DROP COLUMN revenue_target;
ALTER TABLE territory_plan_districts DROP COLUMN pipeline_target;

-- TerritoryPlanDistrictService: add category column, update PK
ALTER TABLE territory_plan_district_services
  ADD COLUMN category service_category NOT NULL DEFAULT 'return';

-- Drop old PK and create new one with category
ALTER TABLE territory_plan_district_services DROP CONSTRAINT territory_plan_district_services_pkey;
ALTER TABLE territory_plan_district_services
  ADD CONSTRAINT territory_plan_district_services_pkey PRIMARY KEY (plan_id, district_leaid, service_id, category);

-- UserGoal: add new target columns
ALTER TABLE user_goals
  ADD COLUMN renewal_target DECIMAL(15,2),
  ADD COLUMN winback_target DECIMAL(15,2),
  ADD COLUMN expansion_target DECIMAL(15,2),
  ADD COLUMN new_business_target DECIMAL(15,2);

-- Migrate existing user goal data
UPDATE user_goals SET renewal_target = revenue_target WHERE revenue_target IS NOT NULL;
UPDATE user_goals SET new_business_target = pipeline_target WHERE pipeline_target IS NOT NULL;

-- Drop old columns from user_goals
ALTER TABLE user_goals DROP COLUMN revenue_target;
ALTER TABLE user_goals DROP COLUMN pipeline_target;
```

**Step 2: Apply migration**

```bash
npx prisma db execute --file prisma/migrations/<timestamp>_account_targets_redesign/migration.sql
```

**Step 3: Mark migration as applied**

```bash
npx prisma migrate resolve --applied <timestamp>_account_targets_redesign
```

**Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

**Step 5: Commit**

```bash
git add prisma/migrations/
git commit -m "feat: migrate DB for four-target model + service categories"
```

---

### Task 3: Update TypeScript Types & Hooks in api.ts

**Files:**
- Modify: `src/lib/api.ts:306-317` (TerritoryPlanDistrict interface)
- Modify: `src/lib/api.ts:1270-1286` (UserGoal interface)
- Modify: `src/lib/api.ts:1338-1346` (useUpsertUserGoal mutation)
- Modify: `src/lib/api.ts:1385-1396` (PlanDistrictDetail interface)
- Modify: `src/lib/api.ts:1410-1439` (useUpdateDistrictTargets mutation)
- Modify: `src/lib/api.ts:1443-1475` (GoalDashboard interface)

**Step 1: Update TerritoryPlanDistrict interface (line 306)**

```typescript
export interface TerritoryPlanDistrict {
  leaid: string;
  addedAt: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
  notes: string | null;
  returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
  newServices: Array<{ id: number; name: string; slug: string; color: string }>;
  tags: Array<{ id: number; name: string; color: string }>;
}
```

**Step 2: Update UserGoal interface (line 1270)**

```typescript
export interface UserGoal {
  id: number;
  fiscalYear: number;
  earningsTarget: number | null;
  takeRatePercent: number | null;
  newDistrictsTarget: number | null;
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
  takeTarget: number | null;
  revenueActual: number;
  takeActual: number;
  pipelineActual: number;
  newDistrictsActual: number;
}
```

**Step 3: Update useUpsertUserGoal mutation (line 1334)**

Replace the mutation data type:

```typescript
mutationFn: (data: {
  fiscalYear: number;
  earningsTarget?: number | null;
  takeRatePercent?: number | null;
  renewalTarget?: number | null;
  winbackTarget?: number | null;
  expansionTarget?: number | null;
  newBusinessTarget?: number | null;
  takeTarget?: number | null;
  newDistrictsTarget?: number | null;
}) =>
```

**Step 4: Update PlanDistrictDetail interface (line 1385)**

```typescript
export interface PlanDistrictDetail {
  planId: string;
  leaid: string;
  addedAt: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
  notes: string | null;
  returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
  newServices: Array<{ id: number; name: string; slug: string; color: string }>;
}
```

**Step 5: Update useUpdateDistrictTargets mutation (line 1410)**

```typescript
export function useUpdateDistrictTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      leaid,
      ...data
    }: {
      planId: string;
      leaid: string;
      renewalTarget?: number | null;
      winbackTarget?: number | null;
      expansionTarget?: number | null;
      newBusinessTarget?: number | null;
      notes?: string | null;
      returnServiceIds?: number[];
      newServiceIds?: number[];
    }) =>
      fetchJson<PlanDistrictDetail>(
        `${API_BASE}/territory-plans/${planId}/districts/${leaid}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planDistrict", variables.planId, variables.leaid] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["goalDashboard"] });
    },
  });
}
```

**Step 6: Update GoalDashboard interface (line 1443)**

```typescript
export interface GoalDashboard {
  fiscalYear: number;
  goals: {
    earningsTarget: number | null;
    takeRatePercent: number | null;
    renewalTarget: number | null;
    winbackTarget: number | null;
    expansionTarget: number | null;
    newBusinessTarget: number | null;
    takeTarget: number | null;
    newDistrictsTarget: number | null;
  } | null;
  planTotals: {
    renewalTarget: number;
    winbackTarget: number;
    expansionTarget: number;
    newBusinessTarget: number;
    totalTarget: number;
    districtCount: number;
    planCount: number;
  };
  actuals: {
    earnings: number;
    revenue: number;
    take: number;
    pipeline: number;
    newDistricts: number;
  };
  plans: Array<{
    id: string;
    name: string;
    color: string;
    status: string;
    districtCount: number;
    renewalTarget: number;
    winbackTarget: number;
    expansionTarget: number;
    newBusinessTarget: number;
    totalTarget: number;
  }>;
}
```

**Step 7: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: update TS types and hooks for four-target model"
```

---

### Task 4: Update District Targets API Routes

**Files:**
- Modify: `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts` (GET + PUT)
- Modify: `src/app/api/territory-plans/[id]/districts/route.ts` (POST)
- Modify: `src/app/api/territory-plans/[id]/route.ts` (GET)

**Step 1: Update GET handler in `[leaid]/route.ts`**

Update the include query (line 30) to include category on targetServices:

```typescript
targetServices: {
  include: {
    service: {
      select: { id: true, name: true, slug: true, color: true },
    },
  },
},
```

Update the response (lines 54-62):

```typescript
renewalTarget: planDistrict.renewalTarget ? Number(planDistrict.renewalTarget) : null,
winbackTarget: planDistrict.winbackTarget ? Number(planDistrict.winbackTarget) : null,
expansionTarget: planDistrict.expansionTarget ? Number(planDistrict.expansionTarget) : null,
newBusinessTarget: planDistrict.newBusinessTarget ? Number(planDistrict.newBusinessTarget) : null,
notes: planDistrict.notes,
returnServices: planDistrict.targetServices
  .filter((ts) => ts.category === "return_services")
  .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
newServices: planDistrict.targetServices
  .filter((ts) => ts.category === "new_services")
  .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
```

**Step 2: Update PUT handler in `[leaid]/route.ts`**

Update request destructuring (line 81):

```typescript
const { renewalTarget, winbackTarget, expansionTarget, newBusinessTarget, notes, returnServiceIds, newServiceIds } = body;
```

Update the updateData construction (lines 101-104):

```typescript
const updateData: Record<string, unknown> = {};
if (renewalTarget !== undefined) updateData.renewalTarget = renewalTarget;
if (winbackTarget !== undefined) updateData.winbackTarget = winbackTarget;
if (expansionTarget !== undefined) updateData.expansionTarget = expansionTarget;
if (newBusinessTarget !== undefined) updateData.newBusinessTarget = newBusinessTarget;
if (notes !== undefined) updateData.notes = notes;
```

Update service handling (lines 133-148) — handle both returnServiceIds and newServiceIds:

```typescript
if (returnServiceIds !== undefined || newServiceIds !== undefined) {
  // Delete existing service assignments
  await prisma.territoryPlanDistrictService.deleteMany({
    where: { planId, districtLeaid: leaid },
  });

  const serviceRecords: Array<{ planId: string; districtLeaid: string; serviceId: number; category: "return_services" | "new_services" }> = [];

  if (returnServiceIds && returnServiceIds.length > 0) {
    for (const serviceId of returnServiceIds) {
      serviceRecords.push({ planId, districtLeaid: leaid, serviceId, category: "return_services" });
    }
  }
  if (newServiceIds && newServiceIds.length > 0) {
    for (const serviceId of newServiceIds) {
      serviceRecords.push({ planId, districtLeaid: leaid, serviceId, category: "new_services" });
    }
  }

  if (serviceRecords.length > 0) {
    await prisma.territoryPlanDistrictService.createMany({ data: serviceRecords });
  }
}
```

Update all response mappings in PUT to use the new four targets + returnServices/newServices (same pattern as GET).

**Step 3: Update POST handler in `districts/route.ts`**

Update request destructuring (line 15):

```typescript
const { leaids, renewalTarget, winbackTarget, expansionTarget, newBusinessTarget, notes, returnServiceIds, newServiceIds } = body;
```

Update the single-district upsert (lines 69-88) to use new field names.

Update service assignment block (lines 92-105) to handle both returnServiceIds and newServiceIds with category.

**Step 4: Update GET handler in `[id]/route.ts`**

Update response mapping (lines 79-87) for each district:

```typescript
renewalTarget: pd.renewalTarget ? Number(pd.renewalTarget) : null,
winbackTarget: pd.winbackTarget ? Number(pd.winbackTarget) : null,
expansionTarget: pd.expansionTarget ? Number(pd.expansionTarget) : null,
newBusinessTarget: pd.newBusinessTarget ? Number(pd.newBusinessTarget) : null,
returnServices: pd.targetServices
  .filter((ts) => ts.category === "return_services")
  .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
newServices: pd.targetServices
  .filter((ts) => ts.category === "new_services")
  .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
```

**Step 5: Commit**

```bash
git add src/app/api/territory-plans/
git commit -m "feat: update territory plan API routes for four-target model"
```

---

### Task 5: Update Goal/Profile API Routes

**Files:**
- Modify: `src/app/api/profile/goals/[fiscalYear]/dashboard/route.ts`
- Modify: `src/app/api/profile/goals/route.ts`
- Modify: `src/app/api/profile/goals/[fiscalYear]/route.ts`
- Modify: `src/app/api/profile/route.ts`

**Step 1: Update dashboard route**

In `dashboard/route.ts`, update the select (lines 55-57):

```typescript
renewalTarget: true,
winbackTarget: true,
expansionTarget: true,
newBusinessTarget: true,
```

Update aggregation (lines 76-98):

```typescript
let totalRenewalTarget = 0;
let totalWinbackTarget = 0;
let totalExpansionTarget = 0;
let totalNewBusinessTarget = 0;
```

And in the loop:

```typescript
if (pd.renewalTarget) totalRenewalTarget += Number(pd.renewalTarget);
if (pd.winbackTarget) totalWinbackTarget += Number(pd.winbackTarget);
if (pd.expansionTarget) totalExpansionTarget += Number(pd.expansionTarget);
if (pd.newBusinessTarget) totalNewBusinessTarget += Number(pd.newBusinessTarget);
```

Update response (lines 130-169):

Goals section:
```typescript
renewalTarget: userGoal.renewalTarget ? Number(userGoal.renewalTarget) : null,
winbackTarget: userGoal.winbackTarget ? Number(userGoal.winbackTarget) : null,
expansionTarget: userGoal.expansionTarget ? Number(userGoal.expansionTarget) : null,
newBusinessTarget: userGoal.newBusinessTarget ? Number(userGoal.newBusinessTarget) : null,
takeTarget: userGoal.takeTarget ? Number(userGoal.takeTarget) : null,
```

planTotals section:
```typescript
planTotals: {
  renewalTarget: totalRenewalTarget,
  winbackTarget: totalWinbackTarget,
  expansionTarget: totalExpansionTarget,
  newBusinessTarget: totalNewBusinessTarget,
  totalTarget: totalRenewalTarget + totalWinbackTarget + totalExpansionTarget + totalNewBusinessTarget,
  districtCount,
  planCount: plans.length,
},
```

Per-plan breakdown:
```typescript
plans: plans.map((plan) => {
  const renewal = plan.districts.reduce((sum, pd) => sum + Number(pd.renewalTarget || 0), 0);
  const winback = plan.districts.reduce((sum, pd) => sum + Number(pd.winbackTarget || 0), 0);
  const expansion = plan.districts.reduce((sum, pd) => sum + Number(pd.expansionTarget || 0), 0);
  const newBiz = plan.districts.reduce((sum, pd) => sum + Number(pd.newBusinessTarget || 0), 0);
  return {
    id: plan.id,
    name: plan.name,
    color: plan.color,
    status: plan.status,
    districtCount: plan.districts.length,
    renewalTarget: renewal,
    winbackTarget: winback,
    expansionTarget: expansion,
    newBusinessTarget: newBiz,
    totalTarget: renewal + winback + expansion + newBiz,
  };
}),
```

**Step 2: Update profile/goals/route.ts**

Replace all `revenueTarget` → `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget` in request destructuring, upsert create/update, and response mapping. Drop `pipelineTarget`.

**Step 3: Update profile/goals/[fiscalYear]/route.ts**

Same pattern: replace revenueTarget/pipelineTarget with the four new target fields in destructuring, update, and response.

**Step 4: Update profile/route.ts**

Replace revenueTarget/pipelineTarget with the four new fields in response mapping (lines 149-151, 266-270).

**Step 5: Commit**

```bash
git add src/app/api/profile/
git commit -m "feat: update goal/profile API routes for four-target model"
```

---

### Task 6: Update PlanDistrictPanel Component

**Files:**
- Modify: `src/components/plans/PlanDistrictPanel.tsx`

**Step 1: Update the Plan Targets section (lines 178-212)**

Replace the 2-column grid with a 2x2 grid for four targets:

```tsx
{/* Four Target Fields — 2x2 grid */}
<div className="grid grid-cols-2 gap-3 mb-3">
  <div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
      Renewal
    </div>
    <InlineEditCell
      type="text"
      value={planDistrict.renewalTarget != null ? String(planDistrict.renewalTarget) : null}
      onSave={async (value) => {
        const parsed = parseCurrencyInput(value);
        await updateTargets.mutateAsync({ planId, leaid, renewalTarget: parsed });
      }}
      placeholder="Set target"
      className="text-sm font-semibold text-[#403770]"
      displayFormat={formatCurrencyDisplay}
    />
  </div>
  <div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
      Winback
    </div>
    <InlineEditCell
      type="text"
      value={planDistrict.winbackTarget != null ? String(planDistrict.winbackTarget) : null}
      onSave={async (value) => {
        const parsed = parseCurrencyInput(value);
        await updateTargets.mutateAsync({ planId, leaid, winbackTarget: parsed });
      }}
      placeholder="Set target"
      className="text-sm font-semibold text-[#8AA891]"
      displayFormat={formatCurrencyDisplay}
    />
  </div>
  <div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
      Expansion
    </div>
    <InlineEditCell
      type="text"
      value={planDistrict.expansionTarget != null ? String(planDistrict.expansionTarget) : null}
      onSave={async (value) => {
        const parsed = parseCurrencyInput(value);
        await updateTargets.mutateAsync({ planId, leaid, expansionTarget: parsed });
      }}
      placeholder="Set target"
      className="text-sm font-semibold text-[#6EA3BE]"
      displayFormat={formatCurrencyDisplay}
    />
  </div>
  <div>
    <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
      New Business
    </div>
    <InlineEditCell
      type="text"
      value={planDistrict.newBusinessTarget != null ? String(planDistrict.newBusinessTarget) : null}
      onSave={async (value) => {
        const parsed = parseCurrencyInput(value);
        await updateTargets.mutateAsync({ planId, leaid, newBusinessTarget: parsed });
      }}
      placeholder="Set target"
      className="text-sm font-semibold text-[#D4A84B]"
      displayFormat={formatCurrencyDisplay}
    />
  </div>
</div>
```

**Step 2: Update Services section (lines 214-257)**

Replace single "Targeted Services" with two sections — "Return Services" and "New Services":

```tsx
{/* Return Services */}
<div className="mb-3">
  <div className="flex items-center justify-between mb-1.5">
    <div className="text-[10px] text-gray-400 uppercase tracking-wide">
      Return Services
    </div>
    <button
      onClick={() => setShowReturnServiceSelector(!showReturnServiceSelector)}
      className="text-[10px] text-[#403770] hover:text-[#F37167] transition-colors font-medium"
    >
      {showReturnServiceSelector ? "Done" : "Edit"}
    </button>
  </div>
  {planDistrict.returnServices && planDistrict.returnServices.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {planDistrict.returnServices.map((service) => (
        <span key={service.id} className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full text-white" style={{ backgroundColor: service.color }}>
          {service.name}
        </span>
      ))}
    </div>
  ) : (
    !showReturnServiceSelector && <p className="text-xs text-gray-400 italic">No return services</p>
  )}
  {showReturnServiceSelector && (
    <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
      <ServiceSelector
        services={allServices}
        selectedIds={planDistrict.returnServices?.map(s => s.id) || []}
        onChange={async (ids) => {
          await updateTargets.mutateAsync({ planId, leaid, returnServiceIds: ids });
        }}
      />
    </div>
  )}
</div>

{/* New Services */}
<div className="mb-3">
  <div className="flex items-center justify-between mb-1.5">
    <div className="text-[10px] text-gray-400 uppercase tracking-wide">
      New Services
    </div>
    <button
      onClick={() => setShowNewServiceSelector(!showNewServiceSelector)}
      className="text-[10px] text-[#403770] hover:text-[#F37167] transition-colors font-medium"
    >
      {showNewServiceSelector ? "Done" : "Edit"}
    </button>
  </div>
  {planDistrict.newServices && planDistrict.newServices.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {planDistrict.newServices.map((service) => (
        <span key={service.id} className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full text-white" style={{ backgroundColor: service.color }}>
          {service.name}
        </span>
      ))}
    </div>
  ) : (
    !showNewServiceSelector && <p className="text-xs text-gray-400 italic">No new services</p>
  )}
  {showNewServiceSelector && (
    <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
      <ServiceSelector
        services={allServices}
        selectedIds={planDistrict.newServices?.map(s => s.id) || []}
        onChange={async (ids) => {
          await updateTargets.mutateAsync({ planId, leaid, newServiceIds: ids });
        }}
      />
    </div>
  )}
</div>
```

Update the state at the top of the component — replace `showServiceSelector` with:

```typescript
const [showReturnServiceSelector, setShowReturnServiceSelector] = useState(false);
const [showNewServiceSelector, setShowNewServiceSelector] = useState(false);
```

**Step 3: Commit**

```bash
git add src/components/plans/PlanDistrictPanel.tsx
git commit -m "feat: update PlanDistrictPanel for four targets + service categories"
```

---

### Task 7: Update DistrictTargetEditor Modal

**Files:**
- Modify: `src/components/plans/DistrictTargetEditor.tsx`

**Step 1: Update the interface (lines 7-21)**

```typescript
interface DistrictTargetEditorProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  district: {
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    enrollment: number | null;
    renewalTarget: number | null;
    winbackTarget: number | null;
    expansionTarget: number | null;
    newBusinessTarget: number | null;
    notes: string | null;
    returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
    newServices: Array<{ id: number; name: string; slug: string; color: string }>;
  };
}
```

**Step 2: Update state variables (lines 44-47)**

```typescript
const [renewalTarget, setRenewalTarget] = useState("");
const [winbackTarget, setWinbackTarget] = useState("");
const [expansionTarget, setExpansionTarget] = useState("");
const [newBusinessTarget, setNewBusinessTarget] = useState("");
const [notes, setNotes] = useState("");
const [returnServiceIds, setReturnServiceIds] = useState<number[]>([]);
const [newServiceIds, setNewServiceIds] = useState<number[]>([]);
```

**Step 3: Update useEffect reset (lines 54-61)**

```typescript
useEffect(() => {
  if (isOpen) {
    setRenewalTarget(formatCurrency(district.renewalTarget));
    setWinbackTarget(formatCurrency(district.winbackTarget));
    setExpansionTarget(formatCurrency(district.expansionTarget));
    setNewBusinessTarget(formatCurrency(district.newBusinessTarget));
    setNotes(district.notes || "");
    setReturnServiceIds(district.returnServices.map((s) => s.id));
    setNewServiceIds(district.newServices.map((s) => s.id));
    setError(null);
  }
}, [isOpen, district]);
```

**Step 4: Update handleSubmit (lines 64-81)**

```typescript
await updateTargets.mutateAsync({
  planId,
  leaid: district.leaid,
  renewalTarget: parseCurrency(renewalTarget),
  winbackTarget: parseCurrency(winbackTarget),
  expansionTarget: parseCurrency(expansionTarget),
  newBusinessTarget: parseCurrency(newBusinessTarget),
  notes: notes.trim() || null,
  returnServiceIds,
  newServiceIds,
});
```

**Step 5: Update the form JSX (lines 120-175)**

Replace the two currency inputs with four, and replace the single ServiceSelector with two labeled groups ("Return Services" and "New Services").

**Step 6: Commit**

```bash
git add src/components/plans/DistrictTargetEditor.tsx
git commit -m "feat: update DistrictTargetEditor for four targets + service categories"
```

---

### Task 8: Update DistrictCard Component

**Files:**
- Modify: `src/components/plans/DistrictCard.tsx`

**Step 1: Update hasTargets check (line 29)**

```typescript
const hasTargets = district.renewalTarget || district.winbackTarget || district.expansionTarget || district.newBusinessTarget;
```

**Step 2: Update the targets display (lines 86-105)**

Replace 2-column Revenue/Pipeline grid with a 2x2 grid showing the four targets:

```tsx
{hasTargets && (
  <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-gray-50 rounded-lg">
    {district.renewalTarget != null && (
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Renewal</div>
        <div className="text-sm font-semibold text-[#403770]">{formatCurrency(district.renewalTarget)}</div>
      </div>
    )}
    {district.winbackTarget != null && (
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Winback</div>
        <div className="text-sm font-semibold text-[#8AA891]">{formatCurrency(district.winbackTarget)}</div>
      </div>
    )}
    {district.expansionTarget != null && (
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Expansion</div>
        <div className="text-sm font-semibold text-[#6EA3BE]">{formatCurrency(district.expansionTarget)}</div>
      </div>
    )}
    {district.newBusinessTarget != null && (
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">New Biz</div>
        <div className="text-sm font-semibold text-[#D4A84B]">{formatCurrency(district.newBusinessTarget)}</div>
      </div>
    )}
  </div>
)}
```

**Step 3: Update services display (lines 118-136)**

Replace `targetServices` references with two groups:

```tsx
{/* Return Services */}
{district.returnServices && district.returnServices.length > 0 && (
  <div className="flex flex-wrap gap-1 mb-1">
    <span className="text-[9px] text-gray-400 uppercase mr-1 self-center">Return:</span>
    {district.returnServices.slice(0, 3).map((service) => (
      <span key={service.id} className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full text-white" style={{ backgroundColor: service.color }} title={service.name}>
        {service.name.length > 14 ? `${service.name.slice(0, 14)}...` : service.name}
      </span>
    ))}
    {district.returnServices.length > 3 && (
      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">+{district.returnServices.length - 3}</span>
    )}
  </div>
)}
{/* New Services */}
{district.newServices && district.newServices.length > 0 && (
  <div className="flex flex-wrap gap-1">
    <span className="text-[9px] text-gray-400 uppercase mr-1 self-center">New:</span>
    {district.newServices.slice(0, 3).map((service) => (
      <span key={service.id} className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full text-white" style={{ backgroundColor: service.color }} title={service.name}>
        {service.name.length > 14 ? `${service.name.slice(0, 14)}...` : service.name}
      </span>
    ))}
    {district.newServices.length > 3 && (
      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">+{district.newServices.length - 3}</span>
    )}
  </div>
)}
```

**Step 4: Commit**

```bash
git add src/components/plans/DistrictCard.tsx
git commit -m "feat: update DistrictCard for four targets + service categories"
```

---

### Task 9: Update DistrictsTable Component

**Files:**
- Modify: `src/components/plans/DistrictsTable.tsx`

**Step 1: Update InlineServiceSelector (lines 61-203)**

Replace the single service toggle with a two-section dropdown (Return / New). The popover should show two groups with headers. Update `toggleService` to accept a category parameter and call the mutation with `returnServiceIds` or `newServiceIds`.

**Step 2: Update table headers (lines 297-313)**

Replace Revenue Target and Pipeline Target columns with four columns:

```tsx
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Renewal</th>
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Winback</th>
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Expansion</th>
<th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">New Biz</th>
```

**Step 3: Update table body cells (lines 335-360)**

Replace two InlineEditCell columns with four:

```tsx
<td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
  <InlineEditCell type="text" value={district.renewalTarget != null ? String(district.renewalTarget) : null}
    onSave={async (value) => { await updateTargets.mutateAsync({ planId, leaid: district.leaid, renewalTarget: parseCurrency(value) }); }}
    placeholder="-" className="text-[13px] text-gray-600 text-right" displayFormat={formatCurrencyDisplay} />
</td>
<td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
  <InlineEditCell type="text" value={district.winbackTarget != null ? String(district.winbackTarget) : null}
    onSave={async (value) => { await updateTargets.mutateAsync({ planId, leaid: district.leaid, winbackTarget: parseCurrency(value) }); }}
    placeholder="-" className="text-[13px] text-gray-600 text-right" displayFormat={formatCurrencyDisplay} />
</td>
<td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
  <InlineEditCell type="text" value={district.expansionTarget != null ? String(district.expansionTarget) : null}
    onSave={async (value) => { await updateTargets.mutateAsync({ planId, leaid: district.leaid, expansionTarget: parseCurrency(value) }); }}
    placeholder="-" className="text-[13px] text-gray-600 text-right" displayFormat={formatCurrencyDisplay} />
</td>
<td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
  <InlineEditCell type="text" value={district.newBusinessTarget != null ? String(district.newBusinessTarget) : null}
    onSave={async (value) => { await updateTargets.mutateAsync({ planId, leaid: district.leaid, newBusinessTarget: parseCurrency(value) }); }}
    placeholder="-" className="text-[13px] text-gray-600 text-right" displayFormat={formatCurrencyDisplay} />
</td>
```

**Step 4: Update totals (lines 283-290)**

```typescript
const totals = districts.reduce(
  (acc, d) => ({
    renewalTarget: acc.renewalTarget + (d.renewalTarget || 0),
    winbackTarget: acc.winbackTarget + (d.winbackTarget || 0),
    expansionTarget: acc.expansionTarget + (d.expansionTarget || 0),
    newBusinessTarget: acc.newBusinessTarget + (d.newBusinessTarget || 0),
    enrollment: acc.enrollment + (d.enrollment || 0),
  }),
  { renewalTarget: 0, winbackTarget: 0, expansionTarget: 0, newBusinessTarget: 0, enrollment: 0 }
);
const grandTotal = totals.renewalTarget + totals.winbackTarget + totals.expansionTarget + totals.newBusinessTarget;
```

**Step 5: Update footer (lines 397-408)**

```tsx
<span className="text-[12px] text-gray-400">
  Total: <span className="font-medium text-gray-500">{formatCurrency(grandTotal)}</span>
</span>
```

**Step 6: Commit**

```bash
git add src/components/plans/DistrictsTable.tsx
git commit -m "feat: update DistrictsTable for four targets + service categories"
```

---

### Task 10: Update PlanTabs (Sort/Filter/Group)

**Files:**
- Modify: `src/components/plans/PlanTabs.tsx`

**Step 1: Update sort options (lines 128-129)**

```typescript
{ value: "renewalTarget", label: "Renewal Target" },
{ value: "winbackTarget", label: "Winback Target" },
{ value: "expansionTarget", label: "Expansion Target" },
{ value: "newBusinessTarget", label: "New Business Target" },
```

**Step 2: Update filter logic (lines 328-332)**

```typescript
if (filterState.hasTarget === "yes") {
  result = result.filter(d => d.renewalTarget || d.winbackTarget || d.expansionTarget || d.newBusinessTarget);
} else if (filterState.hasTarget === "no") {
  result = result.filter(d => !d.renewalTarget && !d.winbackTarget && !d.expansionTarget && !d.newBusinessTarget);
}
```

**Step 3: Update sort logic (lines 349-354)**

```typescript
case "renewalTarget":
  comparison = (a.renewalTarget || 0) - (b.renewalTarget || 0);
  break;
case "winbackTarget":
  comparison = (a.winbackTarget || 0) - (b.winbackTarget || 0);
  break;
case "expansionTarget":
  comparison = (a.expansionTarget || 0) - (b.expansionTarget || 0);
  break;
case "newBusinessTarget":
  comparison = (a.newBusinessTarget || 0) - (b.newBusinessTarget || 0);
  break;
```

**Step 4: Update group logic (line 552)**

```typescript
if (groupBy === "hasTarget") return (d.renewalTarget || d.winbackTarget || d.expansionTarget || d.newBusinessTarget) ? "Has Target" : "No Target";
```

**Step 5: Update service filter references**

Replace `d.targetServices` with a combined array or check both `d.returnServices` and `d.newServices`:

```typescript
const services = [...new Set(districts.flatMap(d => [
  ...(d.returnServices?.map(s => s.name) || []),
  ...(d.newServices?.map(s => s.name) || []),
]))].sort();
```

**Step 6: Commit**

```bash
git add src/components/plans/PlanTabs.tsx
git commit -m "feat: update PlanTabs sort/filter/group for four targets"
```

---

### Task 11: Update PlanPerfSection + Goal Views

**Files:**
- Modify: `src/components/map-v2/panels/PlanPerfSection.tsx`
- Modify: `src/components/views/GoalsView.tsx`
- Modify: `src/components/views/HomeView.tsx`
- Modify: `src/components/goals/GoalEditorModal.tsx`

**Step 1: Update PlanPerfSection (line 126-132)**

Replace pipelineTargeted calculation:

```typescript
const totalTargeted = useMemo(() => {
  if (!plan) return 0;
  return plan.districts.reduce(
    (sum, d) => sum + (d.renewalTarget ?? 0) + (d.winbackTarget ?? 0) + (d.expansionTarget ?? 0) + (d.newBusinessTarget ?? 0),
    0
  );
}, [plan]);
```

Update the MetricCard to use `totalTargeted`.

**Step 2: Update GoalsView (lines 118-126, 189-242)**

Replace Revenue/Pipeline progress cards with a single "Total Target" plus four breakdowns:

```tsx
<ProgressCard label="Total Target"
  current={dashboard.actuals.revenue + dashboard.actuals.pipeline}
  target={(dashboard.goals.renewalTarget || 0) + (dashboard.goals.winbackTarget || 0) + (dashboard.goals.expansionTarget || 0) + (dashboard.goals.newBusinessTarget || 0)}
  color="#403770" />
```

Update plan totals and per-plan displays to use the new fields.

**Step 3: Update HomeView (lines 370-371)**

Replace the two goal metric entries:

```typescript
{ label: "Total Target", current: dashboard.actuals.revenue + dashboard.actuals.pipeline,
  target: (dashboard.goals.renewalTarget || 0) + (dashboard.goals.winbackTarget || 0) + (dashboard.goals.expansionTarget || 0) + (dashboard.goals.newBusinessTarget || 0),
  color: "#403770", format: "currency" as const },
```

**Step 4: Update GoalEditorModal (lines 50-52, 110-111)**

Replace revenueTarget/pipelineTarget with the four new target fields in the interface and in the mutation call.

**Step 5: Commit**

```bash
git add src/components/map-v2/panels/PlanPerfSection.tsx src/components/views/GoalsView.tsx src/components/views/HomeView.tsx src/components/goals/GoalEditorModal.tsx
git commit -m "feat: update goal views for four-target model"
```

---

### Task 12: Verify Build & Manual Smoke Test

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run the dev server**

```bash
npm run dev
```

**Step 3: Manual smoke test checklist**

- [ ] Open a territory plan with districts
- [ ] Verify four target fields show in PlanDistrictPanel
- [ ] Set values for each of the four targets
- [ ] Verify return services and new services selectors work independently
- [ ] Switch to table view — verify four target columns render
- [ ] Verify inline edit works for each target in table
- [ ] Open DistrictTargetEditor modal — verify four inputs + two service groups
- [ ] Check card view — verify targets display correctly
- [ ] Check goal dashboard — verify total + breakdown display
- [ ] Verify sort/filter by target types works in PlanTabs

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address type errors and polish four-target UI"
```
