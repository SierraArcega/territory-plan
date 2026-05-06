---
name: merging-duplicate-districts
description: Use when reconciling two or more rows in `districts` that represent the same Salesforce account — typically a real NCES leaid plus one or more synthetic placeholder rows minted by the contact import, the customer-book import, or the vendor-financials loader. Symptoms include the same district appearing twice on the map/search, an opp's `district_lea_id` not matching its `district_lms_id`'s home district, or `is_customer=true` rows with no NCES data.
---

# Merging Duplicate Districts

The `districts` table accumulates duplicates because three different scripts each mint placeholder rows when they can't match an account to an NCES district. Each invented its own ID scheme, so the same logical district can end up with a row from each:

| Script | Prefix scheme | Example |
|---|---|---|
| `scripts/mint-account-districts.ts` | `M{seq:06d}` (sequential) | `M000049` |
| `scripts/import-customer-book.ts` | `A{md5(name\|state)[:6]}` (deterministic) | `A081491` |
| `scripts/etl/loaders/vendor_financials.py` | `{state_fips}9{seq:04d}` (sequential per state) | `4590009`, `4590019` |

The vendor-financials format is the trickiest because it's 7 digits and starts with a real state fips — it looks like a real NCES leaid. The tell is that `9` in position 3 is reserved (real district codes for SC top out around `4503xxx`) and synthetic rows have null `urban_institute_year`, null `total_enrollment`, and null financial fields. When in doubt, check the data.

When the match later becomes obvious (or a rep flags it), the synthetic rows must be merged into the real NCES district and dropped.

This is **destructive on production data**. Always present a written plan and get explicit user approval before running the merge.

## When to Use

- A user reports the same district appearing twice on the map/search
- A Salesforce opp's `district_lea_id` doesn't match its `district_lms_id`'s home district
- A synthetic-prefix leaid (`M…`, `A…`, or `{fips}9xxxx`) exists alongside a real NCES leaid for the same school
- A row has no NCES data (null enrollment, null financial fields) yet still appears in search

**Do NOT use** for:
- Genuinely different districts that share a name across states. Always verify name + state + city before merging.
- The user-claims feature on `feat/district-claims` — that branch is about rep ownership of districts, a different feature despite the name.

## Workflow

The four phases below are not interchangeable. Skipping the audit silently loses attached data; skipping the override-file update guarantees the synthetic rows return on the next contact import.

### 1. Identify the duplicate set

Find every row that might be the same district:

```sql
SELECT leaid, name, state_abbrev, city_location, lmsid, account_name,
       account_type, is_customer
FROM districts
WHERE name ILIKE '%search term%'
ORDER BY state_abbrev, name;
```

Pick the **canonical leaid**: always the real NCES leaid (7-digit numeric), never an `M`-prefixed synthetic. The synthetic exists only because the import couldn't match — retiring it is the goal.

If multiple synthetics exist (e.g. `Account Name` and `Account Name (District)` both got minted), check `opportunities.district_lms_id` to see which lmsid Salesforce actually uses:

```sql
SELECT id, name, district_lea_id, district_lms_id
FROM opportunities
WHERE district_lms_id IN (<all_synthetic_lmsids>);
```

The lmsid that has opps is the canonical Salesforce account; the other lmsid is orphaned and gets dropped entirely.

### 2. Audit every FK and quasi-FK table

The full FK list (regenerate to be sure — schema evolves):

```sql
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema)
JOIN information_schema.constraint_column_usage ccu USING (constraint_name, table_schema)
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'districts'
  AND ccu.column_name = 'leaid';
```

As of writing, this returns: `activity_districts`, `agency_district_maps`, `contacts`, `district_data_history`, `district_grade_enrollment`, `district_news_fetch`, `district_tags`, `news_article_districts`, `rfps`, `schools`, `task_districts`, `territory_plan_districts`, `vacancies`, `vacancy_scans`, plus the self-referential `districts.parent_leaid`.

**Plus three opp tables that reference districts WITHOUT an FK** (you must check these explicitly):

- `opportunities.district_lea_id`
- `opportunities.district_lms_id`
- `opportunity_snapshots.district_lea_id`
- `unmatched_opportunities.resolved_district_leaid`
- `unmatched_opportunities.account_lms_id`

Count rows attached to each leaid in your duplicate set in a single audit query, so you can see the full picture at a glance.

### 3. Plan the merge

Three sub-decisions:

**Field-level merge.** Diff the row data. The synthetic typically has only `lmsid`, `is_customer=true`, `sales_executive_id`, `account_type='other'`. The canonical has all the NCES data. Promote the synthetic's `lmsid` and `is_customer=true` onto the canonical. **Do not downgrade** `account_type='district'` to `'other'`.

**FK reassignment with conflict handling.** Junction tables with composite PKs may already have rows for the same partner key on both leaids. Naive `UPDATE … SET leaid = canonical` fails with a PK violation. Use `INSERT … ON CONFLICT DO NOTHING` then `DELETE`:

| Table | PK | Strategy |
|---|---|---|
| `news_article_districts` | `(article_id, leaid)` | INSERT…ON CONFLICT DO NOTHING, then DELETE |
| `agency_district_maps` | `(agency_id, leaid)` | Same |
| `district_tags` | `(district_leaid, tag_id)` | Same |
| `activity_districts` | `(activity_id, district_leaid)` | Same |
| `task_districts` | `(task_id, district_leaid)` | Same |
| `territory_plan_districts` | `(plan_id, district_leaid)` | Same |
| `district_news_fetch` | `(leaid)` alone | DELETE synthetic if canonical has its own |
| `district_data_history` | `(leaid, snapshot_date)` | INSERT…ON CONFLICT DO NOTHING, then DELETE |
| `district_grade_enrollment` | `(leaid, grade)` | Same |
| `contacts` / `schools` / `rfps` / `vacancies` / `vacancy_scans` | `id` PK, `leaid` FK | Plain UPDATE |

**Opp-table updates.** The Salesforce sync usually writes `district_lea_id` correctly to the real NCES leaid already, but verify. If any opp row has `district_lea_id` pointing at a synthetic, UPDATE it to the canonical. `district_lms_id` should match whichever lmsid you promoted in step 1.

### 4. Execute in a single transaction

Always atomic. Run a sanity-check SELECT inside the transaction before COMMIT:

```sql
BEGIN;

-- 1. Promote canonical Salesforce account onto the real NCES district
UPDATE districts
SET lmsid = '<canonical_lmsid>',
    is_customer = true
WHERE leaid = '<canonical_leaid>';

-- 2. Reassign composite-PK junction rows (repeat per affected table)
INSERT INTO news_article_districts (article_id, leaid, confidence)
SELECT article_id, '<canonical_leaid>', confidence
FROM news_article_districts
WHERE leaid IN (<synthetic_leaids>)
ON CONFLICT (article_id, leaid) DO NOTHING;

DELETE FROM news_article_districts WHERE leaid IN (<synthetic_leaids>);

-- 3. Drop synthetic rows in single-leaid-PK tables (canonical has its own)
DELETE FROM district_news_fetch WHERE leaid IN (<synthetic_leaids>);

-- 4. Drop the synthetic district rows last
DELETE FROM districts WHERE leaid IN (<synthetic_leaids>);

-- Sanity check: should show only the canonical, with merged fields
SELECT leaid, name, lmsid, is_customer
FROM districts
WHERE leaid IN (<all_leaids>) OR lmsid IN (<all_lmsids>);

COMMIT;
```

### 5. Update the override file

Without this step, the next `scripts/import-salesforce-contacts.ts` run mints the synthetics again from scratch. Edit `scripts/salesforce-contact-leaid-overrides.json` and add **every account-name variant** Salesforce uses for this account, mapped to the canonical leaid:

```json
"<Account Name>|<State>": "<canonical_leaid>",
"<Account Name (District)>|<State>": "<canonical_leaid>"
```

State is the full word ("Texas", not "TX"). Validate with `python3 -c "import json; json.load(open('scripts/salesforce-contact-leaid-overrides.json'))"` after editing — the file is loaded at import time and a syntax error breaks the whole import.

Commit this as a focused commit, not bundled with unrelated work.

## Common Mistakes

| Mistake | What goes wrong |
|---|---|
| `UPDATE districts SET leaid = canonical` | leaid is the PK; you can't update it. Reassign FKs and DELETE the synthetic instead. |
| Naked `UPDATE` on composite-PK junction tables | PK conflict where the partner row already exists on canonical. Use INSERT…ON CONFLICT DO NOTHING + DELETE. |
| Forgetting `salesforce-contact-leaid-overrides.json` | Synthetics get re-minted on next contact import. |
| Picking an `M`-prefixed leaid as canonical | Defeats the purpose; the goal is to drop synthetics. |
| Promoting `account_type='other'` over `'district'` | UI starts treating the district as a non-district account. |
| Skipping the FK audit | Attached rows orphan or cascade-delete silently. |
| Running outside a transaction | Partial merge leaves the DB in a broken state. |
| Confusing this with `feat/district-claims` | That branch is about rep claims on districts — different feature. |

## Red Flags

- About to write `UPDATE districts SET leaid = …` → STOP. leaid is a PK and the FK reassignments need to come first.
- About to run the merge without `BEGIN; … COMMIT;` → STOP. Atomic-or-bust.
- The canonical row has zeroed-out FY revenue and `has_open_pipeline=false` despite the synthetic having opps → the financial sync hasn't propagated yet. The merge will look correct but the UI will briefly show the district as a non-customer until the next sync. Note this in your plan.
- More than two duplicates in the set → there may be a class of accounts (e.g. multi-campus charters) where the import is systematically wrong. Mention this so the user can decide whether to also fix the matcher.
