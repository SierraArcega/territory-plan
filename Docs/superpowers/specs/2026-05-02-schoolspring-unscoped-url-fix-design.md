---
date: 2026-05-02
topic: SchoolSpring unscoped-URL parser fix + vacancy cleanup
status: design-approved
---

# SchoolSpring unscoped-URL parser fix + vacancy cleanup

## Background

Aston ran a query in the Reports tab on 2026-05-03 (UTC) asking for the job
board for "Brimfield School District". The 10 returned vacancies all had
`school_name` values from California (Fresno, San Jose) and North Carolina
(Monroe, Marshville) — none plausibly Brimfield, MA. Investigation found the
data is wrong, not the query.

**Root cause.** Brimfield's `districts.job_board_url` is
`https://www.schoolspring.com/jobs/?iframe=1&employer=19502`. The SchoolSpring
parser at `src/features/vacancies/lib/parsers/schoolspring.ts` extracts only
the URL hostname to scope its API call (`?domainName=...`) and ignores the
`?employer=` query string. When the hostname is the unscoped main domain
`www.schoolspring.com` (instead of a per-employer subdomain like
`brimfieldma.schoolspring.com`), the API returns the network-wide feed, and
those rows get attributed to whatever `leaid` triggered the scan.

**Blast radius.** 169 of 2,242 SchoolSpring-platform districts have a
`job_board_url` matching `^https?://www\.schoolspring\.com`, and 1,162 open
vacancies are currently mis-attributed to those districts. Aston is one of
several reps who would have hit this.

## Goals

1. Stop the parser from ingesting unscoped-network vacancies.
2. Recover correctly-attributed data for as many of the 169 affected districts
   as feasible without manual URL repair.
3. Purge the existing mis-attributed rows safely, preserving any
   human-verified records.

## Non-goals

- Manually correcting `job_board_url` values for the districts that don't
  recover automatically. That's separate operational work.
- Reworking how the SchoolSpring parser caches API responses, paginates, or
  handles other failure modes.
- Touching the `redistribute-statewide-vacancies.ts` script or the
  applitrack/other parsers.

## Design

### Part 1 — Parser change

File: `src/features/vacancies/lib/parsers/schoolspring.ts`

Today `resolveSchoolSpringHostname(url)` returns the URL hostname directly if
it ends in `.schoolspring.com`, including the unscoped main domain. The fix
detours that case through a recovery sequence and propagates an optional
`organization` filter into the paged API calls.

**Signature change**

```ts
type ResolvedSource = {
  hostname: string;
  organizationFilter?: string;
};

async function resolveSchoolSpringSource(url: string): Promise<ResolvedSource | null>
```

(Renamed from `resolveSchoolSpringHostname` so callers fail loudly if they
miss the new return shape.)

**Behavior — when hostname is `www.schoolspring.com`:**

1. Extract `?employer=N` from the original URL. If absent, log a warning
   naming the URL and `return null` (caller handles `null` by skipping the
   district).
2. **Discovery probe.** Issue `GET` (not HEAD — page is HTML) on the original
   URL with a 10s timeout. Parse the response for either:
   - A `Location:` header redirecting to `*.schoolspring.com`, or
   - An asset/API URL inside the HTML body that names a per-employer
     subdomain (e.g., `https://brimfieldma.schoolspring.com/...`).
   If found, return `{ hostname: <subdomain> }` with no organization filter.
3. **API-scoping probe.** If discovery fails but we have `employer=N`, issue
   one paged API call with `domainName=www.schoolspring.com&organization=N
   &page=1&size=1`. If the response is non-empty AND the returned employer
   names look consistent (e.g., a single distinct employer string across the
   sample), assume `organization` is honored. Return
   `{ hostname: 'www.schoolspring.com', organizationFilter: 'N' }`.
4. If both probes fail, log a warning and `return null`.

**Behavior — all other hostnames:** unchanged. The existing
`*.schoolspring.com` short-circuit and the redirect-following alias-domain
path keep working as-is.

**`parseSchoolSpring(url)` change:** read the `organizationFilter` field
from the resolver output and append `&organization=<id>` to every paged API
call when present.

**Tests** (Vitest, co-located in `src/features/vacancies/lib/parsers/__tests__/`):

- Mocked fetch: discovery probe finds a subdomain in the iframe HTML →
  resolver returns the subdomain.
- Mocked fetch: discovery fails, API probe returns consistently-employed
  jobs → resolver returns `{ hostname, organizationFilter }`, and the
  subsequent paged API URLs include `&organization=N`.
- URL with no `employer=` query param → resolver returns `null`, no API
  calls made.
- API probe returns mixed-employer rows → resolver returns `null`.
- Existing `*.tedk12.com` redirect-resolving test path still passes.

### Part 2 — Cleanup script

File: `scripts/purge-unscoped-schoolspring-vacancies.ts`

Standalone tsx script modeled on `scripts/redistribute-statewide-vacancies.ts`.

**Modes:**

```
npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts            # dry-run (default)
npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts --apply    # actually delete
npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts --rescan   # apply + rescan
```

**Selection.** "Broken districts" are exactly:

```sql
SELECT leaid, name, state_abbrev, job_board_url
FROM districts
WHERE job_board_platform = 'schoolspring'
  AND job_board_url ~* '^https?://www\.schoolspring\.com';
```

**Deletion.** Rows where the district matches the broken pattern AND the
vacancy hasn't been human-verified:

```sql
DELETE FROM vacancies v
USING districts d
WHERE v.leaid = d.leaid
  AND d.job_board_platform = 'schoolspring'
  AND d.job_board_url ~* '^https?://www\.schoolspring\.com'
  AND v.district_verified = false;
```

**Output (every mode):**

- District count + total vacancy count to be affected.
- Per-district breakdown: name, state, # to delete, # preserved (verified).
- Sample 5 rows that would be deleted (`title`, `school_name`,
  `source_url`) — sanity check we're killing the right stuff.
- `--apply`: run the DELETE, report rows affected vs the dry-run plan.
- `--rescan`: after delete, iterate the 169 districts and call
  `parseSchoolSpring()` → upsert results into `vacancies` using the same
  upsert path the API route uses. Per-district pass/fail logging, final
  summary tallying recovered/skipped/errored.

**Safety.** Dry-run is default. `--apply` requires the explicit flag.
`--rescan` implies `--apply`. Per-district `try/catch` around the rescan loop
so one bad URL doesn't abort the rest.

**No tests for the script itself.** It's a one-off operational tool and the
parser logic underneath it is tested. (If a smoke test is wanted later, add
a Vitest that runs the script in dry-run mode against a seeded test DB.)

### Part 3 — Rollout

1. Land parser change + tests on a branch, merge to `main`.
2. Run cleanup script in dry-run on production DB. Confirm counts:
   ~169 districts, ~1,162 deletions less any `district_verified=true`
   survivors.
3. Run with `--apply`. Verify rows-affected matches the dry-run plan.
4. Run with `--rescan`. Watch per-district outcomes — expect a mix of
   "recovered via discovery", "recovered via API filter", "skipped, no
   employer", "skipped, recovery failed".
5. Spot-check 2–3 districts in the app: their job boards either show
   plausible local listings or are correctly empty.

## Risks

- **Recovery success rate is unknown.** The SchoolSpring API's behavior with
  `domainName=www.schoolspring.com&organization=N` hasn't been verified, and
  the iframe-discovery path depends on the page containing a usable
  subdomain string. Realistic expectation: 50–80% of the 169 districts
  recover automatically. The rest need manual URL repair, which is out of
  scope for this fix.
- **169 sequential SchoolSpring API calls during `--rescan`.** Should
  complete in under 5 minutes. If rate-limiting kicks in, add a small sleep
  between calls.
- **`district_verified` defaults to false.** This design assumes no prior
  backfill mass-set it to true on these 169 districts. The dry-run output
  surfaces survivors, so an unexpected `verified=true` cluster would be
  visible before applying. If found, decide at that point whether to
  override.
