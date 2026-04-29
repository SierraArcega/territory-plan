# Find Contacts — Existing Options Modal (Backend Context)

Feature: when "Find Contacts" returns `queued === 0` (or a partial-overlap response), replace
the dismissive toast with a modal offering (a) jump to existing contacts in the current plan,
or (b) navigate to another plan that already surfaces the relevant contacts.

This is a reference doc for planning only — no implementation here.

## 1. Relevant Prisma Models

File: `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/find-contacts-existing-options/prisma/schema.prisma`

### `TerritoryPlan` — lines 473–512

```
model TerritoryPlan {
  id          String    @id @default(uuid())
  name        String    @db.VarChar(255)
  ownerId     String?   @map("owner_id") @db.Uuid
  status      String    @default("planning") @db.VarChar(20)   // planning | working | stale | archived
  fiscalYear  Int       @map("fiscal_year")
  userId      String?   @map("user_id") @db.Uuid               // creator (distinct from ownerId)
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Bulk enrichment tracking (written by bulk-enrich route, cleared by enrich-progress)
  enrichmentStartedAt  DateTime? @map("enrichment_started_at")
  enrichmentQueued     Int?      @map("enrichment_queued")
  enrichmentActivityId String?   @map("enrichment_activity_id") @db.Uuid

  districts     TerritoryPlanDistrict[]
  states        TerritoryPlanState[]
  collaborators TerritoryPlanCollaborator[]
  activityLinks ActivityPlan[]
  ownerUser     UserProfile? @relation("PlanOwner", fields: [ownerId], references: [id])
}
```

`enrichmentActivityId` is the UUID of the `Activity` row created at enrichment fire time
(see bulk-enrich route lines 172–188 and 274–284). `enrichmentStartedAt` is used both for
concurrency-guarding (10-minute timeout, line 7 of the bulk-enrich route) and as an implicit
"plan was last enriched at X" signal. There is no explicit `lastEnrichedAt` column on the plan.

### `TerritoryPlanDistrict` — lines 514–533 (the join)

```
model TerritoryPlanDistrict {
  planId        String   @map("plan_id")
  districtLeaid String   @map("district_leaid") @db.VarChar(7)
  addedAt       DateTime @default(now()) @map("added_at")
  // Relations
  plan     TerritoryPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  district District      @relation(fields: [districtLeaid], references: [leaid])

  @@id([planId, districtLeaid])
}
```

Composite PK on `(planId, districtLeaid)`. This is the table we query to find "other plans
sharing a leaid with the current plan." No index on `districtLeaid` alone is declared — the PK
covers `(planId, districtLeaid)`, and Prisma's `@@id` generates a btree usable for `planId` lookups.
A raw lookup by `districtLeaid` alone will scan; we may need an additional index if the query
is slow at scale. Flag for reviewer.

### `Contact` — lines 337–359 (leaid-keyed, NOT plan-scoped)

```
model Contact {
  id             Int       @id @default(autoincrement())
  leaid          String    @db.VarChar(7)
  name           String    @db.VarChar(255)
  title          String?   @db.VarChar(255)
  email          String?   @db.VarChar(255)
  createdAt      DateTime  @default(now()) @map("created_at")
  lastEnrichedAt DateTime? @map("last_enriched_at")
  district       District        @relation(fields: [leaid], references: [leaid])
  schoolContacts SchoolContact[]
  @@index([leaid])
}
```

Contacts live at the district (`leaid`) level, not on plans. Any plan that contains that leaid
can see the contact via the `/contacts` GET route. This is the key fact enabling the feature:
if Plan A already enriched leaid `3600150` and Plan B contains `3600150`, Plan B already
sees those contacts and doesn't need to re-enrich.

### `SchoolContact` — lines 1104–1112 (Principal link)

```
model SchoolContact {
  schoolId  String  @map("school_id") @db.VarChar(12)   // ncessch
  contactId Int     @map("contact_id")
  school    School  @relation(fields: [schoolId], references: [ncessch], onDelete: Cascade)
  contact   Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
  @@id([schoolId, contactId])
}
```

Principals are stored as a `Contact` row (with `title` containing "principal") linked to a
`School` via `SchoolContact`. The Principal enrichment skip-check (bulk-enrich lines 143–150)
uses this join + a case-insensitive title match.

### `Activity` — lines 561–625 (contact_enrichment records)

```
model Activity {
  id              String   @id @default(uuid())
  type            String   @db.VarChar(30)              // "contact_enrichment" for our case
  title           String   @db.VarChar(255)
  status          String   @default("planned")          // planned | in_progress | completed | cancelled
  createdByUserId String?  @map("created_by_user_id") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at")
  source          String   @default("manual")           // bulk-enrich sets "system"
  metadata        Json?                                  // { targetRole, schoolLevels?, queued, skipped, ... }
  plans           ActivityPlan[]
}
```

### `ActivityPlan` — lines 627–636 (the plan join, NOT `PlanActivity`)

```
model ActivityPlan {
  activityId String        @map("activity_id")
  planId     String        @map("plan_id")
  activity   Activity      @relation(...)
  plan       TerritoryPlan @relation(...)
  @@id([activityId, planId])
  @@index([planId])
}
```

There is **no** `PlanActivity` model — the join is `ActivityPlan`.

### `School` (partial) — lines 1011–1079

Relevant fields for Principal mode: `ncessch` (PK), `leaid`, `schoolName`, `schoolLevel`
(1=Primary, 2=Middle, 3=High, 4=Other), `schoolType`, `schoolStatus` (1=Open), plus address
fields passed to Clay.

### Contact → plan lineage — how traceable is it?

**There is no direct foreign key from `Contact` to a `TerritoryPlan`.** Lineage is indirect,
and there are three possible paths to say "this contact was enriched under plan X":

1. **Via `Activity.plans` + timing:** the Activity of type `contact_enrichment` is created
   with `plans: { create: { planId: id } }` (bulk-enrich lines 186, 282), so you can find
   enrichment Activities per plan. But the Activity itself does not carry the list of
   contacts it produced — you'd have to correlate `Contact.createdAt` or
   `Contact.lastEnrichedAt` with `Activity.createdAt` / the plan's `enrichmentStartedAt`
   window, which is fuzzy across concurrent runs.
2. **Via `ActivityContact`:** the schema has an `ActivityContact` join (schema lines 654–662),
   but the Clay webhook (`/api/webhooks/clay/route.ts` lines 166–294) does not populate it
   for bulk-enrich — it only writes `Contact` rows and (if `ncessch` is present)
   `SchoolContact` rows. So `ActivityContact` is not a reliable source of plan lineage for
   contacts produced by bulk-enrich.
3. **Via `leaid` overlap** (the pragmatic route used here): any plan whose
   `TerritoryPlanDistrict` row shares a `districtLeaid` with the current plan, and whose
   shared districts have at least one `Contact`, is a plausible "contact source" — regardless
   of which plan originally triggered the enrichment. **This is the proposed query shape
   below** and the only one that works robustly.

## 2. Existing API Routes

### 2a. `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts`

POST handler. Auth via `getUser()` at line 23. Loads the plan + its district leaids
(lines 54–57). Two branches keyed on `targetRole === "Principal"`:

**Non-Principal (district-level) branch — lines 246–332:**
- Groups `Contact` by `leaid` for the plan's leaids (`contact.groupBy`, lines 246–249).
- `enrichedLeaids` = set of leaids that already have any contact.
- `leaidsToEnrich` = plan leaids minus enriched.
- `total = allLeaids.length`, `skipped = enrichedLeaids.size`, `queued = leaidsToEnrich.length`.
- If `queued === 0`, returns `{ total, skipped, queued: 0 }` immediately (line 257–259) —
  **this is the response shape that triggers our new modal.**
- Otherwise: creates `Activity` (type `contact_enrichment`, `plans: { create: { planId: id } }`),
  updates the plan's `enrichmentStartedAt/Queued/ActivityId`, and fires Clay webhooks in
  batches of 10 with a 1s pause between batches.

**Principal branch — lines 116–241:**
- Loads open schools at requested `schoolLevels` across the plan's leaids (lines 117–135).
- "Already enriched" heuristic: schools with any `SchoolContact` whose Contact has a title
  matching `/principal/i` (lines 143–150). Noted in a code comment as possibly needing to
  widen to "any SchoolContact" if production match rate is poor.
- `total = schools.length`, `skipped = alreadyPrincipalSet.size`, `queued = toEnrich.length`.
- Same `queued === 0` early return (lines 157–159) and same Activity/plan-update/webhook
  pattern afterward.

Response shape (both branches): `{ total: number, skipped: number, queued: number }`.

Concurrency guard (lines 80–111): if there's already an active enrichment
(`enrichmentStartedAt` within 10 minutes AND `enrichmentQueued` non-null), the route may
return 409 with `{ error, enriched, queued }`. Principal mode refuses outright; district
mode compares `contact.groupBy` count against `enrichmentQueued` to decide.

### 2b. `src/app/api/territory-plans/[id]/contacts/route.ts`

GET only. Auth via `getUser()` (line 14). Loads plan + `districts: { select: { districtLeaid } }`.
Fetches all `Contact` rows where `leaid IN (...)`, ordered by `isPrimary DESC, name ASC`,
including `schoolContacts.school` for Principal linkage.

Email dedup (lines 74–81): builds a `Set<string>` of lower-cased emails as it iterates;
the first contact per email wins. Contacts with no email are always kept. Because ordering
is `isPrimary: "desc"` first, primary contacts win the dedup tie.

Returned shape per contact is flattened (id, leaid, salutation, name, title, email, phone,
isPrimary, linkedinUrl, persona, seniorityLevel, createdAt, lastEnrichedAt, schoolContacts).

**Key for our feature:** this endpoint already exposes all contacts for the plan's districts,
regardless of which plan originally triggered the enrichment. The "Show them here" modal
action just needs to `refetch()` this endpoint and/or scroll to it — no new backend work.

### 2c. `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts`

GET only. Poll endpoint used by `ContactsActionBar` while an enrichment is in flight.
Branches on the active Activity's `metadata.targetRole`:

- Principal: counts `SchoolContact` rows where contact.title matches `/principal/i` across
  the plan's leaids; subtracts the `skipped` recorded at fire time; returns `enriched`.
- Non-Principal: `contact.groupBy` by `leaid`; subtracts `skipped`; returns `enriched`.

Response: `{ total, enriched, queued }`. Also completes the Activity and clears
`enrichmentStartedAt/Queued/ActivityId` when `enriched >= queued` or after a 10-minute stall
(lines 89–115).

### 2d. `src/app/api/webhooks/clay/route.ts`

Supports both GET and POST. Receives enriched contact payloads from Clay and upserts
`Contact` rows (by `{ leaid, email }`, or `{ leaid, name }` when email is absent). If the
payload includes a root-level `ncessch` (Principal mode), it also upserts a `SchoolContact`
join row for each processed contact (lines 286–295).

Note for audit trail: this route **does not write to `ActivityContact`**, so there is no
direct link from the enrichment Activity to the specific contacts it created. Lineage is
recoverable only fuzzily via `Contact.createdAt` vs. `Activity.createdAt`.

### 2e. `src/app/api/territory-plans/route.ts`

GET lists plans. Auth via `getUser()`. The comment on line 17 is explicit: *"Show all plans —
the team shares visibility across plans"* — `whereClause = {}` (line 18). Every authenticated
user sees every plan. This is important precedent for how we scope the new endpoint.

Each plan in the response already includes `districtLeaids: string[]` (line 101), which means
a naive client-side solution could fetch `/api/territory-plans` and intersect leaids locally —
but that pulls every plan and every district for every user. Server-side filtering is better.

## 3. Proposed Endpoint: `GET /api/territory-plans/[id]/contact-sources`

Returns a ranked list of other plans that share at least one leaid with the current plan
AND have existing contacts on at least one of those shared leaids.

### Auth scoping

Mirror the existing plan-list endpoint (`whereClause = {}`) — team-visible. Precedent:
`src/app/api/territory-plans/route.ts` line 17 comment, and `src/app/api/territory-plans/[id]/contacts/route.ts`
line 20 comment: *"Team shares visibility across plans (matches list endpoint)."* The modal
needs to surface useful alternatives for the rep; hiding teammates' plans would defeat the
purpose. (Flagged in open questions below — confirm with reviewer.)

### Query shape (Prisma sketch)

Pseudocode, not actual code to commit:

```
// 1. Load current plan's leaids
const current = await prisma.territoryPlan.findUnique({
  where: { id },
  include: { districts: { select: { districtLeaid: true } } },
});
const currentLeaids = current.districts.map(d => d.districtLeaid);

// 2. Find other plans that share ANY of those leaids
//    (exclude self; optionally exclude archived status)
const candidates = await prisma.territoryPlan.findMany({
  where: {
    id: { not: id },
    status: { not: "archived" },
    districts: { some: { districtLeaid: { in: currentLeaids } } },
  },
  select: {
    id: true,
    name: true,
    status: true,
    enrichmentStartedAt: true,
    updatedAt: true,
    ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
    districts: {
      where: { districtLeaid: { in: currentLeaids } },
      select: { districtLeaid: true },
    },
  },
});

// 3. For each candidate, pull contact counts scoped to the shared leaids.
//    contact.groupBy by leaid with leaid IN (sharedLeaids) gives one row per leaid
//    that has >=1 contact. Summing _count gives total contact count for those leaids.
//    Do this once globally (not per-plan) — contacts are leaid-keyed, not plan-keyed,
//    so plans sharing the same leaid see the same contact count.
const sharedLeaidSet = new Set(candidates.flatMap(c => c.districts.map(d => d.districtLeaid)));
const contactCounts = await prisma.contact.groupBy({
  by: ["leaid"],
  where: { leaid: { in: Array.from(sharedLeaidSet) } },
  _count: { _all: true },
});
const contactCountByLeaid = new Map(contactCounts.map(r => [r.leaid, r._count._all]));

// 4. Rank candidates by (contactCount across shared leaids DESC, sharedDistrictCount DESC),
//    then take top 10. Only include candidates with contactCount > 0.
```

### Response row shape

```
{
  planId: string,
  planName: string,
  owner: { id, fullName, avatarUrl } | null,
  status: "planning" | "working" | "stale",     // archived filtered out
  sharedDistrictCount: number,
  contactCount: number,                          // sum of contacts across shared leaids
  lastEnrichedAt: string | null,                 // plan.enrichmentStartedAt ISO, best-effort proxy
  sharedLeaidSample: string[]                    // optional: first 3 for UI tooltip
}
```

Ranking: `contactCount DESC, sharedDistrictCount DESC, updatedAt DESC`. Limit 10.

### Edge cases

- Current plan's own leaids may have contacts that came from no plan at all (imported via a
  non-bulk-enrich pathway). These are still valid "Show them here" fodder and are already
  served by route 2b — no new query needed for that action.
- If every candidate has `contactCount === 0`, the "Open another plan" list is empty and the
  modal should gracefully degrade to showing only the "Show them here" action (or explain
  that no other plans have contacts yet).
- Principal mode wrinkle: a candidate plan may "have contacts" on a shared leaid in the
  district-superintendent sense but not in the Principal sense. If the triggering action
  was Principal-mode enrichment, should the ranking only count SchoolContact rows whose
  title matches `/principal/i`, or any Contact? Flag for reviewer.

## 4. Auth Pattern

`getUser()` is imported from `@/lib/supabase/server` (file:
`/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/find-contacts-existing-options/src/lib/supabase/server.ts`
lines 55–87). It returns the authenticated Supabase user, respecting admin impersonation via
the `impersonate_uid` cookie (an admin can masquerade as another user).

Every relevant route uses the same shape:

```
const user = await getUser();
if (!user) {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}
```

See bulk-enrich route line 23–27, contacts GET line 14–18, plans list line 11–14. The new
endpoint should follow this pattern verbatim.

## 5. Test Conventions

- Vitest + jsdom. Tests co-located in `__tests__/` folder next to the route, file name
  `route.test.ts`.
- Concrete recent example:
  `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/find-contacts-existing-options/src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`
  (see especially lines 1–65 for the setup pattern).
- Standard mocks: `@/lib/supabase/server` → `getUser` returns `{ id: "user-1" }`; `@/lib/prisma`
  → default export is an object with each model's methods mocked via `vi.fn()`.
- `fetch` is stubbed globally with `vi.stubGlobal("fetch", mockFetch)` when the route fires
  outbound webhooks.
- Request factory: `new NextRequest("http://localhost/...", { method: "POST", body: ... })`.
- Route params are passed as `{ params: Promise.resolve({ id: "plan-1" }) }` (Next.js 16 App
  Router signature — they must be a Promise).
- Also relevant: `src/app/api/territory-plans/__tests__/route.test.ts` lines 1–60 for how a
  GET list endpoint with `territoryPlan.findMany` is mocked, including the `$transaction`
  pattern if the new endpoint batches queries.

For the new endpoint, expected test cases:
- Returns 401 without a user.
- Returns 404 when the plan id doesn't exist.
- Returns `[]` when no other plan shares any leaid.
- Returns `[]` when shared plans exist but no shared leaid has contacts.
- Ranks candidates correctly (contactCount desc, then sharedDistrictCount desc).
- Excludes the current plan from its own candidates.
- Excludes archived plans.

## 6. Open Questions / Ambiguities (for reviewer)

1. **Auth scoping — team vs. self?** The existing list and contacts endpoints explicitly
   show team-wide visibility. Should `/contact-sources` also be team-wide, or restricted to
   plans where the user is owner / creator / collaborator? Team-wide matches precedent and
   is probably right, but worth confirming because "open another plan" may feel invasive if
   it surfaces teammates' WIP plans the user wouldn't otherwise see.
2. **Archived plans — include or exclude?** The sketch above excludes `status === "archived"`.
   Is that correct, or could an archived plan still be a legitimate source of existing
   contact intel?
3. **Principal vs. district filtering.** When the user triggered Find Contacts in Principal
   mode and got `queued === 0`, should the "other plans" ranking weight schools-with-principal-
   SchoolContact only, or count any Contact on the shared leaids? The answer affects both the
   query and the modal's copy.
4. **Partial-overlap variant timing.** The request mentions a similar modal after a partial
   enrichment completes (`skipped > 0 && queued > 0`). That fires on the poll-loop completion
   event in `ContactsActionBar`, not on the initial POST response. Should
   `/contact-sources` be called at completion time, or pre-fetched at submit time and cached
   client-side until completion? Pre-fetch is simpler but risks staleness if another user
   triggers enrichment on an overlapping plan in the intervening minutes. Flag for planning.
