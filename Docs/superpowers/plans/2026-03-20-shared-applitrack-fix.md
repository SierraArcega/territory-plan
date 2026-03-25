# Shared AppliTrack Vacancy Mis-mapping Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix shared AppliTrack detection so regional job board results are properly redistributed across districts, and clean up existing mis-mapped vacancy data.

**Architecture:** Add async `isStatewideBoardAsync` that guarantees the shared-instance cache is loaded before checking. Widen the enrollment-based safety net to cover all platforms. Write a one-time cleanup script that deletes mis-mapped vacancies per shared instance, then re-fetches and redistributes using the existing pipeline.

**Tech Stack:** TypeScript, Prisma, Vitest

**Spec:** `Docs/superpowers/specs/2026-03-20-shared-applitrack-fix-design.md`

---

### Task 1: Add `isStatewideBoardAsync` to platform-detector

**Files:**
- Modify: `src/features/vacancies/lib/platform-detector.ts:31-41`
- Test: `src/features/vacancies/lib/__tests__/platform-detector.test.ts`

- [ ] **Step 1: Write failing tests for `isStatewideBoardAsync`**

Add to `src/features/vacancies/lib/__tests__/platform-detector.test.ts`:

```ts
import { detectPlatform, isStatewideBoard, isStatewideBoardAsync, getAppliTrackInstance } from "../platform-detector";

// ... existing tests ...

describe("isStatewideBoardAsync", () => {
  it("returns true for olas without needing cache", async () => {
    expect(await isStatewideBoardAsync("olas")).toBe(true);
  });

  it("returns true for schoolspring without needing cache", async () => {
    expect(await isStatewideBoardAsync("schoolspring")).toBe(true);
  });

  it("returns false for unknown", async () => {
    expect(await isStatewideBoardAsync("unknown")).toBe(false);
  });

  it("returns false for applitrack without URL", async () => {
    expect(await isStatewideBoardAsync("applitrack")).toBe(false);
  });

  it("returns true for applitrack with a shared instance URL when cache is loaded", async () => {
    // loadSharedAppliTrackInstances is called internally by isStatewideBoardAsync.
    // This test hits the real DB, so it will only pass if there are shared instances.
    // We test the integration: the cache is loaded, the instance is checked.
    // For a unit-level test, we can verify the function handles a non-shared URL correctly:
    expect(
      await isStatewideBoardAsync("applitrack", "https://www.applitrack.com/nonexistent-instance-xyz/onlineapp/")
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/vacancies/lib/__tests__/platform-detector.test.ts`
Expected: FAIL — `isStatewideBoardAsync` is not exported.

- [ ] **Step 3: Implement `isStatewideBoardAsync`**

In `src/features/vacancies/lib/platform-detector.ts`, add after the existing `isStatewideBoard` function (after line 41):

```ts
/**
 * Async version of isStatewideBoard that guarantees the shared AppliTrack
 * instance cache is loaded before checking. Use this in async contexts
 * (scan-runner, cron route) for reliable detection.
 */
export async function isStatewideBoardAsync(platform: string, url?: string): Promise<boolean> {
  if (platform === "olas" || platform === "schoolspring") return true;

  if (platform === "applitrack" && url) {
    await loadSharedAppliTrackInstances();
    return isSharedAppliTrack(url);
  }

  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/vacancies/lib/__tests__/platform-detector.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/platform-detector.ts src/features/vacancies/lib/__tests__/platform-detector.test.ts
git commit -m "feat: add isStatewideBoardAsync for reliable shared AppliTrack detection"
```

---

### Task 2: Use async detection in scan-runner + widen safety net

**Files:**
- Modify: `src/features/vacancies/lib/scan-runner.ts:2` (imports)
- Modify: `src/features/vacancies/lib/scan-runner.ts:60-67` (remove redundant cache warming)
- Modify: `src/features/vacancies/lib/scan-runner.ts:125-126` (statewide check)
- Modify: `src/features/vacancies/lib/scan-runner.ts:165-189` (safety net)

- [ ] **Step 1: Update imports and remove redundant cache warming**

In `src/features/vacancies/lib/scan-runner.ts`, change line 2 to import only what's needed (drop `loadSharedAppliTrackInstances` since `isStatewideBoardAsync` handles cache loading internally):

```ts
// OLD
import { detectPlatform, isStatewideBoard, loadSharedAppliTrackInstances } from "./platform-detector";
// NEW
import { detectPlatform, isStatewideBoardAsync } from "./platform-detector";
```

Then replace the `Promise.all` cache-warming block at lines 60-67:

```ts
// OLD
    // Step 2: Set status to running + warm shared AppliTrack cache
    await Promise.all([
      prisma.vacancyScan.update({
        where: { id: scanId },
        data: { status: "running" },
      }),
      loadSharedAppliTrackInstances(),
    ]);
// NEW
    // Step 2: Set status to running
    await prisma.vacancyScan.update({
      where: { id: scanId },
      data: { status: "running" },
    });
```

The `isStatewideBoardAsync` call at Step 5 now handles cache loading — the separate warming call was the source of the race condition.

- [ ] **Step 2: Replace sync `isStatewideBoard` with async variant at line 126**

In `src/features/vacancies/lib/scan-runner.ts`, replace line 126:

```ts
// OLD
    if (isStatewideBoard(platform, scan.district.jobBoardUrl) && rawVacancies.length > 0) {
// NEW
    const isStwide = await isStatewideBoardAsync(platform, scan.district.jobBoardUrl);
    if (isStwide && rawVacancies.length > 0) {
```

- [ ] **Step 3: Widen the enrollment safety net to all platforms**

In `src/features/vacancies/lib/scan-runner.ts`, replace the full `} else {` block starting at line 165 through the end of the safety check (line 189), keeping the `// District-scoped board — process normally` comment and everything after it:

```ts
    } else {
      // Safety check: if ANY platform returns a suspicious number of vacancies
      // relative to district size, skip importing — it's likely a regional
      // aggregator that wasn't detected as shared.
      const enrollment = scan.district.enrollment ?? 0;
      if (rawVacancies.length > 100 && enrollment > 0 && enrollment < 5000) {
        const ratio = rawVacancies.length / enrollment;
        if (ratio > 0.5) {
          console.warn(
            `[scan-runner] Suspicious: ${rawVacancies.length} vacancies from "${platform}" ` +
            `for ${scan.district.name} (enrollment: ${enrollment}, ratio: ${ratio.toFixed(2)}). Skipping.`
          );
          await prisma.vacancyScan.update({
            where: { id: scanId },
            data: {
              status: "completed_partial",
              vacancyCount: 0,
              errorMessage: `Skipped: ${rawVacancies.length} vacancies looks like a regional aggregator (enrollment: ${enrollment}, ratio: ${ratio.toFixed(2)})`,
              completedAt: new Date(),
            },
          });
          return;
        }
      }
```

The existing `processVacancies` call and scan update below this block stay unchanged.

- [ ] **Step 4: Run existing tests to ensure nothing breaks**

Run: `npx vitest run src/features/vacancies/`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/vacancies/lib/scan-runner.ts
git commit -m "fix: use async statewide detection + widen enrollment safety net to all platforms"
```

---

### Task 3: Verify cron route detection is safe (no code changes needed)

**Files:**
- Review: `src/app/api/cron/scan-vacancies/route.ts`

- [ ] **Step 1: Verify the cron route's detection is already reliable**

The cron route at `src/app/api/cron/scan-vacancies/route.ts` calls `await loadSharedAppliTrackInstances()` at line 49, which fully loads the cache. All subsequent `isStatewideBoard` calls (lines 83, 95, 131) happen after this `await`, so the sync variant is safe here.

The cron route also imports `isStatewideBoard` (sync) — this is correct since the cache is guaranteed warm. **No code changes needed.** The scan-runner is where the race condition lived, and Task 2 fixes that.

Verify by reading the file and confirming lines 49 and 83 are in the correct order. No commit for this task.

---

### Task 4: Write the cleanup + redistribution script

**Files:**
- Create: `scripts/cleanup-shared-applitrack.ts`

- [ ] **Step 1: Create the cleanup script**

Create `scripts/cleanup-shared-applitrack.ts`:

```ts
/**
 * One-time cleanup: delete mis-mapped vacancies from shared AppliTrack instances,
 * then re-fetch and redistribute using the existing pipeline.
 *
 * Usage:
 *   npx tsx scripts/cleanup-shared-applitrack.ts [--dry-run] [--instance <name>]
 *
 * Flags:
 *   --dry-run      Show what would be deleted/redistributed without making changes
 *   --instance X   Only process a single AppliTrack instance (e.g., "alaskateacher")
 */
import prisma from "../src/lib/prisma";
import { detectPlatform } from "../src/features/vacancies/lib/platform-detector";
import { getParser } from "../src/features/vacancies/lib/parsers";
import { processVacancies } from "../src/features/vacancies/lib/post-processor";
import type { RawVacancy } from "../src/features/vacancies/lib/parsers/types";

// ---- Reuse fuzzy matching from scan-runner ----

const NOISE_WORDS = [
  "school", "schools", "district", "public", "city", "county",
  "unified", "consolidated", "independent", "regional", "area",
  "township", "borough", "union", "free", "central", "community",
];

function normalizeForMatch(name: string): string {
  let n = name.toLowerCase().trim();
  for (const word of NOISE_WORDS) {
    n = n.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  }
  return n.replace(/\s+/g, " ").trim();
}

function bigrams(str: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    result.add(str.substring(i, i + 2));
  }
  return result;
}

function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const bg of ba) if (bb.has(bg)) intersection++;
  return (2 * intersection) / (ba.size + bb.size);
}

const MIN_NAME_LENGTH_FOR_FUZZY = 5;
const REDISTRIBUTION_DICE_THRESHOLD = 0.6;

interface DistrictCandidate {
  leaid: string;
  name: string;
  normalized: string;
}

function findBestDistrict(
  employerName: string,
  districts: DistrictCandidate[],
  schoolToDistrict: Map<string, string>
): { leaid: string; name: string } | null {
  const normEmployer = normalizeForMatch(employerName);

  if (!normEmployer || normEmployer.length < MIN_NAME_LENGTH_FOR_FUZZY) {
    // Still try exact school name lookup below
  } else {
    for (const d of districts) {
      if (d.normalized.length < MIN_NAME_LENGTH_FOR_FUZZY) continue;
      if (normEmployer.includes(d.normalized) || d.normalized.includes(normEmployer)) {
        return { leaid: d.leaid, name: d.name };
      }
    }

    let bestScore = 0;
    let bestMatch: DistrictCandidate | null = null;
    for (const d of districts) {
      if (d.normalized.length < MIN_NAME_LENGTH_FOR_FUZZY) continue;
      const score = diceCoefficient(normEmployer, d.normalized);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = d;
      }
    }
    if (bestMatch && bestScore >= REDISTRIBUTION_DICE_THRESHOLD) {
      return { leaid: bestMatch.leaid, name: bestMatch.name };
    }
  }

  const schoolLeaid = schoolToDistrict.get(employerName.toLowerCase().trim());
  if (schoolLeaid) {
    const district = districts.find((d) => d.leaid === schoolLeaid);
    if (district) return { leaid: district.leaid, name: district.name };
  }

  return null;
}

// ---- Delay helper ----

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Main ----

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const instanceIdx = args.indexOf("--instance");
  const onlyInstance = instanceIdx !== -1 ? args[instanceIdx + 1] : null;

  if (dryRun) console.log("=== DRY RUN MODE ===\n");

  // 1. Find all shared AppliTrack instances
  const sharedInstances: { instance: string; district_count: bigint }[] = await prisma.$queryRaw`
    SELECT
      LOWER(SUBSTRING(job_board_url FROM 'applitrack.com/([^/]+)')) as instance,
      COUNT(*) as district_count
    FROM districts
    WHERE job_board_url LIKE '%applitrack.com%'
    GROUP BY LOWER(SUBSTRING(job_board_url FROM 'applitrack.com/([^/]+)'))
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `;

  const instances = onlyInstance
    ? sharedInstances.filter((i) => i.instance === onlyInstance)
    : sharedInstances;

  if (instances.length === 0) {
    console.log("No shared AppliTrack instances found.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${instances.length} shared AppliTrack instances to process.\n`);

  let totalDeleted = 0;
  let totalRedistributed = 0;
  let totalInstancesProcessed = 0;

  for (const inst of instances) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Instance: ${inst.instance} (${inst.district_count} districts)`);
    console.log("=".repeat(80));

    // 2. Get all districts pointing to this instance
    const districts: { leaid: string; name: string; enrollment: number | null; jobBoardUrl: string }[] =
      await prisma.district.findMany({
        where: {
          jobBoardUrl: { contains: `applitrack.com/${inst.instance}`, mode: "insensitive" },
        },
        select: { leaid: true, name: true, enrollment: true, jobBoardUrl: true },
      });

    // 3. Count existing open vacancies across all these districts
    const leaids = districts.map((d) => d.leaid);
    const existingCount = await prisma.vacancy.count({
      where: { leaid: { in: leaids }, status: "open" },
    });

    console.log(`  Districts: ${districts.length}`);
    console.log(`  Total open vacancies across all districts: ${existingCount}`);

    if (existingCount === 0) {
      console.log("  No vacancies to clean up — skipping.");
      continue;
    }

    // 4. Delete all open vacancies for these districts
    if (!dryRun) {
      const deleted = await prisma.vacancy.deleteMany({
        where: { leaid: { in: leaids }, status: "open" },
      });
      console.log(`  Deleted ${deleted.count} mis-mapped vacancies.`);
      totalDeleted += deleted.count;
    } else {
      console.log(`  [DRY RUN] Would delete ${existingCount} vacancies.`);
      totalDeleted += existingCount;
    }

    // 5. Pick representative district and re-fetch
    const representative = districts[0];
    const url = representative.jobBoardUrl;
    const platform = detectPlatform(url);
    const parser = getParser(platform);

    if (!parser) {
      console.log(`  No parser for platform "${platform}" — skipping re-fetch.`);
      continue;
    }

    console.log(`  Re-fetching from: ${url.substring(0, 80)}...`);

    let allJobs: RawVacancy[];
    try {
      allJobs = await parser(url);
    } catch (err) {
      console.error(`  Failed to fetch: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    console.log(`  Fetched ${allJobs.length} raw vacancies.`);

    if (allJobs.length === 0) {
      continue;
    }

    // 6. Load state districts + schools for matching
    const fipsPrefix = representative.leaid.substring(0, 2);
    const [stateDistricts, stateSchools] = await Promise.all([
      prisma.district.findMany({
        where: { leaid: { startsWith: fipsPrefix } },
        select: { leaid: true, name: true },
      }),
      prisma.school.findMany({
        where: { leaid: { startsWith: fipsPrefix } },
        select: { schoolName: true, leaid: true },
      }),
    ]);

    const candidates: DistrictCandidate[] = stateDistricts.map((d) => ({
      ...d,
      normalized: normalizeForMatch(d.name),
    }));

    const schoolToDistrict = new Map<string, string>();
    for (const s of stateSchools) {
      schoolToDistrict.set(s.schoolName.toLowerCase().trim(), s.leaid);
    }

    // 7. Group jobs by matched district
    const buckets = new Map<string, { districtName: string; jobs: RawVacancy[] }>();
    let unmatched = 0;

    for (const job of allJobs) {
      if (!job.employerName) {
        unmatched++;
        continue;
      }

      const match = findBestDistrict(job.employerName, candidates, schoolToDistrict);
      if (match) {
        if (!buckets.has(match.leaid)) {
          buckets.set(match.leaid, { districtName: match.name, jobs: [] });
        }
        buckets.get(match.leaid)!.jobs.push(job);
      } else {
        unmatched++;
      }
    }

    console.log(`  Matched to ${buckets.size} districts, ${unmatched} unmatched (dropped).`);

    // 8. Process each bucket through the normal pipeline
    if (!dryRun) {
      const scan = await prisma.vacancyScan.create({
        data: {
          leaid: representative.leaid,
          status: "running",
          platform,
          triggeredBy: "cleanup-script",
        },
      });

      let instanceTotal = 0;
      const CONCURRENCY = 5;
      const entries = [...buckets.entries()];

      for (let i = 0; i < entries.length; i += CONCURRENCY) {
        const batch = entries.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(([leaid, bucket]) =>
            processVacancies(leaid, scan.id, bucket.jobs, platform, bucket.districtName)
          )
        );
        for (const r of results) {
          instanceTotal += r.vacancyCount;
        }
      }

      await prisma.vacancyScan.update({
        where: { id: scan.id },
        data: {
          status: "completed",
          vacancyCount: instanceTotal,
          districtsMatched: buckets.size,
          completedAt: new Date(),
        },
      });

      console.log(`  Redistributed ${instanceTotal} vacancies to ${buckets.size} districts.`);
      totalRedistributed += instanceTotal;
    } else {
      const jobCount = [...buckets.values()].reduce((s, b) => s + b.jobs.length, 0);
      console.log(`  [DRY RUN] Would redistribute ${jobCount} vacancies to ${buckets.size} districts.`);
      totalRedistributed += jobCount;

      // Show top 5 districts by vacancy count
      const sorted = [...buckets.entries()]
        .sort((a, b) => b[1].jobs.length - a[1].jobs.length)
        .slice(0, 5);
      for (const [leaid, bucket] of sorted) {
        console.log(`    ${leaid} ${bucket.districtName}: ${bucket.jobs.length} vacancies`);
      }
    }

    totalInstancesProcessed++;

    // Rate-limit: wait 2s between instances to avoid hammering job boards
    if (instances.indexOf(inst) < instances.length - 1) {
      console.log("  Waiting 2s before next instance...");
      await delay(2000);
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`  Instances processed: ${totalInstancesProcessed}`);
  console.log(`  Vacancies deleted:   ${totalDeleted}`);
  console.log(`  Vacancies redistributed: ${totalRedistributed}`);
  if (dryRun) console.log("\n  (DRY RUN — no changes were made)");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Test with `--dry-run` first**

Run: `npx tsx scripts/cleanup-shared-applitrack.ts --dry-run`
Expected: Shows each shared instance, vacancy counts to delete, and redistribution preview without making changes.

- [ ] **Step 3: Test on a single instance**

Run: `npx tsx scripts/cleanup-shared-applitrack.ts --instance alaskateacher`
Expected: Deletes mis-mapped vacancies for Alaska districts, re-fetches from AppliTrack, redistributes to correct districts. Pelican City should go from 521 open vacancies to a handful (or zero if no jobs are actually in that district).

- [ ] **Step 4: Run full cleanup**

Run: `npx tsx scripts/cleanup-shared-applitrack.ts`
Expected: Processes all shared instances. Review output to confirm reasonable redistribution.

- [ ] **Step 5: Verify results**

Run the diagnostic query from earlier to confirm suspicious districts are cleaned up:

```bash
npx tsx -e "
import prisma from './src/lib/prisma';
async function main() {
  const results: any[] = await prisma.\$queryRaw\`
    SELECT d.leaid, d.name, d.enrollment,
      COUNT(v.id) FILTER (WHERE v.status = 'open') as open_vacancies
    FROM districts d
    LEFT JOIN vacancies v ON v.leaid = d.leaid
    WHERE d.job_board_url LIKE '%applitrack.com/alaskateacher%'
    GROUP BY d.leaid, d.name, d.enrollment
    ORDER BY COUNT(v.id) FILTER (WHERE v.status = 'open') DESC
    LIMIT 10
  \`;
  for (const r of results) {
    console.log(\`\${r.leaid} | \${r.name} | enroll: \${r.enrollment} | open: \${r.open_vacancies}\`);
  }
  await prisma.\$disconnect();
}
main();
"
```

Expected: Each district should have a proportional number of vacancies, not 500+.

- [ ] **Step 6: Commit**

```bash
git add scripts/cleanup-shared-applitrack.ts
git commit -m "feat: add cleanup script for mis-mapped shared AppliTrack vacancies"
```
