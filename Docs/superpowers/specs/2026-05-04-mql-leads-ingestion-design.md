# MQL Leads Ingestion — Design

**Date:** 2026-05-04
**Status:** Approved, ready for plan

## Summary

Import a batch CSV of marketing-qualified leads (MQLs) into the contacts database, log each rep's outreach attempt as a structured activity, and surface the leads as a new category on the Low Hanging Fruit page. Built on a generalized `leads` table that also accommodates future inbound-lead flows without further schema work.

## Motivation

Marketing produces periodic batches of MQL contacts (column-A rep already pre-claimed, score, originating campaign, free-text outreach result). Today this lives in spreadsheets — reps don't see leads next to their other prospecting work, and there's no system record that a contact was ever marketing-qualified. We want:

1. Each MQL contact in the `contacts` table (deduped against existing rows).
2. A persisted record per MQL event so we can show status (new/recent/stale/expired) and replay history when a contact is re-MQL'd in a later round.
3. The rep's outreach result (column T) logged as an `Activity` so it shows up in activity history alongside calls/meetings/emails.
4. Leads visible on Low Hanging Fruit so reps act on them in the same workflow they already use.

## Non-Goals

- A standalone "MQLs" page or tab — surfacing through LHF is the entire UX.
- Editing MQL records from the UI (no edit/delete buttons in this round).
- Auto-creating opportunities from MQLs.
- Showing MQL status on the district detail page or contact drawer (could come later).
- "Pass" / "decline" actions on MQL rows — disposition is set externally, in the marketing tool or next round of CSV.
- Wiring the `inbound` lead type to a real data source — schema and LHF plumbing are reserved, but no inbound importer ships with this work.

## Data Model

### New table: `leads`

```prisma
model Lead {
  id              Int       @id @default(autoincrement())
  contactId       Int       @map("contact_id")
  type            String    @db.VarChar(20)         // "mql" | "inbound" | future types
  score           Int?                                // nullable: inbounds may have no score
  sourceCampaign  String?   @map("source_campaign") @db.VarChar(255)
  capturedAt      DateTime  @map("captured_at")     // when the lead was created upstream
  claimedByUserId String?   @map("claimed_by_user_id") @db.Uuid
  disposition     String?   @db.VarChar(20)         // "qualified" | "unqualified" | null
  importBatch     String?   @map("import_batch") @db.VarChar(20)  // null for inbounds
  activityId      String?   @map("activity_id") @db.Uuid           // outreach activity, if any
  createdAt       DateTime  @default(now()) @map("created_at")

  contact      Contact      @relation(fields: [contactId], references: [id], onDelete: Cascade)
  claimedBy    UserProfile? @relation(fields: [claimedByUserId], references: [id])
  activity     Activity?    @relation(fields: [activityId], references: [id], onDelete: SetNull)

  @@unique([contactId, type, importBatch])
  @@index([contactId])
  @@index([claimedByUserId])
  @@index([capturedAt])
  @@index([type])
  @@map("leads")
}
```

**Why a separate table, not fields on `Contact`:** A contact can be MQL'd in multiple rounds. Each round preserves its own score/campaign/timestamp/disposition. "Is this contact currently an MQL?" reduces to `EXISTS (SELECT 1 FROM leads WHERE contact_id = ? AND type = 'mql' AND now() - captured_at < interval '90 days')`.

**Why `type` discriminator instead of `mql_leads`/`inbound_leads` tables:** MQLs and inbounds share the same shape (contact + score + captured-at + claimed rep + disposition). One table, one query path on LHF, type-specific UI tweaks where needed.

**Idempotency:** The unique constraint on `(contactId, type, importBatch)` makes batch re-imports safe. Inbounds get `importBatch = NULL`; Postgres treats NULLs as distinct, so multiple inbound rows per contact remain valid.

### Status (computed, not stored)

```ts
function leadStatus(capturedAt: Date, now = new Date()): "new" | "recent" | "stale" | "expired" {
  const days = (now.getTime() - capturedAt.getTime()) / 86400_000;
  if (days < 14) return "new";
  if (days < 45) return "recent";
  if (days < 90) return "stale";
  return "expired";
}
```

`expired` rows are filtered out of the LHF API response but stay in the DB forever for historical lookup.

### Migration

```sql
CREATE TABLE leads (
  id                  SERIAL PRIMARY KEY,
  contact_id          INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type                VARCHAR(20) NOT NULL,
  score               INT,
  source_campaign     VARCHAR(255),
  captured_at         TIMESTAMP NOT NULL,
  claimed_by_user_id  UUID REFERENCES user_profiles(id),
  disposition         VARCHAR(20),
  import_batch        VARCHAR(20),
  activity_id         UUID REFERENCES activities(id) ON DELETE SET NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT leads_contact_type_batch_uq UNIQUE (contact_id, type, import_batch)
);
CREATE INDEX leads_contact_idx ON leads (contact_id);
CREATE INDEX leads_claimed_by_idx ON leads (claimed_by_user_id);
CREATE INDEX leads_captured_at_idx ON leads (captured_at);
CREATE INDEX leads_type_idx ON leads (type);
```

No backfill — script populates.

## Activity Logging

A new activity type `lead_outreach` added to `ACTIVITY_CATEGORIES.meetings` in `src/features/activities/types.ts`:

- Label: **"Lead Outreach"**
- Icon: 📞

For each CSV row with a non-empty column-T value:

```
Activity {
  type:            "lead_outreach"
  title:           "Lead outreach: <FirstName> <LastName>"
  notes:           <column T text>
  status:          "completed"
  startDate:       <captured-at timestamp>
  outcome:         <column T text>
  createdByUserId: <claimed rep user id>
  source:          "manual"
}
+ ActivityContact { activityId, contactId }
+ ActivityDistrict { activityId, districtLeaid }
```

Rows with empty column T → only the `Lead` row is created, no activity.

**Idempotency:** Activity creation runs in the same transaction as the `Lead` upsert and is gated on the upsert being a true insert (not a hit on the existing `(contactId, type, importBatch)` unique key). Re-running the script on the same batch CSV creates zero new rows. To support this gating cleanly, `Lead` carries an optional `activityId Int?` FK that points to the outreach activity created for it; absence of that link is the signal to create one on a future re-run if the row was inserted but the activity step failed mid-transaction. (Practically, the transaction rolls back any partial state, so the link is either set or the lead row is absent.)

## Low Hanging Fruit Integration

### Category enum

`IncreaseTargetCategory` extended:

```ts
type IncreaseTargetCategory =
  | "missing_renewal"
  | "mql"
  | "inbound"
  | "fullmind_winback"
  | "ek12_winback";
```

Sort priority:

```ts
const CATEGORY_PRIORITY = {
  missing_renewal: 0,
  mql:             1,
  inbound:         2,
  fullmind_winback: 3,
  ek12_winback:    4,
};
```

### Visual treatment

```ts
const CATEGORY_COLORS = {
  // existing entries…
  mql:     { bg: "#E8F4FB", fg: "#1F5C8A", dot: "#3F8FBE" },  // soft blue
  inbound: { bg: "#FBF1E8", fg: "#8A4A1F", dot: "#BE7A3F" },  // warm tan (reserved)
};
```

Filter chip added next to existing three. Both `mql` and `inbound` get their own chip — `inbound` chip is hidden until at least one `inbound` row exists.

### `IncreaseTarget` shape extension

```ts
mqlContacts?: Array<{
  contactId: number;
  name: string;
  title: string | null;
  email: string;
  phone: string | null;
  score: number | null;
  capturedAt: string;       // ISO
  status: "new" | "recent" | "stale";    // expired filtered out before reaching client
  claimedByName: string | null;
  claimedByUserId: string | null;
  disposition: "qualified" | "unqualified" | null;
}>;
```

(Field name kept as `mqlContacts` for now since this is the only type populated; can rename to `leadContacts` when inbound ships.)

### Row layout for `category === "mql"`

District row stays standard (district name, state, claimed-rep avatar from the lead's `claimedByUserId`). Below the district name, an inline contact list:

```
Tempe Union HSD                    AZ   [MQL]
  ↳ Tracy Preslaski · HR Specialist · score 110 [new]
    tpreslaski@tempeunion.org · (480) 839-0292
```

Revenue cells (Prior rev, FY26 rev, FY26 closed won, etc.) render `—` for MQL rows.

The +Opp / +Plan row actions work unchanged — district-level.

### API: `/api/leaderboard/increase-targets`

Add a 4th SQL block that returns districts where:

- there is at least one `Lead` row of type `mql` whose contact's `leaid` matches the district, AND
- `now() - captured_at < interval '90 days'` (drops expired), AND
- the district is not in any FY27 plan, AND
- the district has no FY27 open pipeline opportunity

Inbound is the same query with `type = 'inbound'`; not enabled in this round.

The block also returns the contact-level array (`mqlContacts`) joined per row, so the API does the aggregation rather than the client.

### Filter defaults

MQL chip is on by default for everyone. The "Last Rep" filter still defaults to all reps (visibility model unchanged — claimed rep is informational, like `lastClosedWon.repName` is today).

## Import Script

New file: `scripts/import-mqls.ts`. Pattern mirrors `import-salesforce-contacts.ts`.

### CLI

```
npx tsx --env-file=.env scripts/import-mqls.ts --csv "<path>" --batch 2026-04-21 --dry-run
npx tsx --env-file=.env scripts/import-mqls.ts --csv "<path>" --batch 2026-04-21 --execute
```

`--batch` defaults to today's ISO date if omitted.

### Per-row processing

1. **Validate** — must have email, NCES, first+last name, score, captured-at timestamp. Junk rows → `/tmp/mql-import-junk.csv`.
2. **Match district by leaid.** Unmatched → `/tmp/mql-import-unmatched-district.csv`.
3. **Match rep by first name → `UserProfile`.** If 0 or >1 match, **interactively prompt** (stdin) showing candidates by `fullName` + `email`. User types index or skips. Choices cached for the session — "Monica" only prompts once.
4. **Upsert Contact** by `(lower(email), leaid)` — same dedup as the salesforce script. Existing contacts not modified. New contacts get name/title/email/phone from CSV.
5. **Insert `Lead`** with `(contactId, "mql", importBatch)` unique key. Idempotent — re-runs skip.
6. **Insert Activity** (`lead_outreach`) only if column T is non-empty AND no existing `lead_outreach` activity exists for this contact within the batch window.

### Output

```
Parsed:                90 rows
Junk (skipped):        2
Unmatched district:    1
Contacts created:      67
Contacts existing:     20
Leads created:         87
Activities created:    54
Activities skipped (no notes): 33
```

`--dry-run` runs everything inside a transaction that rolls back at the end, so report numbers are accurate.

## Testing

### Unit
- `leadStatus(capturedAt, now)` boundary tests at 14d, 45d, 90d.

### Integration (Vitest)
- Extend `src/app/api/leaderboard/increase-targets/__tests__/route.test.ts`:
  - seed `Lead` rows of varying ages
  - assert `new`/`recent`/`stale` show up; `expired` filtered out
  - assert district appears once even with multiple MQL contacts
  - assert district drops off when added to FY27 plan or has FY27 pipeline (existing rules apply uniformly)

### Component
- Extend `src/features/leaderboard/components/__tests__/LowHangingFruitView.test.tsx`:
  - render an `mql` row with two contacts
  - assert contact list, status pills, and `—` revenue cells render

## Files Touched

**New:**
- `prisma/migrations/<timestamp>_add_leads/migration.sql`
- `scripts/import-mqls.ts`

**Modified:**
- `prisma/schema.prisma` — add `Lead` model, `Contact.leads` relation, `UserProfile.claimedLeads` relation
- `src/features/activities/types.ts` — add `lead_outreach` to `ACTIVITY_CATEGORIES.meetings` + label + icon
- `src/features/leaderboard/lib/types.ts` — extend `IncreaseTargetCategory`, add `mqlContacts` field on `IncreaseTarget`
- `src/features/leaderboard/lib/filters.ts` — include `mql` and `inbound` in default categories
- `src/features/leaderboard/components/LowHangingFruitView.tsx` — category colors, sort priority, MQL row rendering
- `src/features/leaderboard/components/LowHangingFruitFilterBar.tsx` — MQL/Inbound chips
- `src/app/api/leaderboard/increase-targets/route.ts` — 4th SQL block returning MQL districts + contact aggregation
- Tests as listed above

## Open Questions

None at design time. Score column may be missing on some rows in future rounds — model already allows `score: Int?`.
