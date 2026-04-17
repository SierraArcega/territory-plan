import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readonlyPool } from "@/lib/db-readonly";
import { getUser } from "@/lib/supabase/server";
import { compileParams } from "@/features/reports/lib/params-to-sql";
import { validateParams } from "@/features/reports/lib/params-validator";
import type { QueryParams, QueryResult } from "@/features/reports/lib/types";
import { MAX_LIMIT } from "@/features/reports/lib/types";

export const dynamic = "force-dynamic";

interface RunRequestBody {
  params: QueryParams;
  conversationId?: string;
  /** Optional label persisted to query_log for context. */
  question?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RunRequestBody;
  try {
    body = (await request.json()) as RunRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.params || typeof body.params !== "object") {
    return NextResponse.json(
      { error: "Missing 'params' object in request body" },
      { status: 400 },
    );
  }

  const validation = validateParams(body.params);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Invalid params", details: validation.errors },
      { status: 400 },
    );
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

    // Fire-and-forget audit log. Use the Prisma client's default pool (full
    // access) because query_log isn't on the query-tool readonly role's
    // writable surface.
    void prisma.queryLog
      .create({
        data: {
          userId: user.id,
          conversationId: body.conversationId ?? undefined,
          question: body.question ?? "[structured params]",
          sql,
          rowCount,
          executionTimeMs,
        },
      })
      .catch(() => undefined);

    const response: QueryResult = {
      columns,
      rows,
      rowCount,
      truncated,
      executionTimeMs,
    };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const executionTimeMs = Date.now() - startedAt;

    void prisma.queryLog
      .create({
        data: {
          userId: user.id,
          conversationId: body.conversationId ?? undefined,
          question: body.question ?? "[structured params]",
          sql,
          rowCount: 0,
          executionTimeMs,
          error: message,
        },
      })
      .catch(() => undefined);

    // Timeout from the 5s statement_timeout looks like:
    // "canceling statement due to statement timeout"
    const isTimeout = /statement timeout/i.test(message);
    return NextResponse.json(
      {
        error: isTimeout ? "Query timed out (5s limit)" : "Query execution failed",
        // Only surface the DB message in dev to help debugging; prod stays opaque.
        details:
          process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: isTimeout ? 408 : 500 },
    );
  }
}
