import prisma from "@/lib/prisma";
import { readonlyPool } from "@/lib/db-readonly";
import { compileParams } from "./params-to-sql";
import { validateParams } from "./params-validator";
import { MAX_LIMIT, type QueryParams, type QueryResult } from "./types";

/**
 * Shared query-execution pipeline used by both POST /api/ai/query/run and
 * POST /api/ai/query/reports/[id]/run. Handles validation → compilation →
 * readonly-pool execution → query_log audit. SQL is NEVER returned in the
 * response — it's persisted to query_log only.
 */

export interface ExecuteQueryOptions {
  params: QueryParams;
  userId: string;
  /** Logged to query_log for attribution. Defaults to "[structured params]". */
  question?: string;
  /** Optional conversation grouping for the thread/saved report. */
  conversationId?: string;
}

export type ExecuteQueryResult =
  | { kind: "ok"; result: QueryResult }
  | {
      kind: "invalid_params";
      errors: string[];
    }
  | {
      kind: "error";
      status: number;
      message: string;
      details?: string;
    };

export async function executeQuery(
  options: ExecuteQueryOptions,
): Promise<ExecuteQueryResult> {
  const validation = validateParams(options.params);
  if (!validation.valid) {
    return { kind: "invalid_params", errors: validation.errors };
  }

  const { sql, values } = compileParams(validation.normalized);
  const startedAt = Date.now();

  try {
    const result = await readonlyPool.query(sql, values);
    const executionTimeMs = Date.now() - startedAt;
    const rows = result.rows;
    const rowCount = rows.length;
    const truncated = rowCount >= (validation.normalized.limit ?? MAX_LIMIT);
    const columns = result.fields.map((f) => f.name);

    void prisma.queryLog
      .create({
        data: {
          userId: options.userId,
          conversationId: options.conversationId ?? undefined,
          question: options.question ?? "[structured params]",
          sql,
          params: validation.normalized as unknown as object,
          rowCount,
          executionTimeMs,
        },
      })
      .catch(() => undefined);

    return {
      kind: "ok",
      result: { columns, rows, rowCount, truncated, executionTimeMs },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const executionTimeMs = Date.now() - startedAt;

    void prisma.queryLog
      .create({
        data: {
          userId: options.userId,
          conversationId: options.conversationId ?? undefined,
          question: options.question ?? "[structured params]",
          sql,
          params: validation.normalized as unknown as object,
          rowCount: 0,
          executionTimeMs,
          error: message,
        },
      })
      .catch(() => undefined);

    // Timeout from the 5s statement_timeout surfaces as:
    // "canceling statement due to statement timeout"
    const isTimeout = /statement timeout/i.test(message);
    return {
      kind: "error",
      status: isTimeout ? 408 : 500,
      message: isTimeout
        ? "Query timed out (5s limit)"
        : "Query execution failed",
      details: process.env.NODE_ENV === "development" ? message : undefined,
    };
  }
}
