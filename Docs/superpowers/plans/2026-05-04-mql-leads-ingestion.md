# MQL Leads Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the 4.21.26 MQL CSV into a generalized `leads` table, log each rep's outreach attempt as a `lead_outreach` activity, and surface the leads as a new MQL category on the Low Hanging Fruit page.

**Architecture:** New `Lead` model with a `type` discriminator (`mql` | `inbound`) so the same table covers future inbound flows. Status (new/recent/stale/expired) is computed from `capturedAt`, not stored. LHF API gains a 4th SQL block that returns districts with active (non-expired) MQL leads, joined with their contacts; LHF UI gains an MQL category, color, sort priority, and an inline contact list rendered under the district name on MQL rows.

**Tech Stack:** Prisma 6, PostgreSQL, Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Vitest, csv-parse, tsx.

**Spec:** `Docs/superpowers/specs/2026-05-04-mql-leads-ingestion-design.md`

---

## Task 1: Create feature branch

**Files:** None — git only.

- [ ] **Step 1: Create branch off main**

```bash
git checkout main
git pull --ff-only
git checkout -b feat/mql-leads-ingestion
```

Expected: `Switched to a new branch 'feat/mql-leads-ingestion'`

---

## Task 2: Add `Lead` model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` — add `Lead` model + back-relations on `Contact`, `UserProfile`, `Activity`

- [ ] **Step 1: Locate the `Contact` model and add the back-relation**

Open `prisma/schema.prisma`. Find the `Contact` block (around the `model Contact {` declaration). Add this line inside the model block, just below the existing `newsArticles NewsArticleContact[]` line:

```prisma
  leads          Lead[]
```

- [ ] **Step 2: Locate the `UserProfile` model and add the back-relation**

Find the `model UserProfile {` block. Add this line at the end of the model body, just before the closing `}`:

```prisma
  claimedLeads   Lead[]               @relation("LeadClaimedBy")
```

- [ ] **Step 3: Locate the `Activity` model and add the back-relation**

Find the `model Activity {` block. Add this line at the end of the model body, just before the closing `}`:

```prisma
  lead           Lead?
```

(Singular relation — one activity is referenced by at most one lead.)

- [ ] **Step 4: Add the `Lead` model**

Insert a new model block. Place it directly after the `Contact` model so related models are colocated:

```prisma
model Lead {
  id              Int       @id @default(autoincrement())
  contactId       Int       @map("contact_id")
  type            String    @db.VarChar(20) // "mql" | "inbound"
  score           Int?
  sourceCampaign  String?   @map("source_campaign") @db.VarChar(255)
  capturedAt      DateTime  @map("captured_at")
  claimedByUserId String?   @map("claimed_by_user_id") @db.Uuid
  disposition     String?   @db.VarChar(20) // "qualified" | "unqualified" | null
  importBatch     String?   @map("import_batch") @db.VarChar(20)
  activityId      String?   @unique @map("activity_id") @db.Uuid
  createdAt       DateTime  @default(now()) @map("created_at")

  contact   Contact      @relation(fields: [contactId], references: [id], onDelete: Cascade)
  claimedBy UserProfile? @relation("LeadClaimedBy", fields: [claimedByUserId], references: [id])
  activity  Activity?    @relation(fields: [activityId], references: [id], onDelete: SetNull)

  @@unique([contactId, type, importBatch])
  @@index([contactId])
  @@index([claimedByUserId])
  @@index([capturedAt])
  @@index([type])
  @@map("leads")
}
```

- [ ] **Step 5: Run Prisma format and validate**

```bash
npx prisma format
npx prisma validate
```

Expected: both commands exit 0. `prisma format` may rewrite alignment of fields — that's fine.

- [ ] **Step 6: Commit schema change**

```bash
git add prisma/schema.prisma
git commit -m "Add Lead model with type discriminator"
```

---

## Task 3: Generate and apply Prisma migration

**Files:**
- Create: `prisma/migrations/<timestamp>_add_leads/migration.sql` (auto-generated)

- [ ] **Step 1: Generate the migration**

```bash
npx prisma migrate dev --name add_leads
```

Expected: prisma creates a new migration directory and runs it against the dev database. You should see `Applied migration ...` in the output.

- [ ] **Step 2: Verify the generated SQL**

Open the new file at `prisma/migrations/<timestamp>_add_leads/migration.sql` (the directory name will be the auto-generated timestamp). Confirm it contains a `CREATE TABLE "leads"` statement with these columns: `id`, `contact_id`, `type`, `score`, `source_campaign`, `captured_at`, `claimed_by_user_id`, `disposition`, `import_batch`, `activity_id`, `created_at`. It should also create the four indexes and two unique constraints described in the spec.

If anything is missing, the schema in Task 2 was wrong — go back and fix the schema, then `npx prisma migrate reset` and re-run `npx prisma migrate dev --name add_leads`.

- [ ] **Step 3: Verify the table exists**

```bash
psql "$DATABASE_URL" -c '\d leads'
```

Expected: shows the `leads` table with all the columns and indexes from the spec.

- [ ] **Step 4: Commit the migration**

```bash
git add prisma/migrations/
git commit -m "Migration: create leads table"
```

---

## Task 4: `leadStatus` helper + tests

**Files:**
- Create: `src/features/leaderboard/lib/lead-status.ts`
- Create: `src/features/leaderboard/lib/__tests__/lead-status.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/leaderboard/lib/__tests__/lead-status.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { leadStatus } from "../lead-status";

const NOW = new Date("2026-05-04T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000);
}

describe("leadStatus", () => {
  it("returns 'new' for leads captured today", () => {
    expect(leadStatus(NOW, NOW)).toBe("new");
  });

  it("returns 'new' just before the 14-day boundary", () => {
    expect(leadStatus(daysAgo(13), NOW)).toBe("new");
  });

  it("returns 'recent' at the 14-day boundary", () => {
    expect(leadStatus(daysAgo(14), NOW)).toBe("recent");
  });

  it("returns 'recent' just before the 45-day boundary", () => {
    expect(leadStatus(daysAgo(44), NOW)).toBe("recent");
  });

  it("returns 'stale' at the 45-day boundary", () => {
    expect(leadStatus(daysAgo(45), NOW)).toBe("stale");
  });

  it("returns 'stale' just before the 90-day boundary", () => {
    expect(leadStatus(daysAgo(89), NOW)).toBe("stale");
  });

  it("returns 'expired' at the 90-day boundary", () => {
    expect(leadStatus(daysAgo(90), NOW)).toBe("expired");
  });

  it("returns 'expired' for very old leads", () => {
    expect(leadStatus(daysAgo(365), NOW)).toBe("expired");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- src/features/leaderboard/lib/__tests__/lead-status.test.ts
```

Expected: FAIL with module-not-found error for `../lead-status`.

- [ ] **Step 3: Implement the helper**

Create `src/features/leaderboard/lib/lead-status.ts`:

```typescript
export type LeadStatus = "new" | "recent" | "stale" | "expired";

const DAY_MS = 86_400_000;

export function leadStatus(capturedAt: Date, now: Date = new Date()): LeadStatus {
  const days = (now.getTime() - capturedAt.getTime()) / DAY_MS;
  if (days < 14) return "new";
  if (days < 45) return "recent";
  if (days < 90) return "stale";
  return "expired";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/features/leaderboard/lib/__tests__/lead-status.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/lib/lead-status.ts src/features/leaderboard/lib/__tests__/lead-status.test.ts
git commit -m "Add leadStatus helper with day-based thresholds"
```

---

## Task 5: Add `lead_outreach` activity type

**Files:**
- Modify: `src/features/activities/types.ts:11-22` (add to `meetings`), `:55` (label), `:85` (icon)

- [ ] **Step 1: Add `lead_outreach` to the `meetings` category**

In `src/features/activities/types.ts`, find the `ACTIVITY_CATEGORIES` declaration. Update the `meetings` array to include `"lead_outreach"` as the last entry:

```typescript
  meetings: [
    "discovery_call",
    "program_check_in",
    "proposal_review",
    "renewal_conversation",
    "lead_outreach",
  ],
```

- [ ] **Step 2: Add the display label**

Find `ACTIVITY_TYPE_LABELS`. Add an entry after `renewal_conversation: "Renewal Conversation",`:

```typescript
  lead_outreach: "Lead Outreach",
```

- [ ] **Step 3: Add the icon**

Find `ACTIVITY_TYPE_ICONS`. Add an entry after `renewal_conversation: "🔄",`:

```typescript
  lead_outreach: "📞",
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. (`ActivityType` is derived from the categories union, so adding to the array auto-extends the union — both `_LABELS` and `_ICONS` will fail to compile if any entry is missing.)

- [ ] **Step 5: Commit**

```bash
git add src/features/activities/types.ts
git commit -m "Add lead_outreach activity type"
```

---

## Task 6: Extend `IncreaseTargetCategory`, colors, sort, and filters

**Files:**
- Modify: `src/features/leaderboard/lib/types.ts` — extend `IncreaseTargetCategory`, add `leadContacts` field
- Modify: `src/features/leaderboard/lib/filters.ts` — extend the URL parser's category whitelist
- Modify: `src/features/leaderboard/components/LowHangingFruitView.tsx` — labels, colors, priority

- [ ] **Step 1: Extend `IncreaseTargetCategory` and add `leadContacts` to `IncreaseTarget`**

Open `src/features/leaderboard/lib/types.ts`. Find the `IncreaseTargetCategory` type and replace it with:

```typescript
export type IncreaseTargetCategory =
  | "missing_renewal"
  | "mql"
  | "inbound"
  | "fullmind_winback"
  | "ek12_winback";

export type LeadStatus = "new" | "recent" | "stale";

export interface IncreaseTargetLeadContact {
  contactId: number;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  score: number | null;
  capturedAt: string; // ISO
  status: LeadStatus; // expired filtered out before reaching client
  claimedByName: string | null;
  claimedByUserId: string | null;
  disposition: "qualified" | "unqualified" | null;
}
```

Then find the `IncreaseTarget` interface and add this field at the end of the body (just before the closing `}`):

```typescript
  /** Populated for `category === "mql"` rows (and "inbound" once it ships). */
  leadContacts?: IncreaseTargetLeadContact[];
```

- [ ] **Step 2: Update the URL filter parser to accept new categories**

Open `src/features/leaderboard/lib/filters.ts`. Find the `filtersFromSearchParams` function — the `csv("category").filter(...)` block. Replace the type guard to include the new categories:

```typescript
    categories: csv("category").filter(
      (c): c is IncreaseTargetCategory =>
        c === "missing_renewal" ||
        c === "mql" ||
        c === "inbound" ||
        c === "fullmind_winback" ||
        c === "ek12_winback",
    ),
```

- [ ] **Step 3: Add labels, colors, and priority for the new categories in `LowHangingFruitView.tsx`**

Open `src/features/leaderboard/components/LowHangingFruitView.tsx`. Replace the three `CATEGORY_LABEL`, `CATEGORY_COLORS`, and `CATEGORY_PRIORITY` constants with these expanded versions:

```typescript
const CATEGORY_LABEL: Record<IncreaseTargetCategory, string> = {
  missing_renewal: "Missing renewal",
  mql: "MQL",
  inbound: "Inbound",
  fullmind_winback: "Fullmind winback",
  ek12_winback: "EK12 winback",
};
const CATEGORY_COLORS: Record<
  IncreaseTargetCategory,
  { bg: string; fg: string; dot: string }
> = {
  missing_renewal: { bg: "#FEF2F1", fg: "#B5453D", dot: "#F37167" },
  mql: { bg: "#E8F4FB", fg: "#1F5C8A", dot: "#3F8FBE" },
  inbound: { bg: "#FBF1E8", fg: "#8A4A1F", dot: "#BE7A3F" },
  fullmind_winback: { bg: "#EFEDF5", fg: "#403770", dot: "#403770" },
  ek12_winback: { bg: "#FDEEE8", fg: "#7C3A21", dot: "#E07A5F" },
};
const CATEGORY_PRIORITY: Record<IncreaseTargetCategory, number> = {
  missing_renewal: 0,
  mql: 1,
  inbound: 2,
  fullmind_winback: 3,
  ek12_winback: 4,
};
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/lib/types.ts src/features/leaderboard/lib/filters.ts src/features/leaderboard/components/LowHangingFruitView.tsx
git commit -m "Extend LHF categories with mql + inbound"
```

---

## Task 7: Add MQL/Inbound chips to filter bar

**Files:**
- Modify: `src/features/leaderboard/components/LowHangingFruitFilterBar.tsx`

- [ ] **Step 1: Update the `CATEGORY_LABELS` map**

Open `src/features/leaderboard/components/LowHangingFruitFilterBar.tsx`. Find the local `CATEGORY_LABELS` constant and replace it with the full set:

```typescript
const CATEGORY_LABELS: Record<IncreaseTargetCategory, string> = {
  missing_renewal: "Missing Renewal",
  mql: "MQL",
  inbound: "Inbound",
  fullmind_winback: "Fullmind Winback",
  ek12_winback: "EK12 Winback",
};
```

- [ ] **Step 2: Render the chips conditionally**

Find the chip-rendering block that maps over `(["missing_renewal", "fullmind_winback", "ek12_winback"] as IncreaseTargetCategory[])` and replace it with:

```typescript
      {(
        ["missing_renewal", "mql", "inbound", "fullmind_winback", "ek12_winback"] as IncreaseTargetCategory[]
      )
        .filter((c) => {
          // Hide chips that have zero rows in the current dataset, except for the
          // three core categories which are always shown so reps recognize the surface.
          if (c === "missing_renewal" || c === "fullmind_winback" || c === "ek12_winback") return true;
          return (facets.categoryCounts[c] ?? 0) > 0;
        })
        .map((c) => {
          const active = filters.categories.includes(c);
          const count = facets.categoryCounts[c] ?? 0;
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors whitespace-nowrap ${
                active
                  ? "bg-[#EFEDF5] border-[#403770] text-[#403770]"
                  : "bg-white border-[#D4CFE2] text-[#6E6390] hover:border-[#C2BBD4]"
              }`}
            >
              {CATEGORY_LABELS[c]}
              <span className={`tabular-nums font-normal ${active ? "text-[#403770]" : "text-[#8A80A8]"}`}>
                ({count})
              </span>
            </button>
          );
        })}
```

- [ ] **Step 3: Update the `Facets` interface so `categoryCounts` covers all 5 categories**

The `Facets` interface uses `Record<IncreaseTargetCategory, number>` for `categoryCounts`. With the union now larger, the upstream caller in `LowHangingFruitView.tsx` needs to seed counts for all categories — open it and find the `useMemo` that builds `facets`. Replace the `counts` declaration block:

```typescript
    const counts: Record<IncreaseTargetCategory, number> = {
      missing_renewal: 0,
      mql: 0,
      inbound: 0,
      fullmind_winback: 0,
      ek12_winback: 0,
    };
```

- [ ] **Step 4: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LowHangingFruitFilterBar.tsx src/features/leaderboard/components/LowHangingFruitView.tsx
git commit -m "Filter bar: render MQL/Inbound category chips"
```

---

## Task 8: API route — add MQL SQL block

**Files:**
- Modify: `src/app/api/leaderboard/increase-targets/route.ts`

- [ ] **Step 1: Extend the local `IncreaseTargetRow` and `IncreaseTargetCategory` types**

Open `src/app/api/leaderboard/increase-targets/route.ts`. The route file declares a local copy of `IncreaseTargetCategory` (line ~43) and a local `IncreaseTargetRow` (line ~8) — extend both:

```typescript
type IncreaseTargetCategory =
  | "missing_renewal"
  | "mql"
  | "inbound"
  | "fullmind_winback"
  | "ek12_winback";
```

In `IncreaseTargetRow`, replace the `category` property type with:

```typescript
  category: IncreaseTargetCategory;
```

(Keeps the route's local types in sync with the shared types.)

- [ ] **Step 2: Add the `LeadContactRow` and `IncreaseTargetLeadContact` types**

Add these declarations directly after the `IncreaseTargetRow` interface block:

```typescript
interface LeadContactRow {
  leaid: string;
  contact_id: number;
  contact_name: string;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  score: number | string | null;
  captured_at: Date | string;
  claimed_by_name: string | null;
  claimed_by_user_id: string | null;
  disposition: string | null;
}

interface IncreaseTargetLeadContact {
  contactId: number;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  score: number | null;
  capturedAt: string;
  status: "new" | "recent" | "stale";
  claimedByName: string | null;
  claimedByUserId: string | null;
  disposition: "qualified" | "unqualified" | null;
}
```

In the `IncreaseTarget` interface, add this field at the end of the body:

```typescript
  leadContacts?: IncreaseTargetLeadContact[];
```

- [ ] **Step 3: Add an MQL CTE to the main query**

Find the existing `WITH fy26_df AS (...)` query in the `GET()` handler. We need to add an `active_mqls` CTE and a 4th source (`src_mql`) to the existing UNION.

Locate the line:

```typescript
      -- Source 3: EK12 Win Back tagged districts (FY24 / FY25 tags)
```

Insert the following CTE block just **before** that comment (between `src_fullmind_winback` and `src_ek12_winback`):

```sql
      -- Active MQL leads: any non-expired (< 90d) lead of type 'mql' for a contact at this district
      active_mqls AS (
        SELECT DISTINCT c.leaid
        FROM leads l
        JOIN contacts c ON c.id = l.contact_id
        WHERE l.type = 'mql'
          AND l.captured_at > NOW() - INTERVAL '90 days'
      ),
      src_mql AS (
        SELECT leaid, 'mql'::text AS category FROM active_mqls
      ),
```

- [ ] **Step 4: Add `src_mql` to the UNION inside `candidates`**

In the same query, find the UNION block:

```sql
        FROM (
          SELECT * FROM src_missing_renewal
          UNION ALL SELECT * FROM src_fullmind_winback
          UNION ALL SELECT * FROM src_ek12_winback
        ) u
```

Replace with:

```sql
        FROM (
          SELECT * FROM src_missing_renewal
          UNION ALL SELECT * FROM src_mql
          UNION ALL SELECT * FROM src_fullmind_winback
          UNION ALL SELECT * FROM src_ek12_winback
        ) u
```

- [ ] **Step 5: Update the dedup priority `CASE` inside `candidates`**

Find the `ROW_NUMBER() OVER (... ORDER BY CASE category ...)` block inside `candidates`. Replace the `CASE` with:

```sql
            ORDER BY CASE category
              WHEN 'missing_renewal' THEN 1
              WHEN 'mql' THEN 2
              WHEN 'fullmind_winback' THEN 3
              WHEN 'ek12_winback' THEN 4
            END
```

- [ ] **Step 6: Update the WHERE plan-membership rule and ORDER BY**

Find this block at the bottom of the query:

```sql
        AND (
          eligible.category = 'missing_renewal'
          OR fy27_plan.leaid IS NULL
        )
      ORDER BY
        CASE eligible.category
          WHEN 'missing_renewal' THEN 1
          WHEN 'fullmind_winback' THEN 2
          WHEN 'ek12_winback' THEN 3
        END,
```

Replace with:

```sql
        AND (
          eligible.category = 'missing_renewal'
          OR fy27_plan.leaid IS NULL
        )
        -- MQLs also drop off when added to plan or pipeline (matches winbacks)
      ORDER BY
        CASE eligible.category
          WHEN 'missing_renewal' THEN 1
          WHEN 'mql' THEN 2
          WHEN 'fullmind_winback' THEN 3
          WHEN 'ek12_winback' THEN 4
        END,
```

- [ ] **Step 7: Add a second query that fetches lead contact details per leaid**

After the main `prisma.$queryRaw` call (the one that produces `rows`), add this second query:

```typescript
    const mqlLeaids = rows
      .filter((r) => r.category === "mql")
      .map((r) => r.leaid);

    let leadContactRows: LeadContactRow[] = [];
    if (mqlLeaids.length > 0) {
      leadContactRows = await prisma.$queryRaw<LeadContactRow[]>`
        SELECT
          c.leaid,
          c.id          AS contact_id,
          c.name        AS contact_name,
          c.title       AS contact_title,
          c.email       AS contact_email,
          c.phone       AS contact_phone,
          l.score,
          l.captured_at,
          up.full_name  AS claimed_by_name,
          up.id::text   AS claimed_by_user_id,
          l.disposition
        FROM leads l
        JOIN contacts c ON c.id = l.contact_id
        LEFT JOIN user_profiles up ON up.id = l.claimed_by_user_id
        WHERE l.type = 'mql'
          AND l.captured_at > NOW() - INTERVAL '90 days'
          AND c.leaid = ANY(${mqlLeaids}::text[])
        ORDER BY c.leaid, l.score DESC NULLS LAST, l.captured_at DESC
      `;
    }

    // Group lead contact rows by leaid so they can be attached to the IncreaseTarget rows below.
    const leadContactsByLeaid = new Map<string, IncreaseTargetLeadContact[]>();
    for (const lc of leadContactRows) {
      const captured = lc.captured_at instanceof Date ? lc.captured_at : new Date(lc.captured_at);
      const days = (Date.now() - captured.getTime()) / 86_400_000;
      const status: "new" | "recent" | "stale" =
        days < 14 ? "new" : days < 45 ? "recent" : "stale";
      const entry: IncreaseTargetLeadContact = {
        contactId: lc.contact_id,
        name: lc.contact_name,
        title: lc.contact_title,
        email: lc.contact_email ?? "",
        phone: lc.contact_phone,
        score: toNumberOrNull(lc.score),
        capturedAt: captured.toISOString(),
        status,
        claimedByName: lc.claimed_by_name,
        claimedByUserId: lc.claimed_by_user_id,
        disposition: (lc.disposition === "qualified" || lc.disposition === "unqualified")
          ? lc.disposition
          : null,
      };
      const list = leadContactsByLeaid.get(lc.leaid) ?? [];
      list.push(entry);
      leadContactsByLeaid.set(lc.leaid, list);
    }
```

- [ ] **Step 8: Attach `leadContacts` to the mapped IncreaseTarget rows**

Find the `rows.map((row) => { ... return { ... } })` block. Just before the closing `};` of the returned object, add:

```typescript
        leadContacts:
          row.category === "mql"
            ? leadContactsByLeaid.get(row.leaid) ?? []
            : undefined,
```

- [ ] **Step 9: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Smoke-test the route**

Start the dev server in the background:

```bash
npm run dev
```

In a second terminal, hit the endpoint (you'll need to be logged in via the browser first; the cookies are required):

```bash
curl -s -b "$(grep -h '' /tmp/cookies.txt 2>/dev/null || echo '')" \
  http://localhost:3005/api/leaderboard/increase-targets | jq '.districts | length'
```

Expected: prints an integer (rows count). The MQL block won't return rows yet because the table is empty — that's correct.

- [ ] **Step 11: Commit**

```bash
git add src/app/api/leaderboard/increase-targets/route.ts
git commit -m "API: add MQL category and per-row lead contact aggregation"
```

---

## Task 9: API integration test for MQL block

**Files:**
- Modify: `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts`

- [ ] **Step 1: Add `leadContacts` to the test's `RawRow` interface and a new `LeadContactRow` mock type**

Open `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts`. Update the `RawRow.category` union and add the `LeadContactRow` interface near the existing `RawRow` declaration:

```typescript
  category: "missing_renewal" | "mql" | "inbound" | "fullmind_winback" | "ek12_winback";
```

```typescript
interface LeadContactRow {
  leaid: string;
  contact_id: number;
  contact_name: string;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  score: number | null;
  captured_at: Date;
  claimed_by_name: string | null;
  claimed_by_user_id: string | null;
  disposition: string | null;
}
```

- [ ] **Step 2: Add a test for MQL row + lead contact aggregation**

Add this `it` block inside the existing top-level `describe`:

```typescript
  it("attaches leadContacts to MQL rows and computes status", async () => {
    const mockQueryRaw = prisma.$queryRaw as Mock;
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);

    // First call → main query (district rows)
    mockQueryRaw.mockResolvedValueOnce([
      makeRow({ leaid: "0100001", name: "Test District", category: "mql" }),
    ]);
    // Second call → leadContacts subquery
    mockQueryRaw.mockResolvedValueOnce([
      {
        leaid: "0100001",
        contact_id: 42,
        contact_name: "Tracy Preslaski",
        contact_title: "HR Specialist",
        contact_email: "tracy@example.com",
        contact_phone: "555-0100",
        score: 110,
        captured_at: sevenDaysAgo,
        claimed_by_name: "Monica Rep",
        claimed_by_user_id: "user-monica",
        disposition: null,
      },
    ] satisfies LeadContactRow[]);

    const response = await GET();
    const body = await response.json();

    expect(body.districts).toHaveLength(1);
    const row = body.districts[0];
    expect(row.category).toBe("mql");
    expect(row.leadContacts).toHaveLength(1);
    expect(row.leadContacts[0]).toMatchObject({
      contactId: 42,
      name: "Tracy Preslaski",
      title: "HR Specialist",
      email: "tracy@example.com",
      phone: "555-0100",
      score: 110,
      status: "new",
      claimedByName: "Monica Rep",
      claimedByUserId: "user-monica",
      disposition: null,
    });
  });

  it("non-MQL rows have leadContacts=undefined", async () => {
    const mockQueryRaw = prisma.$queryRaw as Mock;
    mockQueryRaw.mockResolvedValueOnce([
      makeRow({ leaid: "0100002", category: "missing_renewal" }),
    ]);
    // No second call expected because mqlLeaids is empty.

    const response = await GET();
    const body = await response.json();

    expect(body.districts[0].leadContacts).toBeUndefined();
  });
```

- [ ] **Step 3: Run the test**

```bash
npm test -- src/app/api/leaderboard/increase-targets/__tests__/route.test.ts
```

Expected: existing tests still pass + 2 new tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/leaderboard/increase-targets/__tests__/route.test.ts
git commit -m "Test: API attaches leadContacts to MQL rows"
```

---

## Task 10: Render lead contacts inline on MQL rows in `LowHangingFruitView`

**Files:**
- Modify: `src/features/leaderboard/components/LowHangingFruitView.tsx`

- [ ] **Step 1: Add a `LeadContactRow` rendering helper**

Open `src/features/leaderboard/components/LowHangingFruitView.tsx`. After the `RepAvatar` component definition, add:

```typescript
const LEAD_STATUS_STYLE: Record<"new" | "recent" | "stale", { bg: string; fg: string }> = {
  new: { bg: "#E8F4FB", fg: "#1F5C8A" },
  recent: { bg: "#EFEDF5", fg: "#403770" },
  stale: { bg: "#FBF1E8", fg: "#8A4A1F" },
};

function LeadContactRows({ contacts }: { contacts: NonNullable<IncreaseTarget["leadContacts"]> }) {
  if (contacts.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {contacts.map((c) => {
        const s = LEAD_STATUS_STYLE[c.status];
        return (
          <div key={c.contactId} className="text-xs text-[#544A78] whitespace-nowrap">
            <span className="font-semibold text-[#403770]">{c.name}</span>
            {c.title && <span className="text-[#8A80A8]"> · {c.title}</span>}
            {c.score != null && <span className="text-[#8A80A8]"> · score {c.score}</span>}
            <span
              className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: s.bg, color: s.fg }}
            >
              {c.status}
            </span>
            <div className="text-[10px] text-[#8A80A8]">
              {c.email}
              {c.phone && <> · {c.phone}</>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Render the contact list under the district name on MQL rows**

Find the `<Td>` block that renders the district name (`<div className="font-semibold text-[#403770] whitespace-nowrap">{r.districtName}</div>`). Wrap the existing inner content with a fragment that conditionally renders `<LeadContactRows>` for MQL rows:

```tsx
              <Td>
                <div className="font-semibold text-[#403770] whitespace-nowrap">
                  {r.districtName}
                </div>
                <div className="text-xs text-[#A69DC0] mt-0.5 whitespace-nowrap">
                  {r.enrollment != null ? `${r.enrollment.toLocaleString()} enrolled` : "—"}
                  {r.fy26SessionCount != null && r.fy26SessionCount > 0 && (
                    <> · {r.fy26SessionCount.toLocaleString()} sessions</>
                  )}
                </div>
                {r.category === "mql" && r.leadContacts && r.leadContacts.length > 0 && (
                  <LeadContactRows contacts={r.leadContacts} />
                )}
              </Td>
```

- [ ] **Step 3: Show `—` in revenue cells for MQL rows**

Find the four revenue cells (Prior rev, FY26 rev, FY26 closed won, FY27 pipeline, Suggested) — they each have a class-name conditional. The "Prior rev" `<Td>` already shows `—` when the amount is 0; same for the others. MQL rows naturally get 0/null for all of these from the API (no joins fire for them), so no code change is required *if* the existing `priorRevenue(r)` returns `{ amount: 0 }` for MQL — let's verify:

```bash
grep -n "function priorRevenue" src/features/leaderboard/components/LowHangingFruitView.tsx
```

Read the function body. The function reads `r.priorYearRevenue` and `r.revenueTrend`. Since the API returns `priorYearRevenue=0` and trend nulls for MQL rows, `priorRevenue(r).amount` will be 0 → renders `—`. **No additional change needed.**

- [ ] **Step 4: Run typecheck and the existing component test**

```bash
npx tsc --noEmit
npm test -- src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx
```

Expected: typecheck passes, existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LowHangingFruitView.tsx
git commit -m "LHF: render lead contacts inline under MQL district rows"
```

---

## Task 11: Component test for MQL row rendering

**Files:**
- Modify: `src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx`

- [ ] **Step 1: Read the existing test file to understand its setup**

```bash
cat src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx
```

Note how it mocks `useLowHangingFruitList` and how it constructs an `IncreaseTarget` fixture. We'll add an MQL fixture in the same shape.

- [ ] **Step 2: Add a test that renders an MQL row with two contacts**

Add this `it` block inside the existing top-level `describe` in `LowHangingFruitView.test.tsx`:

```typescript
  it("renders lead contacts inline on MQL rows", () => {
    const mqlRow = makeRow({
      leaid: "0408340",
      districtName: "Tempe Union HSD",
      state: "AZ",
      category: "mql",
      fy26Revenue: 0,
      priorYearRevenue: 0,
      leadContacts: [
        {
          contactId: 1,
          name: "Tracy Preslaski",
          title: "HR Specialist",
          email: "tpreslaski@tempeunion.org",
          phone: "(480) 839-0292",
          score: 110,
          capturedAt: new Date().toISOString(),
          status: "new",
          claimedByName: "Monica",
          claimedByUserId: "user-monica",
          disposition: null,
        },
        {
          contactId: 2,
          name: "Sam Park",
          title: "Director of Operations",
          email: "spark@tempeunion.org",
          phone: null,
          score: 95,
          capturedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
          status: "recent",
          claimedByName: "Monica",
          claimedByUserId: "user-monica",
          disposition: null,
        },
      ],
    });

    mockUseLowHangingFruitList.mockReturnValue({
      data: { districts: [mqlRow], totalRevenueAtRisk: 0 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as never);

    render(<LowHangingFruitView />);

    expect(screen.getByText("Tracy Preslaski")).toBeInTheDocument();
    expect(screen.getByText("Sam Park")).toBeInTheDocument();
    expect(screen.getByText(/score 110/)).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
    expect(screen.getByText("recent")).toBeInTheDocument();
  });
```

If the existing file's `makeRow` helper doesn't accept `leadContacts` and `category: "mql"`, extend it now:

```typescript
function makeRow(overrides: Partial<IncreaseTarget> = {}): IncreaseTarget {
  return {
    // ... existing default fields ...
    leadContacts: undefined,
    ...overrides,
  };
}
```

(If `makeRow` doesn't already exist in the file, copy the fixture-builder pattern from `route.test.ts` and adapt for the client-shape `IncreaseTarget`.)

- [ ] **Step 3: Run the test**

```bash
npm test -- src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx
```

Expected: existing tests pass + the new MQL test passes.

- [ ] **Step 4: Commit**

```bash
git add src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx
git commit -m "Test: LHF renders lead contacts on MQL rows"
```

---

## Task 12: Build the import script — scaffolding + CSV parse

**Files:**
- Create: `scripts/import-mqls.ts`

- [ ] **Step 1: Create the script with CLI parsing and CSV reader**

Create `scripts/import-mqls.ts`:

```typescript
/**
 * Import MQL contacts from a CSV into the contacts table, log per-row outreach
 * activities, and create Lead rows of type 'mql'.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/import-mqls.ts --csv "<path>" --batch 2026-04-21 --dry-run
 *   npx tsx --env-file=.env scripts/import-mqls.ts --csv "<path>" --batch 2026-04-21 --execute
 *
 * Idempotent: re-running with the same --batch creates zero new rows
 * (Lead has UNIQUE(contact_id, type, import_batch); script also short-circuits
 * activity creation when the lead row was a hit).
 */

import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as readline from 'readline';
import { prisma } from '../src/lib/prisma';

interface CsvRow {
  'Sales Rep Reaching Out': string;
  'First Name': string;
  'Last Name': string;
  'Score': string;
  'Title': string;
  'Email': string;
  'Phone': string;
  'District': string;
  'NCES': string;
  'Activity': string;
  'Qualified/Unqualified': string;
  [key: string]: string;
}

interface ParsedArgs {
  csvPath: string;
  batch: string;
  dryRun: boolean;
  execute: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let csvPath = '';
  let batch = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--csv') csvPath = args[++i];
    else if (args[i] === '--batch') batch = args[++i];
  }
  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');
  if (!csvPath) {
    console.error('Missing --csv <path>');
    process.exit(1);
  }
  if (dryRun === execute) {
    console.error('Pass exactly one of --dry-run or --execute');
    process.exit(1);
  }
  return { csvPath, batch, dryRun, execute };
}

async function main() {
  const { csvPath, batch, dryRun } = parseArgs();
  console.log(`CSV: ${csvPath}`);
  console.log(`Batch: ${batch}`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (rolls back)' : 'EXECUTE'}`);

  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows: CsvRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
  });
  console.log(`Parsed ${rows.length} rows`);

  // The transaction block runs everything; on dry-run we throw at the end to roll back.
  try {
    await prisma.$transaction(
      async (tx) => {
        // Filled in subsequent tasks.
        console.log('TODO: process rows');
        if (dryRun) throw new Error('__DRY_RUN_ROLLBACK__');
      },
      { timeout: 120_000 },
    );
  } catch (err) {
    if (err instanceof Error && err.message === '__DRY_RUN_ROLLBACK__') {
      console.log('Dry-run rolled back successfully.');
    } else {
      throw err;
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

// ----- helpers used by later tasks -----

function isNonEmpty(v: string | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export { isNonEmpty, promptUser };
```

- [ ] **Step 2: Smoke-test the scaffolding**

```bash
npx tsx --env-file=.env scripts/import-mqls.ts \
  --csv "/Users/sierraarcega/Downloads/MQL's 2026 - 4.21.26 MQLs (1).csv" \
  --batch 2026-04-21 \
  --dry-run
```

Expected output (no DB writes yet):
```
CSV: /Users/sierraarcega/Downloads/MQL's 2026 - 4.21.26 MQLs (1).csv
Batch: 2026-04-21
Mode: DRY-RUN (rolls back)
Parsed 89 rows
TODO: process rows
Dry-run rolled back successfully.
```

(89 rows because the header row is consumed by `columns: true`.)

- [ ] **Step 3: Commit**

```bash
git add scripts/import-mqls.ts
git commit -m "Script scaffold: import-mqls CLI and CSV parsing"
```

---

## Task 13: Import script — rep matching with interactive prompt

**Files:**
- Modify: `scripts/import-mqls.ts`

- [ ] **Step 1: Add the rep-matching function**

Open `scripts/import-mqls.ts`. Add this function above `async function main()`:

```typescript
interface UserCandidate {
  id: string;
  email: string;
  fullName: string | null;
}

async function buildRepMatcher(): Promise<(firstName: string) => Promise<string | null>> {
  // Pull all rep+admin+sales-leader profiles up front so we can match locally.
  const users = await prisma.userProfile.findMany({
    where: { role: { in: ['rep', 'admin', 'sales_leader'] } },
    select: { id: true, email: true, fullName: true },
  });

  const cache = new Map<string, string | null>(); // first-name (lower) → user id (or null = skip)

  function candidatesFor(firstName: string): UserCandidate[] {
    const target = firstName.trim().toLowerCase();
    return users.filter((u) => {
      const first = (u.fullName ?? '').trim().split(/\s+/)[0]?.toLowerCase();
      return first === target;
    });
  }

  return async (rawFirstName: string): Promise<string | null> => {
    const key = rawFirstName.trim().toLowerCase();
    if (!key) return null;
    if (cache.has(key)) return cache.get(key)!;

    const candidates = candidatesFor(rawFirstName);

    if (candidates.length === 1) {
      cache.set(key, candidates[0].id);
      return candidates[0].id;
    }

    if (candidates.length === 0) {
      console.log(`\nNo user found matching first name "${rawFirstName}".`);
      // Show all reps so the user can pick by email or skip.
      const all = users
        .slice()
        .sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? ''));
      all.forEach((u, i) => console.log(`  [${i}] ${u.fullName ?? '(no name)'} <${u.email}>`));
      const ans = await promptUser(`Pick index for "${rawFirstName}" (or empty to skip): `);
      if (!ans) {
        cache.set(key, null);
        return null;
      }
      const idx = Number(ans);
      if (Number.isInteger(idx) && idx >= 0 && idx < all.length) {
        cache.set(key, all[idx].id);
        return all[idx].id;
      }
      cache.set(key, null);
      return null;
    }

    // Multiple matches — disambiguate.
    console.log(`\nMultiple users match first name "${rawFirstName}":`);
    candidates.forEach((u, i) => console.log(`  [${i}] ${u.fullName ?? '(no name)'} <${u.email}>`));
    const ans = await promptUser(`Pick index for "${rawFirstName}" (or empty to skip): `);
    const idx = Number(ans);
    if (Number.isInteger(idx) && idx >= 0 && idx < candidates.length) {
      cache.set(key, candidates[idx].id);
      return candidates[idx].id;
    }
    cache.set(key, null);
    return null;
  };
}
```

- [ ] **Step 2: Smoke-test the matcher in isolation**

Replace the `console.log('TODO: process rows')` placeholder inside the transaction with:

```typescript
        const matchRep = await buildRepMatcher();
        const sample = new Set<string>();
        for (const r of rows) sample.add(r['Sales Rep Reaching Out']);
        for (const name of sample) {
          const id = await matchRep(name);
          console.log(`  ${name} → ${id ?? '(skipped)'}`);
        }
        if (dryRun) throw new Error('__DRY_RUN_ROLLBACK__');
```

(Temporary code — replaced in the next task.)

- [ ] **Step 3: Run the matcher**

```bash
npx tsx --env-file=.env scripts/import-mqls.ts \
  --csv "/Users/sierraarcega/Downloads/MQL's 2026 - 4.21.26 MQLs (1).csv" \
  --batch 2026-04-21 \
  --dry-run
```

Interactively resolve any ambiguous names. Confirm output shows each unique first name resolved to a user id (or skipped intentionally).

- [ ] **Step 4: Commit**

```bash
git add scripts/import-mqls.ts
git commit -m "Script: interactive rep matching by first name"
```

---

## Task 14: Import script — row processing (Contact + Lead + Activity)

**Files:**
- Modify: `scripts/import-mqls.ts`

- [ ] **Step 1: Add output sinks and result counters**

In `scripts/import-mqls.ts`, near the top of `main()`, declare the output paths and counters:

```typescript
  const JUNK_OUT = '/tmp/mql-import-junk.csv';
  const UNMATCHED_DISTRICT_OUT = '/tmp/mql-import-unmatched-district.csv';
  const junkRows: string[] = [['reason', 'first', 'last', 'email', 'leaid', 'rep'].join(',')];
  const unmatchedDistrictRows: string[] = [['leaid', 'district', 'email', 'rep'].join(',')];
  const counters = {
    parsed: rows.length,
    junk: 0,
    unmatchedDistrict: 0,
    contactsCreated: 0,
    contactsExisting: 0,
    leadsCreated: 0,
    leadsExisting: 0,
    activitiesCreated: 0,
    activitiesSkippedNoNotes: 0,
    repsUnresolved: 0,
  };

  function csvLine(values: (string | null | undefined)[]): string {
    return values.map((v) => {
      const s = (v ?? '').toString();
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',');
  }
```

- [ ] **Step 2: Replace the temporary matcher loop with the real per-row processor**

Replace the contents of the `prisma.$transaction` callback (everything inside `async (tx) => { ... }`) with:

```typescript
        const matchRep = await buildRepMatcher();

        // Cache district leaids that exist (avoids per-row roundtrips).
        const districtLeaids = new Set(
          (await tx.district.findMany({ select: { leaid: true } })).map((d) => d.leaid),
        );

        for (const r of rows) {
          const first = (r['First Name'] ?? '').trim();
          const last = (r['Last Name'] ?? '').trim();
          const email = (r['Email'] ?? '').trim().toLowerCase();
          const leaid = (r['NCES'] ?? '').trim();
          const repFirst = (r['Sales Rep Reaching Out'] ?? '').trim();
          const districtName = (r['District'] ?? '').trim();

          if (!first || !last || !email || !leaid) {
            counters.junk++;
            junkRows.push(csvLine(['missing-required', first, last, email, leaid, repFirst]));
            continue;
          }

          if (!districtLeaids.has(leaid)) {
            counters.unmatchedDistrict++;
            unmatchedDistrictRows.push(csvLine([leaid, districtName, email, repFirst]));
            continue;
          }

          // Resolve rep (may prompt).
          const claimedByUserId = repFirst ? await matchRep(repFirst) : null;
          if (repFirst && !claimedByUserId) counters.repsUnresolved++;

          // Score (the CSV "Score" column).
          const scoreRaw = (r['Score'] ?? '').trim();
          const score = scoreRaw ? Number.parseInt(scoreRaw, 10) : null;

          // Captured-at: the column-17 timestamp. The CSV header for that
          // column is whatever Salesforce/marketing exports — find it by
          // scanning row keys for an ISO-ish date-time value. Fall back to
          // batch date if absent.
          let capturedAt: Date | null = null;
          for (const key of Object.keys(r)) {
            const v = (r as Record<string, string>)[key]?.trim();
            if (!v) continue;
            // Match e.g. "2026-04-21 9:16" or "2026-04-21 09:16:00"
            if (/^\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}/.test(v)) {
              const parsed = new Date(v.replace(' ', 'T'));
              if (!Number.isNaN(parsed.getTime())) {
                capturedAt = parsed;
                break;
              }
            }
          }
          if (!capturedAt) capturedAt = new Date(`${batch}T00:00:00`);

          const sourceCampaign = (() => {
            // Find the campaign-name cell — looks like "Fullmind Persona Nurture_..."
            for (const key of Object.keys(r)) {
              const v = (r as Record<string, string>)[key];
              if (v && /^Fullmind Persona/i.test(v)) return v;
            }
            return null;
          })();

          const outreachNotes = (r['Activity'] ?? '').trim();
          const dispositionRaw = (r['Qualified/Unqualified'] ?? '').trim().toLowerCase();
          const disposition: 'qualified' | 'unqualified' | null =
            dispositionRaw === 'qualified' ? 'qualified'
              : dispositionRaw === 'unqualified' ? 'unqualified'
                : null;

          // Upsert contact by (lower(email), leaid) — preserve existing rows.
          let contact = await tx.contact.findFirst({
            where: { leaid, email: { equals: email, mode: 'insensitive' } },
            select: { id: true },
          });
          if (!contact) {
            contact = await tx.contact.create({
              data: {
                leaid,
                name: `${first} ${last}`,
                title: (r['Title'] ?? '').trim() || null,
                email,
                phone: (r['Phone'] ?? '').trim() || null,
              },
              select: { id: true },
            });
            counters.contactsCreated++;
          } else {
            counters.contactsExisting++;
          }

          // Insert Lead — unique on (contactId, type, importBatch).
          let leadId: number;
          let leadIsNew = false;
          const existingLead = await tx.lead.findUnique({
            where: {
              contactId_type_importBatch: {
                contactId: contact.id,
                type: 'mql',
                importBatch: batch,
              },
            },
            select: { id: true },
          });
          if (existingLead) {
            leadId = existingLead.id;
            counters.leadsExisting++;
          } else {
            const created = await tx.lead.create({
              data: {
                contactId: contact.id,
                type: 'mql',
                score,
                sourceCampaign,
                capturedAt,
                claimedByUserId,
                disposition,
                importBatch: batch,
              },
              select: { id: true },
            });
            leadId = created.id;
            leadIsNew = true;
            counters.leadsCreated++;
          }

          // Activity — only when notes present AND lead is new (idempotent re-run skips).
          if (outreachNotes && leadIsNew) {
            const activity = await tx.activity.create({
              data: {
                type: 'lead_outreach',
                title: `Lead outreach: ${first} ${last}`,
                notes: outreachNotes,
                outcome: outreachNotes,
                status: 'completed',
                startDate: capturedAt,
                createdByUserId: claimedByUserId,
                source: 'manual',
                contacts: { create: [{ contactId: contact.id }] },
                districts: { create: [{ districtLeaid: leaid }] },
              },
              select: { id: true },
            });
            await tx.lead.update({
              where: { id: leadId },
              data: { activityId: activity.id },
            });
            counters.activitiesCreated++;
          } else if (!outreachNotes) {
            counters.activitiesSkippedNoNotes++;
          }
        }
        if (dryRun) throw new Error('__DRY_RUN_ROLLBACK__');
```

- [ ] **Step 3: Print the report after the transaction returns**

After the `try/catch` around the transaction, add:

```typescript
  if (junkRows.length > 1) fs.writeFileSync(JUNK_OUT, junkRows.join('\n'));
  if (unmatchedDistrictRows.length > 1) fs.writeFileSync(UNMATCHED_DISTRICT_OUT, unmatchedDistrictRows.join('\n'));

  console.log('\nReport:');
  console.log(`  Parsed:                 ${counters.parsed}`);
  console.log(`  Junk (skipped):         ${counters.junk}` + (counters.junk ? ` → ${JUNK_OUT}` : ''));
  console.log(`  Unmatched district:     ${counters.unmatchedDistrict}` + (counters.unmatchedDistrict ? ` → ${UNMATCHED_DISTRICT_OUT}` : ''));
  console.log(`  Contacts created:       ${counters.contactsCreated}`);
  console.log(`  Contacts existing:      ${counters.contactsExisting}`);
  console.log(`  Leads created:          ${counters.leadsCreated}`);
  console.log(`  Leads existing:         ${counters.leadsExisting}`);
  console.log(`  Activities created:     ${counters.activitiesCreated}`);
  console.log(`  Activities skipped (no notes): ${counters.activitiesSkippedNoNotes}`);
  console.log(`  Reps unresolved:        ${counters.repsUnresolved}`);
```

- [ ] **Step 4: Run dry-run end-to-end**

```bash
npx tsx --env-file=.env scripts/import-mqls.ts \
  --csv "/Users/sierraarcega/Downloads/MQL's 2026 - 4.21.26 MQLs (1).csv" \
  --batch 2026-04-21 \
  --dry-run
```

Expected: prompts for any ambiguous reps, then prints a non-zero report and ends with "Dry-run rolled back successfully." Verify with:

```bash
psql "$DATABASE_URL" -c 'SELECT COUNT(*) FROM leads;'
```

Expected: `0` (rollback worked).

- [ ] **Step 5: Commit**

```bash
git add scripts/import-mqls.ts
git commit -m "Script: full per-row processing with contact upsert, lead, activity"
```

---

## Task 15: Run the import for real

**Files:** None — operational task.

- [ ] **Step 1: Execute the import**

```bash
npx tsx --env-file=.env scripts/import-mqls.ts \
  --csv "/Users/sierraarcega/Downloads/MQL's 2026 - 4.21.26 MQLs (1).csv" \
  --batch 2026-04-21 \
  --execute
```

Re-resolve any rep prompts (the cache from dry-run doesn't persist across runs).

- [ ] **Step 2: Verify DB state**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS leads FROM leads WHERE type='mql' AND import_batch='2026-04-21';"
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS activities FROM activities WHERE type='lead_outreach';"
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS contacts FROM contacts WHERE created_at > NOW() - INTERVAL '5 minutes';"
```

Expected: leads count matches the script's "Leads created" report; activities count matches; contacts count is 0 to ~70 depending on how many MQLs are net-new emails.

- [ ] **Step 3: Verify the LHF API surfaces them**

Open the Low Hanging Fruit page in the browser at `http://localhost:3005/` (or wherever the app routes the LHF view). Confirm:

- An **MQL** chip appears in the filter bar with a count
- Clicking it filters to MQL rows
- Each MQL row shows the district name and the lead-contact list underneath (name, title, score, status pill, email, phone)
- Revenue cells render `—`
- Sort priority: missing-renewals first, then MQLs, then winbacks

- [ ] **Step 4: Verify idempotency by re-running execute**

```bash
npx tsx --env-file=.env scripts/import-mqls.ts \
  --csv "/Users/sierraarcega/Downloads/MQL's 2026 - 4.21.26 MQLs (1).csv" \
  --batch 2026-04-21 \
  --execute
```

Expected: report shows `Leads created: 0`, `Leads existing: ~89`, `Activities created: 0`. No errors.

- [ ] **Step 5: Commit any operational notes**

If you wrote anything down (rep mappings used, edge cases hit), add it to a short `docs/runbooks/` note. Otherwise skip.

---

## Task 16: Verification & PR

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/mql-leads-ingestion
gh pr create --title "MQL leads ingestion + Low Hanging Fruit MQL category" --body "$(cat <<'EOF'
## Summary
- Generalized `leads` table with `type` discriminator (`mql` | `inbound`)
- `lead_outreach` activity type for rep outreach attempts
- New MQL category on Low Hanging Fruit with inline contact list
- `scripts/import-mqls.ts` for batch ingestion (idempotent on `--batch`)

## Test plan
- [x] `npm test` passes
- [x] `npx tsc --noEmit` clean
- [ ] Dry-run on 4.21.26 CSV reports expected counters
- [ ] Execute on 4.21.26 CSV; verify LHF page shows MQL rows
- [ ] Re-running execute creates 0 new rows

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes (resolved during plan writing)

- **Spec coverage:** every section of the spec maps to at least one task — schema (T2/T3), status helper (T4), activity type (T5), LHF type/colors/sort (T6/T7), API SQL block (T8), API test (T9), LHF rendering (T10), LHF test (T11), import script (T12-T14), execution (T15), verification (T16).
- **Type consistency:** `leadContacts` field name used uniformly across server (`route.ts`), shared types (`types.ts`), and component (`LowHangingFruitView.tsx`). Status union is `"new" | "recent" | "stale"` everywhere except the helper, which also returns `"expired"` (filtered out before reaching the client).
- **No placeholders:** every step contains the actual code or commands. The one TODO inside the import-script scaffold (Task 12) is replaced by Task 13/14 before any execution step depends on it.
