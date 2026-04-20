# Find Contacts: Principal Target Role + School-Level Export

**Date:** 2026-04-20
**Branch:** `feat/find-contacts-principals`
**Status:** Design approved, pending implementation plan

## Problem

The current "Find Contacts" flow (`ContactsActionBar` → Clay bulk enrichment) returns **one contact per district** for district-level roles (Superintendent, CTO, etc.). Sales reps also need **school-level** contacts — specifically **principals** — and when those are exported, each row must identify which school it belongs to (name, level, type).

## Scope

**In scope:**
- Add `"Principal"` to `TARGET_ROLES`
- When Principal is selected, expose a school-level filter (PS / MS / HS checkboxes, all on by default)
- Fire Clay enrichment per-school instead of per-district when Principal is selected
- Link returned principal contacts to the `School` record via `SchoolContact`
- Change CSV export from "one row per district" to **one row per contact**, adding `School Name`, `School Level`, and `School Type` columns

**Out of scope:**
- Adding `"Chief Academic Officer"` (noted as a gap but deferred)
- Renaming the "Find Contacts" button
- New UI for filtering existing contacts by school type (export only)
- A "consolidate to one row per district" toggle (can add later if sales reps push back)
- Schema changes — everything needed already exists

## User Flow

1. User opens a territory plan with districts selected.
2. Clicks **Find Contacts** → popover opens.
3. Selects **Target Role: Principal** → popover expands to show a **School Level** section.
4. All 3 checkboxes (Primary / Middle / High) are checked by default. User can uncheck.
5. Clicks **Start**. Disabled if zero levels are checked.
6. Backend enqueues one Clay webhook per eligible school (not per district).
7. Progress bar ticks as principals come back; they appear in the Contacts table tied to their school.
8. User clicks the download icon → CSV with `District Name | Website | School Name | School Level | School Type | Contact Name | Title | Email | Phone | Department | Seniority Level`.

## Design

### 1. UI (`src/features/plans/components/ContactsActionBar.tsx`)

- `TARGET_ROLES` gets a new entry: `"Principal"` (8th).
- When `selectedRole === "Principal"`, render a **School Level** subsection below the role dropdown:
  - 3 labeled checkboxes: Primary, Middle, High
  - All checked by default (via `useState<Set<number>>(new Set([1, 2, 3]))`)
  - Start button disabled when the set is empty
- Non-Principal roles: popover renders exactly as today (no subsection).
- Keep existing Fullmind brand tokens (`#403770`, `#F7F5FA`, `#EFEDF5`).

### 2. Target Roles constant (`src/features/shared/types/contact-types.ts`)

```ts
export const TARGET_ROLES = [
  "Superintendent",
  "Assistant Superintendent",
  "Chief Technology Officer",
  "Chief Financial Officer",
  "Curriculum Director",
  "Special Education Director",
  "HR Director",
  "Principal", // new
] as const;
```

### 3. Bulk-enrich API (`src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts`)

**Request body extension:**
```ts
{
  targetRole: TargetRole;
  schoolLevels?: number[]; // only read when targetRole === "Principal"
}
```

**Branching on `targetRole`:**

- **Not Principal** → existing per-district logic unchanged.
- **Principal** → new per-school logic:
  1. Fetch `School` records where `leaid IN (plan's districts)` AND `schoolLevel IN (schoolLevels)`.
  2. Skip schools that already have an associated principal contact (join on `SchoolContact`, filter by title match — see §5 below for the "already enriched" heuristic).
  3. Build Clay payload per school:
     ```ts
     {
       ncessch: school.ncessch,
       school_name: school.name,
       school_level: school.schoolLevel,
       school_type: school.schoolType,
       leaid: school.leaid,
       district_name, state, city, street, zip, website_url,
       target_role: "Principal",
       callback_url,
     }
     ```
  4. Fire in batches of 10 with 1s delay — same pattern as today.
  5. `enrichmentQueued` = count of schools queued. `Activity.metadata` includes `{ targetRole: "Principal", schoolLevels, schoolsQueued, districtCount }`.

**Concurrency guard:** existing guard still applies; it just compares "have we seen enough back yet" against `enrichmentQueued`, which now counts schools when Principal.

### 4. Clay webhook callback (`/api/webhooks/clay`)

The callback already creates `Contact` rows. Add logic: if payload includes `ncessch` (present only for principal enrichment), also insert a `SchoolContact` row linking the new contact to the school.

Specifically: after creating/updating the `Contact`, `upsert` a `SchoolContact` keyed on `(contactId, ncessch)`.

### 5. "Already enriched" heuristic for principals

Current flow skips a district if it has **any** contact. For principals we need per-school granularity:

- A school is considered "already enriched as principal" if it has a `SchoolContact` whose linked `Contact.title` matches `/principal/i` (case-insensitive).
- If the heuristic proves fragile, fall back to skipping any school that has **any** `SchoolContact` at all.

Spec'd as (a); leave a plan comment to revisit if the match rate is off.

### 6. CSV export (`src/features/plans/components/ContactsActionBar.tsx` `handleExportCsv`)

**Behavior change:** one row per contact (not per district).

New header:
```
District Name | Website | School Name | School Level | School Type |
Contact Name | Title | Email | Phone | Department | Seniority Level
```

For each contact:
- If contact has `schoolContacts[0]` → pull School Name (`school.name`), School Level (mapped via `SCHOOL_LEVEL_LABELS`), School Type (mapped via a new `SCHOOL_TYPE_LABELS` constant — see §7).
- If contact has no school link → leave those 3 columns empty.

**Empty districts:** the old export included a row for districts with zero contacts. Preserve that — a district with zero contacts still yields one row (all contact/school fields empty) so the rep sees coverage gaps.

### 7. School Type label mapping

Add a small constant (co-locate with `SCHOOL_LEVEL_LABELS` in `MapV2Tooltip.tsx`, or move both into `src/features/shared/types/contact-types.ts` if they're re-used outside the map — decide in the plan):

```ts
const SCHOOL_TYPE_LABELS: Record<number, string> = {
  1: "Regular",
  2: "Special Education",
  3: "Career & Technical",
  4: "Alternative",
};
```

For the export, if `schoolType` is null or unmapped, leave empty. "Transfer" schools are identified downstream by combining `School Level = HS AND School Type = Alternative`.

### 8. ContactsTable (display of enriched principals)

The existing `ContactsTable` should already render principal contacts since it just lists `Contact` rows. Verify during implementation — no spec change unless it groups by district in a way that hides school-level rows.

## Data / dependencies

- **No Prisma schema changes.**
- **Clay workflow audit (explicit plan step):** the existing Clay workflow is keyed to `CLAY_WEBHOOK_URL` and accepts per-district fields only. Before code ships, the user will open Clay and verify / update:
  1. **Input columns** — the table that receives `CLAY_WEBHOOK_URL` POSTs needs new columns: `ncessch`, `school_name`, `school_level`, `school_type`.
  2. **Enrichment step** — must look up a person by title + school (not title + district). In Clay, this is typically a "Find Person" / Apollo / ZoomInfo step where the company input is the school, not the district.
  3. **Callback HTTP column** — the column that POSTs back to `/api/webhooks/clay` must include `ncessch` in its payload so the app can link the returned contact to the correct school.

  If any of the three is missing, the user edits the Clay workflow before flipping the feature on. The app-side code can be built and merged independently of this audit — it just won't produce correct results until Clay is ready.

- **School data coverage:** `schoolLevel` and `schoolType` population rate is unknown. Spot-check in the plan: query for districts where a reasonable % of schools have null values. If `schoolType` is mostly null, the export column is still correct (just blank) and sales reps will see the gap.

## Testing

- **Unit:** `TARGET_ROLES` includes `"Principal"`. `SCHOOL_TYPE_LABELS` maps 1–4.
- **Component:** rendering the popover with Principal selected shows the school-level subsection; unchecking all disables Start.
- **API route test (`bulk-enrich`):**
  - Principal payload with `schoolLevels: [3]` queues only high schools from plan districts.
  - Schools with an existing "principal" `SchoolContact` are skipped.
  - Activity metadata contains `targetRole`, `schoolLevels`, `schoolsQueued`.
  - Non-Principal requests unchanged (regression guard).
- **Clay webhook callback test:** payload with `ncessch` creates both `Contact` and `SchoolContact`.
- **CSV export test:** one row per contact; rows with no school link have empty School columns; districts with zero contacts still emit a row.

## Performance notes

Sales reps may run this on a plan with 500+ schools. Existing batching (10 webhooks per 1s) caps fan-out — 500 schools ≈ 50s of webhook firing. Background-fired, progress-tracked, acceptable. Nothing new.

## Open items for the implementation plan

1. **Clay workflow audit (step 1 of the plan)** — user opens Clay, checks the 3 items above (input columns, enrichment step, callback payload), and edits the workflow if any are missing. The plan should explicitly include this as a first step so it doesn't get forgotten.
2. Confirm `School.schoolType` data coverage (quick query against prod DB).
3. Decide where `SCHOOL_TYPE_LABELS` and `SCHOOL_LEVEL_LABELS` ultimately live — the map-only location is fine for now, but export code will need to import them, so a shared location (`src/features/shared/lib/schoolLabels.ts` or similar) is cleaner.
