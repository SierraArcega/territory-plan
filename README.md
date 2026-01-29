# Territory Plan Builder

Interactive web application for visualizing ~13,000 US school district polygons with Fullmind performance data overlay.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Map:** MapLibre GL JS with vector tiles
- **Database:** PostgreSQL + PostGIS
- **ORM:** Prisma
- **State Management:** Zustand + React Query

## Features

- Interactive map of US school districts with choropleth visualization
- Filter by state, customer status, sales executive
- Search districts by name
- View district details including:
  - Revenue metrics (FY25/FY26)
  - Open pipeline summary
  - Custom notes and owner assignment
  - Tags
  - Contacts

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Python 3.9+ (for ETL scripts)

## Quick Start

### 1. Install Dependencies

```bash
cd territory-plan
npm install
```

### 2. Start Database

```bash
docker-compose up -d
```

### 3. Run Migrations

```bash
npx prisma migrate deploy
```

### 4. Run ETL Pipeline

First, install Python dependencies:

```bash
cd scripts/etl
pip install -r requirements.txt
```

Download NCES EDGE shapefile from: https://nces.ed.gov/programs/edge/Geographic/DistrictBoundaries

Then run the ETL:

```bash
# With downloaded shapefile
python run_etl.py --boundaries --shapefile /path/to/shapefile.shp --fullmind /path/to/fullmind.csv

# Or download automatically
python run_etl.py --all --fullmind /path/to/fullmind.csv
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## ETL Pipeline

The ETL pipeline loads data from three sources:

1. **NCES EDGE Boundaries** - School district polygons (~13,000 districts)
2. **Urban Institute API** - Enrollment data
3. **Fullmind CSV** - Customer and pipeline data

### Running Individual Steps

```bash
# Load boundaries only
python scripts/etl/run_etl.py --boundaries --shapefile /path/to/shapefile.shp

# Fetch enrollment data
python scripts/etl/run_etl.py --enrollment

# Load Fullmind data only
python scripts/etl/run_etl.py --fullmind /path/to/fullmind.csv

# Load education data (finance, poverty, demographics, graduation, staff)
# Note: Finance data uses --year 2020 (latest available from Urban Institute)
python scripts/etl/run_etl.py --education-data --year 2020

# View database stats
python scripts/etl/run_etl.py --stats-only
```

### Full Setup After Database Reset

If the database is reset, run these steps in order:

```bash
cd scripts/etl

# 1. Load district boundaries (~13k districts)
python run_etl.py --boundaries

# 2. Load enrollment data
python run_etl.py --enrollment

# 3. Load education data (finance uses 2020, others use 2022)
python run_etl.py --finance --year 2020
python run_etl.py --poverty --demographics --graduation --staff --year 2022

# 4. Load Fullmind CRM data
python run_etl.py --fullmind /path/to/fullmind.csv

# 5. Verify everything loaded
python run_etl.py --stats-only
```

Or restore from a backup instead: `./scripts/db-backup.sh restore <backup-name>`

## Database Schema

- `districts` - School district boundaries and metadata
- `fullmind_data` - Revenue, bookings, and pipeline metrics
- `district_education_data` - Finance, poverty, graduation, staffing data
- `district_enrollment_demographics` - Enrollment by race/ethnicity
- `district_edits` - User notes and owner assignments
- `tags` - Reusable tags
- `district_tags` - District-tag associations
- `contacts` - District contacts
- `unmatched_accounts` - Fullmind accounts without district match
- `territory_plans` - Saved territory plan configurations
- `data_refresh_logs` - ETL run history

## Database Backup & Restore

Always create a backup before destructive operations:

```bash
# Create a backup
./scripts/db-backup.sh backup before-changes

# Verify database state
./scripts/db-backup.sh verify

# List available backups
./scripts/db-backup.sh list

# Restore from backup (if needed)
./scripts/db-backup.sh restore before-changes
```

**Important:** Backups are stored in `backups/` (gitignored). Keep a copy somewhere safe.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/districts` | GET | List districts with filters |
| `/api/districts/[leaid]` | GET | District detail |
| `/api/districts/[leaid]/edits` | PUT | Update notes/owner |
| `/api/tiles/[z]/[x]/[y]` | GET | Vector tiles (MVT) |
| `/api/metrics/quantiles` | GET | Choropleth legend breaks |
| `/api/tags` | GET/POST | Tag CRUD |
| `/api/contacts` | POST | Create contact |
| `/api/contacts/[id]` | PUT/DELETE | Update/delete contact |
| `/api/unmatched` | GET | Unmatched accounts |
| `/api/unmatched/by-state` | GET | State-level summary |

## Environment Variables

```env
DATABASE_URL="postgresql://territory:territory_dev@localhost:5432/territory_plan"
```

## Cloud Deployment

1. Export local database:
   ```bash
   pg_dump -Fc territory_plan > backup.dump
   ```

2. Create cloud PostgreSQL instance with PostGIS extension

3. Import data:
   ```bash
   pg_restore -d <cloud_url> backup.dump
   ```

4. Update `DATABASE_URL` in production environment

## Brand Colors (Fullmind)

| Color | Hex | Use |
|-------|-----|-----|
| Deep Coral | `#F37167` | Primary accent, customers |
| Plum | `#403770` | Text, headers |
| Steel Blue | `#6EA3BE` | Pipeline accounts |
| Robin's Egg | `#C4E7E6` | Backgrounds |
| Off-white | `#FFFCFA` | Page background |
