# Efficient Queries Skill + Data Dictionary — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a Claude Code skill that enforces a query discovery/review process, paired with a project data dictionary documenting every metric and table.

**Architecture:** Two files — a skill file (`~/.claude/skills/efficient-queries/SKILL.md`) for the process, and a data dictionary (`Docs/data-dictionary.md`) for the knowledge. The skill references the dictionary. Dictionary is organized by business domain, not by table.

**Tech Stack:** Claude Code skills (YAML frontmatter + markdown), project documentation

---

### Task 1: Create the Data Dictionary — Fullmind Sales section

**Files:**
- Create: `Docs/data-dictionary.md`

**Step 1: Write the data dictionary header and Fullmind Sales section**

```markdown
# Territory Plan Builder — Data Dictionary

Reference for all metrics, tables, and data sources in the project database.
Organized by business domain. For each metric: what it measures, where it lives,
and what to watch out for.

---

## Fullmind Sales Data

**Table:** `districts` (denormalized per-FY columns)
**Source:** Fullmind CRM CSV imports via ETL
**Naming pattern:** `fy{YY}_{metric}` — e.g., `fy26_net_invoicing`

### Currently Existing FY Columns

| FY | Sessions (revenue, take, count) | Bookings (opp_count, net_booking, net_invoicing) | Pipeline (opp_count, open, weighted) |
|----|:---:|:---:|:---:|
| FY25 | yes | yes | no |
| FY26 | yes | yes | yes |
| FY27 | no | no | yes |

When new FYs are added, follow the same `fy{YY}_{metric}` naming convention
and add a row to this table.

### Metric Definitions

**Sessions** — delivery/usage metrics (sessions actually taught)
- `fy{YY}_sessions_revenue` — total revenue from sessions delivered
- `fy{YY}_sessions_take` — Fullmind's take (margin) from sessions
- `fy{YY}_sessions_count` — number of sessions delivered

**Bookings** — signed deal metrics
- `fy{YY}_closed_won_opp_count` — number of closed-won opportunities
- `fy{YY}_closed_won_net_booking` — committed revenue from signed deals
- `fy{YY}_net_invoicing` — amount actually billed through invoices. Can differ
  from contract value or session revenue depending on contract structure.
  **Use this as the default revenue metric** unless specifically asking about
  delivery volume (sessions) or deal pipeline (bookings).

**Pipeline** — future potential revenue
- `fy{YY}_open_pipeline_opp_count` — number of open pipeline opportunities
- `fy{YY}_open_pipeline` — total open pipeline value (unweighted)
- `fy{YY}_open_pipeline_weighted` — probability-weighted pipeline value

### Flags

- `is_customer` (Boolean) — simplified flag indicating any Fullmind relationship
  history. Does NOT distinguish between contracted-but-not-invoiced, invoiced-but-
  not-using, or actively engaged. See issue #8 for planned redesign.
- `has_open_pipeline` (Boolean) — has open pipeline in any FY.

### Gotchas

- `net_invoicing` is NOT "cash collected" — it's "amount billed." Contract
  structure can make this higher or lower than actual revenue.
- `is_customer = true` does not mean "active paying customer." Query sessions
  + invoicing + bookings together for the real picture.
- FY25 has no pipeline columns. FY27 has only pipeline (no sessions/bookings yet).
```

**Step 2: Verify the file renders correctly**

Run: `head -60 Docs/data-dictionary.md`
Expected: Markdown renders with the table and definitions visible

**Step 3: Commit**

```bash
git add Docs/data-dictionary.md
git commit -m "docs: add data dictionary — Fullmind sales section"
```

---

### Task 2: Data Dictionary — Education, Demographics & Staffing sections

**Files:**
- Modify: `Docs/data-dictionary.md`

**Step 1: Append Education & Demographics section**

Add sections covering:
- **Enrollment & Demographics** — `districts` table columns: `enrollment`, `total_enrollment`, demographic breakdowns (`enrollment_white`, `enrollment_black`, etc.), `demographics_data_year`. Separate table `district_grade_enrollment` for per-grade breakdown. Source: Urban Institute CCD enrollment endpoint.
- **Staffing & Ratios** — FTE columns (`teachers_fte`, `admin_fte`, `guidance_counselors_fte`, `instructional_aides_fte`, `support_staff_fte`, `staff_total_fte`), salary columns, computed ratios (`student_teacher_ratio`, `student_staff_ratio`, `sped_student_teacher_ratio`). Source: Urban Institute staff endpoint. `staff_data_year` tracks freshness.
- **Finance** — Revenue by source (federal/state/local), `total_expenditure`, `expenditure_per_pupil`, sped expenditure detail, ESSER/COVID relief, tech spending, capital outlay, debt, outsourcing signals (`payments_to_charter_schools`, `payments_to_private_schools`). Source: Urban Institute finance endpoint. `finance_data_year` tracks freshness.
- **Outcomes** — `graduation_rate_total`, `math_proficiency_pct`, `read_proficiency_pct`, `chronic_absenteeism_rate`, `children_poverty_percent`, `median_household_income`. Each has its own `*_data_year` column.

For each metric group, document: what it measures, which table/column, the data year column, and source.

Note the gotcha: **different data sources have different latest years.** Finance might be 2022 while staffing is 2021. Queries combining multiple sources should be aware of year mismatches.

**Step 2: Commit**

```bash
git add Docs/data-dictionary.md
git commit -m "docs: data dictionary — education, demographics, staffing, finance, outcomes"
```

---

### Task 3: Data Dictionary — Trends, Comparisons & Competitor Spend

**Files:**
- Modify: `Docs/data-dictionary.md`

**Step 1: Append Trends & Comparisons section**

Document:
- **3-Year Trends** — pattern: `{metric}_trend_3yr` = percentage change over 3 years. Example: `enrollment_trend_3yr = 3.5` means 3.5% growth. Computed from `district_data_history` table. List all 8 trend columns.
- **Materialized view bucketing** — how trends are converted to signals: `strong_growth` (>=5%), `growth` (>=1%), `stable` (>=-1%), `decline` (>=-5%), `strong_decline` (<-5%).
- **State/National Deltas** — pattern: `{metric}_vs_state` / `{metric}_vs_national` = district value minus average. **Positive = higher value, NOT necessarily "better."** High absenteeism_vs_state is bad; high graduation_vs_state is good. Include polarity table for all 8 metrics. See issue #9 for planned normalization.
- **Quartile Rankings** — pattern: `{metric}_quartile_state` = well_above, above, below, well_below (within-state quartile position).

**Step 2: Append Competitor Spend section**

Document:
- **Table:** `competitor_spend` (NOT on `districts` table)
- **Key difference:** Uses flexible `fiscal_year` VARCHAR column ('FY24', 'FY25', etc.) — unlike Fullmind's hardcoded FY columns
- **Columns:** `leaid`, `competitor`, `fiscal_year`, `total_spend`, `po_count`
- **Unique constraint:** one row per (leaid, competitor, fiscal_year)
- **Known competitors in data:** Proximity Learning, Elevate K12, Tutored By Teachers
- **Source:** GovSpend PO data via ETL

**Step 3: Commit**

```bash
git add Docs/data-dictionary.md
git commit -m "docs: data dictionary — trends, comparisons, competitor spend"
```

---

### Task 4: Data Dictionary — Territory Planning, Materialized View & Infrastructure

**Files:**
- Modify: `Docs/data-dictionary.md`

**Step 1: Append Territory Planning section**

Document:
- `territory_plan` — plan metadata (name, fiscal_year, status, owner)
- `territory_plan_district` — per-district targets (renewal, winback, expansion, new_business as Decimal)
- `territory_plan_district_services` — service assignments with `return_services` vs `new_services` enum
- `services` — catalog of Fullmind service offerings
- Plan membership tracked in materialized view as comma-separated `plan_ids`

**Step 2: Append Materialized View section**

Document `district_map_features`:
- What it pre-computes: Fullmind categories (multi_year, new, lapsed, pipeline stages, target), vendor competitor categories (multi_year, new, churned), trend signals, locale signal, expenditure signal
- **When to query it:** tile/map data only. For everything else, query `districts` directly.
- **Refresh:** `REFRESH MATERIALIZED VIEW district_map_features;` — manual, must run after data loads
- **Definition file:** `scripts/district-map-features-view.sql`
- **Staleness risk:** view can be stale if data was loaded without refreshing

**Step 3: Append Infrastructure Reference section**

Document:
- Connection pool config (max 2 prod / 5 dev, 10s timeouts)
- When to use Prisma vs raw SQL
- Key indexes (list all indexed columns and composite indexes)
- Supabase constraints (shared pooler, serverless cold starts)

**Step 4: Commit**

```bash
git add Docs/data-dictionary.md
git commit -m "docs: data dictionary — territory planning, materialized view, infrastructure"
```

---

### Task 5: Create the Efficient Queries Skill

**Files:**
- Create: `~/.claude/skills/efficient-queries/SKILL.md`

**Step 1: Create the skill directory and file**

Write `SKILL.md` with:

**Frontmatter:**
```yaml
---
name: efficient-queries
description: Use when writing, modifying, or reviewing any database query — Prisma findMany/create/update/delete, raw SQL, API route handlers that read from or write to the DB, materialized view definitions, or ETL scripts that touch PostgreSQL
---
```

**Body sections:**
1. Overview — one-sentence purpose
2. When to Use — symptoms/triggers list
3. Before You Query — read the project data dictionary (`Docs/data-dictionary.md`)
4. 5-Step Process — Goal Discovery, Scope Check, Pattern Match, Write + Review Checklist, Supabase Reality Check (full details from design doc)
5. Red Flags table — rationalization counters
6. Quick Reference — indexed columns, Prisma vs raw SQL decision, materialized view refresh command

Keep under 200 lines. Process-focused, not reference-heavy (dictionary handles reference).

**Step 2: Verify skill is discoverable**

Run: `ls ~/.claude/skills/efficient-queries/SKILL.md`
Expected: File exists

**Step 3: Commit the skill file**

Note: The skill lives outside the repo (`~/.claude/skills/`), so it won't be in a git commit. Just verify it exists.

---

### Task 6: Verify skill triggers correctly

**Step 1: Test skill discovery**

In a new Claude Code message, describe a task that involves writing a database query (e.g., "add an API route that fetches districts by enrollment range"). Check that the skill appears in the available skills list or auto-triggers.

**Step 2: Verify dictionary reference works**

Confirm that when the skill triggers, it can successfully read `Docs/data-dictionary.md` from the project.

**Step 3: Final review**

Read through both files end-to-end. Check:
- Dictionary covers all sections from the design doc
- Skill references the dictionary correctly
- No placeholder content remaining
- Issue links (#8, #9) are present where relevant
