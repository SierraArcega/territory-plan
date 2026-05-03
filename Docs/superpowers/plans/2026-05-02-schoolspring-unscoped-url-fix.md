# SchoolSpring Unscoped-URL Parser Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the SchoolSpring parser from ingesting unscoped-network vacancies into 169 affected districts, recover correctly-attributed data where possible, and purge the 1,162 mis-attributed rows currently in `vacancies`.

**Architecture:** Two-part change. (1) Replace `resolveSchoolSpringHostname()` with `resolveSchoolSpringSource()` that returns `{ hostname, organizationFilter? }` and adds a recovery path for `www.schoolspring.com` URLs (HTML discovery probe → API organization-filter probe → skip). Thread the optional `organizationFilter` into every paged API call. (2) Standalone tsx cleanup script that selects affected districts via SQL regex, hard-deletes vacancies where `district_verified=false`, and optionally re-scans through the existing `runScan()` path.

**Tech Stack:** TypeScript, Vitest, Prisma, raw SQL (pg via `prisma.$queryRawUnsafe`). The script uses the same `runScan()` entry point that `POST /api/vacancies/scan` uses, by creating a `VacancyScan` row and awaiting the runner.

---

## File Structure

**Modify:**
- `src/features/vacancies/lib/parsers/schoolspring.ts` — replace `resolveSchoolSpringHostname()` with `resolveSchoolSpringSource()`, add recovery probes, thread `organizationFilter` through paged calls.

**Create:**
- `src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts` — Vitest tests for the resolver (no parser tests exist today).
- `scripts/purge-unscoped-schoolspring-vacancies.ts` — operational script with `--apply` and `--rescan` flags.

---

## Task 1: Add Vitest test scaffold for the SchoolSpring parser

**Files:**
- Create: `src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`

- [ ] **Step 1: Write a sanity test that the file compiles and Vitest picks it up**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("schoolspring parser", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("scaffold compiles", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
Expected: PASS — 1 test, 0 failed.

- [ ] **Step 3: Commit**

```bash
git add src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts
git commit -m "test(vacancies): scaffold SchoolSpring parser test file"
```

---

## Task 2: Failing test — `*.schoolspring.com` subdomains still resolve directly

This locks in existing behavior so the recovery path doesn't break it.

**Files:**
- Modify: `src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`

- [ ] **Step 1: Replace the scaffold with the first real test**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveSchoolSpringSource } from "../schoolspring";

describe("resolveSchoolSpringSource", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the hostname directly when URL is already on a per-employer subdomain", async () => {
    const result = await resolveSchoolSpringSource(
      "https://brimfieldma.schoolspring.com/jobs"
    );
    expect(result).toEqual({ hostname: "brimfieldma.schoolspring.com" });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
Expected: FAIL — `resolveSchoolSpringSource` is not exported (TS error or runtime undefined).

---

## Task 3: Implement the new resolver signature (subdomain pass-through)

Make Task 2's test pass with the minimal change.

**Files:**
- Modify: `src/features/vacancies/lib/parsers/schoolspring.ts`

- [ ] **Step 1: Add the new type and exported function alongside the existing `resolveSchoolSpringHostname`**

Leave `resolveSchoolSpringHostname` and the existing `parseSchoolSpring` untouched for now — `parseSchoolSpring` still calls the old function. Tasks 4 and 5 fill in the new function's recovery branches; Task 6 swaps `parseSchoolSpring` over and deletes the old one.

Add at the top of the file, after the existing imports:

```ts
export type ResolvedSchoolSpringSource = {
  hostname: string;
  organizationFilter?: string;
};
```

Add the new exported function below the existing `resolveSchoolSpringHostname`:

```ts
/**
 * Resolve the SchoolSpring source (hostname + optional organization filter)
 * from a job board URL.
 *
 * - If the URL is on a per-employer subdomain (e.g. `brimfieldma.schoolspring.com`),
 *   returns that hostname directly.
 * - If the URL is on an alias domain (e.g. *.tedk12.com), follows the redirect
 *   to the per-employer subdomain.
 * - If the URL is on the unscoped main domain `www.schoolspring.com`, attempts
 *   recovery: HTML discovery probe first, then API organization-filter probe.
 *   Returns `null` if recovery fails (caller skips the district).
 */
export async function resolveSchoolSpringSource(
  url: string
): Promise<ResolvedSchoolSpringSource | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  // Per-employer subdomain — use directly.
  if (
    hostname.endsWith(".schoolspring.com") &&
    hostname !== "www.schoolspring.com"
  ) {
    return { hostname };
  }

  // TODO(task 5): unscoped www.schoolspring.com recovery
  // TODO(task 4): alias-domain redirect path
  return null;
}
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
Expected: PASS.

- [ ] **Step 3: Do not commit yet** — Tasks 4 and 5 fill in the TODOs before the code is shippable.

---

## Task 4: Failing test + impl — alias-domain redirect path (preserve existing behavior)

The old `resolveSchoolSpringHostname` followed redirects from `*.tedk12.com` → `*.schoolspring.com`. That has to keep working in the new resolver.

**Files:**
- Modify: `src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
- Modify: `src/features/vacancies/lib/parsers/schoolspring.ts`

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe` block:

```ts
it("follows redirects from alias domains to the per-employer subdomain", async () => {
  const fetchMock = vi.fn(async () => ({
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "location"
          ? "https://brimfieldma.schoolspring.com/jobs"
          : null,
    },
  }));
  vi.stubGlobal("fetch", fetchMock);

  const result = await resolveSchoolSpringSource(
    "https://brimfield.tedk12.com/jobs"
  );

  expect(result).toEqual({ hostname: "brimfieldma.schoolspring.com" });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
  expect(calledUrl).toBe("https://brimfield.tedk12.com/jobs");
  expect(calledOpts).toMatchObject({ method: "HEAD", redirect: "manual" });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts -t "alias domains"`
Expected: FAIL — currently returns `null`.

- [ ] **Step 3: Replace the alias-domain TODO with the implementation**

In `schoolspring.ts`, replace the `// TODO(task 4): alias-domain redirect path` line and the `return null;` below it with:

```ts
  // Alias domain (e.g. *.tedk12.com) — follow redirect to discover the
  // per-employer subdomain.
  if (!hostname.endsWith(".schoolspring.com")) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
        headers: { "User-Agent": "TerritoryPlanBuilder/1.0 (vacancy-scanner)" },
        signal: AbortSignal.timeout(10_000),
      });
      const location = res.headers.get("location");
      if (location) {
        const redirectHostname = new URL(location).hostname.toLowerCase();
        if (
          redirectHostname.endsWith(".schoolspring.com") &&
          redirectHostname !== "www.schoolspring.com"
        ) {
          console.log(`[schoolspring] Resolved ${hostname} → ${redirectHostname}`);
          return { hostname: redirectHostname };
        }
      }
    } catch (err) {
      console.error(`[schoolspring] Failed to resolve redirect for ${url}:`, err);
    }
    console.error(`[schoolspring] Could not resolve SchoolSpring hostname from ${url}`);
    return null;
  }

  // TODO(task 5): unscoped www.schoolspring.com recovery
  return null;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts -t "alias domains"`
Expected: PASS.

- [ ] **Step 5: Run full file to confirm prior test still passes**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 6: Do not commit yet** — Task 5 still has a `return null` TODO.

---

## Task 5: Failing tests + impl — `www.schoolspring.com` recovery sequence

This is the core of the fix. Four behaviors, four tests.

**Files:**
- Modify: `src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
- Modify: `src/features/vacancies/lib/parsers/schoolspring.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the existing `describe` block. (Use `vi.stubGlobal("fetch", ...)` per test — `restoreAllMocks` in `afterEach` clears it.)

```ts
it("recovers via HTML discovery probe — finds per-employer subdomain in iframe response", async () => {
  const fetchMock = vi.fn(async (calledUrl: string) => {
    if (calledUrl.startsWith("https://www.schoolspring.com/jobs/")) {
      return {
        ok: true,
        text: async () =>
          `<html><body><script src="https://brimfieldma.schoolspring.com/static/x.js"></script></body></html>`,
        headers: { get: () => null },
      };
    }
    throw new Error(`Unexpected fetch: ${calledUrl}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await resolveSchoolSpringSource(
    "https://www.schoolspring.com/jobs/?iframe=1&employer=19502"
  );

  expect(result).toEqual({ hostname: "brimfieldma.schoolspring.com" });
});

it("recovers via API organization-filter probe when discovery returns nothing useful", async () => {
  const fetchMock = vi.fn(async (calledUrl: string) => {
    if (calledUrl.startsWith("https://www.schoolspring.com/jobs/")) {
      // Discovery probe — empty body, no usable subdomain.
      return {
        ok: true,
        text: async () => "<html><body>no useful info</body></html>",
        headers: { get: () => null },
      };
    }
    if (calledUrl.startsWith("https://api.schoolspring.com/")) {
      // API probe — single distinct employer name → filter is honored.
      return {
        ok: true,
        json: async () => ({
          success: true,
          value: {
            page: 1,
            size: 1,
            jobsList: [
              { jobId: 1, employer: "Brimfield MA", title: "T", location: "Brimfield, MA", displayDate: "2026-04-28" },
            ],
          },
        }),
      };
    }
    throw new Error(`Unexpected fetch: ${calledUrl}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await resolveSchoolSpringSource(
    "https://www.schoolspring.com/jobs/?iframe=1&employer=19502"
  );

  expect(result).toEqual({
    hostname: "www.schoolspring.com",
    organizationFilter: "19502",
  });
});

it("returns null when www.schoolspring.com URL has no employer query param", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const result = await resolveSchoolSpringSource(
    "https://www.schoolspring.com/jobs/"
  );

  expect(result).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("returns null when API probe response shows mixed employers (filter ignored)", async () => {
  const fetchMock = vi.fn(async (calledUrl: string) => {
    if (calledUrl.startsWith("https://www.schoolspring.com/jobs/")) {
      return {
        ok: true,
        text: async () => "<html><body>no useful info</body></html>",
        headers: { get: () => null },
      };
    }
    if (calledUrl.startsWith("https://api.schoolspring.com/")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          value: {
            page: 1,
            size: 5,
            jobsList: [
              { jobId: 1, employer: "Fresno Unified", title: "T1", location: "Fresno, CA", displayDate: "2026-04-28" },
              { jobId: 2, employer: "San Jose Unified", title: "T2", location: "San Jose, CA", displayDate: "2026-04-28" },
              { jobId: 3, employer: "Monroe County", title: "T3", location: "Monroe, NC", displayDate: "2026-04-28" },
            ],
          },
        }),
      };
    }
    throw new Error(`Unexpected fetch: ${calledUrl}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  const result = await resolveSchoolSpringSource(
    "https://www.schoolspring.com/jobs/?iframe=1&employer=19502"
  );

  expect(result).toBeNull();
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
Expected: FAIL — 4 new tests, all failing because the recovery branch still returns `null`.

- [ ] **Step 3: Implement the recovery sequence**

In `schoolspring.ts`, replace the `// TODO(task 5): unscoped www.schoolspring.com recovery\n  return null;\n}` block with:

```ts
  // Unscoped main domain — try recovery via discovery, then API org-filter probe.
  return await recoverFromUnscopedUrl(url);
}

const SCHOOLSPRING_SUBDOMAIN_RE = /https?:\/\/([a-z0-9-]+)\.schoolspring\.com/gi;

async function recoverFromUnscopedUrl(
  url: string
): Promise<ResolvedSchoolSpringSource | null> {
  const employer = (() => {
    try {
      return new URL(url).searchParams.get("employer");
    } catch {
      return null;
    }
  })();

  if (!employer) {
    console.warn(
      `[schoolspring] Unscoped www.schoolspring.com URL has no employer param — skipping: ${url}`
    );
    return null;
  }

  // Probe 1: HTML discovery — fetch the iframe URL and look for an embedded
  // per-employer subdomain.
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TerritoryPlanBuilder/1.0 (vacancy-scanner)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const body = await res.text();
      // Reset regex state — it's a global, so .exec() carries lastIndex.
      SCHOOLSPRING_SUBDOMAIN_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = SCHOOLSPRING_SUBDOMAIN_RE.exec(body))) {
        const sub = match[1].toLowerCase();
        if (sub !== "www" && sub !== "api") {
          const discovered = `${sub}.schoolspring.com`;
          console.log(`[schoolspring] Discovery probe: ${url} → ${discovered}`);
          return { hostname: discovered };
        }
      }
    }
  } catch (err) {
    console.warn(`[schoolspring] Discovery probe failed for ${url}:`, err);
  }

  // Probe 2: API organization-filter — single-row sample call.
  try {
    const probeUrl = `${SCHOOLSPRING_API}?domainName=www.schoolspring.com&keyword=&location=&category=&gradelevel=&jobtype=&organization=${encodeURIComponent(employer)}&swLat=&swLon=&neLat=&neLon=&page=1&size=5&sortDateAscending=false`;
    const res = await fetch(probeUrl, {
      headers: {
        "User-Agent": "TerritoryPlanBuilder/1.0 (vacancy-scanner)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      const data: SchoolSpringResponse = await res.json();
      const jobs = data?.value?.jobsList ?? [];
      const distinctEmployers = new Set(
        jobs.map((j) => (j.employer ?? "").trim()).filter((s) => s.length > 0)
      );
      if (jobs.length > 0 && distinctEmployers.size === 1) {
        console.log(
          `[schoolspring] API filter probe honored organization=${employer} for ${url}`
        );
        return {
          hostname: "www.schoolspring.com",
          organizationFilter: employer,
        };
      }
    }
  } catch (err) {
    console.warn(`[schoolspring] API filter probe failed for ${url}:`, err);
  }

  console.warn(`[schoolspring] All recovery failed — skipping: ${url}`);
  return null;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
Expected: PASS — 6 tests total (2 from earlier + 4 new).

---

## Task 6: Thread `organizationFilter` through `parseSchoolSpring()` paged calls

The resolver may now return an organization filter; the paged API loop must use it.

**Files:**
- Modify: `src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
- Modify: `src/features/vacancies/lib/parsers/schoolspring.ts`

- [ ] **Step 1: Write the failing test**

Add inside the existing `describe` block:

```ts
it("parseSchoolSpring includes organization filter in paged API URLs when present", async () => {
  const apiCalls: string[] = [];
  const fetchMock = vi.fn(async (calledUrl: string) => {
    if (calledUrl.startsWith("https://www.schoolspring.com/jobs/")) {
      // Discovery returns nothing useful → forces API filter probe.
      return {
        ok: true,
        text: async () => "<html></html>",
        headers: { get: () => null },
      };
    }
    apiCalls.push(calledUrl);
    return {
      ok: true,
      json: async () => ({
        success: true,
        value: {
          page: 1,
          size: 1,
          jobsList: [
            { jobId: 7, employer: "Brimfield MA", title: "Math Teacher", location: "Brimfield, MA", displayDate: "2026-04-28" },
          ],
        },
      }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);

  // parseSchoolSpring is the public entry point.
  const { parseSchoolSpring } = await import("../schoolspring");
  const out = await parseSchoolSpring(
    "https://www.schoolspring.com/jobs/?iframe=1&employer=19502"
  );

  expect(out.length).toBeGreaterThan(0);
  // Every API call after the probe must include &organization=19502
  const pagedCalls = apiCalls.filter((u) => u.includes("page="));
  expect(pagedCalls.length).toBeGreaterThan(0);
  for (const u of pagedCalls) {
    expect(u).toContain("organization=19502");
  }
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts -t "organization filter"`
Expected: FAIL — paged URL contains `organization=` (empty), not `organization=19502`.

- [ ] **Step 3: Update `parseSchoolSpring` to use the new resolver and thread the filter**

In `schoolspring.ts`, replace the entire `parseSchoolSpring` function body with:

```ts
export async function parseSchoolSpring(url: string): Promise<RawVacancy[]> {
  const source = await resolveSchoolSpringSource(url);
  if (!source) {
    console.error(`[schoolspring] Invalid or unresolvable URL: ${url}`);
    return [];
  }

  const { hostname, organizationFilter } = source;
  const orgParam = organizationFilter
    ? encodeURIComponent(organizationFilter)
    : "";

  const allJobs: SchoolSpringJob[] = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const apiUrl = `${SCHOOLSPRING_API}?domainName=${encodeURIComponent(hostname)}&keyword=&location=&category=&gradelevel=&jobtype=&organization=${orgParam}&swLat=&swLon=&neLat=&neLon=&page=${page}&size=${PAGE_SIZE}&sortDateAscending=false`;

    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": "TerritoryPlanBuilder/1.0 (vacancy-scanner)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error(`[schoolspring] API error: ${res.status} ${res.statusText}`);
      break;
    }

    const data: SchoolSpringResponse = await res.json();

    if (!data.success || !data.value?.jobsList?.length) {
      break;
    }

    allJobs.push(...data.value.jobsList);

    if (data.value.jobsList.length < PAGE_SIZE) break;
    page++;
  }

  console.log(
    `[schoolspring] Fetched ${allJobs.length} jobs from API for ${hostname}` +
      (organizationFilter ? ` (organization=${organizationFilter})` : "")
  );

  return allJobs.map((job) => {
    const apiProvidedUrl =
      job.url || job.jobUrl || job.detailUrl || job.link || null;
    const sourceUrl = apiProvidedUrl || `https://${hostname}/job/${job.jobId}`;

    return {
      title: job.title,
      employerName: job.employer || undefined,
      schoolName: job.location || undefined,
      datePosted: job.displayDate
        ? new Date(job.displayDate).toLocaleDateString("en-US")
        : undefined,
      sourceUrl,
    };
  });
}
```

- [ ] **Step 4: Delete the now-orphaned `resolveSchoolSpringHostname` function**

If the old `async function resolveSchoolSpringHostname` is still in the file (it should not be — Task 3's edit replaced its body via the new exported function), delete it. Run `grep -n "resolveSchoolSpringHostname" src/features/vacancies/lib/parsers/schoolspring.ts` — expect 0 hits.

- [ ] **Step 5: Run all parser tests to confirm everything passes**

Run: `npx vitest run src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If errors mention other callers of `resolveSchoolSpringHostname`, they need to be updated too — none should exist; the function was file-local.)

- [ ] **Step 7: Commit the parser change**

```bash
git add src/features/vacancies/lib/parsers/schoolspring.ts \
        src/features/vacancies/lib/parsers/__tests__/schoolspring.test.ts
git commit -m "fix(vacancies): SchoolSpring parser refuses or recovers unscoped www URLs

The parser previously returned the URL hostname directly when it ended in
.schoolspring.com, including the unscoped main domain www.schoolspring.com.
That caused 169 districts whose job_board_url was on the main domain to
ingest network-wide vacancies (Fresno CA, San Jose CA, Monroe NC, etc.)
into their leaid.

Now: when hostname is www.schoolspring.com, attempt recovery via
(1) HTML discovery probe of the iframe URL, looking for an embedded
per-employer subdomain, and (2) API organization-filter probe with the
employer ID extracted from the URL's query string. If both fail, return
null and skip the district. The paged API loop now threads the
organizationFilter into every call."
```

---

## Task 7: Cleanup script — dry-run mode (selection + reporting)

**Files:**
- Create: `scripts/purge-unscoped-schoolspring-vacancies.ts`

- [ ] **Step 1: Create the script with dry-run-only behavior**

```ts
/**
 * Purge vacancies that were mis-attributed to districts whose
 * job_board_url is on the unscoped main domain www.schoolspring.com.
 *
 * Modes:
 *   npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts            # dry-run
 *   npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts --apply    # delete
 *   npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts --rescan   # delete + re-scan
 *
 * Preserves rows where vacancies.district_verified = true.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const URL_PATTERN = "^https?://www\\.schoolspring\\.com";

type AffectedDistrict = {
  leaid: string;
  name: string;
  state_abbrev: string;
  job_board_url: string;
  to_delete: number;
  preserved_verified: number;
};

type SampleRow = {
  district: string;
  state: string;
  title: string;
  school_name: string | null;
  source_url: string | null;
};

async function selectAffected(): Promise<AffectedDistrict[]> {
  return prisma.$queryRawUnsafe<AffectedDistrict[]>(`
    SELECT
      d.leaid,
      d.name,
      d.state_abbrev,
      d.job_board_url,
      COUNT(*) FILTER (WHERE v.district_verified = false)::int AS to_delete,
      COUNT(*) FILTER (WHERE v.district_verified = true)::int  AS preserved_verified
    FROM districts d
    JOIN vacancies v ON v.leaid = d.leaid
    WHERE d.job_board_platform = 'schoolspring'
      AND d.job_board_url ~* '${URL_PATTERN}'
    GROUP BY d.leaid, d.name, d.state_abbrev, d.job_board_url
    ORDER BY to_delete DESC
  `);
}

async function sampleRows(): Promise<SampleRow[]> {
  return prisma.$queryRawUnsafe<SampleRow[]>(`
    SELECT d.name AS district, d.state_abbrev AS state,
           v.title, v.school_name, v.source_url
    FROM vacancies v
    JOIN districts d ON d.leaid = v.leaid
    WHERE d.job_board_platform = 'schoolspring'
      AND d.job_board_url ~* '${URL_PATTERN}'
      AND v.district_verified = false
    ORDER BY random()
    LIMIT 5
  `);
}

function reportPlan(districts: AffectedDistrict[], sample: SampleRow[]) {
  const totalDelete = districts.reduce((s, d) => s + d.to_delete, 0);
  const totalPreserved = districts.reduce((s, d) => s + d.preserved_verified, 0);

  console.log(`\n=== AFFECTED DISTRICTS: ${districts.length} ===`);
  console.log(`Vacancies to delete:   ${totalDelete}`);
  console.log(`Vacancies preserved (verified): ${totalPreserved}\n`);

  console.log("Per-district breakdown:");
  for (const d of districts) {
    console.log(
      `  [${d.state_abbrev}] ${d.name} (${d.leaid}): -${d.to_delete} delete, ${d.preserved_verified} preserved`
    );
  }

  console.log("\nSample rows that would be deleted:");
  for (const r of sample) {
    console.log(
      `  • ${r.district} (${r.state}) | ${r.title} | school_name=${r.school_name ?? "null"}`
    );
    console.log(`    ${r.source_url ?? "(no url)"}`);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply") || args.has("--rescan");
  const rescan = args.has("--rescan");

  console.log(
    `[purge-unscoped-schoolspring] mode=${rescan ? "RESCAN" : apply ? "APPLY" : "DRY-RUN"}`
  );

  const districts = await selectAffected();
  const sample = await sampleRows();
  reportPlan(districts, sample);

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to delete.");
    return;
  }

  // TODO(task 8): --apply DELETE
  // TODO(task 9): --rescan loop
  console.log("\nApply/rescan modes wired in subsequent tasks.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run dry-run against the dev database**

Run: `npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts`
Expected: prints `mode=DRY-RUN`, then a count near 169 districts and ~1,162 deletions, with a per-district breakdown and 5 sample rows.

- [ ] **Step 3: Sanity-check the sample**

Look at the 5 sample rows. Each `school_name` should be a city/state that doesn't match the district's state. If you see a sample where `school_name` looks legit for the district, **stop and investigate** before continuing.

- [ ] **Step 4: Do not commit yet** — Tasks 8 and 9 finish the script.

---

## Task 8: Cleanup script — `--apply` mode (DELETE)

**Files:**
- Modify: `scripts/purge-unscoped-schoolspring-vacancies.ts`

- [ ] **Step 1: Replace the `TODO(task 8)` block with the delete call**

Find the line `// TODO(task 8): --apply DELETE` and replace the two TODO comments and the `console.log("\nApply/rescan modes wired in subsequent tasks.");` line with:

```ts
  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM vacancies v
    USING districts d
    WHERE v.leaid = d.leaid
      AND d.job_board_platform = 'schoolspring'
      AND d.job_board_url ~* '${URL_PATTERN}'
      AND v.district_verified = false
  `);
  console.log(`\n[apply] Deleted ${deleted} vacancy rows.`);

  if (!rescan) return;

  // TODO(task 9): --rescan loop
  console.log("\nRescan mode wired in next task.");
```

- [ ] **Step 2: Test --apply on the dev database**

Run: `npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts --apply`
Expected: prints the same plan as dry-run, then `[apply] Deleted N vacancy rows.` where N matches the dry-run "Vacancies to delete" total.

- [ ] **Step 3: Confirm the rows are actually gone**

Run: `npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts`
Expected: districts list now shows `to_delete: 0` for every district (only `preserved_verified` rows remain).

- [ ] **Step 4: Do not commit yet** — Task 9 adds the rescan path.

---

## Task 9: Cleanup script — `--rescan` mode

**Files:**
- Modify: `scripts/purge-unscoped-schoolspring-vacancies.ts`

- [ ] **Step 1: Add the rescan loop**

At the top of the script, add to the imports:

```ts
import { runScan } from "../src/features/vacancies/lib/scan-runner";
```

Replace the `// TODO(task 9): --rescan loop` and its `console.log` line with:

```ts
  console.log(`\n[rescan] Re-scanning ${districts.length} districts via runScan()...`);

  let recovered = 0;
  let skipped = 0;
  let errored = 0;

  for (const d of districts) {
    try {
      const scan = await prisma.vacancyScan.create({
        data: {
          leaid: d.leaid,
          status: "pending",
          triggeredBy: "purge-unscoped-schoolspring-vacancies",
        },
      });
      await runScan(scan.id);

      const updated = await prisma.vacancyScan.findUnique({
        where: { id: scan.id },
        select: { status: true, vacancyCount: true },
      });

      const found = updated?.vacancyCount ?? 0;
      if (found > 0) {
        recovered++;
        console.log(`  ✓ ${d.name} (${d.state_abbrev}, ${d.leaid}): ${found} vacancies`);
      } else {
        skipped++;
        console.log(`  · ${d.name} (${d.state_abbrev}, ${d.leaid}): 0 (recovery failed or no jobs)`);
      }
    } catch (err) {
      errored++;
      console.error(`  ✗ ${d.name} (${d.state_abbrev}, ${d.leaid}):`, err);
    }
  }

  console.log(
    `\n[rescan] Done: ${recovered} recovered, ${skipped} skipped, ${errored} errored.`
  );
```

- [ ] **Step 2: Confirm the `VacancyScan.vacancyCount` field name is current**

Run: `grep -n "vacancyCount" prisma/schema.prisma`
Expected: at least one match in `model VacancyScan`. If absent (schema renamed since this plan was written), update the `select` clause and the `?? 0` reference accordingly.

- [ ] **Step 3: Smoke-test --rescan on a single-district subset**

Pick one district from the dry-run output and run a one-off rescan to make sure `runScan()` works from a script context:

```bash
npx tsx -e "
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runScan } from './src/features/vacancies/lib/scan-runner';
const prisma = new PrismaClient();
(async () => {
  const scan = await prisma.vacancyScan.create({
    data: { leaid: '<one leaid from the output>', status: 'pending', triggeredBy: 'manual-smoke' },
  });
  await runScan(scan.id);
  const after = await prisma.vacancyScan.findUnique({ where: { id: scan.id } });
  console.log(after);
  await prisma.\$disconnect();
})();
"
```

Expected: scan completes, status becomes `completed` or `failed`. If it fails for environmental reasons (missing env var, etc.), fix before running the full --rescan.

- [ ] **Step 4: Run the full --rescan**

Run: `npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts --rescan`
Expected: For every affected district, prints either `✓ ... N vacancies` (recovered) or `· ... 0 (recovery failed)`. Final summary line.

- [ ] **Step 5: Spot-check 2 districts in the app**

Open the territory plan UI in `npm run dev` (port 3005). Find two districts that the rescan reported as recovered, open their vacancy panels, and verify the `school_name` values are now plausible for the district's state. Find one that was skipped, confirm it shows zero vacancies.

- [ ] **Step 6: Commit the script**

```bash
git add scripts/purge-unscoped-schoolspring-vacancies.ts
git commit -m "chore(vacancies): script to purge + re-scan unscoped-URL districts

Standalone tsx script with dry-run default, --apply for the DELETE, and
--rescan to additionally re-ingest using the fixed parser. Preserves any
vacancies where district_verified = true. Uses the same runScan() entry
point as POST /api/vacancies/scan."
```

---

## Task 10: Final verification

**Files:** none — read-only checks.

- [ ] **Step 1: Re-query Aston's Brimfield case**

```bash
npx tsx -e "
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
(async () => {
  const rows = await prisma.\$queryRawUnsafe(\`
    SELECT v.title, v.school_name, v.source_url
    FROM vacancies v JOIN districts d ON d.leaid = v.leaid
    WHERE d.name = 'Brimfield School District' AND d.state_abbrev = 'MA' AND v.status = 'open'
  \`);
  console.log(rows);
  await prisma.\$disconnect();
})();
"
```

Expected: either zero rows (recovery failed for Brimfield, which is acceptable) or rows whose `school_name` plausibly belongs to Brimfield, MA. **Not** Fresno/San Jose/Monroe.

- [ ] **Step 2: Re-run the affected-district query**

Run: `npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts`
Expected: every district shows `to_delete: 0`. If any non-zero `to_delete` count appears, that means new bad data has been ingested since the last `--rescan` — which would mean the parser fix didn't actually take effect. Stop and investigate.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests pass. Pay attention to any new failures in the parsers test file.
