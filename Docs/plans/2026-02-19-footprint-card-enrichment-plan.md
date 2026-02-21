# Enriched Territory Footprint Card — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add pipeline share, FY25 revenue share, and top 5 accounts with pipeline-vs-target to the Territory Footprint focus mode card.

**Architecture:** Enrich the focus-mode API to return per-district pipeline + targets (joined from `TerritoryPlanDistrict`), update the TypeScript types, then upgrade the FootprintCard component with new metric rows and a pipeline-vs-target account list.

**Tech Stack:** Next.js API route, Prisma, React, Tailwind CSS, existing `useAnimatedNumber` hook

**Design doc:** `Docs/plans/2026-02-19-footprint-card-enrichment-design.md`
**Data dictionary:** `Docs/data-dictionary.md`

---

### Task 1: Enrich the focus-mode API — top 5 districts with pipeline + targets

**Files:**
- Modify: `src/app/api/focus-mode/[planId]/route.ts` (lines 97-109, the topDistricts query)

**Step 1: Replace the topDistricts query**

Currently (lines 97-109):
```ts
// Top 3 plan districts by FY26 net invoicing
const topDistricts = planLeaidList.length > 0
  ? await prisma.district.findMany({
      where: { leaid: { in: planLeaidList }, fy26NetInvoicing: { not: null } },
      orderBy: { fy26NetInvoicing: "desc" },
      take: 3,
      select: {
        leaid: true,
        name: true,
        fy26NetInvoicing: true,
      },
    })
  : [];
```

Replace with a query that fetches the top 5 plan districts by plan-FY pipeline, joining `TerritoryPlanDistrict` for targets:

```ts
// Top 5 plan districts by plan-FY pipeline, with targets
const topDistricts = planLeaidList.length > 0
  ? await prisma.territoryPlanDistrict.findMany({
      where: { planId, districtLeaid: { in: planLeaidList } },
      include: {
        district: {
          select: {
            leaid: true,
            name: true,
            fy26NetInvoicing: true,
            fy26OpenPipeline: true,
            fy27OpenPipeline: true,
          },
        },
      },
    })
  : [];

// Sort by plan-FY pipeline descending, take 5
const pipelineKey = plan.fiscalYear >= 2027 ? "fy27OpenPipeline" : "fy26OpenPipeline";
const sortedTopDistricts = topDistricts
  .map((pd) => ({
    leaid: pd.district.leaid,
    name: pd.district.name,
    fy26Invoicing: toNum(pd.district.fy26NetInvoicing),
    pipeline: toNum(pd.district[pipelineKey]),
    totalTarget:
      toNum(pd.renewalTarget) +
      toNum(pd.expansionTarget) +
      toNum(pd.winbackTarget) +
      toNum(pd.newBusinessTarget),
  }))
  .sort((a, b) => b.pipeline - a.pipeline)
  .slice(0, 5);
```

**Step 2: Update the topDistricts mapping in the return block**

Replace lines 135-139:
```ts
topDistricts: topDistricts.map((d) => ({
  leaid: d.leaid,
  name: d.name,
  fy26Invoicing: toNum(d.fy26NetInvoicing),
})),
```

With:
```ts
topDistricts: sortedTopDistricts,
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Only pre-existing mockResolvedValue errors

**Step 4: Commit**

```bash
git add src/app/api/focus-mode/[planId]/route.ts
git commit -m "feat(focus-mode): enrich topDistricts with pipeline and targets"
```

---

### Task 2: Update TypeScript types for enriched topDistricts

**Files:**
- Modify: `src/lib/api.ts` (lines 2496-2500)

**Step 1: Add `pipeline` and `totalTarget` to the topDistricts type**

Replace lines 2496-2500:
```ts
  topDistricts: Array<{
    leaid: string;
    name: string;
    fy26Invoicing: number;
  }>;
```

With:
```ts
  topDistricts: Array<{
    leaid: string;
    name: string;
    fy26Invoicing: number;
    pipeline: number;
    totalTarget: number;
  }>;
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Only pre-existing errors

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(focus-mode): add pipeline and totalTarget to FocusModeStateData type"
```

---

### Task 3: Add pipeline share + FY25 revenue share metrics to FootprintCard

**Files:**
- Modify: `src/components/map-v2/focus-mode/FootprintCard.tsx`

**Step 1: Compute share percentages**

Add these computed values after the existing `animatedPipeline` line (after line 40):

```tsx
// Pipeline share: this state's plan pipeline vs total across all states
const statePlanPipeline = data.plan.fy26Pipeline + data.plan.fy27Pipeline;
const totalPlanPipeline = states.reduce(
  (sum, s) => sum + s.plan.fy26Pipeline + s.plan.fy27Pipeline, 0
);
const pipelineShare = totalPlanPipeline > 0
  ? (statePlanPipeline / totalPlanPipeline) * 100
  : 0;

// FY25 revenue share: this state's plan FY25 invoicing vs total
const totalPlanFy25 = states.reduce((sum, s) => sum + s.plan.fy25Invoicing, 0);
const revenueShare = totalPlanFy25 > 0
  ? (data.plan.fy25Invoicing / totalPlanFy25) * 100
  : 0;
```

**Step 2: Add share metric rows between "Open Pipeline" and "Top Accounts"**

Insert this JSX after the pipeline section (after line 108, before the topDistricts section):

```tsx
{/* Share metrics — side by side */}
<div className="flex gap-3 pt-1 border-t border-gray-100">
  {/* Pipeline Share */}
  <div className="flex-1">
    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
      Pipeline Share
    </div>
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#6EA3BE] transition-all duration-700"
          style={{ width: `${Math.min(pipelineShare, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-[#6EA3BE] tabular-nums">
        {pipelineShare.toFixed(0)}%
      </span>
    </div>
  </div>
  {/* FY25 Revenue Share */}
  <div className="flex-1">
    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
      FY25 Share
    </div>
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#403770] transition-all duration-700"
          style={{ width: `${Math.min(revenueShare, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-[#403770] tabular-nums">
        {revenueShare.toFixed(0)}%
      </span>
    </div>
  </div>
</div>
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 4: Commit**

```bash
git add src/components/map-v2/focus-mode/FootprintCard.tsx
git commit -m "feat(focus-mode): add pipeline share and FY25 revenue share to FootprintCard"
```

---

### Task 4: Replace top districts with top 5 accounts showing pipeline vs. target

**Files:**
- Modify: `src/components/map-v2/focus-mode/FootprintCard.tsx`

**Step 1: Add a helper function for attainment bar color**

Add this function at the top of the file, after `formatCurrency`:

```tsx
function attainmentColor(pct: number): { bar: string; text: string } {
  if (pct > 100) return { bar: "bg-[#EDFFE3]", text: "text-[#5f665b]" };
  if (pct >= 75) return { bar: "bg-[#403770]", text: "text-[#403770]" };
  return { bar: "bg-[#FFCF70]", text: "text-[#997c43]" };
}
```

**Step 2: Replace the top districts section**

Replace the entire `{/* Top Districts — inline relative bars */}` section (lines 110-140) with:

```tsx
{/* Top Accounts — pipeline vs target */}
{data.topDistricts.length > 0 && (
  <div className="pt-1 border-t border-gray-100">
    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mb-1.5">
      Top Accounts
    </div>
    <div className="space-y-2">
      {data.topDistricts.map((d, i) => {
        const pct = d.totalTarget > 0
          ? (d.pipeline / d.totalTarget) * 100
          : 0;
        const colors = attainmentColor(pct);
        return (
          <div key={d.leaid}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-gray-600 truncate flex-1 mr-2">
                <span className="text-[10px] text-gray-300 mr-1">{i + 1}</span>
                {d.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${colors.bar} transition-all duration-700`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              {d.totalTarget > 0 ? (
                <span className={`text-[9px] font-semibold tabular-nums whitespace-nowrap ${colors.text}`}>
                  {formatCurrency(d.pipeline)}/{formatCurrency(d.totalTarget)}
                </span>
              ) : (
                <span className="text-[9px] text-gray-300 whitespace-nowrap">
                  {formatCurrency(d.pipeline)} · No target
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
```

**Step 3: Remove the old `maxInvoicing` variable**

Delete line 43:
```tsx
const maxInvoicing = Math.max(...data.topDistricts.map((d) => d.fy26Invoicing), 1);
```

This is no longer needed since we're using pipeline/target ratios instead of relative invoicing bars.

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5: Commit**

```bash
git add src/components/map-v2/focus-mode/FootprintCard.tsx
git commit -m "feat(focus-mode): top 5 accounts with pipeline vs target attainment bars"
```

---

### Task 5: Visual QA

**Step 1: Start the dev server**

Run: `npm run dev`

Open the app, navigate to Map V2, open a territory plan, click "Focus Map". Verify the FootprintCard (bottom-left):

- [ ] Pipeline Share shows correct % with Steel Blue bar
- [ ] FY25 Share shows correct % with Plum bar
- [ ] Share bars are side-by-side and don't overflow the card width
- [ ] Top Accounts shows 5 districts (or fewer if plan has fewer)
- [ ] Accounts sorted by pipeline descending
- [ ] Pipeline/target values formatted correctly ($420K/$500K)
- [ ] Attainment bar colors:
  - Golden for < 75% attainment
  - Plum for 75-100%
  - Mint for > 100%
- [ ] "No target" label shown when district has no targets set
- [ ] State selector tabs still sync with YoY card
- [ ] Card doesn't overflow or look cramped at 280px width

**Step 2: Fix any visual issues**

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix(focus-mode): visual polish for enriched footprint card"
```
