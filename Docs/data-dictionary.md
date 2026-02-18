# Territory Plan Builder — Data Dictionary

Reference for all metrics, tables, and data sources in the project database.
Organized by business domain. For each metric: what it measures, where it lives,
and what to watch out for.

**Audience:** Sierra (human-readable reference) and Claude (query context).
**Maintained alongside schema changes** — when columns change, update this file
in the same commit.

---

## Fullmind Sales Data

**Table:** `districts` (denormalized per-FY columns)
**Source:** Fullmind CRM CSV imports via ETL
**Naming pattern:** `fy{YY}_{metric}` — e.g., `fy26_net_invoicing`

### FY Column Inventory

| FY | Sessions (revenue, take, count) | Bookings (opp_count, net_booking, net_invoicing) | Pipeline (opp_count, open, weighted) |
|----|:---:|:---:|:---:|
| FY25 | yes | yes | no |
| FY26 | yes | yes | yes |
| FY27 | no | no | yes |

When new FYs are added, follow the same `fy{YY}_{metric}` naming convention
and add a row to this table.

### Metric Definitions

**Sessions** — delivery/usage metrics (sessions actually taught)

| Column pattern | Type | What it measures |
|----------------|------|------------------|
| `fy{YY}_sessions_revenue` | Decimal(15,2) | Total revenue from sessions delivered |
| `fy{YY}_sessions_take` | Decimal(15,2) | Fullmind's take (margin) from sessions |
| `fy{YY}_sessions_count` | Int | Number of sessions delivered |

**Bookings** — signed deal metrics

| Column pattern | Type | What it measures |
|----------------|------|------------------|
| `fy{YY}_closed_won_opp_count` | Int | Number of closed-won opportunities |
| `fy{YY}_closed_won_net_booking` | Decimal(15,2) | Committed revenue from signed deals |
| `fy{YY}_net_invoicing` | Decimal(15,2) | Amount actually billed through invoices |

**`net_invoicing` is the default revenue metric.** Use it unless specifically
asking about delivery volume (sessions) or deal value (bookings). It reflects
what was actually charged — but can differ from contract value or session
revenue depending on contract structure.

**Pipeline** — future potential revenue

| Column pattern | Type | What it measures |
|----------------|------|------------------|
| `fy{YY}_open_pipeline_opp_count` | Int | Number of open pipeline opportunities |
| `fy{YY}_open_pipeline` | Decimal(15,2) | Total open pipeline value (unweighted) |
| `fy{YY}_open_pipeline_weighted` | Decimal(15,2) | Probability-weighted pipeline value |

### Relationship Flags

| Column | Type | What it means | Gotcha |
|--------|------|---------------|--------|
| `is_customer` | Boolean | Has any Fullmind relationship history | Oversimplified — does NOT distinguish contracted-but-not-invoiced from active. See [issue #8](https://github.com/SierraArcega/territory-plan/issues/8). |
| `has_open_pipeline` | Boolean | Has open pipeline in any FY | Binary flag, doesn't indicate which FY or amount |

### Other CRM Fields

| Column | Type | What it means |
|--------|------|---------------|
| `account_name` | VarChar(255) | Fullmind's name for this account (may differ from NCES district name) |
| `sales_executive` | VarChar(100) | Assigned sales rep |
| `lmsid` | VarChar(50) | Fullmind LMS identifier |

### Gotchas

- **`net_invoicing` is not "cash collected"** — it's "amount billed." Contract
  structure can make this higher or lower than actual revenue.
- **`is_customer = true` does not mean "active paying customer."** A district
  can be contracted but never invoiced, or invoiced but not using sessions.
  Query sessions + invoicing + bookings together for the real picture.
- **FY25 has no pipeline columns.** FY27 has only pipeline (no sessions or
  bookings yet).
- **Querying "revenue"?** Ask: do you mean delivery revenue (sessions_revenue),
  deal value (closed_won_net_booking), or amount billed (net_invoicing)?
  They measure different things.
