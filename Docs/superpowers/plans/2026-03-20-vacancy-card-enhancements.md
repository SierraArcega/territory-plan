# Vacancy Card Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance vacancy cards in the map sidebar to show district + school, job board links, and territory plan membership.

**Architecture:** Two-file change. The API route gets additional SELECT columns (sourceUrl, jobBoardUrl) and a lateral subquery to aggregate territory plan memberships. The VacancyCard component gets an updated layout with always-visible district, school below it, job board link, and a collapsible plan indicator.

**Tech Stack:** Next.js API route (raw SQL via pg pool), React component with Tailwind

---

### Task 1: Add sourceUrl, jobBoardUrl, and plan data to the vacancy API

**Files:**
- Modify: `src/app/api/map/vacancies/route.ts:87-132`

- [ ] **Step 1: Add sourceUrl and jobBoardUrl to the SELECT**

In `src/app/api/map/vacancies/route.ts`, add `v.source_url` and `d.job_board_url` to the SQL SELECT and include them in the GeoJSON properties mapping.

Add these two columns to the SELECT clause (after the `d.leaid` line):

```sql
v.source_url AS "sourceUrl",
d.job_board_url AS "jobBoardUrl",
```

Add them to the properties mapping (after `leaid: row.leaid`):

```ts
sourceUrl: row.sourceUrl,
jobBoardUrl: row.jobBoardUrl,
```

- [ ] **Step 2: Add plan membership via lateral subquery**

Add a LEFT JOIN LATERAL to aggregate territory plan data per vacancy's district. This avoids row multiplication — each vacancy still returns one row.

Add this join after the existing `LEFT JOIN schools s ON v.school_ncessch = s.ncessch` line:

```sql
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
    'id', tp.id,
    'name', tp.name,
    'fiscalYear', tp.fiscal_year,
    'color', tp.color
  )) AS plans
  FROM territory_plan_districts tpd
  INNER JOIN territory_plans tp ON tpd.plan_id = tp.id
  WHERE tpd.district_leaid = v.leaid
) tp_agg ON true
```

Add the column to the SELECT:

```sql
tp_agg.plans AS "plans",
```

Add it to the properties mapping:

```ts
plans: row.plans ?? null,
```

- [ ] **Step 3: Verify the API returns the new fields**

Run the dev server and test with curl:

```bash
curl -s "http://localhost:3005/api/map/vacancies?bounds=-100,40,-90,50" | jq '.features[0].properties | {sourceUrl, jobBoardUrl, plans}'
```

Expected: JSON with sourceUrl (string or null), jobBoardUrl (string or null), plans (array of objects or null).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/map/vacancies/route.ts
git commit -m "feat: add sourceUrl, jobBoardUrl, and plan membership to vacancy API"
```

---

### Task 2: Update VacancyCard to show district + school, job board link, and plan indicator

**Files:**
- Modify: `src/features/map/components/SearchResults/VacancyCard.tsx`

- [ ] **Step 1: Add state and extract new properties**

At the top of the component function, add a `useState` for the plan dropdown and extract the new properties:

```tsx
import { useState } from "react";

// Inside the component, after existing property extractions:
const sourceUrl = p.sourceUrl ?? null;
const jobBoardUrl = p.jobBoardUrl ?? null;
const plans: { id: string; name: string; fiscalYear: number; color: string }[] | null = p.plans ?? null;
const [plansOpen, setPlansOpen] = useState(false);

// Resolve which URL to show — prefer individual posting, fall back to district board
const listingUrl = sourceUrl ?? jobBoardUrl ?? null;
```

- [ ] **Step 2: Update the location/detail row**

Replace the existing `{/* Detail row */}` section (lines 84-101) with a two-line location display that always shows district and optionally shows school:

```tsx
{/* Location */}
<div className="mt-1.5 space-y-0.5">
  <div className="text-xs text-[#544A78] font-medium truncate">
    {districtName ?? "Unknown District"}
  </div>
  {schoolName && (
    <div className="text-xs text-[#8A80A8] truncate">
      {schoolName}
    </div>
  )}
</div>

{/* Meta row: days open + job board link */}
<div className="flex items-center gap-3 mt-1">
  {daysOpen != null && (
    <span className="text-xs text-[#8A80A8]">
      <span className="font-medium text-[#6E6390]">{daysOpen}</span> days open
    </span>
  )}
  {listingUrl && (
    <a
      href={listingUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-xs text-[#6EA3BE] hover:text-[#4a7a90] transition-colors"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      Job Board
    </a>
  )}
</div>
```

- [ ] **Step 3: Add the plan indicator with expandable dropdown**

After the meta row and before the layer accent bar, add the plan indicator:

```tsx
{/* Plan membership indicator */}
{plans && plans.length > 0 && (
  <div className="mt-1.5">
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPlansOpen(!plansOpen);
      }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#403770]/10 text-[#544A78] hover:bg-[#403770]/15 transition-colors"
    >
      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
      </svg>
      In {plans.length} {plans.length === 1 ? "Plan" : "Plans"}
      <svg
        className={`w-2.5 h-2.5 transition-transform ${plansOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    {plansOpen && (
      <div className="mt-1 ml-1 space-y-1">
        {plans.map((plan) => (
          <div key={plan.id} className="flex items-center gap-1.5 text-[10px] text-[#6E6390]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: plan.color }}
            />
            <span className="truncate">{plan.name}</span>
            <span className="text-[#8A80A8] shrink-0">FY{String(plan.fiscalYear).slice(-2)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Verify in browser**

1. Run `npm run dev` (if not already running)
2. Open `http://localhost:3005/?tab=map`
3. Navigate to an area with vacancies
4. Verify each card shows:
   - District name always visible
   - School name below district when present
   - Days open count
   - "Job Board" link (opens in new tab when clicked)
   - "In X Plans" badge for districts that are in territory plans
   - Clicking the badge expands to show plan names with color dots and FY

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/SearchResults/VacancyCard.tsx
git commit -m "feat: enhanced vacancy cards with district/school, job board links, and plan indicator"
```
