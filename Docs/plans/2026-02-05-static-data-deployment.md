# Static Data Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable deploying the Data Reconciliation dashboard to Vercel with periodic data snapshots so the team can access it via URL without needing local database/API access.

**Architecture:** A snapshot script runs locally (where FastAPI + OpenSearch are accessible), captures API responses as JSON files, and commits/pushes them. The Next.js API routes detect a `USE_STATIC_DATA` env var and serve snapshot files instead of proxying to live backends. A macOS launchd plist runs the script hourly. The NCES lookup stays live via Prisma/Supabase. A metadata file tracks when data was last refreshed, displayed in the UI.

**Tech Stack:** Next.js 16.1.6, TypeScript, node:fs/path (snapshot script), macOS launchd (cron), Vercel (deployment)

---

## Task 1: Create the Snapshot Script

**Files:**
- Create: `scripts/snapshot-data.ts`
- Create: `data/snapshots/.gitkeep`

**Context:** The script runs locally while the dev server is up on port 3005. It hits three Next.js API routes that proxy to FastAPI and OpenSearch, saves the responses as JSON files, and writes metadata + log entries.

**Endpoints to snapshot:**
- `http://localhost:3005/api/data/district-profiles` → `data/snapshots/district-profiles.json`
- `http://localhost:3005/api/data/reconciliation?type=unmatched` → `data/snapshots/unmatched.json`
- `http://localhost:3005/api/data/reconciliation?type=fragmented` → `data/snapshots/fragmented.json`

**Step 1: Create the snapshots directory**

```bash
mkdir -p data/snapshots
touch data/snapshots/.gitkeep
```

**Step 2: Write the snapshot script**

Create `scripts/snapshot-data.ts`:

```typescript
/**
 * Snapshot script — captures live API data and saves as static JSON files.
 * Run while the dev server is up: npx tsx scripts/snapshot-data.ts
 *
 * Optionally pass --push to auto-commit and push after snapshot.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const BASE_URL = process.env.SNAPSHOT_BASE_URL || "http://localhost:3005";
const SNAPSHOT_DIR = path.resolve(__dirname, "../data/snapshots");
const LOG_FILE = path.join(SNAPSHOT_DIR, "snapshot.log");
const METADATA_FILE = path.join(SNAPSHOT_DIR, "metadata.json");

const ENDPOINTS = [
  {
    name: "district-profiles",
    url: `${BASE_URL}/api/data/district-profiles`,
    file: "district-profiles.json",
  },
  {
    name: "unmatched",
    url: `${BASE_URL}/api/data/reconciliation?type=unmatched`,
    file: "unmatched.json",
  },
  {
    name: "fragmented",
    url: `${BASE_URL}/api/data/reconciliation?type=fragmented`,
    file: "fragmented.json",
  },
];

function appendLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

async function snapshotEndpoint(
  endpoint: (typeof ENDPOINTS)[number]
): Promise<{ name: string; count: number }> {
  const response = await fetch(endpoint.url);
  if (!response.ok) {
    throw new Error(`${endpoint.name}: HTTP ${response.status}`);
  }
  const data = await response.json();
  const count = Array.isArray(data) ? data.length : 1;
  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, endpoint.file),
    JSON.stringify(data, null, 2)
  );
  return { name: endpoint.name, count };
}

async function main() {
  const shouldPush = process.argv.includes("--push");

  // Ensure snapshot directory exists
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  try {
    const results = await Promise.all(ENDPOINTS.map(snapshotEndpoint));

    // Build summary string
    const summary = results.map((r) => `${r.name}: ${r.count}`).join(" | ");
    appendLog(`OK | ${summary}`);

    // Write metadata
    const metadata = {
      lastRefreshed: new Date().toISOString(),
      counts: Object.fromEntries(results.map((r) => [r.name, r.count])),
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

    if (shouldPush) {
      console.log("\nCommitting and pushing snapshot...");
      execSync("git add data/snapshots/", { stdio: "inherit" });
      execSync(
        `git commit -m "chore: update data snapshot ${new Date().toISOString().slice(0, 16)}"`,
        { stdio: "inherit" }
      );
      execSync("git push", { stdio: "inherit" });
      console.log("Pushed successfully.");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    appendLog(`FAIL | ${msg}`);
    process.exit(1);
  }
}

main();
```

**Step 3: Add npm script**

Add to `package.json` scripts:

```json
"snapshot": "tsx scripts/snapshot-data.ts",
"snapshot:push": "tsx scripts/snapshot-data.ts --push"
```

**Step 4: Test the script**

Run (with dev server up on another terminal):
```bash
npm run snapshot
```
Expected: Three JSON files and `metadata.json` written to `data/snapshots/`, one log line in `snapshot.log`.

**Step 5: Commit**

```bash
git add scripts/snapshot-data.ts data/snapshots/.gitkeep package.json
git commit -m "feat: add snapshot script for static data deployment"
```

---

## Task 2: Add Static Data Fallback to API Routes

**Files:**
- Modify: `src/app/api/data/district-profiles/route.ts`
- Modify: `src/app/api/data/reconciliation/route.ts`

**Context:** When `USE_STATIC_DATA` env var is set to `"true"`, the API routes read from `data/snapshots/*.json` instead of calling FastAPI/OpenSearch. This is what enables the Vercel deployment to work without live backends.

**Step 1: Modify district-profiles route**

In `src/app/api/data/district-profiles/route.ts`, add static data fallback at the top of the GET handler:

```typescript
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(request: NextRequest) {
  // Static data mode — serve snapshot file instead of proxying to FastAPI
  if (process.env.USE_STATIC_DATA === "true") {
    try {
      const filePath = path.join(process.cwd(), "data/snapshots/district-profiles.json");
      const raw = fs.readFileSync(filePath, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json(
        { error: "Static data file not found. Run: npm run snapshot" },
        { status: 503 }
      );
    }
  }

  // Live mode — proxy to FastAPI (existing code below)
  const fastApiUrl = process.env.FASTAPI_URL;
  // ... rest of existing code unchanged
}
```

**Step 2: Modify reconciliation route**

In `src/app/api/data/reconciliation/route.ts`, add static data fallback at the top of the GET handler:

```typescript
// Add imports at top of file
import fs from "node:fs";
import path from "node:path";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type || !["unmatched", "fragmented"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid type. Must be 'unmatched' or 'fragmented'" },
      { status: 400 }
    );
  }

  // Static data mode — serve snapshot file instead of querying OpenSearch
  if (process.env.USE_STATIC_DATA === "true") {
    try {
      const filePath = path.join(process.cwd(), `data/snapshots/${type}.json`);
      const raw = fs.readFileSync(filePath, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json(
        { error: `Static data file for ${type} not found. Run: npm run snapshot` },
        { status: 503 }
      );
    }
  }

  // Live mode — query OpenSearch (existing code below)
  try {
    const client = getOpenSearchClient();
    // ... rest of existing code unchanged
  }
}
```

**Step 3: Verify locally**

Set the env var and start the dev server to confirm static fallback works:
```bash
USE_STATIC_DATA=true npm run dev
```
Visit `http://localhost:3005` and navigate to Data Reconciliation. All three tabs should load data from the snapshot files.

**Step 4: Commit**

```bash
git add src/app/api/data/district-profiles/route.ts src/app/api/data/reconciliation/route.ts
git commit -m "feat: add static data fallback to API routes"
```

---

## Task 3: Add "Last Refreshed" Label to the UI

**Files:**
- Create: `src/lib/useSnapshotMetadata.ts`
- Modify: `src/components/views/DataView.tsx`

**Context:** The snapshot script writes `data/snapshots/metadata.json` with a `lastRefreshed` timestamp. We create a small API-like hook that reads this, and display it as a subtle label at the top of the Data Reconciliation view. In local dev mode (live data), it shows "Live" instead.

**Step 1: Create a metadata API route**

Create `src/app/api/data/snapshot-metadata/route.ts`:

```typescript
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.USE_STATIC_DATA !== "true") {
    return NextResponse.json({ mode: "live" });
  }

  try {
    const filePath = path.join(process.cwd(), "data/snapshots/metadata.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const metadata = JSON.parse(raw);
    return NextResponse.json({ mode: "static", ...metadata });
  } catch {
    return NextResponse.json({ mode: "static", lastRefreshed: null });
  }
}
```

**Step 2: Add hook in api.ts**

Add to `src/lib/api.ts` (after the `useNcesLookup` hook):

```typescript
export interface SnapshotMetadata {
  mode: "live" | "static";
  lastRefreshed?: string | null;
  counts?: Record<string, number>;
}

export function useSnapshotMetadata() {
  return useQuery({
    queryKey: ["snapshot-metadata"],
    queryFn: () => fetchJson<SnapshotMetadata>(`${API_BASE}/data/snapshot-metadata`),
    staleTime: 60 * 1000, // 1 minute
  });
}
```

**Step 3: Add the label to DataView.tsx**

Import `useSnapshotMetadata` and add a label near the top of the page, right below the tab bar:

```tsx
const { data: snapshotMeta } = useSnapshotMetadata();

// In the JSX, after the tab buttons and before the content:
{snapshotMeta && snapshotMeta.mode === "static" && snapshotMeta.lastRefreshed && (
  <div className="text-xs text-gray-400 text-right px-4">
    Data as of {new Date(snapshotMeta.lastRefreshed).toLocaleString()}
  </div>
)}
{snapshotMeta && snapshotMeta.mode === "live" && (
  <div className="text-xs text-emerald-500 text-right px-4">
    ● Live
  </div>
)}
```

**Step 4: Verify**

- With `USE_STATIC_DATA=true`: should show "Data as of Feb 5, 2026 4:00 PM" (or whatever the snapshot timestamp is).
- Without the env var (normal dev): should show green "● Live".

**Step 5: Commit**

```bash
git add src/app/api/data/snapshot-metadata/route.ts src/lib/api.ts src/components/views/DataView.tsx
git commit -m "feat: add 'last refreshed' label to Data Reconciliation view"
```

---

## Task 4: Set Up the Hourly Cron Job

**Files:**
- Create: `scripts/com.territory-plan.snapshot.plist`
- Modify: `scripts/snapshot-data.ts` (add logging for stdout/stderr paths)

**Context:** A macOS `launchd` plist that runs the snapshot script every hour. It uses `--push` so snapshots auto-commit and push, triggering Vercel redeployment. Logs go to a file for debugging.

**Step 1: Create the launchd plist**

Create `scripts/com.territory-plan.snapshot.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.territory-plan.snapshot</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/npx</string>
    <string>tsx</string>
    <string>scripts/snapshot-data.ts</string>
    <string>--push</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan</string>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>StandardOutPath</key>
  <string>/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/data/snapshots/cron-stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan/data/snapshots/cron-stderr.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
```

**Step 2: Add setup/teardown npm scripts**

Add to `package.json` scripts:

```json
"snapshot:install-cron": "cp scripts/com.territory-plan.snapshot.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.territory-plan.snapshot.plist",
"snapshot:uninstall-cron": "launchctl unload ~/Library/LaunchAgents/com.territory-plan.snapshot.plist && rm ~/Library/LaunchAgents/com.territory-plan.snapshot.plist"
```

**Step 3: Add cron logs to .gitignore**

Add to `.gitignore`:

```
data/snapshots/cron-stdout.log
data/snapshots/cron-stderr.log
```

**Step 4: Test the cron installation**

```bash
npm run snapshot:install-cron
```
Verify it's loaded:
```bash
launchctl list | grep territory-plan
```
Expected: shows `com.territory-plan.snapshot` in the list.

**Step 5: Commit**

```bash
git add scripts/com.territory-plan.snapshot.plist package.json .gitignore
git commit -m "feat: add hourly snapshot cron job via launchd"
```

---

## Task 5: Configure for Vercel Deployment

**Files:**
- Create: `.env.production` (or configure in Vercel dashboard)
- Modify: `.gitignore` (ensure snapshot data files are NOT ignored — they need to ship)

**Context:** Vercel needs the snapshot JSON files in the repo and the `USE_STATIC_DATA` env var set. The Prisma/Supabase connection needs its own env vars configured in the Vercel dashboard.

**Step 1: Verify .gitignore allows snapshot data files**

Make sure `data/snapshots/*.json` and `data/snapshots/metadata.json` are NOT in `.gitignore`. The `snapshot.log` can be committed (useful for auditing). Only the cron log files should be ignored.

**Step 2: Create a Vercel-specific env example**

Create `docs/DEPLOYMENT.md` (brief, not a full README):

```markdown
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
```

**Step 3: Run a full snapshot and push**

```bash
npm run snapshot:push
```

**Step 4: Deploy to Vercel**

```bash
npx vercel --prod
```
Or connect the GitHub repo in the Vercel dashboard for automatic deployments.

**Step 5: Commit**

```bash
git add docs/DEPLOYMENT.md data/snapshots/
git commit -m "feat: add Vercel deployment configuration and initial snapshot"
```

---

## Task 6: Build Verification

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```
Expected: No new errors in our changed files.

**Step 2: Run production build**

```bash
npm run build
```
Expected: Build succeeds.

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: resolve build issues for static data deployment"
```
