import { readonlyPool } from "@/lib/db-readonly";
import { MAX_LIMIT, type QuerySummary } from "../agent/types";

const SELECT_ONLY = /^\s*(with\s+[\s\S]+?\s+)?select\b/i;

export type RunSqlResult =
  | {
      kind: "ok";
      sql: string;
      summary: QuerySummary;
      columns: string[];
      rows: Array<Record<string, unknown>>;
      rowCount: number;
      executionTimeMs: number;
    }
  | { kind: "validation_error"; errors: string[] }
  | { kind: "error"; message: string };

function findLimit(sql: string): number | null {
  const stripped = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const m = /\blimit\s+(\d+)\b/i.exec(stripped);
  return m ? Number(m[1]) : null;
}

export async function handleRunSql(
  sql: string,
  summary: QuerySummary,
  fallbackSource?: string,
): Promise<RunSqlResult> {
  if (!SELECT_ONLY.test(sql.trim())) {
    return {
      kind: "validation_error",
      errors: ["run_sql only accepts SELECT statements."],
    };
  }
  if (sql.includes(";")) {
    return {
      kind: "validation_error",
      errors: ["run_sql rejects SQL containing semicolons."],
    };
  }
  const limit = findLimit(sql);
  if (limit == null) {
    return { kind: "validation_error", errors: ["SQL is missing a LIMIT clause."] };
  }
  if (limit > MAX_LIMIT) {
    return {
      kind: "validation_error",
      errors: [`SQL LIMIT ${limit} exceeds MAX_LIMIT ${MAX_LIMIT}.`],
    };
  }
  let effectiveSummary = summary;
  const sourceIsValid =
    summary?.source &&
    typeof summary.source === "string" &&
    summary.source.trim().length > 0;
  if (!sourceIsValid) {
    const cleanedFallback = fallbackSource?.trim().slice(0, 200);
    if (cleanedFallback) {
      effectiveSummary = { ...(summary ?? {}), source: cleanedFallback };
    } else {
      return {
        kind: "validation_error",
        errors: ["summary.source must be a non-empty string describing the query."],
      };
    }
  }

  const startedAt = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let res: any;
  try {
    res = await readonlyPool.query(sql);
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const columns = res.fields?.map((f: { name: string }) => f.name) ?? [];
  return {
    kind: "ok",
    sql,
    summary: effectiveSummary,
    columns,
    rows: res.rows ?? [],
    rowCount: res.rowCount ?? (res.rows ?? []).length,
    executionTimeMs: Date.now() - startedAt,
  };
}
