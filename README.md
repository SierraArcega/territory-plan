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

# Fetch enrollment data (optional, can be slow)
python scripts/etl/run_etl.py --enrollment

# Load Fullmind data only
python scripts/etl/run_etl.py --fullmind /path/to/fullmind.csv

# View database stats
python scripts/etl/run_etl.py --stats-only
```

## Database Schema

- `districts` - School district boundaries and metadata
- `fullmind_data` - Revenue, bookings, and pipeline metrics
- `district_edits` - User notes and owner assignments
- `tags` - Reusable tags
- `district_tags` - District-tag associations
- `contacts` - District contacts
- `unmatched_accounts` - Fullmind accounts without district match

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
