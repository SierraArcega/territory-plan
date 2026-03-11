# Vendor Metric Normalization Design

## Problem

The summary bar uses different data shapes for Fullmind vs competitors. Fullmind has 5 financial metrics; competitors only have `total_spend`. This creates a discriminated union (`type: "fullmind" | "competitor"`) that flows through the API, hook, and component — adding conditional logic at every layer.

## Decision

Create a new `vendor_financials` table that stores all 10 metrics for every vendor. Normalize at the API layer so every vendor returns the same shape. Missing data is 0.

## New Table: vendor_financials

One row per (leaid, vendor, fiscal_year). All 10 metrics, same shape for every vendor.

| Column | Type | Notes |
|---|---|---|
| leaid | VARCHAR(7) | FK to districts |
| vendor | VARCHAR(20) | 'fullmind', 'proximity', 'elevate', 'tbt' |
| fiscal_year | VARCHAR(4) | 'FY25', 'FY26' |
| open_pipeline | DECIMAL(15,2) | Default 0 |
| closed_won_bookings | DECIMAL(15,2) | Default 0 |
| invoicing | DECIMAL(15,2) | Default 0 |
| scheduled_revenue | DECIMAL(15,2) | Default 0 |
| delivered_revenue | DECIMAL(15,2) | Default 0 |
| deferred_revenue | DECIMAL(15,2) | Default 0 |
| total_revenue | DECIMAL(15,2) | Default 0 |
| delivered_take | DECIMAL(15,2) | Default 0 |
| scheduled_take | DECIMAL(15,2) | Default 0 |
| all_take | DECIMAL(15,2) | Default 0 |
| last_updated | TIMESTAMP | Default NOW() |

UNIQUE(leaid, vendor, fiscal_year)

## Data Migration (existing → vendor_financials)

| Old source | Old column | New column |
|---|---|---|
| districts | `open_pipeline` | `open_pipeline` |
| districts | `closed_won_net_booking` | `closed_won_bookings` |
| districts | `net_invoicing` | `invoicing` |
| districts | `sessions_revenue` | `total_revenue` |
| districts | `sessions_take` | `all_take` |
| competitor_spend | `total_spend` | `total_revenue` |

New fields (scheduled_revenue, delivered_revenue, deferred_revenue, delivered_take, scheduled_take) loaded via user-provided CSV for Fullmind and Elevate.

## Unified Metric Set (10 metrics, all vendors)

| UI Label | vendor_financials column |
|---|---|
| Open Pipeline | `open_pipeline` |
| Closed Won Bookings | `closed_won_bookings` |
| Invoicing | `invoicing` |
| Scheduled Revenue | `scheduled_revenue` |
| Delivered Revenue | `delivered_revenue` |
| Deferred Revenue | `deferred_revenue` |
| Total Revenue | `total_revenue` |
| Delivered Take | `delivered_take` |
| Scheduled Take | `scheduled_take` |
| All Take | `all_take` |

## Changes

### API Route (`src/app/api/districts/summary/route.ts`)

- Combined + per-vendor queries JOIN `vendor_financials` instead of districts table financial columns
- Still uses `district_map_features` for category grouping (engagement filter)
- Every `byVendor` entry returns all 10 metrics in the same shape

### Hook (`src/features/map/lib/useMapSummary.ts`)

- `SummaryTotals` has all 10 metric fields
- Remove `CompetitorVendorTotals` type and `type: "fullmind" | "competitor"` discriminator
- All vendor entries are just `{ totals: SummaryTotals }`

### Component (`src/features/map/components/MapSummaryBar.tsx`)

- `VendorRow` renders the same stats for every vendor (districts + enrollment + 10 financial)
- Remove conditional fullmind/competitor rendering
- Zero values display as `$0`

## FY Behavior

No change. The existing fiscal year selector continues to filter all data by FY.

## Dropped

- `open_pipeline_weighted` — not in the unified metric set
