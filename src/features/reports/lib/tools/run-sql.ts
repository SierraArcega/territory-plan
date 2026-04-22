import { readonlyPool } from "@/lib/db-readonly";
import { validateSummary } from "../agent/summary-validator";
import type { QuerySummary } from "../agent/types";

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

export async function handleRunSql(
  sql: string,
  summary: QuerySummary,
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

  const validation = validateSummary(sql, summary);
  if (!validation.valid) {
    return { kind: "validation_error", errors: validation.errors };
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
    summary,
    columns,
    rows: res.rows ?? [],
    rowCount: res.rowCount ?? (res.rows ?? []).length,
    executionTimeMs: Date.now() - startedAt,
  };
}
