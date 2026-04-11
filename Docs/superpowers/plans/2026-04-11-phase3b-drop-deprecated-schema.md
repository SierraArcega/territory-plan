# Phase 3b: Drop Deprecated Columns and Tables

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all deprecated columns, tables, and string fallback patterns from the Prisma schema and application code, now that Phase 3a has migrated all consumers to the normalized shape.

**Architecture:** Remove code references first (stateLocation, string person fallbacks), then strip the Prisma schema, then generate a migration. The migration should be reviewed before applying to production — the Python ETL dual-write stop is Phase 3c.

**Tech Stack:** Prisma, TypeScript, Next.js App Router

**Spec:** `Docs/superpowers/specs/2026-04-11-phase3-schema-cleanup-design.md` (Phase 3b section)

---

### Task 1: Remove `stateLocation` from all code

`stateLocation` is a `VarChar(2)` state abbreviation — identical to `stateAbbrev` which is already on every district. Replace all reads with `stateAbbrev`.

**Files:**
- Modify: `src/features/shared/types/api-types.ts:20`
- Modify: `src/app/api/districts/[leaid]/route.ts:76`
- Modify: `src/app/api/districts/route.ts:131,156`
- Modify: `src/app/api/contacts/clay-lookup/route.ts:42,79`
- Modify: `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts:102,162`
- Modify: `src/app/api/accounts/route.ts:93`
- Modify: `src/features/districts/components/DistrictInfo.tsx:33,83,88-89`
- Modify: `src/features/map/components/panels/district/DistrictDetailsCard.tsx:42`
- Modify: `src/features/map/components/SearchBar/index.tsx:21,184`

- [ ] **Step 1: Remove `stateLocation` from District type**

In `src/features/shared/types/api-types.ts`, delete line 20:
```ts
  stateLocation: string | null;
```

- [ ] **Step 2: Replace `stateLocation` with `stateAbbrev` in API routes**

In `src/app/api/districts/[leaid]/route.ts`, remove `stateLocation: district.stateLocation,` from the response (line 76). The response already includes `stateAbbrev` at line 68.

In `src/app/api/districts/route.ts`:
- Remove `stateLocation: true,` from the Prisma select (line 131)
- Remove `stateLocation: d.stateLocation,` from the response mapping (line 156)

In `src/app/api/contacts/clay-lookup/route.ts`:
- Remove `stateLocation: true,` from the Prisma select (line 42)
- Change `state_full: district.stateLocation,` to `state_full: district.stateAbbrev,` (line 79)

In `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts`:
- Remove `stateLocation: true,` from the Prisma select (line 102)
- Change `district.stateLocation` to `district.stateAbbrev` (line 162)

In `src/app/api/accounts/route.ts`:
- Remove `stateLocation: null,` from the response (line 93)

- [ ] **Step 3: Replace `stateLocation` with `stateAbbrev` in frontend components**

In `src/features/districts/components/DistrictInfo.tsx`:
- Replace all `district.stateLocation` with `district.stateAbbrev` (lines 33, 83, 88-89)

In `src/features/map/components/panels/district/DistrictDetailsCard.tsx`:
- Replace `d.stateLocation` with `d.stateAbbrev` in the address display (line 42)

In `src/features/map/components/SearchBar/index.tsx`:
- Remove `stateLocation` from the `DistrictSuggestion` interface (line 21)
- Replace `stateLocation` usage with `stateAbbrev` in location query (line 184)

- [ ] **Step 4: Run type check**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx tsc --noEmit`

Expected: No type errors (stateLocation is fully removed from types and code).

- [ ] **Step 5: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add -A && git commit -m "feat: remove stateLocation, replace with stateAbbrev"
```

---

### Task 2: Remove string person column fallback patterns

The district detail and state routes still fall back to string `salesExecutive`/`territoryOwner` when the UUID FK is null. Now that Phase 2b populated all FKs, remove these fallbacks.

**Files:**
- Modify: `src/app/api/districts/[leaid]/route.ts:94-98`
- Modify: `src/app/api/states/[code]/route.ts:135-138`

- [ ] **Step 1: Simplify district detail salesExecutive response**

In `src/app/api/districts/[leaid]/route.ts`, replace the fallback block (lines 94-98):

```ts
        salesExecutive: district.salesExecutiveUser
          ? { id: district.salesExecutiveUser.id, fullName: district.salesExecutiveUser.fullName, avatarUrl: district.salesExecutiveUser.avatarUrl }
          : district.salesExecutive
          ? { id: null, fullName: district.salesExecutive, avatarUrl: null }
          : null,
```

With:

```ts
        salesExecutive: district.salesExecutiveUser
          ? { id: district.salesExecutiveUser.id, fullName: district.salesExecutiveUser.fullName, avatarUrl: district.salesExecutiveUser.avatarUrl }
          : null,
```

- [ ] **Step 2: Simplify state detail territoryOwner response**

In `src/app/api/states/[code]/route.ts`, find the similar fallback pattern for `territoryOwner` and simplify it the same way — return the FK relation user or null, no string fallback.

- [ ] **Step 3: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add -A && git commit -m "feat: remove string person column fallbacks from routes"
```

---

### Task 3: Remove deprecated columns from District model in Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove 18 FY columns from District model**

Delete lines 54-77 (the FY25/FY26/FY27 session, booking, and pipeline columns):

```prisma
  // FY25 Sessions
  fy25SessionsRevenue      Decimal? @default(0) @map("fy25_sessions_revenue") @db.Decimal(15, 2)
  fy25SessionsTake         Decimal? @default(0) @map("fy25_sessions_take") @db.Decimal(15, 2)
  fy25SessionsCount        Int?     @default(0) @map("fy25_sessions_count")
  // FY26 Sessions
  fy26SessionsRevenue      Decimal? @default(0) @map("fy26_sessions_revenue") @db.Decimal(15, 2)
  fy26SessionsTake         Decimal? @default(0) @map("fy26_sessions_take") @db.Decimal(15, 2)
  fy26SessionsCount        Int?     @default(0) @map("fy26_sessions_count")
  // FY25 Bookings
  fy25ClosedWonOppCount    Int?     @default(0) @map("fy25_closed_won_opp_count")
  fy25ClosedWonNetBooking  Decimal? @default(0) @map("fy25_closed_won_net_booking") @db.Decimal(15, 2)
  fy25NetInvoicing         Decimal? @default(0) @map("fy25_net_invoicing") @db.Decimal(15, 2)
  // FY26 Bookings
  fy26ClosedWonOppCount    Int?     @default(0) @map("fy26_closed_won_opp_count")
  fy26ClosedWonNetBooking  Decimal? @default(0) @map("fy26_closed_won_net_booking") @db.Decimal(15, 2)
  fy26NetInvoicing         Decimal? @default(0) @map("fy26_net_invoicing") @db.Decimal(15, 2)
  // FY26 Pipeline
  fy26OpenPipelineOppCount Int?     @default(0) @map("fy26_open_pipeline_opp_count")
  fy26OpenPipeline         Decimal? @default(0) @map("fy26_open_pipeline") @db.Decimal(15, 2)
  fy26OpenPipelineWeighted Decimal? @default(0) @map("fy26_open_pipeline_weighted") @db.Decimal(15, 2)
  // FY27 Pipeline
  fy27OpenPipelineOppCount Int?     @default(0) @map("fy27_open_pipeline_opp_count")
  fy27OpenPipeline         Decimal? @default(0) @map("fy27_open_pipeline") @db.Decimal(15, 2)
  fy27OpenPipelineWeighted Decimal? @default(0) @map("fy27_open_pipeline_weighted") @db.Decimal(15, 2)
```

- [ ] **Step 2: Remove `salesExecutive` string column**

Delete line 52:
```prisma
  salesExecutive           String?  @map("sales_executive") @db.VarChar(100)
```

Also find and remove the `@@index([salesExecutive])` if it exists (search for `salesExecutive` in the indexes section).

- [ ] **Step 3: Remove `stateLocation` column**

Delete line 30:
```prisma
  stateLocation      String?  @map("state_location") @db.VarChar(2)
```

- [ ] **Step 4: Remove `owner` string column**

Delete line 161:
```prisma
  owner          String?   @db.VarChar(100)
```

Note: The `ownerId` UUID FK and `ownerUser` relation remain (lines 165-167).

- [ ] **Step 5: Remove `competitorSpend` relation from District**

Delete line 278:
```prisma
  competitorSpend  CompetitorSpend[]
```

- [ ] **Step 6: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add prisma/schema.prisma && git commit -m "feat: remove deprecated FY, person string, and stateLocation columns from District model"
```

---

### Task 4: Remove CompetitorSpend model from Prisma schema

**Files:**
- Modify: `prisma/schema.prisma:321-339`

- [ ] **Step 1: Delete the entire CompetitorSpend model**

Delete lines 321-339:

```prisma
// ===== Competitor Spend =====
// Tracks competitor purchase order spend by district, competitor, and fiscal year
// Source: GovSpend PO data via ETL
model CompetitorSpend {
  id          Int      @id @default(autoincrement())
  leaid       String   @db.VarChar(7)
  competitor  String   @db.VarChar(50)
  fiscalYear  String   @map("fiscal_year") @db.VarChar(4)
  totalSpend  Decimal  @map("total_spend") @db.Decimal(12, 2)
  poCount     Int      @map("po_count")
  lastUpdated DateTime @default(now()) @map("last_updated")

  district District @relation(fields: [leaid], references: [leaid])

  @@unique([leaid, competitor, fiscalYear])
  @@index([leaid])
  @@index([competitor, fiscalYear])
  @@map("competitor_spend")
}
```

Note: The `competitor_spend` table stays in the DB until the migration runs. The Prisma client just won't generate types for it anymore.

- [ ] **Step 2: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add prisma/schema.prisma && git commit -m "feat: remove CompetitorSpend model from Prisma schema"
```

---

### Task 5: Remove deprecated columns from other models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove FY columns from UnmatchedAccount**

Delete lines 414-417:
```prisma
  fy25NetInvoicing   Decimal  @default(0) @map("fy25_net_invoicing") @db.Decimal(15, 2)
  fy26NetInvoicing   Decimal  @default(0) @map("fy26_net_invoicing") @db.Decimal(15, 2)
  fy26OpenPipeline   Decimal  @default(0) @map("fy26_open_pipeline") @db.Decimal(15, 2)
  fy27OpenPipeline   Decimal  @default(0) @map("fy27_open_pipeline") @db.Decimal(15, 2)
```

- [ ] **Step 2: Remove `salesExecutive` string from UnmatchedAccount**

Delete line 407:
```prisma
  salesExecutive     String?  @map("sales_executive") @db.VarChar(100)
```

The `salesExecutiveId` FK remains (line 408).

- [ ] **Step 3: Remove `territoryOwner` string from State**

Delete line 479:
```prisma
  territoryOwner String? @map("territory_owner") @db.VarChar(100)
```

The `territoryOwnerId` FK and `territoryOwnerUser` relation remain (lines 480-481).

- [ ] **Step 4: Remove `owner` string from School**

Delete line 1136:
```prisma
  owner          String?   @db.VarChar(100)
```

The `ownerId` FK and `ownerUser` relation remain (lines 1137-1138).

- [ ] **Step 5: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add prisma/schema.prisma && git commit -m "feat: remove deprecated FY and person string columns from UnmatchedAccount, State, School"
```

---

### Task 6: Remove remaining code references to dropped fields

After removing schema fields, Prisma will no longer generate types for them. Find and fix any code that still references them.

**Files:**
- Modify: `src/app/api/explore/[entity]/route.ts` (FY field assignments in explore row output)
- Modify: `src/features/explore/lib/filters.ts` (FY column mappings)
- Any other files that reference removed Prisma fields

- [ ] **Step 1: Run Prisma generate to update client types**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx prisma generate`

- [ ] **Step 2: Run type check to find breakages**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx tsc --noEmit 2>&1 | head -60`

Expected: Type errors in files that still reference removed Prisma fields. Fix each one.

Known files that will need updates:
- The explore route assigns flat FY keys to the row object — these keys are now just plain object properties (not Prisma-typed), so they should still work. But verify.
- The explore filters map may reference Prisma field names — update if broken.
- Any route that selects `salesExecutive`, `owner`, `stateLocation`, or `territoryOwner` from Prisma will fail.

- [ ] **Step 3: Fix any type errors found**

For each erroring file, remove or replace the reference to the dropped field. Common patterns:
- Remove `salesExecutive: true` from Prisma selects (the FK relation `salesExecutiveUser` stays)
- Remove `owner: true` from Prisma selects (the FK relation `ownerUser` stays)
- Remove `stateLocation: true` from Prisma selects (already handled in Task 1, but double-check)
- Remove `territoryOwner: true` from Prisma selects

- [ ] **Step 4: Run type check again**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx tsc --noEmit`

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add -A && git commit -m "fix: remove remaining references to dropped Prisma fields"
```

---

### Task 7: Run full test suite and verify

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run`

Expected: All tests pass. If any fail due to removed fields in test mocks, update the mocks.

- [ ] **Step 2: Fix any test failures**

Common fixes:
- Remove FY fields from mock objects in test files
- Remove `salesExecutive`/`owner` string fields from test mocks
- Remove `stateLocation` from test mocks

- [ ] **Step 3: Run tests again if fixes were needed**

Run: `cd /Users/sierraarcega/territory-plan-db-normalization && npx vitest run`

Expected: All tests pass.

- [ ] **Step 4: Commit if fixes were made**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add -A && git commit -m "test: update test mocks for removed schema fields"
```

---

### Task 8: Delete `district_vendor_comparison` view script

**Files:**
- Delete: `scripts/vendor-comparison-view.sql`

- [ ] **Step 1: Delete the SQL script**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && rm scripts/vendor-comparison-view.sql
```

Note: The actual materialized view in the database should be dropped via a migration or manually. Add a comment to the migration file noting `DROP MATERIALIZED VIEW IF EXISTS district_vendor_comparison;` should be included.

- [ ] **Step 2: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add -A && git commit -m "feat: remove district_vendor_comparison view script"
```

---

### Task 9: Update spec with Phase 3b completion status

**Files:**
- Modify: `Docs/superpowers/specs/2026-04-01-db-normalization-claude-query-tool-design.md`
- Modify: `Docs/superpowers/specs/2026-04-11-phase3-schema-cleanup-design.md`

- [ ] **Step 1: Update the parent spec**

In the Phase 3 section of the parent spec, mark Phase 3b items as complete.

- [ ] **Step 2: Update the Phase 3 spec**

Add completion status to the Phase 3b section header.

- [ ] **Step 3: Commit**

```bash
cd /Users/sierraarcega/territory-plan-db-normalization && git add -A && git commit -m "docs: update specs with Phase 3b completion status"
```
