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
