# Vercel Deployment

## Required Environment Variables

Set these in the Vercel dashboard (Settings → Environment Variables):

| Variable | Value | Purpose |
|----------|-------|---------|
| `USE_STATIC_DATA` | `true` | Serve snapshot JSON instead of proxying to FastAPI/OpenSearch |
| `DATABASE_URL` | `postgresql://...` | Prisma/Supabase connection for NCES lookups |

## Refresh Data

Data refreshes automatically every hour via local cron job. To manually refresh:

```bash
npm run snapshot:push
```

This captures fresh data from your running dev server, commits, and pushes. Vercel auto-deploys on push.

## Setup Cron (One-Time)

```bash
npm run snapshot:install-cron
```

To remove the cron job:

```bash
npm run snapshot:uninstall-cron
```

## How It Works

1. The snapshot script (`scripts/snapshot-data.ts`) runs locally where FastAPI and OpenSearch are accessible
2. It saves API responses as JSON files in `data/snapshots/`
3. With `--push`, it commits and pushes the snapshot files
4. Vercel auto-deploys on push
5. In production, API routes detect `USE_STATIC_DATA=true` and serve the snapshot files
6. NCES lookups stay live via Prisma/Supabase (DATABASE_URL)
