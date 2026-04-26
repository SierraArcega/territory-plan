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
