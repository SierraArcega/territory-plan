import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { readonlyPool } from "@/lib/db-readonly";
import prisma from "@/lib/prisma";
import { previewBodySchema } from "@/lib/saved-views/schema";
import { validateFilterTree } from "@/lib/saved-views/sql-compiler";
import { buildPreviewSql, type ScopeSpec } from "@/lib/saved-views/preview-sql";
import type { FilterNode } from "@/lib/saved-views/filter-tree";

export const dynamic = "force-dynamic";

/**
 * POST /api/lists/preview
 *
 * Compiles a filter tree + optional scope into parameterized SQL, executes
 * count + sample queries against the read-only Postgres pool, and returns
 * `{ count, sample }` for the list builder's live preview pane.
 *
 * Body shape — see previewBodySchema in src/lib/saved-views/schema.ts.
 *
 * Errors:
 *   401 — unauth
 *   400 — body parse, Zod, allowlist validation, scope validation failures
 *   200 — { count: number, sample: Array<{ id, primary_label, ... }>, truncated?: bool }
 *
 * Statement timeout: the readonly pool sets statement_timeout = 5s at the
 * connection level, so any compiled query is capped.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = previewBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid preview body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Validate field/op allowlist BEFORE compiling so a malformed tree returns
  // a precise error instead of a vague compile-time message.
  const fieldErr = validateFilterTree(data.source, data.filterTree);
  if (fieldErr) {
    return NextResponse.json({ error: fieldErr }, { status: 400 });
  }

  if (data.scopeMode === "rules" && data.scopeFilterTree) {
    const scopeFieldErr = validateFilterTree("districts", data.scopeFilterTree);
    if (scopeFieldErr) {
      return NextResponse.json(
        { error: `Scope: ${scopeFieldErr}` },
        { status: 400 },
      );
    }
  }

  // Build the scope spec. For scope=reference with kind=list, look up the
  // referenced list's filter tree at request time. The compiled SQL for it
  // joins through districts (assumes the referenced list's source is
  // 'districts' — list-of-list references in v1 only support districts).
  let scope: ScopeSpec;
  if (data.scopeMode === "reference") {
    if (!data.scopeRefKind || !data.scopeRefId) {
      return NextResponse.json(
        { error: "scope mode 'reference' requires scopeRefKind and scopeRefId" },
        { status: 400 },
      );
    }
    if (data.scopeRefKind === "list") {
      // Visibility: the referenced list must be owner OR shared.
      const ref = await prisma.savedList.findUnique({
        where: { id: data.scopeRefId },
        select: { ownerId: true, shared: true, source: true, filterTree: true },
      });
      if (!ref || (ref.ownerId !== user.id && !ref.shared)) {
        return NextResponse.json(
          { error: "Referenced list not found" },
          { status: 404 },
        );
      }
      if (ref.source !== "districts") {
        return NextResponse.json(
          { error: "Referenced list must have source 'districts' for scope=reference" },
          { status: 400 },
        );
      }
      scope = {
        mode: "reference",
        refKind: "list",
        refId: data.scopeRefId,
        filterTree: ref.filterTree as unknown as FilterNode,
      };
    } else {
      // refKind === 'plan'. No filterTree needed; refId is enough.
      scope = {
        mode: "reference",
        refKind: "plan",
        refId: data.scopeRefId,
      };
    }
  } else if (data.scopeMode === "rules") {
    scope = { mode: "rules", filterTree: data.scopeFilterTree ?? null };
  } else {
    scope = { mode: "none" };
  }

  const built = buildPreviewSql(data.source, data.filterTree, scope, 3);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: 400 });
  }

  // Execute both queries against the readonly pool. The pool enforces a 5s
  // statement timeout at the role level, so a slow filter degrades to a 500
  // (caught below) rather than hanging the request.
  try {
    const countRes = await readonlyPool.query<{ count: number }>(
      built.sql.countSql,
      built.sql.params,
    );
    const sampleRes = await readonlyPool.query<{
      id: string | number;
      primary_label: string | null;
      secondary_label: string | null;
      meta: string | number | boolean | null;
    }>(built.sql.sampleSql, built.sql.params);

    return NextResponse.json({
      count: countRes.rows[0]?.count ?? 0,
      sample: sampleRes.rows.map((r) => ({
        id: r.id,
        primaryLabel: r.primary_label,
        secondaryLabel: r.secondary_label,
        meta: r.meta,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Statement-timeout / lock-timeout / cancellation — return a graceful
    // "truncated" response so the UI shows a soft empty state.
    if (/statement timeout|canceling statement/i.test(message)) {
      return NextResponse.json({ count: null, sample: [], truncated: true });
    }
    console.error("[lists/preview] SQL error", { message });
    return NextResponse.json({ error: "Failed to preview list" }, { status: 500 });
  }
}
