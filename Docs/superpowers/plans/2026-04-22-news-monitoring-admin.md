# News Monitoring Admin Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `NewsIngestCard` to the admin dashboard (alongside `VacancyScanCard`) and unify the existing data-refresh sync log with news-ingest runs in a single table under a renamed "Ingest Health" tab.

**Architecture:** Pure-function normalizer (`ingest-log-normalizer.ts`) converts `news_ingest_runs` rows to a unified shape shared with `data_refresh_logs`. One new API route (`/api/admin/news-ingest-stats`) returns aggregate health/coverage stats via raw SQL (pg Pool — news tables aren't in Prisma). The existing `/api/admin/sync` route is extended to query both tables via raw SQL, merge-sort by `started_at DESC`, and return unified rows.

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Tailwind 4, TanStack Query, Prisma (for DRL only), `src/lib/db.ts` pg Pool (for NIR raw SQL), Vitest + Testing Library.

**Spec:** `Docs/superpowers/specs/2026-04-22-news-monitoring-admin-design.md`

**Reality-adjusted notes from DB inspection (deviations from spec to call out):**
- NIR status values are `'ok'` / `'running'` — the normalizer maps `'ok'` → `'success'` for the unified type.
- `district_news_fetch.last_status` is null for ~99% of rows. Amber tier means "row exists in `district_news_fetch` with `last_fetched_at` in last 30d regardless of `last_status`".
- The spec's unified status union (`'success' | 'failed' | 'running' | 'pending'`) is kept; no `'pending'` values exist in the data today, but the type stays permissive.
- Existing `/api/admin/sync` returns Prisma-native camelCase fields (`dataSource`, `startedAt`, etc.). Task 7 changes this to the unified shape; Task 8 updates the consumer. They must land together; both are in-session work.

---

## File Structure

**New files:**
- `src/features/admin/lib/ingest-log-normalizer.ts` — pure normalization fns (both DRL row → unified, and NIR row → unified)
- `src/features/admin/lib/__tests__/ingest-log-normalizer.test.ts` — unit tests
- `src/features/admin/hooks/useAdminNewsStats.ts` — TanStack Query hook for the stats endpoint
- `src/features/admin/components/NewsIngestCard.tsx` — the card, mirrors `VacancyScanCard`
- `src/features/admin/components/__tests__/NewsIngestCard.test.tsx` — component test
- `src/app/api/admin/news-ingest-stats/route.ts` — GET endpoint
- `src/app/api/admin/news-ingest-stats/__tests__/route.test.ts` — route test

**Modified files:**
- `src/app/api/admin/sync/route.ts` — merge DRL + NIR via raw SQL, return unified shape
- `src/app/api/admin/sync/__tests__/route.test.ts` — NEW test file (none exists today)
- `src/features/admin/hooks/useAdminSync.ts` — update types to unified shape; fix query-key to use primitives (per CLAUDE.md perf rule)
- `src/features/admin/components/AdminDashboard.tsx` — rename tab label "Data Sync" → "Ingest Health"; change tab id `"sync"` → `"ingest-health"`; add legacy URL slug alias
- `src/features/admin/components/DataSyncTab.tsx` — rename file to `IngestHealthTab.tsx`; mount `<NewsIngestCard />`; consume unified row shape; render NIR `detail` in expanded rows
- `src/features/admin/components/__tests__/IngestHealthTab.test.tsx` — NEW optional smoke test (skip if admin components have no test coverage today)

---

## Task 1 — Normalizer pure function (TDD)

**Files:**
- Create: `src/features/admin/lib/ingest-log-normalizer.ts`
- Create: `src/features/admin/lib/__tests__/ingest-log-normalizer.test.ts`

- [ ] **Step 1: Write failing test file**

Create `src/features/admin/lib/__tests__/ingest-log-normalizer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  normalizeDrlRow,
  normalizeNirRow,
  type UnifiedIngestRow,
} from "../ingest-log-normalizer";

const baseDrl = {
  id: 42,
  data_source: "nces_districts",
  status: "success",
  records_updated: 18991,
  records_failed: 0,
  error_message: null,
  started_at: new Date("2026-04-22T10:00:00Z"),
  completed_at: new Date("2026-04-22T10:03:00Z"),
};

const baseNir = {
  id: "run_abc123",
  layer: "daily",
  status: "ok",
  started_at: new Date("2026-04-22T11:00:00Z"),
  finished_at: new Date("2026-04-22T11:05:00Z"),
  articles_new: 120,
  articles_dup: 15,
  districts_processed: 500,
  llm_calls: 42,
  error: null,
};

describe("normalizeDrlRow", () => {
  it("prefixes id with drl:", () => {
    const out = normalizeDrlRow(baseDrl);
    expect(out.id).toBe("drl:42");
  });

  it("passes through data_source as source", () => {
    const out = normalizeDrlRow(baseDrl);
    expect(out.source).toBe("nces_districts");
  });

  it("computes durationMs from started_at and completed_at", () => {
    const out = normalizeDrlRow(baseDrl);
    expect(out.durationMs).toBe(3 * 60 * 1000);
  });

  it("returns durationMs = null when completed_at is null", () => {
    const out = normalizeDrlRow({ ...baseDrl, completed_at: null });
    expect(out.durationMs).toBeNull();
  });

  it("omits detail field for DRL rows", () => {
    const out = normalizeDrlRow(baseDrl);
    expect(out.detail).toBeUndefined();
  });
});

describe("normalizeNirRow", () => {
  it("prefixes id with nir:", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.id).toBe("nir:run_abc123");
  });

  it("builds source as news:<layer>", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.source).toBe("news:daily");
  });

  it("maps articles_new to recordsUpdated", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.recordsUpdated).toBe(120);
  });

  it("sets recordsFailed to null (no equivalent in NIR)", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.recordsFailed).toBeNull();
  });

  it("maps status 'ok' to 'success' in unified shape", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.status).toBe("success");
  });

  it("passes through status 'running' unchanged", () => {
    const out = normalizeNirRow({ ...baseNir, status: "running" });
    expect(out.status).toBe("running");
  });

  it("passes through status 'failed' unchanged", () => {
    const out = normalizeNirRow({ ...baseNir, status: "failed" });
    expect(out.status).toBe("failed");
  });

  it("computes durationMs from started_at to finished_at", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.durationMs).toBe(5 * 60 * 1000);
  });

  it("returns durationMs = null when finished_at is null", () => {
    const out = normalizeNirRow({ ...baseNir, finished_at: null });
    expect(out.durationMs).toBeNull();
  });

  it("includes detail with all news-specific fields", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.detail).toEqual({
      articlesDup: 15,
      districtsProcessed: 500,
      llmCalls: 42,
      layer: "daily",
    });
  });

  it("passes through error to errorMessage", () => {
    const out = normalizeNirRow({ ...baseNir, error: "timeout" });
    expect(out.errorMessage).toBe("timeout");
  });

  it("ISO-serializes timestamps", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.startedAt).toBe("2026-04-22T11:00:00.000Z");
    expect(out.completedAt).toBe("2026-04-22T11:05:00.000Z");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/features/admin/lib/__tests__/ingest-log-normalizer.test.ts`
Expected: All tests FAIL with `Cannot find module '../ingest-log-normalizer'`.

- [ ] **Step 3: Create the normalizer**

Create `src/features/admin/lib/ingest-log-normalizer.ts`:

```typescript
export interface UnifiedIngestRow {
  id: string;
  source: string;
  status: string;
  recordsUpdated: number | null;
  recordsFailed: number | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  detail?: {
    articlesDup: number;
    districtsProcessed: number;
    llmCalls: number;
    layer: string;
  };
}

export interface DrlRow {
  id: number;
  data_source: string;
  status: string;
  records_updated: number | null;
  records_failed: number | null;
  error_message: string | null;
  started_at: Date | string;
  completed_at: Date | string | null;
}

export interface NirRow {
  id: string;
  layer: string;
  status: string;
  started_at: Date | string;
  finished_at: Date | string | null;
  articles_new: number | null;
  articles_dup: number | null;
  districts_processed: number | null;
  llm_calls: number | null;
  error: string | null;
}

function toIso(d: Date | string): string {
  return typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
}

function diffMs(start: Date | string, end: Date | string | null): number | null {
  if (!end) return null;
  const startMs = (typeof start === "string" ? new Date(start) : start).getTime();
  const endMs = (typeof end === "string" ? new Date(end) : end).getTime();
  return endMs - startMs;
}

export function normalizeDrlRow(row: DrlRow): UnifiedIngestRow {
  return {
    id: `drl:${row.id}`,
    source: row.data_source,
    status: row.status,
    recordsUpdated: row.records_updated,
    recordsFailed: row.records_failed,
    startedAt: toIso(row.started_at),
    completedAt: row.completed_at ? toIso(row.completed_at) : null,
    durationMs: diffMs(row.started_at, row.completed_at),
    errorMessage: row.error_message,
  };
}

export function normalizeNirRow(row: NirRow): UnifiedIngestRow {
  const status = row.status === "ok" ? "success" : row.status;
  return {
    id: `nir:${row.id}`,
    source: `news:${row.layer}`,
    status,
    recordsUpdated: row.articles_new,
    recordsFailed: null,
    startedAt: toIso(row.started_at),
    completedAt: row.finished_at ? toIso(row.finished_at) : null,
    durationMs: diffMs(row.started_at, row.finished_at),
    errorMessage: row.error,
    detail: {
      articlesDup: row.articles_dup ?? 0,
      districtsProcessed: row.districts_processed ?? 0,
      llmCalls: row.llm_calls ?? 0,
      layer: row.layer,
    },
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/features/admin/lib/__tests__/ingest-log-normalizer.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/lib/ingest-log-normalizer.ts src/features/admin/lib/__tests__/ingest-log-normalizer.test.ts
git commit -m "feat(admin): add ingest-log-normalizer for unified DRL+NIR rows"
```

---

## Task 2 — News stats TanStack Query hook

**Files:**
- Create: `src/features/admin/hooks/useAdminNewsStats.ts`

- [ ] **Step 1: Create the hook**

Create `src/features/admin/hooks/useAdminNewsStats.ts`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";

export interface NewsIngestStats {
  articles: {
    last7d: number;
    prior7d: number;
  };
  coverage: {
    targetDistrictCount: number;
    green: number;
    amber: number;
    red: number;
    percentGreen: number;
  };
  lastRun: {
    finishedAt: string | null;
    status: string | null;
    layer: string | null;
  };
  failures24h: number;
  layerBreakdown: Array<{
    layer: string;
    runsLast24h: number;
    lastStatus: string;
  }>;
  health: "green" | "amber" | "red";
}

async function fetchNewsIngestStats(): Promise<NewsIngestStats> {
  const res = await fetch("/api/admin/news-ingest-stats");
  if (!res.ok) throw new Error("Failed to fetch news ingest stats");
  return res.json();
}

export function useAdminNewsStats() {
  return useQuery({
    queryKey: ["admin", "news-ingest-stats"],
    queryFn: fetchNewsIngestStats,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/admin/hooks/useAdminNewsStats.ts
git commit -m "feat(admin): add useAdminNewsStats TanStack Query hook"
```

---

## Task 3 — News stats API route (TDD)

**Files:**
- Create: `src/app/api/admin/news-ingest-stats/route.ts`
- Create: `src/app/api/admin/news-ingest-stats/__tests__/route.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `src/app/api/admin/news-ingest-stats/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getAdminUser: vi.fn(),
}));

import pool from "@/lib/db";
import { getAdminUser } from "@/lib/supabase/server";

const mockPool = vi.mocked(pool) as unknown as { connect: ReturnType<typeof vi.fn> };
const mockGetAdminUser = vi.mocked(getAdminUser);

import { GET } from "../route";

interface MockClient {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
}

function makeMockClient(): MockClient {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdminUser.mockResolvedValue({ id: "u1" } as never);
});

describe("GET /api/admin/news-ingest-stats", () => {
  it("returns 403 when user is not admin", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("short-circuits health to green when targetDistrictCount is 0", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    // 5 queries: articles7d, coverage, lastRun, failures24h, layerBreakdown
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "0", prior7d: "0" }] })
      .mockResolvedValueOnce({
        rows: [{ target_district_count: "0", green: "0", amber: "0", red: "0" }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.coverage.targetDistrictCount).toBe(0);
    expect(body.health).toBe("green");
  });

  it("returns red health when percentGreen below 40", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "100", prior7d: "120" }] })
      .mockResolvedValueOnce({
        rows: [
          { target_district_count: "100", green: "30", amber: "20", red: "50" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date("2026-04-22T11:00:00Z"),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.coverage.percentGreen).toBe(30);
    expect(body.health).toBe("red");
  });

  it("returns red health when failures24h > 3", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "100", prior7d: "120" }] })
      .mockResolvedValueOnce({
        rows: [
          { target_district_count: "100", green: "80", amber: "10", red: "10" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date(Date.now() - 60 * 60 * 1000),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "5" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.failures24h).toBe(5);
    expect(body.health).toBe("red");
  });

  it("returns amber when coverage between 40 and 70", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "100", prior7d: "120" }] })
      .mockResolvedValueOnce({
        rows: [
          { target_district_count: "100", green: "55", amber: "25", red: "20" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date(Date.now() - 60 * 60 * 1000),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.coverage.percentGreen).toBe(55);
    expect(body.health).toBe("amber");
  });

  it("returns green when coverage >= 70 and last run fresh and no failures", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "100", prior7d: "120" }] })
      .mockResolvedValueOnce({
        rows: [
          { target_district_count: "100", green: "80", amber: "10", red: "10" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date(Date.now() - 60 * 60 * 1000),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.health).toBe("green");
  });

  it("maps NIR status 'ok' to 'success' in lastRun", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query
      .mockResolvedValueOnce({ rows: [{ last7d: "0", prior7d: "0" }] })
      .mockResolvedValueOnce({
        rows: [{ target_district_count: "10", green: "10", amber: "0", red: "0" }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            finished_at: new Date("2026-04-22T11:00:00Z"),
            status: "ok",
            layer: "daily",
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET();
    const body = await res.json();

    expect(body.lastRun.status).toBe("success");
  });

  it("returns 500 when DB query throws", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);
    client.query.mockRejectedValue(new Error("boom"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/app/api/admin/news-ingest-stats/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/admin/news-ingest-stats/route.ts`:

```typescript
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FAILURE_THRESHOLD = 3;
const COVERAGE_RED_BELOW = 40;
const COVERAGE_GREEN_AT_OR_ABOVE = 70;
const LAST_RUN_FRESH_HOURS = 24;

type Health = "green" | "amber" | "red";

interface LastRun {
  finishedAt: string | null;
  status: string | null;
  layer: string | null;
}

function mapNirStatus(status: string | null): string | null {
  if (!status) return null;
  return status === "ok" ? "success" : status;
}

function computeHealth(input: {
  targetDistrictCount: number;
  percentGreen: number;
  failures24h: number;
  lastRun: LastRun;
}): Health {
  if (input.targetDistrictCount === 0) return "green";
  if (input.failures24h > FAILURE_THRESHOLD) return "red";
  if (input.percentGreen < COVERAGE_RED_BELOW) return "red";

  const lastRunFresh =
    input.lastRun.finishedAt !== null &&
    Date.now() - new Date(input.lastRun.finishedAt).getTime() <
      LAST_RUN_FRESH_HOURS * 60 * 60 * 1000;
  const lastRunSucceeded = input.lastRun.status === "success";

  if (
    input.percentGreen < COVERAGE_GREEN_AT_OR_ABOVE ||
    !lastRunFresh ||
    !lastRunSucceeded
  ) {
    return "amber";
  }

  return "green";
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const client = await pool.connect();
    try {
      const [articlesRes, coverageRes, lastRunRes, failuresRes, layerRes] =
        await Promise.all([
          client.query(`
            SELECT
              COUNT(*) FILTER (WHERE fetched_at >= NOW() - INTERVAL '7 days') AS last7d,
              COUNT(*) FILTER (WHERE fetched_at >= NOW() - INTERVAL '14 days'
                               AND fetched_at < NOW() - INTERVAL '7 days') AS prior7d
            FROM news_articles
          `),
          client.query(`
            WITH target AS (
              SELECT DISTINCT d.leaid
              FROM districts d
              WHERE d.is_customer = true OR d.has_open_pipeline = true
              UNION
              SELECT DISTINCT district_leaid AS leaid FROM territory_plan_districts
            ),
            article_30d AS (
              SELECT DISTINCT nad.leaid
              FROM news_article_districts nad
              JOIN news_articles na ON na.id = nad.article_id
              WHERE na.fetched_at >= NOW() - INTERVAL '30 days'
            ),
            fetch_30d AS (
              SELECT DISTINCT leaid
              FROM district_news_fetch
              WHERE last_fetched_at >= NOW() - INTERVAL '30 days'
            )
            SELECT
              COUNT(*) AS target_district_count,
              COUNT(*) FILTER (WHERE t.leaid IN (SELECT leaid FROM article_30d)) AS green,
              COUNT(*) FILTER (
                WHERE t.leaid NOT IN (SELECT leaid FROM article_30d)
                  AND t.leaid IN (SELECT leaid FROM fetch_30d)
              ) AS amber,
              COUNT(*) FILTER (
                WHERE t.leaid NOT IN (SELECT leaid FROM article_30d)
                  AND t.leaid NOT IN (SELECT leaid FROM fetch_30d)
              ) AS red
            FROM target t
          `),
          client.query(`
            SELECT finished_at, status, layer
            FROM news_ingest_runs
            WHERE finished_at IS NOT NULL
            ORDER BY finished_at DESC
            LIMIT 1
          `),
          client.query(`
            SELECT COUNT(*) AS count
            FROM news_ingest_runs
            WHERE status = 'failed'
              AND COALESCE(finished_at, started_at) >= NOW() - INTERVAL '24 hours'
          `),
          client.query(`
            WITH ranked AS (
              SELECT
                layer,
                status,
                started_at,
                ROW_NUMBER() OVER (PARTITION BY layer ORDER BY started_at DESC) AS rn
              FROM news_ingest_runs
              WHERE started_at >= NOW() - INTERVAL '24 hours'
            )
            SELECT
              layer,
              COUNT(*) AS runs_last_24h,
              MAX(CASE WHEN rn = 1 THEN status END) AS last_status
            FROM ranked
            GROUP BY layer
            ORDER BY runs_last_24h DESC, MAX(CASE WHEN rn = 1 THEN started_at END) DESC
            LIMIT 5
          `),
        ]);

      const articlesRow = articlesRes.rows[0] ?? { last7d: "0", prior7d: "0" };
      const coverageRow = coverageRes.rows[0] ?? {
        target_district_count: "0",
        green: "0",
        amber: "0",
        red: "0",
      };
      const lastRunRow = lastRunRes.rows[0];
      const failuresCount = parseInt(failuresRes.rows[0]?.count ?? "0", 10);

      const targetDistrictCount = parseInt(
        coverageRow.target_district_count,
        10
      );
      const green = parseInt(coverageRow.green, 10);
      const amber = parseInt(coverageRow.amber, 10);
      const red = parseInt(coverageRow.red, 10);
      const percentGreen =
        targetDistrictCount > 0
          ? Math.round((green / targetDistrictCount) * 100)
          : 0;

      const lastRun: LastRun = lastRunRow
        ? {
            finishedAt: new Date(lastRunRow.finished_at).toISOString(),
            status: mapNirStatus(lastRunRow.status),
            layer: lastRunRow.layer,
          }
        : { finishedAt: null, status: null, layer: null };

      const layerBreakdown = layerRes.rows.map((r) => ({
        layer: r.layer,
        runsLast24h: parseInt(r.runs_last_24h, 10),
        lastStatus: mapNirStatus(r.last_status) ?? "pending",
      }));

      const health = computeHealth({
        targetDistrictCount,
        percentGreen,
        failures24h: failuresCount,
        lastRun,
      });

      return NextResponse.json({
        articles: {
          last7d: parseInt(articlesRow.last7d, 10),
          prior7d: parseInt(articlesRow.prior7d, 10),
        },
        coverage: {
          targetDistrictCount,
          green,
          amber,
          red,
          percentGreen,
        },
        lastRun,
        failures24h: failuresCount,
        layerBreakdown,
        health,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching news ingest stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch news ingest stats" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/app/api/admin/news-ingest-stats/__tests__/route.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/news-ingest-stats/
git commit -m "feat(admin): add /api/admin/news-ingest-stats endpoint"
```

---

## Task 4 — NewsIngestCard component (TDD)

**Files:**
- Create: `src/features/admin/components/NewsIngestCard.tsx`
- Create: `src/features/admin/components/__tests__/NewsIngestCard.test.tsx`

- [ ] **Step 1: Write failing component test**

Create `src/features/admin/components/__tests__/NewsIngestCard.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NewsIngestCard from "../NewsIngestCard";
import type { NewsIngestStats } from "../../hooks/useAdminNewsStats";

vi.mock("../../hooks/useAdminNewsStats", () => ({
  useAdminNewsStats: vi.fn(),
}));

import { useAdminNewsStats } from "../../hooks/useAdminNewsStats";
const mockHook = vi.mocked(useAdminNewsStats);

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <NewsIngestCard />
    </QueryClientProvider>
  );
}

function baseStats(overrides: Partial<NewsIngestStats> = {}): NewsIngestStats {
  return {
    articles: { last7d: 150, prior7d: 120 },
    coverage: {
      targetDistrictCount: 200,
      green: 160,
      amber: 20,
      red: 20,
      percentGreen: 80,
    },
    lastRun: {
      finishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: "success",
      layer: "daily",
    },
    failures24h: 0,
    layerBreakdown: [
      { layer: "daily", runsLast24h: 2, lastStatus: "success" },
      { layer: "rolling", runsLast24h: 10, lastStatus: "success" },
    ],
    health: "green",
    ...overrides,
  };
}

describe("NewsIngestCard", () => {
  it("shows loading skeleton when query is pending", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true } as never);
    renderCard();
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders all four stats with data", () => {
    mockHook.mockReturnValue({
      data: baseStats(),
      isLoading: false,
    } as never);
    renderCard();
    expect(screen.getByText("News Ingest")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("160")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("renders empty state when lastRun.finishedAt is null", () => {
    mockHook.mockReturnValue({
      data: baseStats({
        lastRun: { finishedAt: null, status: null, layer: null },
        health: "red",
      }),
      isLoading: false,
    } as never);
    renderCard();
    expect(screen.getByText(/No runs yet/i)).toBeInTheDocument();
  });

  it("renders coverage '—' when targetDistrictCount is 0", () => {
    mockHook.mockReturnValue({
      data: baseStats({
        coverage: {
          targetDistrictCount: 0,
          green: 0,
          amber: 0,
          red: 0,
          percentGreen: 0,
        },
      }),
      isLoading: false,
    } as never);
    renderCard();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders up to 5 layer chips", () => {
    mockHook.mockReturnValue({
      data: baseStats({
        layerBreakdown: [
          { layer: "daily", runsLast24h: 5, lastStatus: "success" },
          { layer: "rolling", runsLast24h: 4, lastStatus: "success" },
          { layer: "weekly", runsLast24h: 3, lastStatus: "success" },
          { layer: "monthly", runsLast24h: 2, lastStatus: "success" },
          { layer: "quarterly", runsLast24h: 1, lastStatus: "success" },
        ],
      }),
      isLoading: false,
    } as never);
    renderCard();
    expect(screen.getByText("daily")).toBeInTheDocument();
    expect(screen.getByText("quarterly")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/features/admin/components/__tests__/NewsIngestCard.test.tsx`
Expected: FAIL — `Cannot find module '../NewsIngestCard'`.

- [ ] **Step 3: Implement the component**

Create `src/features/admin/components/NewsIngestCard.tsx`:

```typescript
"use client";

import { useAdminNewsStats } from "../hooks/useAdminNewsStats";

const HEALTH_COLORS: Record<"green" | "amber" | "red", string> = {
  green: "#8AA891",
  amber: "#E5A53D",
  red: "#F37167",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Stat({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-[#8A80A8]">
        {label}
      </div>
      <div className="text-xl font-semibold text-[#403770]">{value}</div>
      {sub && (
        <div
          className={`text-[11px] ${
            alert ? "text-[#c25a52]" : "text-[#A69DC0]"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export default function NewsIngestCard() {
  const { data, isLoading } = useAdminNewsStats();

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-xl border border-[#E2DEEC] p-5 space-y-3 animate-pulse">
        <div className="h-5 w-40 bg-[#E2DEEC]/60 rounded" />
        <div className="h-16 bg-[#E2DEEC]/40 rounded" />
      </div>
    );
  }

  const noRuns = data.lastRun.finishedAt === null;
  const nothingToCover = data.coverage.targetDistrictCount === 0;

  const coverageValue = nothingToCover ? "—" : `${data.coverage.percentGreen}%`;
  const districtsCoveredValue = nothingToCover
    ? "—"
    : data.coverage.green.toLocaleString();
  const articleDelta = data.articles.last7d - data.articles.prior7d;
  const articleSub =
    articleDelta === 0
      ? "flat vs prior 7d"
      : articleDelta > 0
        ? `+${articleDelta} vs prior 7d`
        : `${articleDelta} vs prior 7d`;

  const greenPct = nothingToCover
    ? 0
    : (data.coverage.green / data.coverage.targetDistrictCount) * 100;
  const amberPct = nothingToCover
    ? 0
    : (data.coverage.amber / data.coverage.targetDistrictCount) * 100;
  const redPct = nothingToCover
    ? 0
    : (data.coverage.red / data.coverage.targetDistrictCount) * 100;

  return (
    <div className="bg-white rounded-xl border border-[#E2DEEC] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: HEALTH_COLORS[data.health] }}
          />
          <h3 className="text-sm font-semibold text-[#403770]">News Ingest</h3>
        </div>
        <span className="text-[11px] text-[#A69DC0]">
          {noRuns ? "No runs yet" : `Last run ${relativeTime(data.lastRun.finishedAt)}`}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat
          label="Articles (7d)"
          value={data.articles.last7d.toLocaleString()}
          sub={articleSub}
        />
        <Stat
          label="Districts Covered"
          value={districtsCoveredValue}
          sub={
            nothingToCover
              ? "no target districts"
              : `of ${data.coverage.targetDistrictCount.toLocaleString()}`
          }
        />
        <Stat label="Coverage" value={coverageValue} />
        <Stat
          label="Failures (24h)"
          value={data.failures24h.toLocaleString()}
          alert={data.failures24h > 0}
        />
      </div>

      {!nothingToCover && (
        <div>
          <div className="h-2 w-full rounded-full overflow-hidden bg-[#E2DEEC] flex">
            <div
              style={{
                width: `${greenPct}%`,
                backgroundColor: HEALTH_COLORS.green,
              }}
            />
            <div
              style={{
                width: `${amberPct}%`,
                backgroundColor: HEALTH_COLORS.amber,
              }}
            />
            <div
              style={{
                width: `${redPct}%`,
                backgroundColor: HEALTH_COLORS.red,
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[11px] text-[#A69DC0]">
            <span>{data.coverage.green} green</span>
            <span>{data.coverage.amber} amber</span>
            <span>{data.coverage.red} red</span>
          </div>
        </div>
      )}

      {data.layerBreakdown.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {data.layerBreakdown.map((chip) => (
            <div
              key={chip.layer}
              className="flex items-center gap-1.5 rounded-full border border-[#E2DEEC] bg-[#F7F5FA] px-2.5 py-1 text-[11px] text-[#6E6390]"
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    chip.lastStatus === "success"
                      ? HEALTH_COLORS.green
                      : chip.lastStatus === "failed"
                        ? HEALTH_COLORS.red
                        : HEALTH_COLORS.amber,
                }}
              />
              <span className="font-medium">{chip.layer}</span>
              <span className="text-[#A69DC0]">({chip.runsLast24h})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/features/admin/components/__tests__/NewsIngestCard.test.tsx`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/components/NewsIngestCard.tsx src/features/admin/components/__tests__/NewsIngestCard.test.tsx
git commit -m "feat(admin): add NewsIngestCard component"
```

---

## Task 5 — Mount NewsIngestCard in the tab

**Files:**
- Modify: `src/features/admin/components/DataSyncTab.tsx`

- [ ] **Step 1: Add import and render**

At the top of `src/features/admin/components/DataSyncTab.tsx`, after the existing `VacancyScanCard` import, add:

```typescript
import NewsIngestCard from "./NewsIngestCard";
```

In the return block, find `<VacancyScanCard />` (currently around line 159) and add `<NewsIngestCard />` immediately after it:

```tsx
<SyncHealthBanner />
<VacancyScanCard />
<NewsIngestCard />
```

- [ ] **Step 2: Smoke-check in dev**

Run `npm run dev` on port 3005.
Visit `http://localhost:3005/admin?section=sync`.
Expected: NewsIngestCard renders below VacancyScanCard with real data.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/components/DataSyncTab.tsx
git commit -m "feat(admin): mount NewsIngestCard in Data Sync tab"
```

---

## Task 6 — Rename tab label and URL slug (with legacy alias)

**Files:**
- Modify: `src/features/admin/components/AdminDashboard.tsx`

- [ ] **Step 1: Update the tab type and TABS array**

In `src/features/admin/components/AdminDashboard.tsx`, find:

```typescript
type AdminTab = "unmatched" | "users" | "integrations" | "sync" | "vacancy-config" | "leaderboard";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "unmatched", label: "Unmatched Opps" },
  { id: "users", label: "Users" },
  { id: "integrations", label: "Integrations" },
  { id: "sync", label: "Data Sync" },
  { id: "vacancy-config", label: "Vacancy Config" },
  { id: "leaderboard", label: "Leaderboard" },
];
```

Replace with:

```typescript
type AdminTab = "unmatched" | "users" | "integrations" | "ingest-health" | "vacancy-config" | "leaderboard";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "unmatched", label: "Unmatched Opps" },
  { id: "users", label: "Users" },
  { id: "integrations", label: "Integrations" },
  { id: "ingest-health", label: "Ingest Health" },
  { id: "vacancy-config", label: "Vacancy Config" },
  { id: "leaderboard", label: "Leaderboard" },
];

// Legacy slug alias: old bookmarks to ?section=sync should still land here.
const LEGACY_TAB_ALIASES: Record<string, AdminTab> = {
  sync: "ingest-health",
};
```

- [ ] **Step 2: Update the initial-tab logic to use the alias**

Find the block that initializes `activeTab` from `searchParams.get("section")`. It currently looks like:

```typescript
const sectionParam = searchParams.get("section") as AdminTab | null;
const [activeTab, setActiveTab] = useState<AdminTab>(
  sectionParam ?? "unmatched"
);
```

Replace with:

```typescript
const rawSection = searchParams.get("section");
const resolvedSection: AdminTab | null =
  rawSection && rawSection in LEGACY_TAB_ALIASES
    ? LEGACY_TAB_ALIASES[rawSection]
    : (rawSection as AdminTab | null);
const [activeTab, setActiveTab] = useState<AdminTab>(
  resolvedSection ?? "unmatched"
);
```

(If the existing init pattern is slightly different, preserve its structure — add the alias lookup at the point where the raw section param is consumed.)

- [ ] **Step 3: Update the render branch**

Find where the component renders tab content. Today: `{activeTab === "sync" && <DataSyncTab />}`. Change to:

```tsx
{activeTab === "ingest-health" && <DataSyncTab />}
```

(The file rename happens in Task 8 — don't rename the import yet.)

- [ ] **Step 4: Smoke-check both URLs resolve**

Run `npm run dev` on port 3005.
- Visit `http://localhost:3005/admin?section=ingest-health` → should render the tab.
- Visit `http://localhost:3005/admin?section=sync` → legacy alias should still render the tab.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/components/AdminDashboard.tsx
git commit -m "feat(admin): rename Data Sync tab to Ingest Health (with legacy slug alias)"
```

---

## Task 7 — Extend /api/admin/sync for unified DRL + NIR (TDD)

**Files:**
- Modify: `src/app/api/admin/sync/route.ts`
- Create: `src/app/api/admin/sync/__tests__/route.test.ts`
- Modify: `src/features/admin/hooks/useAdminSync.ts`

This task changes the response shape. Task 8 updates the consumer. Keep these two tasks in the same working session — do NOT deploy between them.

- [ ] **Step 1: Write failing route tests**

Create `src/app/api/admin/sync/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  getAdminUser: vi.fn(),
}));

import pool from "@/lib/db";
import { getAdminUser } from "@/lib/supabase/server";

const mockPool = vi.mocked(pool) as unknown as {
  connect: ReturnType<typeof vi.fn>;
};
const mockGetAdminUser = vi.mocked(getAdminUser);

import { GET } from "../route";

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

function makeMockClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAdminUser.mockResolvedValue({ id: "u1" } as never);
});

describe("GET /api/admin/sync (unified)", () => {
  it("returns 403 when not admin", async () => {
    mockGetAdminUser.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/admin/sync"));
    expect(res.status).toBe(403);
  });

  it("merges DRL and NIR rows sorted by startedAt desc", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);

    client.query
      // drl rows
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            data_source: "nces",
            status: "success",
            records_updated: 100,
            records_failed: 0,
            error_message: null,
            started_at: new Date("2026-04-22T10:00:00Z"),
            completed_at: new Date("2026-04-22T10:05:00Z"),
          },
        ],
      })
      // nir rows
      .mockResolvedValueOnce({
        rows: [
          {
            id: "run1",
            layer: "daily",
            status: "ok",
            started_at: new Date("2026-04-22T11:00:00Z"),
            finished_at: new Date("2026-04-22T11:05:00Z"),
            articles_new: 50,
            articles_dup: 5,
            districts_processed: 200,
            llm_calls: 20,
            error: null,
          },
        ],
      })
      // total counts
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      // distinct sources
      .mockResolvedValueOnce({ rows: [{ data_source: "nces" }] })
      .mockResolvedValueOnce({ rows: [{ layer: "daily" }] });

    const res = await GET(makeRequest("/api/admin/sync?page=1&page_size=10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe("nir:run1"); // newer started_at first
    expect(body.items[1].id).toBe("drl:1");
    expect(body.pagination.total).toBe(2);
    expect(body.sources).toContain("nces");
    expect(body.sources).toContain("news:daily");
  });

  it("news rows have detail block; DRL rows do not", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);

    client.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            data_source: "nces",
            status: "success",
            records_updated: 100,
            records_failed: 0,
            error_message: null,
            started_at: new Date("2026-04-22T10:00:00Z"),
            completed_at: new Date("2026-04-22T10:05:00Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "run1",
            layer: "daily",
            status: "ok",
            started_at: new Date("2026-04-22T11:00:00Z"),
            finished_at: new Date("2026-04-22T11:05:00Z"),
            articles_new: 50,
            articles_dup: 5,
            districts_processed: 200,
            llm_calls: 20,
            error: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(makeRequest("/api/admin/sync"));
    const body = await res.json();

    const newsRow = body.items.find((r: { id: string }) => r.id.startsWith("nir:"));
    const drlRow = body.items.find((r: { id: string }) => r.id.startsWith("drl:"));

    expect(newsRow.detail).toEqual({
      articlesDup: 5,
      districtsProcessed: 200,
      llmCalls: 20,
      layer: "daily",
    });
    expect(drlRow.detail).toBeUndefined();
  });

  it("source filter 'news:*' skips DRL query entirely", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);

    // Only 3 real queries when newsOnly: nir rows, nir count, nir layers.
    // DRL rows/count/sources are resolved as empty synchronously (no client.query call).
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    await GET(makeRequest("/api/admin/sync?source=news:*"));

    // DRL query should NOT have been invoked — client.query called 4 times,
    // none of them for data_refresh_logs rows or count.
    const queryStrings = client.query.mock.calls.map(
      (c) => (c[0] as string).toLowerCase()
    );
    const drlRowQuery = queryStrings.find(
      (q) => q.includes("from data_refresh_logs") && !q.includes("count(")
    );
    expect(drlRowQuery).toBeUndefined();
  });

  it("paginates the merged set correctly", async () => {
    const client = makeMockClient();
    mockPool.connect.mockResolvedValue(client as never);

    const drlRows = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      data_source: "nces",
      status: "success",
      records_updated: 100,
      records_failed: 0,
      error_message: null,
      started_at: new Date(Date.UTC(2026, 3, 22, 10, i)),
      completed_at: new Date(Date.UTC(2026, 3, 22, 10, i + 1)),
    }));

    client.query
      .mockResolvedValueOnce({ rows: drlRows })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "10" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("/api/admin/sync?page=2&page_size=5")
    );
    const body = await res.json();

    expect(body.items).toHaveLength(5);
    expect(body.pagination.total).toBe(10);
    expect(body.pagination.page).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/app/api/admin/sync/__tests__/route.test.ts`
Expected: Tests FAIL — route still returns Prisma-native shape.

- [ ] **Step 3: Replace the route handler**

Replace the entire body of `src/app/api/admin/sync/route.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getAdminUser } from "@/lib/supabase/server";
import {
  normalizeDrlRow,
  normalizeNirRow,
  type UnifiedIngestRow,
} from "@/features/admin/lib/ingest-log-normalizer";

export const dynamic = "force-dynamic";

function wantsNewsOnly(source: string | null): boolean {
  return source === "news:*" || (source?.startsWith("news:") ?? false);
}

function wantsDrlOnly(source: string | null): boolean {
  return source !== null && source !== "" && !source.startsWith("news:");
}

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("page_size") || "25", 10))
    );
    const source = searchParams.get("source");
    const status = searchParams.get("status");

    const newsOnly = wantsNewsOnly(source);
    const drlOnly = wantsDrlOnly(source);

    const client = await pool.connect();
    try {
      const fetchLimit = page * pageSize;

      // DRL rows
      const drlRowsPromise: Promise<{ rows: unknown[] }> = drlOnly
        ? (async () => {
            const whereClauses: string[] = [];
            const params: unknown[] = [];
            if (source) {
              params.push(source);
              whereClauses.push(`data_source = $${params.length}`);
            }
            if (status) {
              params.push(status);
              whereClauses.push(`status = $${params.length}`);
            }
            const where = whereClauses.length
              ? `WHERE ${whereClauses.join(" AND ")}`
              : "";
            params.push(fetchLimit);
            return client.query(
              `SELECT id, data_source, status, records_updated, records_failed,
                      error_message, started_at, completed_at
               FROM data_refresh_logs
               ${where}
               ORDER BY started_at DESC
               LIMIT $${params.length}`,
              params
            );
          })()
        : newsOnly
          ? Promise.resolve({ rows: [] })
          : (async () => {
              const whereClauses: string[] = [];
              const params: unknown[] = [];
              if (status) {
                params.push(status);
                whereClauses.push(`status = $${params.length}`);
              }
              const where = whereClauses.length
                ? `WHERE ${whereClauses.join(" AND ")}`
                : "";
              params.push(fetchLimit);
              return client.query(
                `SELECT id, data_source, status, records_updated, records_failed,
                        error_message, started_at, completed_at
                 FROM data_refresh_logs
                 ${where}
                 ORDER BY started_at DESC
                 LIMIT $${params.length}`,
                params
              );
            })();

      // NIR rows
      const nirRowsPromise: Promise<{ rows: unknown[] }> = drlOnly
        ? Promise.resolve({ rows: [] })
        : (async () => {
            const whereClauses: string[] = [];
            const params: unknown[] = [];
            // Map "news:<layer>" to WHERE layer = '<layer>'; "news:*" → no layer filter.
            if (source && source.startsWith("news:") && source !== "news:*") {
              params.push(source.slice("news:".length));
              whereClauses.push(`layer = $${params.length}`);
            }
            if (status) {
              const dbStatus = status === "success" ? "ok" : status;
              params.push(dbStatus);
              whereClauses.push(`status = $${params.length}`);
            }
            const where = whereClauses.length
              ? `WHERE ${whereClauses.join(" AND ")}`
              : "";
            params.push(fetchLimit);
            return client.query(
              `SELECT id, layer, status, started_at, finished_at,
                      articles_new, articles_dup, districts_processed,
                      llm_calls, error
               FROM news_ingest_runs
               ${where}
               ORDER BY started_at DESC
               LIMIT $${params.length}`,
              params
            );
          })();

      // Counts
      const drlCountPromise: Promise<{ rows: Array<{ count: string }> }> = newsOnly
        ? Promise.resolve({ rows: [{ count: "0" }] })
        : (async () => {
            const whereClauses: string[] = [];
            const params: unknown[] = [];
            if (drlOnly && source) {
              params.push(source);
              whereClauses.push(`data_source = $${params.length}`);
            }
            if (status) {
              params.push(status);
              whereClauses.push(`status = $${params.length}`);
            }
            const where = whereClauses.length
              ? `WHERE ${whereClauses.join(" AND ")}`
              : "";
            return client.query(
              `SELECT COUNT(*)::text AS count FROM data_refresh_logs ${where}`,
              params
            );
          })();

      const nirCountPromise: Promise<{ rows: Array<{ count: string }> }> = drlOnly
        ? Promise.resolve({ rows: [{ count: "0" }] })
        : (async () => {
            const whereClauses: string[] = [];
            const params: unknown[] = [];
            if (source && source.startsWith("news:") && source !== "news:*") {
              params.push(source.slice("news:".length));
              whereClauses.push(`layer = $${params.length}`);
            }
            if (status) {
              const dbStatus = status === "success" ? "ok" : status;
              params.push(dbStatus);
              whereClauses.push(`status = $${params.length}`);
            }
            const where = whereClauses.length
              ? `WHERE ${whereClauses.join(" AND ")}`
              : "";
            return client.query(
              `SELECT COUNT(*)::text AS count FROM news_ingest_runs ${where}`,
              params
            );
          })();

      // Distinct sources for filter dropdown
      const drlSourcesPromise = newsOnly
        ? Promise.resolve({ rows: [] as Array<{ data_source: string }> })
        : client.query(
            `SELECT DISTINCT data_source FROM data_refresh_logs ORDER BY data_source`
          );
      const nirLayersPromise = drlOnly
        ? Promise.resolve({ rows: [] as Array<{ layer: string }> })
        : client.query(
            `SELECT DISTINCT layer FROM news_ingest_runs ORDER BY layer`
          );

      const [
        drlRowsRes,
        nirRowsRes,
        drlCountRes,
        nirCountRes,
        drlSourcesRes,
        nirLayersRes,
      ] = await Promise.all([
        drlRowsPromise,
        nirRowsPromise,
        drlCountPromise,
        nirCountPromise,
        drlSourcesPromise,
        nirLayersPromise,
      ]);

      const normalized: UnifiedIngestRow[] = [
        ...drlRowsRes.rows.map((r) => normalizeDrlRow(r as never)),
        ...nirRowsRes.rows.map((r) => normalizeNirRow(r as never)),
      ];

      normalized.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

      const offset = (page - 1) * pageSize;
      const items = normalized.slice(offset, offset + pageSize);

      const total =
        parseInt(drlCountRes.rows[0]?.count ?? "0", 10) +
        parseInt(nirCountRes.rows[0]?.count ?? "0", 10);

      const sources = [
        ...(drlSourcesRes.rows as Array<{ data_source: string }>).map(
          (r) => r.data_source
        ),
        ...(nirLayersRes.rows as Array<{ layer: string }>).map(
          (r) => `news:${r.layer}`
        ),
      ];

      return NextResponse.json({
        items,
        pagination: { page, pageSize, total },
        sources,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching sync logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync logs" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run route tests to confirm they pass**

Run: `npx vitest run src/app/api/admin/sync/__tests__/route.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Update useAdminSync.ts types and query key**

Replace the contents of `src/features/admin/hooks/useAdminSync.ts` with:

```typescript
"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { UnifiedIngestRow } from "../lib/ingest-log-normalizer";

export interface AdminSyncResponse {
  items: UnifiedIngestRow[];
  pagination: { page: number; pageSize: number; total: number };
  sources: string[];
}

export interface UseAdminSyncParams {
  page?: number;
  pageSize?: number;
  source?: string;
  status?: string;
}

export function useAdminSync(params: UseAdminSyncParams = {}) {
  const { page = 1, pageSize = 20, source = "", status = "" } = params;

  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("page_size", String(pageSize));
  if (source) searchParams.set("source", source);
  if (status) searchParams.set("status", status);

  return useQuery({
    queryKey: ["admin", "sync", page, pageSize, source, status],
    queryFn: () =>
      fetchJson<AdminSyncResponse>(`${API_BASE}/admin/sync?${searchParams}`),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
```

Notes:
- Query key uses primitives per CLAUDE.md perf rule ("TanStack Query keys must use serialized primitives, never raw objects"). Old `{ page, pageSize, ... }` object key is a pre-existing rule violation; this fix is scoped to this feature.
- Sorting is removed from the client API surface (DRL+NIR merged ordering is fixed to `started_at DESC` server-side). DataSyncTab's local sort UI will be simplified in Task 8.

- [ ] **Step 6: Commit (note: DataSyncTab currently mis-renders — fixed in Task 8)**

```bash
git add src/app/api/admin/sync/ src/features/admin/hooks/useAdminSync.ts
git commit -m "feat(admin): unify /api/admin/sync over data_refresh_logs and news_ingest_runs"
```

---

## Task 8 — Update DataSyncTab consumer + render news detail + rename file

**Files:**
- Rename + modify: `src/features/admin/components/DataSyncTab.tsx` → `src/features/admin/components/IngestHealthTab.tsx`
- Modify: `src/features/admin/components/AdminDashboard.tsx` (update import)

- [ ] **Step 1: Move the file**

```bash
git mv src/features/admin/components/DataSyncTab.tsx src/features/admin/components/IngestHealthTab.tsx
```

- [ ] **Step 2: Update consumer to unified row shape and remove server-side sort**

Open `src/features/admin/components/IngestHealthTab.tsx`. Find the column definitions and row rendering that consume Prisma-native fields (`item.dataSource`, `item.startedAt`, `item.completedAt`, `item.recordsUpdated`, `item.recordsFailed`, `item.errorMessage`, numeric `item.id`) and replace them with unified-shape fields.

Rename the default export:

```tsx
export default function IngestHealthTab() {
```

Replace the column definition block (wherever `columns: { key, label, align }` is defined, today including `dataSource`, `status`, `recordsUpdated`, `recordsFailed`, `startedAt`, `completedAt`) with:

```typescript
type SortableColumn = "source" | "status" | "recordsUpdated" | "startedAt" | "completedAt";

const columns: { key: SortableColumn; label: string; align?: "left" | "right" }[] = [
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
  { key: "recordsUpdated", label: "Records", align: "right" },
  { key: "startedAt", label: "Started" },
  { key: "completedAt", label: "Duration" },
];
```

Remove the `handleSort` / `sortDirFor` / `sortBy` / `sortDir` state and column click handlers (unified ordering is fixed on the server). Keep the headers as plain (non-clickable) cells.

Inside the row rendering component (`RowGroup` / wherever each `items.map((item) => ...)` renders), swap consumed fields:

| Old (Prisma-native) | New (unified) |
|---|---|
| `item.dataSource` | `item.source` |
| `item.status` | `item.status` (unchanged) |
| `item.recordsUpdated` | `item.recordsUpdated` (unchanged) |
| `item.recordsFailed` | `item.recordsFailed` (unchanged, may be null for news rows) |
| `item.startedAt` (Date) | `new Date(item.startedAt)` (now ISO string) |
| `item.completedAt` (Date) | `new Date(item.completedAt)` (ISO string or null) |
| `item.errorMessage` | `item.errorMessage` (unchanged) |
| `item.id` (number, Set<number>) | `item.id` (string, `Set<string>`) |

Duration display: compute from `item.durationMs` when present, otherwise fall back to "—".

**Ensure `expandedRows` state is typed as `Set<string>`** (it already is per the explorer excerpt — no change needed there).

- [ ] **Step 3: Render news detail block in expanded row**

Find the expanded-row JSX (currently: `{isExpanded && hasError && (<tr>...</tr>)}`). Extend to also render when news detail exists, even without an error:

```tsx
{isExpanded && (hasError || item.detail) && (
  <tr className={!isLast ? "border-b border-[#E2DEEC]" : ""}>
    <td colSpan={columns.length + 1} className="p-0">
      <div
        className={`bg-[#F7F5FA] px-8 py-4 ${
          hasError ? "border-l-2 border-[#F37167]" : "border-l-2 border-[#C2BBD4]"
        }`}
      >
        {hasError && (
          <p className="text-sm text-[#c25a52] whitespace-pre-wrap mb-3">
            {item.errorMessage}
          </p>
        )}
        {item.detail && (
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#8A80A8]">
                Layer
              </div>
              <div className="text-[#403770] font-medium">
                {item.detail.layer}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#8A80A8]">
                Districts processed
              </div>
              <div className="text-[#403770] font-medium">
                {item.detail.districtsProcessed.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#8A80A8]">
                Duplicates
              </div>
              <div className="text-[#403770] font-medium">
                {item.detail.articlesDup.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#8A80A8]">
                LLM calls
              </div>
              <div className="text-[#403770] font-medium">
                {item.detail.llmCalls.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </td>
  </tr>
)}
```

Update the chevron/expand toggle gating so rows with `item.detail` are also expandable (not just error rows). The condition `const canExpand = hasError || !!item.detail;` should drive the chevron rendering in the leftmost cell.

- [ ] **Step 4: Update the expand-cell gating**

Find the leftmost cell that renders the chevron (currently shown only when `hasError`). Change the check to `canExpand`:

```tsx
const canExpand = hasError || !!item.detail;
// ...
<td className="w-10 px-3 py-3">
  {canExpand && (
    <button onClick={onToggle} aria-label="Toggle details">
      {/* existing chevron icon */}
    </button>
  )}
</td>
```

- [ ] **Step 5: Update status filter dropdown**

Find the status `<select>` (currently has options `success` / `error` / `running`). Replace with:

```tsx
<select
  value={status}
  onChange={(e) => {
    setStatus(e.target.value);
    setPage(1);
  }}
  className="border border-[#C2BBD4] rounded-lg px-3 py-2 text-xs font-medium text-[#6E6390] bg-white"
>
  <option value="">All statuses</option>
  <option value="success">success</option>
  <option value="failed">failed</option>
  <option value="running">running</option>
</select>
```

(The unified API accepts `success` / `failed` / `running` and internally maps `success` → `ok` for NIR queries.)

- [ ] **Step 6: Update AdminDashboard.tsx import**

In `src/features/admin/components/AdminDashboard.tsx`, find:

```typescript
const DataSyncTab = lazy(() => import("./DataSyncTab"));
```

Change to:

```typescript
const IngestHealthTab = lazy(() => import("./IngestHealthTab"));
```

And in the render branch:

```tsx
{activeTab === "ingest-health" && <IngestHealthTab />}
```

- [ ] **Step 7: Typecheck and run all admin tests**

Run: `npx tsc --noEmit`
Expected: No type errors.

Run: `npx vitest run src/features/admin src/app/api/admin`
Expected: All tests pass (normalizer, news-ingest-stats route, sync route, NewsIngestCard).

- [ ] **Step 8: Smoke check in dev**

Run `npm run dev` on port 3005.
Visit `http://localhost:3005/admin?section=ingest-health`.
Verify:
- Both VacancyScanCard and NewsIngestCard render.
- Sync log table loads with rows from both DRL and NIR merged by recency.
- Expanding a news row shows the detail block (layer, districts processed, duplicates, LLM calls).
- Expanding an error row shows the error message.
- Filter dropdown: "All sources" lists both DRL data sources and `news:daily` / `news:rolling`.
- Status filter `failed` shows only failed rows.
- Pagination works across merged set.
- Legacy URL `?section=sync` still loads the tab.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(admin): rename DataSyncTab to IngestHealthTab; consume unified sync shape with news detail"
```

---

## Task 9 — Integration smoke verification + close-out

**Files:** none

- [ ] **Step 1: Final sanity check against direct SQL**

With `npm run dev` running on port 3005, note the `percentGreen` coverage displayed on the NewsIngestCard. Then run this SQL via Supabase MCP / psql and confirm the number matches:

```sql
WITH target AS (
  SELECT DISTINCT d.leaid
  FROM districts d
  WHERE d.is_customer = true OR d.has_open_pipeline = true
  UNION
  SELECT DISTINCT district_leaid AS leaid FROM territory_plan_districts
),
article_30d AS (
  SELECT DISTINCT nad.leaid
  FROM news_article_districts nad
  JOIN news_articles na ON na.id = nad.article_id
  WHERE na.fetched_at >= NOW() - INTERVAL '30 days'
)
SELECT
  COUNT(*) AS target_count,
  COUNT(*) FILTER (WHERE t.leaid IN (SELECT leaid FROM article_30d)) AS green,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE t.leaid IN (SELECT leaid FROM article_30d))
    / NULLIF(COUNT(*), 0)
  ) AS percent_green
FROM target t;
```

Expected: `percent_green` returned equals the card's Coverage %.

- [ ] **Step 2: Final test run**

Run: `npm test`
Expected: All tests pass (not just the new ones).

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/news-monitoring-admin
```

- [ ] **Step 4: Open PR via gh CLI**

```bash
gh pr create --title "feat(admin): news ingestion monitoring on Ingest Health tab" --body "$(cat <<'EOF'
## Summary
- Add NewsIngestCard alongside VacancyScanCard on a renamed "Ingest Health" tab
- Extend /api/admin/sync to merge data_refresh_logs + news_ingest_runs via a shared normalizer
- New /api/admin/news-ingest-stats endpoint exposes tiered coverage (green/amber/red) + pipeline health

Spec: Docs/superpowers/specs/2026-04-22-news-monitoring-admin-design.md
Plan: docs/superpowers/plans/2026-04-22-news-monitoring-admin.md

## Test plan
- [ ] `npm test` passes
- [ ] Visit /admin?section=ingest-health and verify both cards render
- [ ] Expand a news row, confirm layer/districts/dup/llm_calls shown
- [ ] Expand an error row, confirm error message shown
- [ ] Filter by news:daily, confirm only news rows shown
- [ ] Filter by status=failed, confirm DRL failed rows shown
- [ ] Legacy URL /admin?section=sync still loads the tab

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Problem + goals | Covered by architecture choice |
| Non-goals (no mutations, no drill-down, no content quality, no DB migration) | Enforced by task list — none of these tasks do any of those |
| Scope decisions table (focus, coverage def, denominator, placement, drill-down, log integration) | Tasks 3, 4, 5, 6, 7, 8 |
| Architecture: API-level union | Tasks 1, 7 |
| `GET /api/admin/news-ingest-stats` contract | Task 3 |
| Extended `GET /api/admin/sync` contract | Task 7 |
| Health thresholds with green-override rule | Task 3 (`computeHealth`) |
| NewsIngestCard layout (4 stats, tier bar, layer chips) | Task 4 |
| Edge cases (empty target set, running rows, fetch-no-status) | Tasks 3 + 4 |
| Error handling (partial query failure → fail whole request) | Task 3 (uses `Promise.all` — one rejection fails the catch) |
| File layout (new vs modified) | Tasks 1–8 cover all files |
| Testing (normalizer, stats route, sync route, card) | Tasks 1, 3, 4, 7 |
| Performance notes (primitive query keys, 60s stale) | Tasks 2, 7 |
| URL slug alias for legacy bookmarks | Task 6 |

No gaps.
