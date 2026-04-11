# Phase 2b: Person FK + CompetitorSpend Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all queries from string person columns (owner, sales_executive, territory_owner) to UUID FK relations, migrate CompetitorSpend queries to DistrictFinancials, and update the frontend owner picker to send UUIDs (approach C — clean break).

**Architecture:** API routes switch from reading/writing string name columns to UUID FK columns with JOINs to user_profiles. Frontend owner pickers already show team member dropdowns — they just need to send `user.id` instead of `user.fullName`. CompetitorSpend Prisma queries migrate to DistrictFinancials with `vendor != 'fullmind'` filter.

**Tech Stack:** Next.js App Router API routes, Prisma ORM, React 19, TanStack Query, TypeScript

**Branch:** `feat/db-normalization-query-tool` (worktree at `.worktrees/db-normalization-query-tool`)

**Vendor slug reference:** `district_financials.vendor` uses lowercase slugs: `fullmind`, `proximity`, `elevate`, `tbt`, `educere`. The old `competitor_spend.competitor` used display names (`"Proximity Learning"`, etc.).

**Out of scope (deferred):**
- State FK migration (state_abbrev → state_fips lookups) — `state_abbrev` remains the primary filter key on districts as a denormalized cache. No query changes needed; the FK is already populated for future use.
- `opportunities.sales_rep_id` FK — the Prisma schema has the column but no relation to UserProfile. Deferred to a future task since opportunity queries are handled by a separate sync pipeline.
- Phase 3 cleanup (dropping old string columns, FY columns, CompetitorSpend table) — after Phase 2 is validated in production.

---

## File Map

### API Routes (modify)
| File | Change |
|------|--------|
| `src/app/api/districts/[leaid]/route.ts` | Read `ownerUser`, `salesExecutiveUser` relations |
| `src/app/api/districts/route.ts` | Filter by `salesExecutiveId` instead of `salesExecutive` |
| `src/app/api/districts/[leaid]/edits/route.ts` | Accept `ownerId` UUID, write `ownerId` |
| `src/app/api/districts/batch-edits/route.ts` | Accept `ownerId` UUID, write `ownerId` |
| `src/app/api/districts/search/route.ts` | Swap `competitorSpend` filters → `districtFinancials` |
| `src/app/api/explore/[entity]/route.ts` | Read `ownerUser` relation for district owner |
| `src/app/api/territory-plans/[id]/route.ts` | Read `ownerUser` relation for district owner |
| `src/app/api/states/[code]/route.ts` | Read `territoryOwnerUser` relation; write `territoryOwnerId` |
| `src/app/api/states/[code]/districts/route.ts` | Read `salesExecutiveUser` relation |
| `src/app/api/schools/route.ts` | Read `ownerUser` relation |
| `src/app/api/schools/[ncessch]/route.ts` | Read `ownerUser` relation |
| `src/app/api/schools/[ncessch]/edits/route.ts` | Accept `ownerId` UUID, write `ownerId` |
| `src/app/api/accounts/route.ts` | Accept `salesExecutiveId` UUID, write `salesExecutiveId` |
| `src/app/api/sales-executives/route.ts` | Query `user_profiles` instead of distinct strings |

### Shared Lib (modify)
| File | Change |
|------|--------|
| `src/features/shared/lib/auto-tags.ts` | Replace `competitorSpend` → `districtFinancials` |
| `src/features/shared/types/api-types.ts` | Update `DistrictEdits`, `FullmindData`, `StateDetail`; add `PersonRef` type |
| `src/features/explore/lib/filters.ts` | Update `owner` → `ownerId`, `salesExecutive` → `salesExecutiveId` |

### Frontend Components (modify)
| File | Change |
|------|--------|
| `src/features/districts/components/NotesEditor.tsx` | Replace text input with user dropdown |
| `src/features/districts/lib/queries.ts` | Update mutation types to use UUIDs |
| `src/features/map/components/explore/cellRenderers.tsx` | Send `u.id` instead of display name |
| `src/features/map/components/explore/BulkActionBar.tsx` | Queue UUID instead of name |
| `src/features/shared/components/filters/FilterBar.tsx` | Fetch users for sales exec filter |
| `src/features/map/lib/queries.ts` | Update state mutation to use `territoryOwnerId` |
| `src/features/map/components/panels/district/FullmindCard.tsx` | Render `salesExecutive.fullName` |
| `src/features/districts/components/DistrictHeader.tsx` | Render `salesExecutive.fullName` |
| `src/features/map/components/SearchBar/FullmindDropdown.tsx` | Parse new sales-executives response |
| `src/features/map/components/SearchBar/DistrictsDropdown.tsx` | Parse new sales-executives response |
| `src/features/map/components/panels/AccountForm.tsx` | Send `salesExecutiveId` UUID |

### Tests (modify)
| File | Change |
|------|--------|
| `src/features/shared/lib/__tests__/auto-tags.test.ts` | Swap `competitorSpend` mocks → `districtFinancials` |

---

## Task 1: CompetitorSpend → DistrictFinancials (auto-tags.ts)

**Files:**
- Modify: `src/features/shared/lib/auto-tags.ts`
- Modify: `src/features/shared/lib/__tests__/auto-tags.test.ts`

The auto-tags file has 4 `prisma.competitorSpend.findMany()` calls and also reads FY columns directly from the districts table. Migrate both: competitor queries to `districtFinancials` and FY reads to `districtFinancials` (consistent with Phase 2a).

- [ ] **Step 1: Update COMPETITOR_TAG_MAP keys to vendor slugs**

The map currently uses display names as keys. Change to vendor slugs matching `district_financials.vendor`:

```typescript
// In auto-tags.ts — replace the existing COMPETITOR_TAG_MAP (lines 35-51)
export const COMPETITOR_TAG_MAP: Record<string, Record<string, keyof typeof AUTO_TAGS>> = {
  proximity: {
    FY24: "PROXIMITY_LEARNING_FY24",
    FY25: "PROXIMITY_LEARNING_FY25",
    FY26: "PROXIMITY_LEARNING_FY26",
  },
  elevate: {
    FY24: "ELEVATE_K12_FY24",
    FY25: "ELEVATE_K12_FY25",
    FY26: "ELEVATE_K12_FY26",
  },
  tbt: {
    FY24: "TUTORED_BY_TEACHERS_FY24",
    FY25: "TUTORED_BY_TEACHERS_FY25",
    FY26: "TUTORED_BY_TEACHERS_FY26",
  },
};
```

- [ ] **Step 2: Migrate `syncClassificationTagsForDistrict` — competitor query**

Replace the EK12 competitor query (line 145):

```typescript
// BEFORE:
const ek12Spend = await prisma.competitorSpend.findMany({
  where: { leaid, competitor: "Elevate K12" },
  select: { fiscalYear: true, totalSpend: true },
});

// AFTER:
const ek12Spend = await prisma.districtFinancials.findMany({
  where: { leaid, vendor: "elevate" },
  select: { fiscalYear: true, totalRevenue: true },
});

const ek12ByFY: Record<string, number> = {};
for (const s of ek12Spend) {
  ek12ByFY[s.fiscalYear] = Number(s.totalRevenue);
}
```

- [ ] **Step 3: Migrate `syncClassificationTagsForDistrict` — Fullmind FY reads**

Replace the district FY column reads (lines 130-140) with a districtFinancials query:

```typescript
// BEFORE: reads fy25NetInvoicing, fy25ClosedWonNetBooking, etc. from district
const district = await prisma.district.findUnique({
  where: { leaid },
  select: {
    fy25NetInvoicing: true,
    fy25ClosedWonNetBooking: true,
    fy25SessionsRevenue: true,
    fy26NetInvoicing: true,
    fy26ClosedWonNetBooking: true,
    fy26SessionsRevenue: true,
  },
});
if (!district) return;

// AFTER: single query for both Fullmind + EK12 from districtFinancials
const financials = await prisma.districtFinancials.findMany({
  where: { leaid },
  select: { vendor: true, fiscalYear: true, totalRevenue: true, invoicing: true, closedWonBookings: true },
});
if (financials.length === 0) {
  // Check district exists at all
  const exists = await prisma.district.count({ where: { leaid } });
  if (!exists) return;
}

// Split into Fullmind and EK12
const fmByFY: Record<string, { invoicing: number; revenue: number; bookings: number }> = {};
const ek12ByFY: Record<string, number> = {};
for (const f of financials) {
  if (f.vendor === "fullmind") {
    fmByFY[f.fiscalYear] = {
      invoicing: Number(f.invoicing ?? 0),
      revenue: Number(f.totalRevenue ?? 0),
      bookings: Number(f.closedWonBookings ?? 0),
    };
  } else if (f.vendor === "elevate") {
    ek12ByFY[f.fiscalYear] = Number(f.totalRevenue ?? 0);
  }
}

// Fullmind revenue signals per FY
const fm25 = fmByFY["FY25"] ?? { invoicing: 0, revenue: 0, bookings: 0 };
const fm26 = fmByFY["FY26"] ?? { invoicing: 0, revenue: 0, bookings: 0 };

const fm25HasRevenue = fm25.invoicing > 0 || fm25.revenue > 0;
const fm25HasAnySignal = fm25HasRevenue || fm25.bookings > 0;
const fm26HasRevenue = fm26.invoicing > 0 || fm26.revenue > 0;
const fm26HasAnySignal = fm26HasRevenue || fm26.bookings > 0;
```

Remove the separate EK12 query (lines 144-148) since it's now folded into the single query above.

- [ ] **Step 4: Migrate `syncAllClassificationTags` — bulk queries**

Replace the bulk district FY query (lines 237-247) and EK12 query (lines 251-259):

```typescript
// BEFORE: two separate queries — districts FY columns + competitorSpend
const districts = await prisma.district.findMany({
  select: { leaid: true, fy25NetInvoicing: true, ... },
});
const ek12Rows = await prisma.competitorSpend.findMany({
  where: { competitor: "Elevate K12" },
  select: { leaid: true, fiscalYear: true, totalSpend: true },
});

// AFTER: single query from districtFinancials
const allFinancials = await prisma.districtFinancials.findMany({
  where: {
    vendor: { in: ["fullmind", "elevate"] },
  },
  select: { leaid: true, vendor: true, fiscalYear: true, totalRevenue: true, invoicing: true, closedWonBookings: true },
});

// Build per-district lookup maps
const fmMap = new Map<string, Record<string, { invoicing: number; revenue: number; bookings: number }>>();
const ek12Map = new Map<string, Record<string, number>>();
const allLeaids = new Set<string>();

for (const f of allFinancials) {
  if (!f.leaid) continue;
  allLeaids.add(f.leaid);

  if (f.vendor === "fullmind") {
    if (!fmMap.has(f.leaid)) fmMap.set(f.leaid, {});
    fmMap.get(f.leaid)![f.fiscalYear] = {
      invoicing: Number(f.invoicing ?? 0),
      revenue: Number(f.totalRevenue ?? 0),
      bookings: Number(f.closedWonBookings ?? 0),
    };
  } else if (f.vendor === "elevate") {
    if (!ek12Map.has(f.leaid)) ek12Map.set(f.leaid, {});
    ek12Map.get(f.leaid)![f.fiscalYear] = Number(f.totalRevenue ?? 0);
  }
}
console.log(`Loaded financials for ${allLeaids.size} districts.`);
```

Then update the per-district loop (lines 265-300) to read from the new maps:

```typescript
for (const leaid of allLeaids) {
  const fm = fmMap.get(leaid) ?? {};
  const fm25 = fm["FY25"] ?? { invoicing: 0, revenue: 0, bookings: 0 };
  const fm26 = fm["FY26"] ?? { invoicing: 0, revenue: 0, bookings: 0 };

  const fm26HasRevenue = fm26.invoicing > 0 || fm26.revenue > 0;
  const fm25HasAny = fm25.invoicing > 0 || fm25.revenue > 0 || fm25.bookings > 0;

  // Fullmind classification
  if (fm26HasRevenue && fullmindReturnId) {
    inserts.push({ districtLeaid: leaid, tagId: fullmindReturnId });
  } else if (fm26.bookings > 0 && churnRiskId) {
    inserts.push({ districtLeaid: leaid, tagId: churnRiskId });
  } else if (fm25HasAny && fmWinBackFy25Id) {
    inserts.push({ districtLeaid: leaid, tagId: fmWinBackFy25Id });
  }

  // EK12 classification
  const ek12 = ek12Map.get(leaid);
  if (ek12) {
    const fy24 = (ek12["FY24"] ?? 0) > 0;
    const fy25 = (ek12["FY25"] ?? 0) > 0;
    const fy26 = (ek12["FY26"] ?? 0) > 0;

    if (fy26 && ek12ReturnId) {
      inserts.push({ districtLeaid: leaid, tagId: ek12ReturnId });
    } else if (fy25 && ek12WbFy25Id) {
      inserts.push({ districtLeaid: leaid, tagId: ek12WbFy25Id });
    } else if (fy24 && ek12WbFy24Id) {
      inserts.push({ districtLeaid: leaid, tagId: ek12WbFy24Id });
    }
  }
}
```

- [ ] **Step 5: Migrate `syncCompetitorTagsForDistrict`**

Replace the per-district competitor query (line 400):

```typescript
// BEFORE:
const competitorSpend = await prisma.competitorSpend.findMany({
  where: { leaid },
  select: { competitor: true, fiscalYear: true, totalSpend: true },
});

// AFTER:
const competitorFinancials = await prisma.districtFinancials.findMany({
  where: { leaid, vendor: { not: "fullmind" } },
  select: { vendor: true, fiscalYear: true, totalRevenue: true },
});

const tagsToApply = new Set<string>();
for (const spend of competitorFinancials) {
  if (Number(spend.totalRevenue) > 0) {
    const competitorMap = COMPETITOR_TAG_MAP[spend.vendor];
    if (competitorMap) {
      const tagKey = competitorMap[spend.fiscalYear];
      if (tagKey) {
        tagsToApply.add(AUTO_TAGS[tagKey].name);
      }
    }
  }
}
```

- [ ] **Step 6: Migrate `syncAllCompetitorTags`**

Replace the distinct LEAIDs query (line 453):

```typescript
// BEFORE:
const distinctLeaids = await prisma.competitorSpend.findMany({
  select: { leaid: true },
  distinct: ["leaid"],
});

// AFTER:
const distinctLeaids = await prisma.districtFinancials.findMany({
  where: { vendor: { not: "fullmind" }, leaid: { not: null } },
  select: { leaid: true },
  distinct: ["leaid"],
});
```

Note: `leaid` is nullable on `districtFinancials` (unmatched accounts can have `unmatchedAccountId` instead), so filter `leaid: { not: null }`.

- [ ] **Step 7: Update comment at line 22**

```typescript
// BEFORE:
// Competitor tags - auto-applied based on competitor_spend data

// AFTER:
// Competitor tags - auto-applied based on district_financials data (non-fullmind vendors)
```

Also update the JSDoc for `syncCompetitorTagsForDistrict` (line 394):

```typescript
// BEFORE:
* Syncs competitor tags for a district based on competitor_spend data.

// AFTER:
* Syncs competitor tags for a district based on district_financials data (non-fullmind vendors).
```

- [ ] **Step 8: Update auto-tags tests**

In `src/features/shared/lib/__tests__/auto-tags.test.ts`, replace all `competitorSpend` mock references with `districtFinancials`:

```typescript
// BEFORE:
competitorSpend: { findMany: vi.fn() },

// AFTER:
districtFinancials: { findMany: vi.fn() },
```

Replace all `prisma.competitorSpend.findMany` mock calls:

```typescript
// BEFORE:
vi.mocked(prisma.competitorSpend.findMany).mockResolvedValue([...]);

// AFTER:
vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([...]);
```

Update mock data shapes: `totalSpend` → `totalRevenue`, `competitor` → `vendor`, display names → slugs:

```typescript
// BEFORE: { leaid: "123", competitor: "Elevate K12", fiscalYear: "FY26", totalSpend: new Decimal(1000) }
// AFTER:  { leaid: "123", vendor: "elevate", fiscalYear: "FY26", totalRevenue: new Decimal(1000) }
```

For classification tag tests that mock district FY columns, update to mock `districtFinancials.findMany` instead:

```typescript
// BEFORE:
vi.mocked(prisma.district.findUnique).mockResolvedValue({
  fy25NetInvoicing: new Decimal(100), ...
});

// AFTER:
vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
  { vendor: "fullmind", fiscalYear: "FY25", invoicing: new Decimal(100), totalRevenue: new Decimal(100), closedWonBookings: new Decimal(0) },
]);
```

- [ ] **Step 9: Run tests**

```bash
npx vitest run src/features/shared/lib/__tests__/auto-tags.test.ts
```

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/features/shared/lib/auto-tags.ts src/features/shared/lib/__tests__/auto-tags.test.ts
git commit -m "feat: migrate auto-tags from competitorSpend to districtFinancials"
```

---

## Task 2: CompetitorSpend → DistrictFinancials (search route)

**Files:**
- Modify: `src/app/api/districts/search/route.ts`

The search route has 3 remaining `competitorSpend` references for the specific-competitor and any-competitor filters. The `competitorChurned` filter was already migrated to `districtFinancials` in Phase 2a.

- [ ] **Step 1: Migrate specific competitor filters**

Replace the `competitor_*` filter block (lines 196-213):

```typescript
// BEFORE:
if (f.column.startsWith("competitor_")) {
  const vendorId = f.column.replace("competitor_", "");
  const competitorName = COMPETITOR_NAMES[vendorId];
  if (!competitorName) continue;

  if (f.op === "is_not_empty") {
    if (!relationWhere.AND) relationWhere.AND = [];
    (relationWhere.AND as unknown[]).push({
      competitorSpend: { some: { competitor: competitorName } },
    });
  } else if (f.op === "is_empty") {
    if (!relationWhere.AND) relationWhere.AND = [];
    (relationWhere.AND as unknown[]).push({
      competitorSpend: { none: { competitor: competitorName } },
    });
  }
}

// AFTER:
if (f.column.startsWith("competitor_")) {
  const vendorSlug = f.column.replace("competitor_", "");
  // Validate it's a known competitor vendor slug
  if (!COMPETITOR_NAMES[vendorSlug]) continue;

  if (f.op === "is_not_empty") {
    if (!relationWhere.AND) relationWhere.AND = [];
    (relationWhere.AND as unknown[]).push({
      districtFinancials: { some: { vendor: vendorSlug } },
    });
  } else if (f.op === "is_empty") {
    if (!relationWhere.AND) relationWhere.AND = [];
    (relationWhere.AND as unknown[]).push({
      districtFinancials: { none: { vendor: vendorSlug } },
    });
  }
}
```

- [ ] **Step 2: Migrate competitorEngagement filter**

Replace the `competitorEngagement` block (lines 215-220):

```typescript
// BEFORE:
if (f.column === "competitorEngagement") {
  if (f.op === "is_not_empty") {
    relationWhere.competitorSpend = { some: {} };
  }
}

// AFTER:
if (f.column === "competitorEngagement") {
  if (f.op === "is_not_empty") {
    relationWhere.districtFinancials = {
      some: { vendor: { not: "fullmind" } },
    };
  }
}
```

- [ ] **Step 3: Remove COMPETITOR_NAMES constant (or keep for reference)**

`COMPETITOR_NAMES` was used to map vendor slug → display name for the `competitorSpend.competitor` field. Since `districtFinancials.vendor` already stores the slug, we only need COMPETITOR_NAMES for validation. Keep it but update the comment:

```typescript
// Competitor vendor slugs → display names (used for validation)
const COMPETITOR_NAMES: Record<string, string> = {
  proximity: "Proximity Learning",
  elevate: "Elevate K12",
  tbt: "Tutored By Teachers",
  educere: "Educere",
};
```

- [ ] **Step 4: Verify the search route works**

```bash
npm run dev
# Test in browser: search with competitor filter chips
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/districts/search/route.ts
git commit -m "feat: migrate search route competitor filters from competitorSpend to districtFinancials"
```

---

## Task 3: Person FK — API Types and PersonRef

**Files:**
- Modify: `src/features/shared/types/api-types.ts`

- [ ] **Step 1: Add PersonRef type and update interfaces**

```typescript
// Add near the top of the User Types section:
export interface PersonRef {
  id: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}
```

Note: `id` is `string | null` because unresolved legacy person references (where the string name didn't match any user_profile) still need to display a name without a UUID.

```typescript
// Update DistrictEdits:
export interface DistrictEdits {
  leaid: string;
  notes: string | null;
  owner: PersonRef | null;
  updatedAt: string;
}

// Update FullmindData.salesExecutive:
export interface FullmindData {
  // ... other fields unchanged ...
  salesExecutive: PersonRef | null; // was: string | null
  // ...
}

// Update StateDetail.territoryOwner:
export interface StateDetail {
  // ... other fields unchanged ...
  territoryOwner: PersonRef | null; // was: string | null
  // ...
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/shared/types/api-types.ts
git commit -m "feat: add PersonRef type, update DistrictEdits to use PersonRef for owner"
```

---

## Task 4: Person FK — District Read Routes

**Files:**
- Modify: `src/app/api/districts/[leaid]/route.ts`
- Modify: `src/app/api/districts/route.ts`
- Modify: `src/app/api/states/[code]/districts/route.ts`

- [ ] **Step 1: Migrate district detail route**

In `src/app/api/districts/[leaid]/route.ts`, add `ownerUser` and `salesExecutiveUser` to the Prisma select, and update the response to return PersonRef objects.

Find the select block and add:

```typescript
ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
salesExecutiveUser: { select: { id: true, fullName: true, avatarUrl: true } },
```

Update the response `fullmindData` section (line ~84):

```typescript
// BEFORE:
salesExecutive: district.salesExecutive,

// AFTER:
salesExecutive: district.salesExecutiveUser
  ? { id: district.salesExecutiveUser.id, fullName: district.salesExecutiveUser.fullName, avatarUrl: district.salesExecutiveUser.avatarUrl }
  : district.salesExecutive  // fallback to string for unmatched reps
  ? { id: null, fullName: district.salesExecutive, avatarUrl: null }
  : null,
```

Update the `edits` section (lines ~109-113):

```typescript
// BEFORE:
edits: district.notes != null || district.owner != null ? {
  leaid: district.leaid,
  notes: district.notes,
  owner: district.owner,
  updatedAt: district.notesUpdatedAt?.toISOString() ?? null,
} : null,

// AFTER:
edits: district.notes != null || district.ownerId != null ? {
  leaid: district.leaid,
  notes: district.notes,
  owner: district.ownerUser
    ? { id: district.ownerUser.id, fullName: district.ownerUser.fullName, avatarUrl: district.ownerUser.avatarUrl }
    : null,
  updatedAt: district.notesUpdatedAt?.toISOString() ?? null,
} : null,
```

Add `ownerId` to the select to use in the null check above.

- [ ] **Step 2: Migrate districts list route — sales exec filter**

In `src/app/api/districts/route.ts`, change the `salesExec` filter (line ~110):

```typescript
// BEFORE:
if (salesExec) {
  where.salesExecutive = salesExec;
}

// AFTER:
if (salesExec) {
  where.salesExecutiveId = salesExec;
}
```

Note: `salesExec` param now receives a UUID from the frontend (Task 7 updates the FilterBar).

- [ ] **Step 3: Migrate state districts route**

In `src/app/api/states/[code]/districts/route.ts`, add `salesExecutiveUser` relation and update response:

Add to select (after line ~64):

```typescript
salesExecutiveUser: { select: { id: true, fullName: true, avatarUrl: true } },
```

Update response mapping (line ~92):

```typescript
// BEFORE:
salesExecutive: d.salesExecutive,

// AFTER:
salesExecutive: d.salesExecutiveUser
  ? { id: d.salesExecutiveUser.id, fullName: d.salesExecutiveUser.fullName, avatarUrl: d.salesExecutiveUser.avatarUrl }
  : null,
```

Remove `salesExecutive: true` from the select (replaced by the relation).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/districts/[leaid]/route.ts src/app/api/districts/route.ts src/app/api/states/[code]/districts/route.ts
git commit -m "feat: migrate district read routes to use person FK relations"
```

---

## Task 5: Person FK — Explore, Plans, Schools, State Read Routes

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts`
- Modify: `src/app/api/territory-plans/[id]/route.ts`
- Modify: `src/app/api/schools/route.ts`
- Modify: `src/app/api/schools/[ncessch]/route.ts`
- Modify: `src/app/api/states/[code]/route.ts`

- [ ] **Step 1: Migrate explore entity route — district owner**

In `src/app/api/explore/[entity]/route.ts`, the district `owner` field is read at two places:
1. Line ~863: `owner: d.district.owner ?? null` (plan expansion row)
2. The general district row mapper uses `DISTRICT_FIELD_MAP.owner` → `"owner"` to select the string column.

For the plan expansion row (line ~863), update the plan district select to include `ownerUser`:

```typescript
// In the plan entity handler's district select, add:
ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
```

Update the mapping:

```typescript
// BEFORE:
owner: d.district.owner ?? null,

// AFTER:
owner: d.district.ownerUser
  ? { id: d.district.ownerUser.id, fullName: d.district.ownerUser.fullName, avatarUrl: d.district.ownerUser.avatarUrl }
  : null,
```

For the general district entity, the `owner` column goes through `DISTRICT_FIELD_MAP` and is selected as a Prisma field. Update `RELATION_SELECTS` to include `ownerUser` when the `owner` column is requested, and update the row mapper to return the user object.

Add `owner` to `RELATION_SELECTS`:

```typescript
owner: {
  ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
},
```

In the row mapper, when building the flat row from district data, check for `ownerUser`:

```typescript
// After spreading Prisma fields into the row, replace the owner string with the user object
if (d.ownerUser) {
  row.owner = d.ownerUser.fullName ?? null;
}
```

Note: The explore table displays owner as a plain string in the cell — it renders `value` as text. The `EditableOwnerCell` currently matches by comparing `String(value)` against `u.fullName || u.email`. We keep the flat string for display but Task 8 will change the save to send UUID.

- [ ] **Step 2: Migrate territory plans route — district owner**

In `src/app/api/territory-plans/[id]/route.ts`, add `ownerUser` to the district select within the plan districts include, and update the mapping:

```typescript
// In the districts include's district select, add:
ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
```

```typescript
// BEFORE (line ~279):
owner: pd.district.owner ?? null,

// AFTER:
owner: pd.district.ownerUser
  ? { id: pd.district.ownerUser.id, fullName: pd.district.ownerUser.fullName, avatarUrl: pd.district.ownerUser.avatarUrl }
  : null,
```

- [ ] **Step 3: Migrate schools routes**

In `src/app/api/schools/route.ts`, add `ownerUser` to the select and update:

```typescript
// Add to select:
ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
```

```typescript
// BEFORE:
owner: s.owner,

// AFTER:
owner: s.ownerUser
  ? { id: s.ownerUser.id, fullName: s.ownerUser.fullName, avatarUrl: s.ownerUser.avatarUrl }
  : null,
```

In `src/app/api/schools/[ncessch]/route.ts`, same pattern for the detail response.

- [ ] **Step 4: Migrate state route — territory owner**

In `src/app/api/states/[code]/route.ts`, the state detail response returns `territoryOwner` as a string (line ~132). Update:

The state is already fetched with `findUnique` — since `territoryOwnerUser` is a relation, add an include or modify to use select:

```typescript
const state = await prisma.state.findUnique({
  where: { abbrev: stateCode },
  include: {
    territoryOwnerUser: { select: { id: true, fullName: true, avatarUrl: true } },
  },
});
```

Update response (line ~132):

```typescript
// BEFORE:
territoryOwner: state.territoryOwner,

// AFTER:
territoryOwner: state.territoryOwnerUser
  ? { id: state.territoryOwnerUser.id, fullName: state.territoryOwnerUser.fullName, avatarUrl: state.territoryOwnerUser.avatarUrl }
  : state.territoryOwner
  ? { id: null, fullName: state.territoryOwner, avatarUrl: null }
  : null,
```

Note: Fallback to string for states where `territory_owner_id` hasn't been populated yet.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/explore/[entity]/route.ts src/app/api/territory-plans/[id]/route.ts src/app/api/schools/route.ts src/app/api/schools/[ncessch]/route.ts src/app/api/states/[code]/route.ts
git commit -m "feat: migrate explore, plans, schools, state routes to use person FK relations"
```

---

## Task 6: Person FK — API Write Routes

**Files:**
- Modify: `src/app/api/districts/[leaid]/edits/route.ts`
- Modify: `src/app/api/districts/batch-edits/route.ts`
- Modify: `src/app/api/schools/[ncessch]/edits/route.ts`
- Modify: `src/app/api/states/[code]/route.ts` (PUT handler)
- Modify: `src/app/api/accounts/route.ts`

- [ ] **Step 1: Migrate district edits route**

In `src/app/api/districts/[leaid]/edits/route.ts`:

```typescript
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;
    const body = await request.json();
    const { notes, ownerId } = body;

    const district = await prisma.district.update({
      where: { leaid },
      data: {
        notes: notes !== undefined ? notes : undefined,
        ownerId: ownerId !== undefined ? (ownerId || null) : undefined,
        notesUpdatedAt: new Date(),
      },
      include: {
        ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      leaid: district.leaid,
      notes: district.notes,
      owner: district.ownerUser
        ? { id: district.ownerUser.id, fullName: district.ownerUser.fullName, avatarUrl: district.ownerUser.avatarUrl }
        : null,
      updatedAt: district.notesUpdatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Error updating district edits:", error);
    return NextResponse.json(
      { error: "Failed to update district edits" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Migrate batch edits route**

In `src/app/api/districts/batch-edits/route.ts`:

```typescript
const { leaids, filters, ownerId, notes } = body as {
  leaids?: string[];
  filters?: FilterDef[];
  ownerId?: string;
  notes?: string;
};

// ...

if (ownerId === undefined && notes === undefined) {
  return NextResponse.json(
    { error: "At least one of ownerId or notes must be provided" },
    { status: 400 }
  );
}

// ...

const data: Record<string, unknown> = { notesUpdatedAt: new Date() };
if (ownerId !== undefined) data.ownerId = ownerId || null;
if (notes !== undefined) data.notes = notes || null;
```

- [ ] **Step 3: Migrate school edits route**

In `src/app/api/schools/[ncessch]/edits/route.ts`:

```typescript
const { ownerId, notes } = body;

const school = await prisma.school.update({
  where: { ncessch },
  data: {
    ownerId: ownerId !== undefined ? (ownerId || null) : undefined,
    notes: notes !== undefined ? notes : undefined,
    notesUpdatedAt: new Date(),
  },
  include: {
    ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
  },
});

return NextResponse.json({
  ncessch: school.ncessch,
  notes: school.notes,
  owner: school.ownerUser
    ? { id: school.ownerUser.id, fullName: school.ownerUser.fullName, avatarUrl: school.ownerUser.avatarUrl }
    : null,
  updatedAt: school.updatedAt.toISOString(),
});
```

- [ ] **Step 4: Migrate state PUT route**

In `src/app/api/states/[code]/route.ts` PUT handler, accept `territoryOwnerId`:

```typescript
const { notes, territoryOwnerId } = body;

// When creating a new state:
state = await prisma.state.create({
  data: {
    fips: district.stateFips,
    abbrev: stateCode,
    name: STATE_NAMES[stateCode] || stateCode,
    notes: notes ?? undefined,
    territoryOwnerId: territoryOwnerId ?? undefined,
  },
  include: {
    territoryOwnerUser: { select: { id: true, fullName: true, avatarUrl: true } },
  },
});

// When updating:
state = await prisma.state.update({
  where: { abbrev: stateCode },
  data: {
    ...(notes !== undefined && { notes }),
    ...(territoryOwnerId !== undefined && { territoryOwnerId: territoryOwnerId || null }),
  },
  include: {
    territoryOwnerUser: { select: { id: true, fullName: true, avatarUrl: true } },
  },
});

return NextResponse.json({
  code: state.abbrev,
  notes: state.notes,
  territoryOwner: state.territoryOwnerUser
    ? { id: state.territoryOwnerUser.id, fullName: state.territoryOwnerUser.fullName, avatarUrl: state.territoryOwnerUser.avatarUrl }
    : null,
});
```

- [ ] **Step 5: Migrate accounts route**

In `src/app/api/accounts/route.ts`, change `salesExecutive` to `salesExecutiveId`:

```typescript
const {
  name,
  accountType,
  stateAbbrev,
  street,
  city,
  state,
  zip,
  lat,
  lng,
  salesExecutiveId,
  phone,
  websiteUrl,
} = body;

// ...

const newAccount = await prisma.district.create({
  data: {
    leaid,
    name: name.trim(),
    accountType,
    stateAbbrev: resolvedStateAbbrev,
    stateFips,
    streetLocation: street || null,
    cityLocation: city || null,
    stateLocation: state || null,
    zipLocation: zip || null,
    salesExecutiveId: salesExecutiveId || null,
    phone: phone || null,
    websiteUrl: websiteUrl || null,
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/districts/[leaid]/edits/route.ts src/app/api/districts/batch-edits/route.ts src/app/api/schools/[ncessch]/edits/route.ts src/app/api/states/[code]/route.ts src/app/api/accounts/route.ts
git commit -m "feat: migrate write routes to accept UUID person FKs"
```

---

## Task 7: Sales Executives Route Migration

**Files:**
- Modify: `src/app/api/sales-executives/route.ts`

The current route queries distinct `sales_executive` strings from districts. Replace with a query from `user_profiles` that returns user IDs (so the filter dropdown can send UUIDs).

- [ ] **Step 1: Rewrite route**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Return all team members as potential sales exec filter options
    const users = await prisma.userProfile.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching sales executives:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales executives" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/sales-executives/route.ts
git commit -m "feat: migrate sales-executives route to query user_profiles"
```

---

## Task 8: Frontend — Query Hooks and Filter Map

**Files:**
- Modify: `src/features/districts/lib/queries.ts`
- Modify: `src/features/explore/lib/filters.ts`
- Modify: `src/features/map/lib/queries.ts`
- Modify: `src/features/shared/lib/queries.ts`

- [ ] **Step 1: Update district mutation hooks**

In `src/features/districts/lib/queries.ts`:

```typescript
// Update useUpdateDistrictEdits:
export function useUpdateDistrictEdits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      leaid,
      notes,
      ownerId,
    }: {
      leaid: string;
      notes?: string;
      ownerId?: string;
    }) =>
      fetchJson<DistrictEdits>(`${API_BASE}/districts/${leaid}/edits`, {
        method: "PUT",
        body: JSON.stringify({ notes, ownerId }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["district", variables.leaid] });
    },
  });
}

// Update BatchEditParams:
interface BatchEditParams {
  leaids?: string[];
  filters?: { column: string; op: string; value?: unknown }[];
  ownerId?: string;
  notes?: string;
}

export function useBatchEditDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leaids, filters, ownerId, notes }: BatchEditParams) =>
      fetchJson<{ updated: number }>(`${API_BASE}/districts/batch-edits`, {
        method: "POST",
        body: JSON.stringify({ leaids, filters, ownerId, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["explore"] });
    },
  });
}
```

- [ ] **Step 2: Update filter map**

In `src/features/explore/lib/filters.ts`, update the owner and salesExecutive mappings:

```typescript
// BEFORE:
owner: "owner",
// ...
salesExecutive: "salesExecutive",

// AFTER:
owner: "ownerId",
// ...
salesExecutive: "salesExecutiveId",
```

Note: This changes the Prisma where clause generated by `buildWhereClause`. Filters on `owner` will now match against `ownerId` (UUID), and `salesExecutive` will match against `salesExecutiveId` (UUID). The explore filter UI sends user IDs after Task 9.

- [ ] **Step 3: Update state mutation**

In `src/features/map/lib/queries.ts`, update the state update mutation:

```typescript
// BEFORE:
mutationFn: ({
  stateCode,
  notes,
  territoryOwner,
}: {
  stateCode: string;
  notes?: string;
  territoryOwner?: string;
}) =>
  fetchJson<{ code: string; notes: string | null; territoryOwner: string | null }>(
    ...
    body: JSON.stringify({ notes, territoryOwner }),
  ),

// AFTER:
mutationFn: ({
  stateCode,
  notes,
  territoryOwnerId,
}: {
  stateCode: string;
  notes?: string;
  territoryOwnerId?: string;
}) =>
  fetchJson<{ code: string; notes: string | null; territoryOwner: { id: string; fullName: string | null; avatarUrl: string | null } | null }>(
    `${API_BASE}/states/${stateCode}`,
    {
      method: "PUT",
      body: JSON.stringify({ notes, territoryOwnerId }),
    }
  ),
```

- [ ] **Step 4: Update useSalesExecutives return type**

In `src/features/shared/lib/queries.ts`:

```typescript
// BEFORE:
export function useSalesExecutives() {
  return useQuery({
    queryKey: ["salesExecutives"],
    queryFn: () => fetchJson<string[]>(`${API_BASE}/sales-executives`),
    staleTime: 60 * 60 * 1000,
  });
}

// AFTER:
export function useSalesExecutives() {
  return useQuery({
    queryKey: ["salesExecutives"],
    queryFn: () => fetchJson<{ id: string; fullName: string | null; email: string }[]>(`${API_BASE}/sales-executives`),
    staleTime: 60 * 60 * 1000,
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/districts/lib/queries.ts src/features/explore/lib/filters.ts src/features/map/lib/queries.ts src/features/shared/lib/queries.ts
git commit -m "feat: update frontend query hooks and filter map for UUID person FKs"
```

---

## Task 9: Frontend — Component Updates

**Files:**
- Modify: `src/features/districts/components/NotesEditor.tsx`
- Modify: `src/features/map/components/explore/cellRenderers.tsx`
- Modify: `src/features/map/components/explore/BulkActionBar.tsx`
- Modify: `src/features/shared/components/filters/FilterBar.tsx`

- [ ] **Step 1: Migrate NotesEditor — replace text input with user dropdown**

Replace the entire `NotesEditor.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useUpdateDistrictEdits } from "@/features/districts/lib/queries";
import { useUsers } from "@/features/shared/lib/queries";
import type { DistrictEdits } from "@/features/shared/types/api-types";

interface NotesEditorProps {
  leaid: string;
  edits: DistrictEdits | null;
}

export default function NotesEditor({ leaid, edits }: NotesEditorProps) {
  const [notes, setNotes] = useState(edits?.notes || "");
  const [ownerId, setOwnerId] = useState(edits?.owner?.id || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const ownerRef = useRef<HTMLDivElement>(null);

  const updateMutation = useUpdateDistrictEdits();
  const { data: users } = useUsers();

  useEffect(() => {
    setNotes(edits?.notes || "");
    setOwnerId(edits?.owner?.id || "");
    setIsDirty(false);
  }, [edits]);

  // Close owner dropdown on outside click
  useEffect(() => {
    if (!isOwnerOpen) return;
    const handler = (e: MouseEvent) => {
      if (ownerRef.current && !ownerRef.current.contains(e.target as Node)) {
        setIsOwnerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOwnerOpen]);

  const ownerDisplay = ownerId
    ? users?.find((u) => u.id === ownerId)?.fullName || "Unknown"
    : null;

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ leaid, notes, ownerId: ownerId || undefined });
      setIsEditing(false);
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save:", error);
    }
  };

  const handleCancel = () => {
    setNotes(edits?.notes || "");
    setOwnerId(edits?.owner?.id || "");
    setIsEditing(false);
    setIsDirty(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[#403770]">Notes & Owner</h3>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-[#F37167] hover:text-[#403770] font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          {/* Owner dropdown */}
          <div ref={ownerRef}>
            <label className="block text-xs text-gray-500 mb-1">Owner</label>
            <button
              type="button"
              onClick={() => setIsOwnerOpen((o) => !o)}
              className="w-full px-3 py-2 text-sm text-left border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
            >
              {ownerDisplay || <span className="text-gray-400">Select owner...</span>}
            </button>
            {isOwnerOpen && (
              <div className="mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-20 relative">
                <button
                  onClick={() => { setOwnerId(""); setIsOwnerOpen(false); setIsDirty(true); }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-400 italic hover:bg-gray-50"
                >
                  — Unassigned —
                </button>
                {(users || []).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { setOwnerId(u.id); setIsOwnerOpen(false); setIsDirty(true); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      ownerId === u.id ? "text-[#403770] font-medium bg-[#403770]/5" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {u.fullName || u.email}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Add notes about this district..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-[#403770]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
              className="px-3 py-1.5 text-sm bg-[#F37167] text-white rounded-md hover:bg-[#e05f55] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Owner Display */}
          <div>
            <span className="text-xs text-gray-500">Owner</span>
            <p className="text-sm text-[#403770]">
              {edits?.owner?.fullName || (
                <span className="text-gray-400 italic">No owner assigned</span>
              )}
            </p>
          </div>

          {/* Notes Display */}
          <div>
            <span className="text-xs text-gray-500">Notes</span>
            {notes ? (
              <p className="text-sm text-[#403770] whitespace-pre-wrap">
                {notes}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No notes</p>
            )}
          </div>

          {/* Last updated */}
          {edits?.updatedAt && (
            <p className="text-xs text-gray-400 mt-2" suppressHydrationWarning>
              Last updated:{" "}
              {new Date(edits.updatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Migrate EditableOwnerCell — send UUID**

In `src/features/map/components/explore/cellRenderers.tsx`, update `EditableOwnerCell`:

Change the `onSave` type:

```typescript
// BEFORE:
onSave: (rowId: string, column: string, value: string) => void;

// AFTER (no change to signature — the value IS now the UUID):
onSave: (rowId: string, column: string, value: string) => void;
```

Change the unassigned button:

```typescript
// BEFORE:
onClick={(e) => { e.stopPropagation(); onSave(rowId, "owner", ""); close(); }}

// AFTER (same — empty string means unassign):
onClick={(e) => { e.stopPropagation(); onSave(rowId, "ownerId", ""); close(); }}
```

Change the user buttons:

```typescript
// BEFORE:
onClick={(e) => { e.stopPropagation(); onSave(rowId, "owner", display); close(); }}

// AFTER:
onClick={(e) => { e.stopPropagation(); onSave(rowId, "ownerId", u.id); close(); }}
```

The `handleSave` callbacks in both `PlanExpansionRow` and `useDistrictCellRenderers` call `updateEdits.mutate({ leaid: rowId, [column]: value || undefined })`. Since `column` is now `"ownerId"`, this will correctly send `{ leaid, ownerId: "uuid" }` to the mutation.

- [ ] **Step 3: Migrate BulkActionBar — queue UUID**

In `src/features/map/components/explore/BulkActionBar.tsx`:

Update `handleSelectOwner` to pass user ID:

```typescript
// BEFORE:
const handleSelectOwner = (name: string, display: string) => {
  setQueuedOwner({ name, display });

// AFTER:
const handleSelectOwner = (id: string, display: string) => {
  setQueuedOwner({ name: id, display });
```

Update the apply logic (line ~197):

```typescript
// BEFORE:
promises.push(batchEdit.mutateAsync({ ...target, owner: queuedOwner.name }));

// AFTER:
promises.push(batchEdit.mutateAsync({ ...target, ownerId: queuedOwner.name }));
```

Update the user buttons in the popover (line ~400):

```typescript
// BEFORE:
onClick={() => handleSelectOwner(display, display)}

// AFTER:
onClick={() => handleSelectOwner(u.id, display)}
```

Update the unassigned button (line ~386):

```typescript
// BEFORE:
onClick={() => handleSelectOwner("", "Unassigned")}

// AFTER — same (empty string means unassign):
onClick={() => handleSelectOwner("", "Unassigned")}
```

Update the "selected" check (line ~396):

```typescript
// BEFORE:
const selected = queuedOwner?.name === display;

// AFTER:
const selected = queuedOwner?.name === u.id;
```

- [ ] **Step 4: Migrate FilterBar — sales exec dropdown**

In `src/features/shared/components/filters/FilterBar.tsx`, the sales exec filter currently fetches `/api/sales-executives` which returns string names. After Task 7, it returns `{ id, fullName, email }` objects.

Update the state and fetch:

```typescript
// BEFORE:
const [owners, setOwners] = useState<string[]>([]);
// ...
fetch("/api/sales-executives")
  .then((r) => (r.ok ? r.json() : []))
  .then((data) =>
    setOwners(
      data.map?.((d: Record<string, unknown>) => d.name || d) || [],
    ),
  )

// AFTER:
const [salesExecs, setSalesExecs] = useState<{ id: string; fullName: string | null; email: string }[]>([]);
// ...
fetch("/api/sales-executives")
  .then((r) => (r.ok ? r.json() : []))
  .then((data) => setSalesExecs(data || []))
```

Update the select dropdown (the `<select>` element currently has `<option value={owner}>`):

```typescript
// BEFORE:
<option value="">All Sales Execs</option>
{owners.map((owner) => (
  <option key={owner} value={owner}>
    {owner}
  </option>
))}

// AFTER:
<option value="">All Sales Execs</option>
{salesExecs.map((user) => (
  <option key={user.id} value={user.id}>
    {user.fullName || user.email}
  </option>
))}
```

The select's `onChange` sends the value (now a UUID) as the `salesExec` query param, which the districts route filters by `salesExecutiveId`.

- [ ] **Step 5: Update FullmindCard and DistrictHeader — render salesExecutive.fullName**

In `src/features/map/components/panels/district/FullmindCard.tsx` (line ~41):

```tsx
// BEFORE:
SE: <span className="font-medium text-[#403770]">{data.fullmindData.salesExecutive}</span>

// AFTER:
SE: <span className="font-medium text-[#403770]">{data.fullmindData.salesExecutive?.fullName}</span>
```

Also update the truthiness check (line ~39):

```tsx
// BEFORE:
{data.fullmindData?.salesExecutive && (

// AFTER:
{data.fullmindData?.salesExecutive?.fullName && (
```

In `src/features/districts/components/DistrictHeader.tsx` (line ~156-160):

```tsx
// BEFORE:
{fullmindData?.salesExecutive && (
  ...
  {fullmindData.salesExecutive}

// AFTER:
{fullmindData?.salesExecutive?.fullName && (
  ...
  {fullmindData.salesExecutive.fullName}
```

- [ ] **Step 6: Update SearchBar dropdowns — parse new sales-executives response**

In `src/features/map/components/SearchBar/FullmindDropdown.tsx` (line ~28):

```typescript
// BEFORE:
.then((data) => setOwners(data.map?.((d: any) => d.name || d) || []))

// AFTER:
.then((data) => setOwners(data.map?.((d: { id: string; fullName: string | null; email: string }) => ({ id: d.id, name: d.fullName || d.email })) || []))
```

Update the `owners` state type and the dropdown filter chip to send `user.id`:

```typescript
// BEFORE:
const [owners, setOwners] = useState<string[]>([]);

// AFTER:
const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
```

Update where the filter chip sends the value — the `column="salesExecutive"` filter should send the UUID as the value:

```tsx
// The filter chip's value should be the user ID, display should be the name.
// Update the filter option rendering to use owner.id as value and owner.name as label.
```

In `src/features/map/components/SearchBar/DistrictsDropdown.tsx` (line ~87-89), apply the same pattern.

- [ ] **Step 7: Update AccountForm — send salesExecutiveId**

In `src/features/map/components/panels/AccountForm.tsx`, the form collects `salesExecutive` as a text input. Update to use a user dropdown and send UUID.

Update state (line ~25):

```typescript
// BEFORE:
const [salesExecutive, setSalesExecutive] = useState("");

// AFTER:
const [salesExecutiveId, setSalesExecutiveId] = useState("");
```

Import and use the users query to provide a dropdown instead of free text:

```typescript
import { useUsers } from "@/features/shared/lib/queries";
// ...
const { data: users } = useUsers();
```

Update the submit handler (line ~54):

```typescript
// BEFORE:
salesExecutive: salesExecutive || undefined,

// AFTER:
salesExecutiveId: salesExecutiveId || undefined,
```

Replace the text input (line ~255) with a `<select>`:

```tsx
<select
  value={salesExecutiveId}
  onChange={(e) => setSalesExecutiveId(e.target.value)}
  className="..."
>
  <option value="">Select sales executive...</option>
  {(users || []).map((u) => (
    <option key={u.id} value={u.id}>
      {u.fullName || u.email}
    </option>
  ))}
</select>
```

Also update `useCreateAccount` in `src/features/districts/lib/queries.ts`:

```typescript
// BEFORE (in the mutationFn type):
salesExecutive?: string;

// AFTER:
salesExecutiveId?: string;
```

- [ ] **Step 8: Commit**

```bash
git add src/features/districts/components/NotesEditor.tsx src/features/map/components/explore/cellRenderers.tsx src/features/map/components/explore/BulkActionBar.tsx src/features/shared/components/filters/FilterBar.tsx src/features/map/components/panels/district/FullmindCard.tsx src/features/districts/components/DistrictHeader.tsx src/features/map/components/SearchBar/FullmindDropdown.tsx src/features/map/components/SearchBar/DistrictsDropdown.tsx src/features/map/components/panels/AccountForm.tsx src/features/districts/lib/queries.ts
git commit -m "feat: migrate frontend components to send UUID for owner/salesExec"
```

---

## Task 10: Update Tests

**Files:**
- Modify: `src/app/api/territory-plans/__tests__/route.test.ts`

- [ ] **Step 1: Update territory plan test mock — district owner**

Line ~116 already expects `owner` as `{ id, fullName, avatarUrl }` — that's the plan owner (already UUID-based). But line ~311 has a district mock with `owner: null` as a string field. Update the mock district to use `ownerUser`:

```typescript
// BEFORE (line ~307-312):
district: {
  name: "Test District",
  stateAbbrev: "CA",
  enrollment: 1000,
  owner: null,
  districtTags: [],
},

// AFTER:
district: {
  name: "Test District",
  stateAbbrev: "CA",
  enrollment: 1000,
  ownerUser: null,
  districtTags: [],
},
```

Also update the expected response assertion for the district's `owner` field in the GET plan test to match the new PersonRef shape.

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass. Fix any additional type errors or assertion mismatches discovered.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: update tests for person FK migration"
```

---

## Task 11: Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test district detail panel**

Navigate to a district. Verify:
- Owner shows as a name (from user_profiles), not "No owner assigned" for districts with known owners
- Sales Executive shows as a name
- Editing owner shows a dropdown of team members
- Saving owner persists and refreshes correctly

- [ ] **Step 3: Test explore table**

Open the explore table. Verify:
- Owner column shows names
- Clicking owner cell shows user dropdown
- Selecting a user saves correctly
- Bulk action bar → assign owner works

- [ ] **Step 4: Test filters**

- Sales Exec filter dropdown shows team member names
- Filtering by a sales exec returns correct districts
- Competitor presence/absence filters work in search

- [ ] **Step 5: Test state panel**

Navigate to a state. Verify:
- Territory owner shows (if assigned)
- Territory plan owner shows correctly

- [ ] **Step 6: Test auto-tags**

If you can trigger tag sync (via admin or CLI), verify:
- Classification tags (Fullmind Return, Churn Risk, etc.) still applied correctly
- Competitor tags (EK12, Proximity, etc.) still applied correctly
