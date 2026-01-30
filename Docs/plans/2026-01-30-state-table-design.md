# State Table Design

## Overview

Add a `State` table to group districts by state, store denormalized aggregate metrics, and enable territory management at the state level.

## Requirements

- Store all state identifiers (FIPS, abbreviation, name) for flexible joins
- Denormalized aggregates refreshed from district data (not computed on-the-fly)
- Territory owner assignment per state
- Fiscal year goals (revenue, district count) in separate table
- Link territory plans to states (optional association)

## Schema

### State Model

```prisma
model State {
  fips          String    @id @db.VarChar(2)
  abbrev        String    @unique @db.VarChar(2)
  name          String    @db.VarChar(100)

  // Denormalized Aggregates (refreshed from districts)
  totalDistricts      Int       @default(0) @map("total_districts")
  totalEnrollment     Int?      @map("total_enrollment")
  totalSchools        Int?      @map("total_schools")
  totalCustomers      Int       @default(0) @map("total_customers")
  totalWithPipeline   Int       @default(0) @map("total_with_pipeline")
  totalPipelineValue  Decimal?  @map("total_pipeline_value") @db.Decimal(15, 2)

  // Education averages
  avgExpenditurePerPupil  Decimal? @map("avg_expenditure_per_pupil") @db.Decimal(12, 2)
  avgGraduationRate       Decimal? @map("avg_graduation_rate") @db.Decimal(5, 2)
  avgPovertyRate          Decimal? @map("avg_poverty_rate") @db.Decimal(5, 2)

  // Territory Management
  territoryOwner    String?   @map("territory_owner") @db.VarChar(100)
  notes             String?

  // Timestamps
  aggregatesUpdatedAt DateTime? @map("aggregates_updated_at")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  // Relations
  goals          StateGoal[]
  territoryPlans TerritoryPlan[]

  @@map("states")
}
```

### StateGoal Model

```prisma
model StateGoal {
  id              Int       @id @default(autoincrement())
  stateFips       String    @map("state_fips") @db.VarChar(2)
  fiscalYear      Int       @map("fiscal_year")

  revenueGoal         Decimal?  @map("revenue_goal") @db.Decimal(15, 2)
  districtCountGoal   Int?      @map("district_count_goal")

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  state           State     @relation(fields: [stateFips], references: [fips])

  @@unique([stateFips, fiscalYear])
  @@map("state_goals")
}
```

### TerritoryPlan Modification

Add optional state association:

```prisma
model TerritoryPlan {
  // ... existing fields ...

  stateFips   String?   @map("state_fips") @db.VarChar(2)
  state       State?    @relation(fields: [stateFips], references: [fips])

  @@index([stateFips])
}
```

## Aggregate Refresh Strategy

SQL function to compute aggregates from district data:

```sql
UPDATE states s SET
  total_districts = agg.total_districts,
  total_enrollment = agg.total_enrollment,
  total_schools = agg.total_schools,
  total_customers = agg.total_customers,
  total_with_pipeline = agg.total_with_pipeline,
  total_pipeline_value = agg.total_pipeline_value,
  avg_expenditure_per_pupil = agg.avg_expenditure_per_pupil,
  avg_graduation_rate = agg.avg_graduation_rate,
  avg_poverty_rate = agg.avg_poverty_rate,
  aggregates_updated_at = NOW()
FROM (
  SELECT
    state_fips,
    COUNT(*) as total_districts,
    SUM(enrollment) as total_enrollment,
    SUM(number_of_schools) as total_schools,
    COUNT(*) FILTER (WHERE is_customer = true) as total_customers,
    COUNT(*) FILTER (WHERE has_open_pipeline = true) as total_with_pipeline,
    SUM(fy26_open_pipeline) as total_pipeline_value,
    SUM(expenditure_per_pupil * enrollment) / NULLIF(SUM(enrollment), 0) as avg_expenditure_per_pupil,
    SUM(graduation_rate_total * enrollment) / NULLIF(SUM(enrollment), 0) as avg_graduation_rate,
    AVG(children_poverty_percent) as avg_poverty_rate
  FROM districts
  GROUP BY state_fips
) agg
WHERE s.fips = agg.state_fips;
```

Refresh triggers:
- After ETL runs (enrollment, Fullmind, education data)
- Manual refresh via `--refresh-states` flag
- Could expose as API endpoint

## Implementation Plan

1. Update `prisma/schema.prisma` with State, StateGoal models and TerritoryPlan modification
2. Run `npx prisma db push` to create tables
3. Create `scripts/etl/data/states_seed.json` with 50 states + DC + territories
4. Create `scripts/etl/loaders/state_aggregates.py` with seed and refresh functions
5. Update `scripts/etl/run_etl.py` with `--seed-states` and `--refresh-states` flags
6. Run seed script to populate state reference data
7. Run first aggregate refresh

## Key Decisions

- FIPS code as primary key (matches district `stateFips` for joins)
- Store both FIPS and abbreviation for flexible external data joins
- Territory plans optionally associated with a state (national/multi-state plans remain supported)
- Separate StateGoal table for fiscal year goals (easy to add years without schema changes)
- Aggregates stored denormalized and refreshed (not computed on-the-fly)
- Education averages weighted by enrollment where appropriate
