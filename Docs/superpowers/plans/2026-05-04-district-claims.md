# District Claims Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `District.ownerId` with a multi-claimant model (derived from opps + plans, plus rep-authored manual claims) and drop the entire CRM-name-backfill family (`sales_executive_id` on districts/accounts/unmatched_accounts, `territory_owner_id` on states, `owner_id` on schools) along with the `district_map_features` materialized view's owner column.

**Architecture:** Hybrid — manual claims live in a real `district_manual_claims` table (CRUD'd by reps via `claim`/`release`/`transfer`); derived claims are a SQL view (`district_derived_claims_v`) computed from `opportunities` and `territory_plan_districts/collaborators`. App reads through a union view (`district_claimants_v`). A nightly cron refreshes `last_activity_at` on manual rows; a separate cron deletes claims with no activity for 6 months.

**Tech Stack:** Postgres + Prisma; Next.js 16 App Router; React 19 + Tailwind 4; Zustand; TanStack Query; Vitest + Testing Library; Vercel cron via `vercel.json`.

**Spec:** `Docs/superpowers/specs/2026-05-04-district-claims-design.md`

**Branch:** `feat/district-claims` (already created off `main`)

---

## File Structure

### New files

- `prisma/migrations/<ts>_district_manual_claims_and_views/migration.sql` — additive schema + views.
- `prisma/migrations/<ts>_drop_crm_name_backfill_columns/migration.sql` — destructive cleanup.
- `scripts/backfill-district-manual-claims.ts` — one-shot backfill from `districts.owner_id` + `districts.sales_executive_id`.
- `scripts/audit-backfilled-claims.ts` — emits `covered.csv` + `unsupported.csv`.
- `src/app/api/districts/[leaid]/claimants/route.ts` — `GET` claimants list.
- `src/app/api/districts/[leaid]/claims/route.ts` — `POST` claim (idempotent).
- `src/app/api/districts/[leaid]/claims/me/route.ts` — `DELETE` own claim.
- `src/app/api/districts/[leaid]/claims/transfer/route.ts` — `POST` transfer.
- `src/app/api/cron/refresh-claim-activity/route.ts` — nightly activity-refresh.
- `src/app/api/cron/expire-manual-claims/route.ts` — nightly expiry.
- `src/features/districts/components/DistrictClaimants.tsx` — both compact + detail variants in one file.
- `src/features/districts/components/__tests__/DistrictClaimants.test.tsx`
- API test files co-located under `__tests__/route.test.ts` next to each new endpoint.

### Modified files (high-traffic — full list per task)

- `prisma/schema.prisma` — add `DistrictManualClaim` model (additive); later, remove dropped relations.
- `scripts/district-map-features-view.sql` — strip `sales_executive_id` references.
- `src/app/auth/callback/route.ts` — trim CRM-name re-link block.
- `src/app/api/districts/search/route.ts`, `.../[leaid]/route.ts`, `.../[leaid]/edits/route.ts`, `.../batch-edits/route.ts`, `.../route.ts`, `.../summary/route.ts`, `.../summary/compare/route.ts`, `.../leaids/route.ts`, `.../states/[code]/route.ts`, `.../states/[code]/districts/route.ts`, `.../schools/[ncessch]/route.ts`, `.../schools/[ncessch]/edits/route.ts`, `.../accounts/route.ts`, `.../tiles/[z]/[x]/[y]/route.ts`.
- `src/features/districts/components/DistrictHeader.tsx`, `src/features/map/components/SearchResults/DistrictExploreModal.tsx`, `src/features/map/components/SearchResults/DistrictSearchCard.tsx`, `src/features/map/components/SearchResults/index.tsx`.
- `src/features/map/components/SearchBar/SearchBar.tsx` (or `index.tsx`), `FullmindDropdown.tsx`, `DistrictsDropdown.tsx`, `FilterPills.tsx`.
- `src/features/map/components/MapV2Container.tsx`.
- `src/features/districts/lib/queries.ts`, `src/features/shared/lib/queries.ts`, `src/features/shared/lib/app-store.ts`, `src/features/shared/lib/filters.ts`, `src/features/shared/types/api-types.ts`, `src/lib/district-column-metadata.ts`.
- `vercel.json` — register two new cron entries.

---

## Phase A — Additive infrastructure

### Task 1: Migration — `district_manual_claims` table

**Files:**
- Create: `prisma/migrations/<ts>_district_manual_claims_and_views/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Generate the migration directory**

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_district_manual_claims_and_views
```

(The remaining steps assume that directory; substitute the generated path.)

- [ ] **Step 2: Write the table SQL**

```sql
-- prisma/migrations/<ts>_district_manual_claims_and_views/migration.sql

CREATE TABLE district_manual_claims (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_leaid    varchar(7)  NOT NULL REFERENCES districts(leaid),
  user_id           uuid        NOT NULL REFERENCES user_profiles(id),
  claimed_at        timestamptz NOT NULL DEFAULT now(),
  last_activity_at  timestamptz NOT NULL DEFAULT now(),
  note              text,
  CONSTRAINT district_manual_claims_unique UNIQUE (district_leaid, user_id)
);

CREATE INDEX district_manual_claims_user_idx       ON district_manual_claims(user_id);
CREATE INDEX district_manual_claims_district_idx   ON district_manual_claims(district_leaid);
CREATE INDEX district_manual_claims_last_activity  ON district_manual_claims(last_activity_at);
```

- [ ] **Step 3: Add Prisma model**

In `prisma/schema.prisma`, after the `District` model, add:

```prisma
model DistrictManualClaim {
  id              String   @id @default(uuid()) @db.Uuid
  districtLeaid   String   @map("district_leaid") @db.VarChar(7)
  userId          String   @map("user_id") @db.Uuid
  claimedAt       DateTime @default(now()) @map("claimed_at") @db.Timestamptz
  lastActivityAt  DateTime @default(now()) @map("last_activity_at") @db.Timestamptz
  note            String?  @db.Text

  district District     @relation(fields: [districtLeaid], references: [leaid])
  user     UserProfile  @relation("DistrictManualClaimUser", fields: [userId], references: [id])

  @@unique([districtLeaid, userId], map: "district_manual_claims_unique")
  @@index([userId], map: "district_manual_claims_user_idx")
  @@index([districtLeaid], map: "district_manual_claims_district_idx")
  @@index([lastActivityAt], map: "district_manual_claims_last_activity")
  @@map("district_manual_claims")
}
```

Then add the inverse relations:

In `District` model `// ===== Relations =====` block, add:
```prisma
  manualClaims       DistrictManualClaim[]
```

In `UserProfile` model (search for other `@relation("...User")` lines and place adjacent), add:
```prisma
  districtManualClaims DistrictManualClaim[] @relation("DistrictManualClaimUser")
```

- [ ] **Step 4: Apply migration locally and regenerate Prisma client**

```bash
npx prisma migrate dev --name district_manual_claims_and_views --create-only
# Then run the migration we already wrote:
npx prisma migrate dev
npx prisma generate
```

Expected: `district_manual_claims` table exists; `prisma.districtManualClaim.*` is callable in TS.

- [ ] **Step 5: Smoke test from a Node REPL**

```bash
node --experimental-vm-modules -e "
import('./src/lib/prisma.js').then(async (m) => {
  const count = await m.default.districtManualClaim.count();
  console.log('rows:', count);
  await m.default.\$disconnect();
});"
```

Expected: `rows: 0`.

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations prisma/schema.prisma
git commit -m "feat(claims): add district_manual_claims table + Prisma model"
```

---

### Task 2: Migration — `district_derived_claims_v` view

**Files:**
- Modify: `prisma/migrations/<ts>_district_manual_claims_and_views/migration.sql` (append)

- [ ] **Step 1: Append the derived-claims view SQL**

Append to the migration file from Task 1:

```sql
-- Derived claims: opportunities (open pipeline + recently closed) + plan owners + plan collaborators.
CREATE OR REPLACE VIEW district_derived_claims_v AS
-- Open pipeline (Stage 0–5), no time window
SELECT
  o.district_lea_id   AS district_leaid,
  o.sales_rep_id      AS user_id,
  'open_pipeline'     AS basis,
  o.created_at        AS since
FROM opportunities o
WHERE o.district_lea_id IS NOT NULL
  AND o.sales_rep_id IS NOT NULL
  AND o.stage IN ('Stage 0','Stage 1','Stage 2','Stage 3','Stage 4','Stage 5')

UNION ALL

-- Closed Won / Closed Lost in last 18 months
SELECT
  o.district_lea_id   AS district_leaid,
  o.sales_rep_id      AS user_id,
  'recently_closed'   AS basis,
  o.close_date        AS since
FROM opportunities o
WHERE o.district_lea_id IS NOT NULL
  AND o.sales_rep_id IS NOT NULL
  AND o.stage IN ('Closed Won','Closed Lost')
  AND o.close_date >= now() - interval '18 months'

UNION ALL

-- Plan owner
SELECT
  tpd.district_leaid          AS district_leaid,
  tp.owner_id                 AS user_id,
  'plan_owner'                AS basis,
  tpd.added_at                AS since
FROM territory_plan_districts tpd
JOIN territory_plans tp ON tp.id = tpd.plan_id
WHERE tp.owner_id IS NOT NULL

UNION ALL

-- Plan collaborator
SELECT
  tpd.district_leaid          AS district_leaid,
  tpc.user_id                 AS user_id,
  'plan_collaborator'         AS basis,
  tpd.added_at                AS since
FROM territory_plan_districts tpd
JOIN territory_plan_collaborators tpc ON tpc.plan_id = tpd.plan_id;
```

- [ ] **Step 2: Apply migration**

```bash
npx prisma migrate dev
```

- [ ] **Step 3: Sanity-check the view**

```bash
psql $DATABASE_URL -c "SELECT basis, COUNT(*) FROM district_derived_claims_v GROUP BY basis;"
```

Expected: four rows (`open_pipeline`, `recently_closed`, `plan_owner`, `plan_collaborator`) with non-zero counts.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations
git commit -m "feat(claims): add district_derived_claims_v view"
```

---

### Task 3: Migration — `district_claimants_v` union view

**Files:**
- Modify: `prisma/migrations/<ts>_district_manual_claims_and_views/migration.sql` (append)

- [ ] **Step 1: Append the union view**

```sql
CREATE OR REPLACE VIEW district_claimants_v AS
SELECT
  district_leaid,
  user_id,
  basis,
  since,
  'derived'::text AS kind
FROM district_derived_claims_v

UNION ALL

SELECT
  district_leaid,
  user_id,
  'manual_claim'::text AS basis,
  claimed_at           AS since,
  'manual'::text       AS kind
FROM district_manual_claims;
```

- [ ] **Step 2: Apply migration**

```bash
npx prisma migrate dev
```

- [ ] **Step 3: Smoke check**

```bash
psql $DATABASE_URL -c "SELECT kind, basis, COUNT(*) FROM district_claimants_v GROUP BY kind, basis ORDER BY kind, basis;"
```

Expected: 4 derived rows + 0 manual rows for now.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations
git commit -m "feat(claims): add district_claimants_v union view"
```

---

### Task 4: Backfill script — `scripts/backfill-district-manual-claims.ts`

**Files:**
- Create: `scripts/backfill-district-manual-claims.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/backfill-district-manual-claims.ts
//
// One-shot. Inserts a manual claim for every (leaid, user_id) pair derivable
// from districts.owner_id and districts.sales_executive_id. Idempotent — the
// UNIQUE (district_leaid, user_id) constraint deduplicates re-runs.
//
// Usage: npx tsx scripts/backfill-district-manual-claims.ts

import prisma from "@/lib/prisma";

async function main() {
  const inserted = await prisma.$executeRaw`
    INSERT INTO district_manual_claims (district_leaid, user_id, claimed_at, last_activity_at)
    SELECT leaid, owner_id, now(), now()
      FROM districts
      WHERE owner_id IS NOT NULL
    UNION
    SELECT leaid, sales_executive_id, now(), now()
      FROM districts
      WHERE sales_executive_id IS NOT NULL
    ON CONFLICT (district_leaid, user_id) DO NOTHING
  `;
  console.log(`Inserted ${inserted} new manual claim rows.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

```bash
npx tsx scripts/backfill-district-manual-claims.ts
```

Expected: `Inserted N new manual claim rows.` (N = count of distinct ownerId / salesExecutiveId pairs in `districts`).

- [ ] **Step 3: Verify**

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) AS total, COUNT(DISTINCT user_id) AS users, COUNT(DISTINCT district_leaid) AS districts FROM district_manual_claims;"
```

Expected: total > 0; users and districts also > 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-district-manual-claims.ts
git commit -m "feat(claims): backfill manual claims from owner_id + sales_executive_id"
```

---

### Task 5: Audit script — `scripts/audit-backfilled-claims.ts`

**Files:**
- Create: `scripts/audit-backfilled-claims.ts`

- [ ] **Step 1: Write the script**

```ts
// scripts/audit-backfilled-claims.ts
//
// For every manual claim row, decide whether the same (leaid, user_id) also
// has a derived claim via district_derived_claims_v. Emits two CSVs:
//   - covered.csv     — manual claim is redundant (derived basis exists)
//   - unsupported.csv — manual claim has no derived basis (suspect)
//
// Usage: npx tsx scripts/audit-backfilled-claims.ts

import { writeFileSync } from "node:fs";
import prisma from "@/lib/prisma";

type Row = {
  district_leaid: string;
  district_name: string | null;
  user_id: string;
  user_full_name: string | null;
  derived_bases: string | null; // semicolon-separated
  claimed_at: Date;
};

async function main() {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      mc.district_leaid,
      d.name AS district_name,
      mc.user_id,
      up.full_name AS user_full_name,
      (SELECT string_agg(DISTINCT basis, ';' ORDER BY basis)
         FROM district_derived_claims_v dc
         WHERE dc.district_leaid = mc.district_leaid
           AND dc.user_id = mc.user_id
      ) AS derived_bases,
      mc.claimed_at
    FROM district_manual_claims mc
    LEFT JOIN districts d ON d.leaid = mc.district_leaid
    LEFT JOIN user_profiles up ON up.id = mc.user_id
    ORDER BY mc.district_leaid, mc.user_id
  `;

  const header =
    "district_leaid,district_name,user_id,user_full_name,derived_bases,claimed_at";
  const csv = (r: Row) =>
    [
      r.district_leaid,
      JSON.stringify(r.district_name ?? ""),
      r.user_id,
      JSON.stringify(r.user_full_name ?? ""),
      r.derived_bases ?? "",
      r.claimed_at.toISOString(),
    ].join(",");

  const covered = rows.filter((r) => r.derived_bases !== null);
  const unsupported = rows.filter((r) => r.derived_bases === null);

  writeFileSync("covered.csv", [header, ...covered.map(csv)].join("\n") + "\n");
  writeFileSync(
    "unsupported.csv",
    [header, ...unsupported.map(csv)].join("\n") + "\n",
  );

  console.log(
    `Total: ${rows.length}. Covered: ${covered.length}. Unsupported: ${unsupported.length}.`,
  );
  console.log("Wrote covered.csv and unsupported.csv to working directory.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

```bash
npx tsx scripts/audit-backfilled-claims.ts
```

Expected: prints totals, writes two CSVs.

- [ ] **Step 3: Eyeball outputs**

```bash
head -20 unsupported.csv
wc -l covered.csv unsupported.csv
```

- [ ] **Step 4: Add CSVs to `.gitignore` (one-off audit artifacts)**

In `.gitignore`, append:

```
/covered.csv
/unsupported.csv
```

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-backfilled-claims.ts .gitignore
git commit -m "feat(claims): audit script — covered vs unsupported backfill rows"
```

---

## Phase C.1 — App code

### Task 6: API — `GET /api/districts/[leaid]/claimants`

**Files:**
- Create: `src/app/api/districts/[leaid]/claimants/route.ts`
- Create: `src/app/api/districts/[leaid]/claimants/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/districts/[leaid]/claimants/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-current" }),
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma) as { $queryRaw: ReturnType<typeof vi.fn> };

describe("GET /api/districts/[leaid]/claimants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("collapses multiple bases for one user into a single claimant row", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        district_leaid: "1234567",
        user_id: "user-1",
        basis: "open_pipeline",
        since: new Date("2026-01-01"),
        kind: "derived",
        full_name: "Alice",
        avatar_url: null,
      },
      {
        district_leaid: "1234567",
        user_id: "user-1",
        basis: "manual_claim",
        since: new Date("2026-02-01"),
        kind: "manual",
        full_name: "Alice",
        avatar_url: null,
      },
    ]);

    const req = new NextRequest("http://localhost/api/districts/1234567/claimants");
    const res = await GET(req, { params: Promise.resolve({ leaid: "1234567" }) });
    const body = await res.json();

    expect(body.claimants).toHaveLength(1);
    expect(body.claimants[0]).toMatchObject({
      user: { id: "user-1", fullName: "Alice", avatarUrl: null },
      kind: "both",
      bases: expect.arrayContaining(["open_pipeline", "manual_claim"]),
    });
  });

  it("sorts current user first", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        district_leaid: "1234567",
        user_id: "user-other",
        basis: "open_pipeline",
        since: new Date("2026-03-01"),
        kind: "derived",
        full_name: "Bob",
        avatar_url: null,
      },
      {
        district_leaid: "1234567",
        user_id: "user-current",
        basis: "manual_claim",
        since: new Date("2026-01-01"),
        kind: "manual",
        full_name: "You",
        avatar_url: null,
      },
    ]);

    const req = new NextRequest("http://localhost/api/districts/1234567/claimants");
    const res = await GET(req, { params: Promise.resolve({ leaid: "1234567" }) });
    const body = await res.json();

    expect(body.claimants[0].user.id).toBe("user-current");
  });
});
```

- [ ] **Step 2: Run test (expect failure: route doesn't exist)**

```bash
npm test -- src/app/api/districts/\[leaid\]/claimants
```

Expected: error, "Cannot find module '../route'".

- [ ] **Step 3: Write the route**

```ts
// src/app/api/districts/[leaid]/claimants/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RawRow = {
  district_leaid: string;
  user_id: string;
  basis:
    | "open_pipeline"
    | "recently_closed"
    | "plan_owner"
    | "plan_collaborator"
    | "manual_claim";
  since: Date | null;
  kind: "derived" | "manual";
  full_name: string | null;
  avatar_url: string | null;
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await ctx.params;
  const user = await getUser();
  const currentUserId = user?.id ?? null;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      cv.district_leaid,
      cv.user_id,
      cv.basis,
      cv.since,
      cv.kind,
      up.full_name,
      up.avatar_url
    FROM district_claimants_v cv
    JOIN user_profiles up ON up.id = cv.user_id
    WHERE cv.district_leaid = ${leaid}
  `;

  // Group by user.
  const byUser = new Map<
    string,
    {
      user: { id: string; fullName: string | null; avatarUrl: string | null };
      kinds: Set<"derived" | "manual">;
      bases: Set<RawRow["basis"]>;
      latestSince: Date | null;
    }
  >();

  for (const r of rows) {
    const existing = byUser.get(r.user_id);
    if (existing) {
      existing.kinds.add(r.kind);
      existing.bases.add(r.basis);
      if (r.since && (!existing.latestSince || r.since > existing.latestSince)) {
        existing.latestSince = r.since;
      }
    } else {
      byUser.set(r.user_id, {
        user: { id: r.user_id, fullName: r.full_name, avatarUrl: r.avatar_url },
        kinds: new Set([r.kind]),
        bases: new Set([r.basis]),
        latestSince: r.since,
      });
    }
  }

  const claimants = [...byUser.values()].map((g) => ({
    user: g.user,
    kind:
      g.kinds.has("derived") && g.kinds.has("manual")
        ? "both"
        : g.kinds.has("manual")
          ? "manual"
          : "derived",
    bases: [...g.bases],
    latestSince: g.latestSince,
  }));

  // Sort: current user first; then by latestSince desc.
  claimants.sort((a, b) => {
    if (a.user.id === currentUserId && b.user.id !== currentUserId) return -1;
    if (b.user.id === currentUserId && a.user.id !== currentUserId) return 1;
    const aT = a.latestSince?.getTime() ?? 0;
    const bT = b.latestSince?.getTime() ?? 0;
    return bT - aT;
  });

  return NextResponse.json({
    claimants: claimants.map(({ latestSince: _, ...rest }) => rest),
  });
}
```

- [ ] **Step 4: Run tests (expect pass)**

```bash
npm test -- src/app/api/districts/\[leaid\]/claimants
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/districts/\[leaid\]/claimants
git commit -m "feat(claims): GET /api/districts/[leaid]/claimants"
```

---

### Task 7: API — `POST /api/districts/[leaid]/claims` (idempotent claim)

**Files:**
- Create: `src/app/api/districts/[leaid]/claims/route.ts`
- Create: `src/app/api/districts/[leaid]/claims/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/districts/[leaid]/claims/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    districtManualClaim: {
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

import { POST } from "../route";
import prisma from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

describe("POST /api/districts/[leaid]/claims", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts a manual claim for the current user", async () => {
    mockPrisma.districtManualClaim.upsert.mockResolvedValueOnce({
      id: "row-1",
      districtLeaid: "1234567",
      userId: "user-1",
      claimedAt: new Date("2026-05-04"),
      lastActivityAt: new Date("2026-05-04"),
      note: null,
    });

    const req = new NextRequest("http://localhost/api/districts/1234567/claims", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ leaid: "1234567" }) });

    expect(res.status).toBe(200);
    expect(mockPrisma.districtManualClaim.upsert).toHaveBeenCalledWith({
      where: { districtLeaid_userId: { districtLeaid: "1234567", userId: "user-1" } },
      create: { districtLeaid: "1234567", userId: "user-1" },
      update: { lastActivityAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run test (fails — no route)**

```bash
npm test -- src/app/api/districts/\[leaid\]/claims
```

- [ ] **Step 3: Write the route**

```ts
// src/app/api/districts/[leaid]/claims/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ leaid: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { leaid } = await ctx.params;

  const claim = await prisma.districtManualClaim.upsert({
    where: { districtLeaid_userId: { districtLeaid: leaid, userId: user.id } },
    create: { districtLeaid: leaid, userId: user.id },
    update: { lastActivityAt: new Date() },
  });
  return NextResponse.json({ claim });
}
```

- [ ] **Step 4: Run test (passes)**

```bash
npm test -- src/app/api/districts/\[leaid\]/claims
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/districts/\[leaid\]/claims
git commit -m "feat(claims): POST /api/districts/[leaid]/claims (idempotent)"
```

---

### Task 8: API — `DELETE /api/districts/[leaid]/claims/me`

**Files:**
- Create: `src/app/api/districts/[leaid]/claims/me/route.ts`
- Create: `src/app/api/districts/[leaid]/claims/me/__tests__/route.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// src/app/api/districts/[leaid]/claims/me/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    districtManualClaim: { delete: vi.fn() },
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

import { DELETE } from "../route";
import prisma from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

describe("DELETE /api/districts/[leaid]/claims/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes the current user's claim", async () => {
    mockPrisma.districtManualClaim.delete.mockResolvedValueOnce({});
    const req = new NextRequest("http://localhost/api/districts/1234567/claims/me", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ leaid: "1234567" }) });
    expect(res.status).toBe(204);
    expect(mockPrisma.districtManualClaim.delete).toHaveBeenCalledWith({
      where: { districtLeaid_userId: { districtLeaid: "1234567", userId: "user-1" } },
    });
  });

  it("returns 404 if no claim exists", async () => {
    const err = new Error("not found");
    // Prisma throws P2025 when delete misses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).code = "P2025";
    mockPrisma.districtManualClaim.delete.mockRejectedValueOnce(err);

    const req = new NextRequest("http://localhost/api/districts/1234567/claims/me", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params: Promise.resolve({ leaid: "1234567" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run (fails)**

```bash
npm test -- src/app/api/districts/\[leaid\]/claims/me
```

- [ ] **Step 3: Write route**

```ts
// src/app/api/districts/[leaid]/claims/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ leaid: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { leaid } = await ctx.params;

  try {
    await prisma.districtManualClaim.delete({
      where: { districtLeaid_userId: { districtLeaid: leaid, userId: user.id } },
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.code === "P2025") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    throw e;
  }
}
```

- [ ] **Step 4: Run (passes)**
- [ ] **Step 5: Commit**

```bash
git add src/app/api/districts/\[leaid\]/claims/me
git commit -m "feat(claims): DELETE /api/districts/[leaid]/claims/me"
```

---

### Task 9: API — `POST /api/districts/[leaid]/claims/transfer`

**Files:**
- Create: `src/app/api/districts/[leaid]/claims/transfer/route.ts`
- Create: `src/app/api/districts/[leaid]/claims/transfer/__tests__/route.test.ts`

- [ ] **Step 1: Failing test**

```ts
// src/app/api/districts/[leaid]/claims/transfer/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    $transaction: vi.fn(),
    districtManualClaim: {
      delete: vi.fn(),
      create: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-from", email: "from@example.com" }),
}));

import { POST } from "../route";
import prisma from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

describe("POST /api/districts/[leaid]/claims/transfer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("atomically deletes source and creates target with transfer note", async () => {
    mockPrisma.userProfile.findUnique.mockResolvedValueOnce({
      id: "user-from",
      fullName: "Alice From",
    });
    mockPrisma.$transaction.mockImplementationOnce(async (fn: any) => {
      // simulate Prisma callback transaction
      return fn(mockPrisma);
    });
    mockPrisma.districtManualClaim.delete.mockResolvedValueOnce({});
    mockPrisma.districtManualClaim.create.mockResolvedValueOnce({
      id: "row-2",
      districtLeaid: "1234567",
      userId: "user-to",
      note: "transferred from Alice From",
    });

    const req = new NextRequest("http://localhost/api/districts/1234567/claims/transfer", {
      method: "POST",
      body: JSON.stringify({ toUserId: "user-to" }),
    });
    const res = await POST(req, { params: Promise.resolve({ leaid: "1234567" }) });

    expect(res.status).toBe(200);
    expect(mockPrisma.districtManualClaim.delete).toHaveBeenCalledWith({
      where: { districtLeaid_userId: { districtLeaid: "1234567", userId: "user-from" } },
    });
    expect(mockPrisma.districtManualClaim.create).toHaveBeenCalledWith({
      data: {
        districtLeaid: "1234567",
        userId: "user-to",
        note: "transferred from Alice From",
      },
    });
  });

  it("returns 404 if caller has no claim", async () => {
    mockPrisma.userProfile.findUnique.mockResolvedValueOnce({
      id: "user-from",
      fullName: "Alice",
    });
    mockPrisma.$transaction.mockImplementationOnce(async (fn: any) => fn(mockPrisma));
    const err = new Error("not found");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).code = "P2025";
    mockPrisma.districtManualClaim.delete.mockRejectedValueOnce(err);

    const req = new NextRequest("http://localhost/api/districts/1234567/claims/transfer", {
      method: "POST",
      body: JSON.stringify({ toUserId: "user-to" }),
    });
    const res = await POST(req, { params: Promise.resolve({ leaid: "1234567" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run (fails)**

- [ ] **Step 3: Write the route**

```ts
// src/app/api/districts/[leaid]/claims/transfer/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ leaid: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { leaid } = await ctx.params;
  const { toUserId } = (await req.json()) as { toUserId: string };
  if (!toUserId) {
    return NextResponse.json({ error: "toUserId required" }, { status: 400 });
  }

  const fromProfile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { fullName: true },
  });
  const note = `transferred from ${fromProfile?.fullName ?? user.id}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.districtManualClaim.delete({
        where: {
          districtLeaid_userId: { districtLeaid: leaid, userId: user.id },
        },
      });
      const created = await tx.districtManualClaim.create({
        data: { districtLeaid: leaid, userId: toUserId, note },
      });
      return created;
    });
    return NextResponse.json({ claim: result });
  } catch (e) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((e as any)?.code === "P2025") {
      return NextResponse.json({ error: "no existing claim" }, { status: 404 });
    }
    throw e;
  }
}
```

- [ ] **Step 4: Run (passes)**
- [ ] **Step 5: Commit**

```bash
git add src/app/api/districts/\[leaid\]/claims/transfer
git commit -m "feat(claims): POST /api/districts/[leaid]/claims/transfer"
```

---

### Task 10: Cron — `refresh-claim-activity`

**Files:**
- Create: `src/app/api/cron/refresh-claim-activity/route.ts`
- Create: `src/app/api/cron/refresh-claim-activity/__tests__/route.test.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Failing test**

```ts
// src/app/api/cron/refresh-claim-activity/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: { $executeRaw: vi.fn().mockResolvedValue(7) },
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

describe("GET /api/cron/refresh-claim-activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret";
  });

  it("rejects without secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/refresh-claim-activity");
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("runs the recompute SQL when authorized", async () => {
    const req = new NextRequest(
      "http://localhost/api/cron/refresh-claim-activity?secret=secret",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    const body = await res.json();
    expect(body.updated).toBe(7);
  });
});
```

- [ ] **Step 2: Run (fails)**

- [ ] **Step 3: Write the cron route**

```ts
// src/app/api/cron/refresh-claim-activity/route.ts
//
// Daily cron — recomputes district_manual_claims.last_activity_at as the most
// recent of: (a) opps where the rep is salesRepId, latest of created_at /
// close_date / latest stage_history entry; (b) plans the rep owns or
// collaborates on that contain the district, plan.updated_at; (c) activities
// linked to the district where activity.user_id = rep.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const updated = await prisma.$executeRaw`
    WITH activity AS (
      SELECT
        mc.district_leaid,
        mc.user_id,
        GREATEST(
          (SELECT MAX(GREATEST(o.created_at, COALESCE(o.close_date, o.created_at)))
             FROM opportunities o
             WHERE o.district_lea_id = mc.district_leaid
               AND o.sales_rep_id = mc.user_id),
          (SELECT MAX(tp.updated_at)
             FROM territory_plans tp
             JOIN territory_plan_districts tpd ON tpd.plan_id = tp.id
             WHERE tpd.district_leaid = mc.district_leaid
               AND (tp.owner_id = mc.user_id
                    OR EXISTS (SELECT 1 FROM territory_plan_collaborators tpc
                                WHERE tpc.plan_id = tp.id AND tpc.user_id = mc.user_id))),
          (SELECT MAX(a.created_at)
             FROM activity_districts ad
             JOIN activities a ON a.id = ad.activity_id
             WHERE ad.district_leaid = mc.district_leaid
               AND a.user_id = mc.user_id)
        ) AS latest
      FROM district_manual_claims mc
    )
    UPDATE district_manual_claims mc
       SET last_activity_at = activity.latest
      FROM activity
     WHERE mc.district_leaid = activity.district_leaid
       AND mc.user_id = activity.user_id
       AND activity.latest IS NOT NULL
       AND activity.latest > mc.last_activity_at
  `;

  return NextResponse.json({ updated });
}
```

> **Note for the implementing engineer:** the spec mentions reading the latest entry from `opportunities.stage_history`. That field is JSON with array entries; deriving the latest timestamp inline in SQL adds complexity. The first iteration only uses `created_at` and `close_date` — accurate enough since reps who interact with an opp also touch one of those columns through normal Salesforce sync. If a regression shows claims expiring while reps are demonstrably moving stages, add a `MAX((entry->>'at')::timestamptz)` over the JSON array.

- [ ] **Step 4: Verify activity-link table names**

Confirm in `prisma/schema.prisma` that the join tables are spelled `activity_districts` (the model is `ActivityDistrict`). If the actual `@@map` differs, update the SQL accordingly.

```bash
grep -A2 "model ActivityDistrict" prisma/schema.prisma
```

- [ ] **Step 5: Run tests (passes)**

- [ ] **Step 6: Register the cron in `vercel.json`**

In `vercel.json`, add to the `crons` array:

```json
{
  "path": "/api/cron/refresh-claim-activity?secret=${CRON_SECRET}",
  "schedule": "30 4 * * *"
}
```

(4:30 AM UTC daily, before the expiry job below runs.)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/refresh-claim-activity vercel.json
git commit -m "feat(claims): refresh-claim-activity cron"
```

---

### Task 11: Cron — `expire-manual-claims`

**Files:**
- Create: `src/app/api/cron/expire-manual-claims/route.ts`
- Create: `src/app/api/cron/expire-manual-claims/__tests__/route.test.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Failing test**

```ts
// src/app/api/cron/expire-manual-claims/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    districtManualClaim: { deleteMany: vi.fn() },
  },
}));

import { GET } from "../route";
import prisma from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

describe("GET /api/cron/expire-manual-claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret";
  });

  it("rejects without secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/expire-manual-claims");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("deletes claims with last_activity_at older than 6 months", async () => {
    mockPrisma.districtManualClaim.deleteMany.mockResolvedValueOnce({ count: 3 });
    const req = new NextRequest(
      "http://localhost/api/cron/expire-manual-claims?secret=secret",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(3);

    const arg = mockPrisma.districtManualClaim.deleteMany.mock.calls[0][0];
    const cutoff = arg.where.lastActivityAt.lt as Date;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    // within ~10 seconds of "now minus 6 months"
    expect(Math.abs(cutoff.getTime() - sixMonthsAgo.getTime())).toBeLessThan(10_000);
  });
});
```

- [ ] **Step 2: Run (fails)**

- [ ] **Step 3: Write the cron route**

```ts
// src/app/api/cron/expire-manual-claims/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);

  const { count } = await prisma.districtManualClaim.deleteMany({
    where: { lastActivityAt: { lt: cutoff } },
  });

  console.log(`[expire-manual-claims] deleted ${count} stale claims (cutoff ${cutoff.toISOString()})`);
  return NextResponse.json({ deleted: count, cutoff: cutoff.toISOString() });
}
```

- [ ] **Step 4: Tests pass**

- [ ] **Step 5: Register cron in `vercel.json`**

```json
{
  "path": "/api/cron/expire-manual-claims?secret=${CRON_SECRET}",
  "schedule": "0 5 * * *"
}
```

(5:00 AM UTC daily, after the activity-refresh job.)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/expire-manual-claims vercel.json
git commit -m "feat(claims): expire-manual-claims cron"
```

---

### Task 12: `<DistrictClaimants>` component (compact + detail)

**Files:**
- Create: `src/features/districts/components/DistrictClaimants.tsx`
- Create: `src/features/districts/components/__tests__/DistrictClaimants.test.tsx`

- [ ] **Step 1: Read `Documentation/UI Framework/tokens.md` (avatar, chip, plum tokens)**

```bash
grep -A4 "avatar\|chip\|stack" "Documentation/UI Framework/tokens.md" | head -60
```

- [ ] **Step 2: Failing tests**

```tsx
// src/features/districts/components/__tests__/DistrictClaimants.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DistrictClaimants } from "../DistrictClaimants";

const baseUser = (id: string, name: string) => ({
  id,
  fullName: name,
  avatarUrl: null,
});

describe("<DistrictClaimants compact>", () => {
  it("renders nothing when there are zero claimants", () => {
    const { container } = render(
      <DistrictClaimants
        variant="compact"
        currentUserId="me"
        claimants={[]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders up to 3 avatars and a +N pill for the rest", () => {
    const claimants = [1, 2, 3, 4, 5].map((i) => ({
      user: baseUser(`u${i}`, `Rep ${i}`),
      kind: "derived" as const,
      bases: ["open_pipeline" as const],
    }));
    render(
      <DistrictClaimants variant="compact" currentUserId="me" claimants={claimants} />,
    );
    expect(screen.getAllByTestId("claimant-avatar")).toHaveLength(3);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("highlights the current user's avatar", () => {
    const claimants = [
      { user: baseUser("me", "You"), kind: "manual" as const, bases: ["manual_claim" as const] },
      { user: baseUser("u2", "Other"), kind: "derived" as const, bases: ["open_pipeline" as const] },
    ];
    render(
      <DistrictClaimants variant="compact" currentUserId="me" claimants={claimants} />,
    );
    const meAvatar = screen.getAllByTestId("claimant-avatar")[0];
    expect(meAvatar).toHaveAttribute("data-current-user", "true");
  });
});

describe("<DistrictClaimants detail>", () => {
  const claimants = [
    {
      user: baseUser("me", "Sierra"),
      kind: "both" as const,
      bases: ["open_pipeline" as const, "manual_claim" as const],
    },
  ];

  it("shows Release + Transfer buttons when current user is a manual claimant", () => {
    render(
      <DistrictClaimants
        variant="detail"
        currentUserId="me"
        claimants={claimants}
        onClaim={() => {}}
        onRelease={() => {}}
        onTransfer={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /release/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /transfer/i })).toBeInTheDocument();
  });

  it("shows Claim button when current user is not a claimant", () => {
    render(
      <DistrictClaimants
        variant="detail"
        currentUserId="someone-else"
        claimants={claimants}
        onClaim={() => {}}
        onRelease={() => {}}
        onTransfer={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /claim this district/i })).toBeInTheDocument();
  });

  it("shows a basis chip per basis on each row", () => {
    render(
      <DistrictClaimants
        variant="detail"
        currentUserId="me"
        claimants={claimants}
        onClaim={() => {}}
        onRelease={() => {}}
        onTransfer={() => {}}
      />,
    );
    expect(screen.getByText(/open pipeline/i)).toBeInTheDocument();
    expect(screen.getByText(/manual claim/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests (fail — no component)**

```bash
npm test -- src/features/districts/components/__tests__/DistrictClaimants
```

- [ ] **Step 4: Write the component**

```tsx
// src/features/districts/components/DistrictClaimants.tsx
"use client";

import { useState } from "react";

export type ClaimantBasis =
  | "open_pipeline"
  | "recently_closed"
  | "plan_owner"
  | "plan_collaborator"
  | "manual_claim";

export type Claimant = {
  user: { id: string; fullName: string | null; avatarUrl: string | null };
  kind: "derived" | "manual" | "both";
  bases: ClaimantBasis[];
};

const BASIS_LABELS: Record<ClaimantBasis, string> = {
  open_pipeline: "Open pipeline",
  recently_closed: "Recently closed",
  plan_owner: "Plan owner",
  plan_collaborator: "Collaborator",
  manual_claim: "Manual claim",
};

const BASIS_TONE: Record<ClaimantBasis, string> = {
  open_pipeline: "bg-plum/10 text-plum",
  recently_closed: "bg-plum/5 text-plum/70",
  plan_owner: "bg-[#EFEDF5] text-[#544A78]",
  plan_collaborator: "bg-[#F7F5FA] text-[#6E6390]",
  manual_claim: "bg-[#EFEDF5] text-[#544A78]",
};

function Initials({ name }: { name: string | null }) {
  const parts = (name ?? "?").split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`
      : (parts[0] ?? "?").slice(0, 2);
  return <>{initials.toUpperCase()}</>;
}

function Avatar({
  user,
  isCurrentUser,
}: {
  user: Claimant["user"];
  isCurrentUser: boolean;
}) {
  return (
    <span
      data-testid="claimant-avatar"
      data-current-user={isCurrentUser ? "true" : "false"}
      title={user.fullName ?? ""}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold ${
        isCurrentUser
          ? "ring-2 ring-plum/60 bg-plum text-white"
          : "bg-[#EFEDF5] text-[#544A78]"
      }`}
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <Initials name={user.fullName} />
      )}
    </span>
  );
}

interface CompactProps {
  variant: "compact";
  currentUserId: string | null;
  claimants: Claimant[];
}

interface DetailProps {
  variant: "detail";
  currentUserId: string | null;
  claimants: Claimant[];
  onClaim: () => void;
  onRelease: () => void;
  onTransfer: (toUserId: string) => void;
}

export function DistrictClaimants(props: CompactProps | DetailProps) {
  if (props.variant === "compact") {
    if (props.claimants.length === 0) return null;
    const visible = props.claimants.slice(0, 3);
    const overflow = props.claimants.length - visible.length;
    return (
      <span className="inline-flex items-center -space-x-2">
        {visible.map((c) => (
          <Avatar
            key={c.user.id}
            user={c.user}
            isCurrentUser={c.user.id === props.currentUserId}
          />
        ))}
        {overflow > 0 && (
          <span className="inline-flex h-6 items-center justify-center rounded-full bg-[#EFEDF5] px-1.5 text-[10px] font-semibold text-[#544A78] border-2 border-white">
            +{overflow}
          </span>
        )}
      </span>
    );
  }

  return <DetailVariant {...props} />;
}

function DetailVariant(props: DetailProps) {
  const isMine = props.claimants.some(
    (c) => c.user.id === props.currentUserId && (c.kind === "manual" || c.kind === "both"),
  );

  return (
    <section className="space-y-3">
      <ul className="space-y-2">
        {props.claimants.map((c) => (
          <li
            key={c.user.id}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <Avatar
              user={c.user}
              isCurrentUser={c.user.id === props.currentUserId}
            />
            <span className="text-sm font-medium text-[#544A78]">
              {c.user.fullName ?? "(unknown user)"}
            </span>
            <span className="flex flex-wrap items-center gap-1">
              {c.bases.map((b) => (
                <span
                  key={b}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${BASIS_TONE[b]}`}
                >
                  {BASIS_LABELS[b]}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>

      {isMine ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={props.onRelease}
            className="px-3 py-1.5 text-xs rounded-lg border border-[#D4CFE2] text-[#544A78] hover:bg-[#F7F5FA]"
          >
            Release
          </button>
          <TransferButton onTransfer={props.onTransfer} />
        </div>
      ) : (
        <button
          type="button"
          onClick={props.onClaim}
          className="px-3 py-1.5 text-xs rounded-lg bg-plum text-white hover:bg-plum/90"
        >
          Claim this district
        </button>
      )}
    </section>
  );
}

function TransferButton({ onTransfer }: { onTransfer: (toUserId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [toUserId, setToUserId] = useState("");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs rounded-lg border border-[#D4CFE2] text-[#544A78] hover:bg-[#F7F5FA]"
      >
        Transfer…
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white p-4 rounded-lg w-72 space-y-3">
            <h3 className="text-sm font-semibold text-[#544A78]">Transfer claim</h3>
            <input
              autoFocus
              type="text"
              placeholder="Target user id"
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="w-full px-2 py-1 border border-[#D4CFE2] rounded text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-2 py-1 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!toUserId}
                onClick={() => {
                  onTransfer(toUserId);
                  setOpen(false);
                }}
                className="px-2 py-1 text-xs rounded bg-plum text-white disabled:opacity-50"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

> The transfer modal uses a raw user-id input as a v1 placeholder. The user-picker modal exists elsewhere in the codebase (see `src/features/map/components/SearchResults/PlanDetailSidebar.tsx`'s owner select for a working `useUsers` hook). A follow-up task could swap the text input for that picker — kept simple here so the test can drive a transfer without a network mock.

- [ ] **Step 5: Run tests (pass)**

- [ ] **Step 6: Commit**

```bash
git add src/features/districts/components/DistrictClaimants.tsx \
        src/features/districts/components/__tests__/DistrictClaimants.test.tsx
git commit -m "feat(claims): DistrictClaimants component (compact + detail)"
```

---

### Task 13: Hooks for the claim API

**Files:**
- Modify: `src/features/districts/lib/queries.ts`

- [ ] **Step 1: Add hooks**

Append to `src/features/districts/lib/queries.ts`:

```ts
// ===== Claims =====

import type { Claimant } from "@/features/districts/components/DistrictClaimants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useDistrictClaimants(leaid: string | null) {
  return useQuery({
    queryKey: ["district-claimants", leaid],
    enabled: !!leaid,
    queryFn: async (): Promise<{ claimants: Claimant[] }> => {
      const res = await fetch(`/api/districts/${leaid}/claimants`);
      if (!res.ok) throw new Error("failed to load claimants");
      return res.json();
    },
  });
}

export function useClaimDistrict(leaid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/districts/${leaid}/claims`, { method: "POST" });
      if (!res.ok) throw new Error("claim failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["district-claimants", leaid] }),
  });
}

export function useReleaseClaim(leaid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/districts/${leaid}/claims/me`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("release failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["district-claimants", leaid] }),
  });
}

export function useTransferClaim(leaid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (toUserId: string) => {
      const res = await fetch(`/api/districts/${leaid}/claims/transfer`, {
        method: "POST",
        body: JSON.stringify({ toUserId }),
      });
      if (!res.ok) throw new Error("transfer failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["district-claimants", leaid] }),
  });
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/districts/lib/queries.ts
git commit -m "feat(claims): hooks for claim/release/transfer + claimants list"
```

---

### Task 14: Wire `<DistrictClaimants>` into the search-result card

**Files:**
- Modify: `src/features/map/components/SearchResults/DistrictSearchCard.tsx`
- Modify: `src/app/api/districts/search/route.ts`
- Modify: `src/features/shared/types/api-types.ts`

- [ ] **Step 1: Add `claimantSummary` to the search API response**

In `src/app/api/districts/search/route.ts`, drop the `ownerUser` Prisma include. Add a single SQL query after the main district fetch that pulls `(user_id, avatar_url, full_name)` per leaid from `district_claimants_v` for the page's leaids, then attach to each row:

```ts
// after the existing district fetch
const leaids = districts.map((d) => d.leaid);
const claimantsRows = leaids.length
  ? await prisma.$queryRaw<{
      district_leaid: string;
      user_id: string;
      avatar_url: string | null;
    }[]>`
      SELECT cv.district_leaid, cv.user_id, up.avatar_url
        FROM district_claimants_v cv
        JOIN user_profiles up ON up.id = cv.user_id
       WHERE cv.district_leaid = ANY(${leaids})
    `
  : [];

const summariesByLeaid = new Map<
  string,
  { count: number; currentUserIsClaimant: boolean; topAvatars: { id: string; avatarUrl: string | null }[] }
>();
for (const row of claimantsRows) {
  const s = summariesByLeaid.get(row.district_leaid) ?? {
    count: 0,
    currentUserIsClaimant: false,
    topAvatars: [],
  };
  if (!s.topAvatars.find((a) => a.id === row.user_id)) {
    s.count += 1;
    if (row.user_id === currentUserId) s.currentUserIsClaimant = true;
    if (s.topAvatars.length < 3) {
      s.topAvatars.push({ id: row.user_id, avatarUrl: row.avatar_url });
    }
  }
  summariesByLeaid.set(row.district_leaid, s);
}

// when shaping the response, attach:
//   claimantSummary: summariesByLeaid.get(d.leaid) ?? { count: 0, currentUserIsClaimant: false, topAvatars: [] }
```

(`currentUserId` should come from `await getUser()`; add the import if not present.)

- [ ] **Step 2: Update the response type**

In `src/features/shared/types/api-types.ts`, find the district-search response shape and replace the `ownerUser` field with:

```ts
claimantSummary: {
  count: number;
  currentUserIsClaimant: boolean;
  topAvatars: { id: string; avatarUrl: string | null }[];
};
```

- [ ] **Step 3: Update `DistrictSearchCard.tsx`**

Find lines 100-104 (the current `ownerUser` block):

```tsx
{district.ownerUser && (
  <span className="text-xs text-[#8A80A8] truncate max-w-[100px]">
    {district.ownerUser.fullName}
  </span>
)}
```

Replace with:

```tsx
{district.claimantSummary?.count > 0 && (
  <DistrictClaimants
    variant="compact"
    currentUserId={currentUserId ?? null}
    claimants={district.claimantSummary.topAvatars.map((a) => ({
      user: { id: a.id, fullName: null, avatarUrl: a.avatarUrl },
      kind: a.id === currentUserId ? "manual" : "derived",
      bases: [],
    }))}
  />
)}
```

`currentUserId` comes from a `useProfile()` hook (see `src/features/...` for existing usage; if absent in this file, lift it from the parent `<SearchResults>` and pass via a prop).

Also update the `District` type at the top of the file:

```tsx
// Replace:
//   ownerUser: { id: string; fullName: string; avatarUrl: string | null } | null;
// with:
   claimantSummary: {
     count: number;
     currentUserIsClaimant: boolean;
     topAvatars: { id: string; avatarUrl: string | null }[];
   };
```

- [ ] **Step 4: Update test fixtures in `DistrictSearchCard.test.tsx`**

Find the test mock object and replace `ownerUser: null` with:

```tsx
claimantSummary: { count: 0, currentUserIsClaimant: false, topAvatars: [] },
```

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all green.

- [ ] **Step 6: Smoke-test in dev**

```bash
npm run dev
# Browse to a district list page, verify avatars render where appropriate.
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/districts/search src/features/map/components/SearchResults/DistrictSearchCard.tsx \
        src/features/map/components/SearchResults/__tests__ src/features/shared/types/api-types.ts
git commit -m "feat(claims): replace owner badge with claimant avatar stack on search card"
```

---

### Task 15: Wire claims into the district detail panel

**Files:**
- Modify: `src/features/districts/components/DistrictHeader.tsx` (or whatever panel hosts the existing owner display)
- Modify: `src/app/api/districts/[leaid]/route.ts` (drop `ownerUser`/`salesExecutiveUser`)
- Create: snippet — wherever the detail panel renders, mount `<DistrictClaimants variant="detail" ...>` with hooks from Task 13

- [ ] **Step 1: Drop owner-related fields from `[leaid]/route.ts`**

Lines 41-44, 104-118 in `src/app/api/districts/[leaid]/route.ts`:

- Delete `ownerUser: { select: { id: true, fullName: true, avatarUrl: true } }` from the include.
- Delete `salesExecutiveUser: { select: ... }` from the include.
- Delete the `salesExecutive: ...` field-shape on the response.
- Delete the `edits.owner` field on the response.
- Delete the conditional block that emits `edits` when only `ownerId` is present (replace with `district.notes != null ? { notes, notesUpdatedAt } : undefined`).

- [ ] **Step 2: Update existing test fixtures**

In `src/app/api/districts/[leaid]/__tests__/route.test.ts` (around line 44), remove `ownerUser: null` and `salesExecutiveUser: null` from the mock — they should not be requested anymore. Run tests:

```bash
npm test -- src/app/api/districts/\[leaid\]
```

- [ ] **Step 3: Mount `<DistrictClaimants variant="detail">` in the detail panel**

In `src/features/districts/components/DistrictHeader.tsx` (around line 156), DELETE the `salesExecutive` block:

```tsx
{fullmindData?.salesExecutive?.fullName && (
  ...
  {fullmindData.salesExecutive.fullName}
  ...
)}
```

Then, just below the existing header content, add a `Claims` section:

```tsx
{leaid && (
  <ClaimsSection leaid={leaid} />
)}
```

And define `ClaimsSection` in the same file (or extract to its own file if the file's already big):

```tsx
function ClaimsSection({ leaid }: { leaid: string }) {
  const { data, isLoading } = useDistrictClaimants(leaid);
  const profile = useProfile();
  const claim = useClaimDistrict(leaid);
  const release = useReleaseClaim(leaid);
  const transfer = useTransferClaim(leaid);

  if (isLoading) {
    return <p className="text-xs text-[#8A80A8]">Loading claims…</p>;
  }
  return (
    <DistrictClaimants
      variant="detail"
      currentUserId={profile?.id ?? null}
      claimants={data?.claimants ?? []}
      onClaim={() => claim.mutate()}
      onRelease={() => release.mutate()}
      onTransfer={(toUserId) => transfer.mutate(toUserId)}
    />
  );
}
```

Make sure imports include the hooks from Task 13 + the component from Task 12 + `useProfile` from wherever it currently lives.

- [ ] **Step 4: Smoke-test in dev**

```bash
npm run dev
# Open a district. Verify Claims section renders, "Claim this district" button appears for non-claimants.
# Click claim, see the avatar appear, see Release + Transfer buttons. Click Release. Refresh.
```

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/districts/\[leaid\] src/features/districts/components/DistrictHeader.tsx
git commit -m "feat(claims): claims section on district detail; drop sales-executive row"
```

---

### Task 16: "Mine" filter chip on the district list

**Files:**
- Modify: `src/app/api/districts/route.ts` (already has `salesExec`; add `claimedBy`)
- Modify: `src/app/api/districts/search/route.ts` (claimedBy filter)
- Modify: `src/features/map/components/SearchBar/FilterPills.tsx`
- Modify: `src/features/shared/lib/app-store.ts` (add `claimedBy` slice)
- Modify: relevant query hook in `src/features/districts/lib/queries.ts`

- [ ] **Step 1: Add `claimedBy` filter to API**

In `src/app/api/districts/route.ts` (near the existing `salesExec` handling around line 86):

```ts
const claimedBy = searchParams.get("claimedBy");
if (claimedBy) {
  // Restrict to districts where this user has any kind of claim.
  // Prisma can't filter on a view, so use a raw subquery.
  where.leaid = {
    in: await prisma.$queryRaw<{ leaid: string }[]>`
      SELECT DISTINCT district_leaid AS leaid
        FROM district_claimants_v
       WHERE user_id = ${claimedBy}::uuid
    `.then((rows) => rows.map((r) => r.leaid)),
  };
}
```

Add the same handling to `src/app/api/districts/search/route.ts`.

- [ ] **Step 2: Add `mine` chip to filter pills**

In `src/features/map/components/SearchBar/FilterPills.tsx`, add a new chip type next to existing ones (`isCustomer`, `hasOpenPipeline`):

```tsx
{
  key: "mine",
  label: "Mine",
  active: filters.claimedBy === currentUserId,
  toggle: () =>
    setFilter(
      "claimedBy",
      filters.claimedBy === currentUserId ? null : currentUserId,
    ),
},
```

(Adapt to the file's actual chip-list shape.)

- [ ] **Step 3: Default the chip on for the current user**

In `src/features/shared/lib/app-store.ts`, where filter defaults live, default `claimedBy` to the current user's id on first init. Use a ref/effect guard so it only sets the default once and doesn't overwrite later "Show all" toggles.

- [ ] **Step 4: Run tests + dev smoke**

```bash
npm test
npm run dev
# Verify "Mine" chip appears + is on by default for the logged-in user.
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/districts/route.ts src/app/api/districts/search \
        src/features/map/components/SearchBar/FilterPills.tsx \
        src/features/shared/lib/app-store.ts
git commit -m "feat(claims): Mine filter chip — defaults to current user"
```

---

### Task 17: Drop ownerId / salesExec / territoryOwnerId edit & filter params

**Files:**
- Modify: `src/app/api/districts/[leaid]/edits/route.ts`
- Modify: `src/app/api/districts/batch-edits/route.ts`
- Modify: `src/app/api/districts/route.ts`
- Modify: `src/app/api/states/[code]/route.ts`
- Modify: `src/app/api/states/[code]/districts/route.ts`
- Modify: `src/app/api/schools/[ncessch]/route.ts`
- Modify: `src/app/api/schools/[ncessch]/edits/route.ts`
- Modify: `src/app/api/accounts/route.ts`
- Modify: `src/app/api/tiles/[z]/[x]/[y]/route.ts`
- Modify: `src/features/districts/lib/queries.ts`
- Modify: `src/features/shared/lib/queries.ts`
- Modify: `src/features/shared/lib/filters.ts`
- Modify: `src/features/shared/lib/app-store.ts`
- Modify: `src/features/shared/types/api-types.ts`
- Modify: `src/lib/district-column-metadata.ts`
- Modify: `src/features/map/components/MapV2Container.tsx`
- Modify: `src/features/map/components/SearchBar/SearchBar.tsx`, `FullmindDropdown.tsx`, `DistrictsDropdown.tsx`

(The list looks long but each file gets a handful of focused deletions.)

- [ ] **Step 1: Edit endpoints — remove `ownerId` from accepted body**

In `src/app/api/districts/[leaid]/edits/route.ts`, drop the `ownerId` destructure and the `ownerId !== undefined ? ... : undefined` line. Drop `ownerUser` from the post-update include and the response shaping.

- [ ] **Step 2: Batch edits — drop `ownerId`**

In `src/app/api/districts/batch-edits/route.ts`:
- Remove `ownerId` from the destructure.
- Change validation to: `if (notes === undefined) return 400`.
- Remove `if (ownerId !== undefined) data.ownerId = ownerId || null;`.

- [ ] **Step 3: Districts list — drop `salesExec` filter**

In `src/app/api/districts/route.ts`, remove the `where.salesExecutiveId = salesExec` line and the `salesExec` query-param read.

- [ ] **Step 4: States detail — drop territory owner**

In `src/app/api/states/[code]/route.ts`:
- Drop `territoryOwnerUser: { select: ... }` from include (lines 86, 285, 313, 325).
- Drop `territoryOwner: state.territoryOwnerUser ? ...` from response shaping (lines 135, 248, 333).
- Drop `territoryOwnerId` destructure from PATCH body (line 279); drop `...territoryOwnerId !== undefined && {...}` block (line 322).

- [ ] **Step 5: States districts — drop `salesExecutiveUser`**

In `src/app/api/states/[code]/districts/route.ts`, drop `salesExecutiveUser` from the include (line 66) and `salesExecutive: d.salesExecutiveUser ? ...` from the per-row mapping (line 94).

- [ ] **Step 6: Schools — drop owner**

In `src/app/api/schools/[ncessch]/route.ts` and `edits/route.ts`, drop the `owner` field from the response shaping. Drop `ownerUser` from the include if present.

- [ ] **Step 7: Accounts — drop salesExecutiveId**

In `src/app/api/accounts/route.ts`, drop `salesExecutiveId` from the destructure and from the create-data object (lines 34, 94).

- [ ] **Step 8: Tiles — drop sales_executive columns**

In `src/app/api/tiles/[z]/[x]/[y]/route.ts`, drop `d.sales_executive_id,` and `d.sales_executive_name,` from the SELECT (lines 94-95). Make sure the surrounding feature-properties object no longer references either.

- [ ] **Step 9: TanStack Query consumers**

In `src/features/districts/lib/queries.ts`:
- Drop `salesExecutive?: string | null` from the params interface and the `searchParams.set("salesExec", ...)` line.
- Drop `salesExecutiveId?: string` from the edit-payload interface.

In `src/features/shared/lib/queries.ts`, delete the entire `useSalesExecutives` hook (the one with `queryKey: ["salesExecutives"]`).

- [ ] **Step 10: Filter / store / type cleanup**

- `src/features/shared/lib/filters.ts`: delete the `salesExecutive: "salesExecutiveId"` field-map entry.
- `src/features/shared/lib/app-store.ts`: delete the `salesExecutive` filter slice entirely.
- `src/features/shared/types/api-types.ts`: drop `salesExecutive: PersonRef | null` (3 occurrences) and `territoryOwner: PersonRef | null` (1 occurrence).
- `src/lib/district-column-metadata.ts:2321`: delete the `territoryOwnerId` metadata entry.
- `src/features/map/components/MapV2Container.tsx:1028`: delete `salesExecutive: props?.sales_executive_name,`.
- `src/features/map/components/SearchBar/SearchBar.tsx` (or `index.tsx`), `FullmindDropdown.tsx`, `DistrictsDropdown.tsx`: remove `"salesExecutive"`, `"owner"` from the column allow-list arrays. Delete the `<FullmindDropdown column="salesExecutive">` (and the duplicate in DistrictsDropdown). Delete `salesExecutive: "Sales Exec"` from the `FilterPills` label map.

- [ ] **Step 11: Drop the "Owner" stat from the explore modal**

In `src/features/map/components/SearchResults/DistrictExploreModal.tsx` lines 285-286, delete the `<SidebarStat label="Owner" value={fullmindData.salesExecutive.fullName} />` block.

- [ ] **Step 12: Run typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Fix any compile errors that fall out of removed types — most likely "property X does not exist on type Y" in test fixtures and unrelated components. Delete those references.

- [ ] **Step 13: Smoke-test in dev**

```bash
npm run dev
# Open the search bar's Fullmind dropdown — "Sales Exec" filter should be gone.
# Open a district → DistrictHeader should not show a "Sales Executive" line.
# Open the explore modal → no "Owner" stat.
```

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "refactor(claims): drop ownerId / salesExec / territoryOwnerId from API + UI"
```

---

### Task 18: Trim the auth-callback CRM-name re-link

**Files:**
- Modify: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Delete the crmName-driven re-links**

Replace lines 32-67 (the `prisma.userProfile.findUnique` + `Promise.all` block) with: nothing. Keep only the email-based opp salesRep re-link above it.

The cleaned file should still:
- exchange the auth code,
- run the `UPDATE opportunities SET sales_rep_id = ...` block (matching on email),
- redirect.

- [ ] **Step 2: Verify by reading**

```bash
sed -n '20,75p' src/app/auth/callback/route.ts
```

Confirm only one `prisma.$executeRaw` block remains.

- [ ] **Step 3: Run tests**

```bash
npm test
```

(The callback isn't directly tested, but confirm no regressions in adjacent files.)

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "refactor(claims): drop CRM-name re-links from auth callback"
```

---

### Task 19: Repurpose summary endpoint `owner` → claimant filter

**Files:**
- Modify: `src/app/api/districts/summary/route.ts`
- Modify: `src/app/api/districts/summary/compare/route.ts`
- Modify: `src/app/api/districts/leaids/route.ts`

- [ ] **Step 1: Replace `dmf.sales_executive_id` filter with claimant subquery**

In `src/app/api/districts/summary/route.ts` around the existing block:

```ts
if (owner) {
  baseConditions.push(`dmf.sales_executive_id = $${paramIdx}`);
  baseParams.push(owner);
  paramIdx++;
}
```

Replace with:

```ts
if (owner) {
  baseConditions.push(
    `dmf.leaid IN (SELECT DISTINCT district_leaid FROM district_claimants_v WHERE user_id = $${paramIdx}::uuid)`,
  );
  baseParams.push(owner);
  paramIdx++;
}
```

Apply the same change in `summary/compare/route.ts` (line 111) and `leaids/route.ts` (line 32).

- [ ] **Step 2: Add a fixture-driven test**

In `src/app/api/districts/summary/__tests__/route.test.ts`, add a test that asserts the SQL contains `district_claimants_v` when `owner` is set:

```ts
it("filters by claimant when owner is set", async () => {
  // Look at existing test patterns in this file; mock prisma.$queryRawUnsafe
  // and assert the generated SQL string contains "district_claimants_v".
});
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/app/api/districts/summary
```

- [ ] **Step 4: Smoke-test**

```bash
npm run dev
# Hit /api/districts/summary?owner=<your-uuid>&fy=fy26 in browser; verify response is non-empty.
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/districts/summary src/app/api/districts/leaids
git commit -m "refactor(claims): summary endpoints filter by claimant, not sales_executive_id"
```

---

## Phase C.2 — Destructive schema migration

### Task 20: Update materialized view source SQL

**Files:**
- Modify: `scripts/district-map-features-view.sql`

- [ ] **Step 1: Strip sales_executive references**

In `scripts/district-map-features-view.sql`:

- Lines 428-429: delete `d.sales_executive_id,` and `up.full_name AS sales_executive_name,` from the SELECT.
- Line 490: delete `LEFT JOIN user_profiles up ON d.sales_executive_id = up.id`.
- Lines 501: delete `d.sales_executive_id, up.full_name,` from the GROUP BY.
- Line 509: delete `CREATE INDEX idx_dmf_owner ON district_map_features(sales_executive_id);`.

- [ ] **Step 2: Sanity-check the SQL is still valid**

```bash
psql $DATABASE_URL -f scripts/district-map-features-view.sql
```

Expected: view recreates; "district_map_features created" summary prints.

- [ ] **Step 3: Verify the column is gone**

```bash
psql $DATABASE_URL -c "\d+ district_map_features" | grep -i exec
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add scripts/district-map-features-view.sql
git commit -m "refactor(claims): drop sales_executive_id from district_map_features view"
```

---

### Task 21: Destructive Prisma migration

**Files:**
- Create: `prisma/migrations/<ts>_drop_crm_name_backfill_columns/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Generate migration directory**

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_drop_crm_name_backfill_columns
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- Drop the materialized view first (it depends on districts.sales_executive_id).
DROP MATERIALIZED VIEW IF EXISTS district_map_features;

-- Drop FK columns + their indexes.
ALTER TABLE districts            DROP COLUMN IF EXISTS owner_id;
ALTER TABLE districts            DROP COLUMN IF EXISTS sales_executive_id;
ALTER TABLE schools              DROP COLUMN IF EXISTS owner_id;
ALTER TABLE states               DROP COLUMN IF EXISTS territory_owner_id;
ALTER TABLE accounts             DROP COLUMN IF EXISTS sales_executive_id;
ALTER TABLE unmatched_accounts   DROP COLUMN IF EXISTS sales_executive_id;

-- Recreate the materialized view from the updated source-of-truth file.
-- The migration runner can't \i another file, so paste the body of
-- scripts/district-map-features-view.sql here, OR run that script as a
-- separate post-deploy step. We'll do the latter to keep this migration
-- focused. After this migration runs, execute:
--   psql $DATABASE_URL -f scripts/district-map-features-view.sql
```

- [ ] **Step 3: Update Prisma schema**

In `prisma/schema.prisma`:

- `District` model: delete `ownerId`, `salesExecutiveId`, `ownerUser`, `salesExecutiveUser`, and the two `@@index` lines for those columns. Delete the `@relation("DistrictOwner")` and `@relation("DistrictSalesExec")` named-relations on `UserProfile` too.
- `School` model: delete `ownerId`, `ownerUser`, related index. Delete the `@relation("SchoolOwner")` from UserProfile.
- `State` model: delete `territoryOwnerId`, `territoryOwnerUser`, related index, and the named relation from UserProfile.
- `Account` model: delete `salesExecutiveId`, related relation/index.
- `UnmatchedAccount` model: delete `salesExecutiveId`, related relation/index.

- [ ] **Step 4: Apply migration**

```bash
npx prisma migrate dev
```

Then recreate the view:

```bash
psql $DATABASE_URL -f scripts/district-map-features-view.sql
```

Expected: migration applies clean; view recreates.

- [ ] **Step 5: Regenerate Prisma client + run typecheck**

```bash
npx prisma generate
npx tsc --noEmit
```

If any code still references the dropped fields, either it's truly dead and should be deleted, or Task 17 missed a spot — fix inline.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

- [ ] **Step 7: Commit**

```bash
git add prisma
git commit -m "refactor(claims): drop CRM-name-backfill columns + Prisma relations"
```

---

### Task 22: Final integration smoke-test

**Files:** none (manual)

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Walk through the user journey**

- Browse to a district list. Confirm the "Mine" chip is on by default.
- Open a district. Confirm the Claims section renders, with at least one expected derived basis (an open opp, a plan).
- Click "Claim this district" if the current user has no manual claim yet. Confirm the avatar appears, Release/Transfer buttons appear.
- Click "Release". Confirm the row disappears.
- Click "Claim" again. Click "Transfer". Type a teammate's user-id. Confirm the row moves.
- Open the search bar filters. Confirm "Sales Exec" filter is gone.
- Open the unmatched-accounts admin page. Confirm the sales-executive filter is gone (or its UI gracefully no-ops).
- Open a state detail. Confirm there's no territory-owner edit field.

- [ ] **Step 3: Run all tests one more time**

```bash
npm test && npx tsc --noEmit
```

- [ ] **Step 4: Push the branch and open a PR**

```bash
git push -u origin feat/district-claims
gh pr create --title "District claims (replace ownerId; drop CRM-backfill family)" --body "$(cat <<'EOF'
## Summary
- Replaces District.ownerId with a multi-claimant model (derived from opps + plans + manual claims).
- Drops every CRM-name-backfilled FK across districts/schools/states/accounts/unmatched_accounts.
- Rebuilds the district_map_features materialized view without sales_executive_id.

## Test plan
- [ ] Run npm test
- [ ] Smoke-test the journey in Task 22 above
- [ ] Verify "Mine" chip default behavior matches CLAUDE.md filter convention
- [ ] Confirm no /api/* responses still surface ownerUser / salesExecutiveUser / territoryOwnerUser

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage check:**

- §Concepts (derivation rules, manual mechanics) → Tasks 2 (derived view), 3 (union view), 7-9 (manual API), 10-11 (cron). ✓
- §Data model → Tasks 1-3. ✓
- §Materialized view rebuild → Tasks 20-21. ✓
- §API new endpoints → Tasks 6-9. ✓
- §API existing-endpoint changes → Tasks 14, 15, 17, 19. ✓
- §Auth callback → Task 18. ✓
- §UI `<DistrictClaimants>` → Task 12. ✓
- §UI search-card / detail-panel → Tasks 14, 15. ✓
- §UI "Mine" chip → Task 16. ✓
- §UI surfaces removed (CRM-backfill) → Task 17. ✓
- §Migration Phase A → Tasks 1-5. ✓
- §Migration Phase B (audit) → Task 5 (script); human review happens between Phase A and Phase C deploys.
- §Migration Phase C → Tasks 6-21. ✓
- §Background jobs → Tasks 10-11. ✓
- §Tests → embedded in each task per TDD. View-level SQL tests are exercised indirectly through the API tests + smoke-test in Task 22 (this codebase mocks Prisma rather than running real-DB integration tests).

**Placeholder scan:**

- The transfer modal in Task 12 uses a raw user-id input instead of a real picker. Documented inline as v1 limitation; a future enhancement.
- Task 10 mentions `activity_districts` / `activities` table names — implementer is told to verify against schema.prisma.
- Task 19 step 2 says "Look at existing test patterns" — could be more prescriptive. Acceptable because the test pattern is variable across summary files.

**Type consistency:**

- `Claimant`, `ClaimantBasis` defined in Task 12; reused in Task 13. ✓
- `claimantSummary` shape matches between Task 14 (server emits) and Task 14 (client consumes). ✓
- `districtLeaid_userId` Prisma compound-key name matches between Tasks 7, 8, 9. ✓

---

## Execution

**Plan complete and saved to `Docs/superpowers/plans/2026-05-04-district-claims.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
