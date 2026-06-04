import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getAction } from "@/features/copilot/lib/action-registry";
import { isServiceError } from "@/features/shared/lib/service-error";
import type { ExecuteActionRequest } from "@/features/copilot/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/copilot/actions/execute
 *
 * Executes ONE rep-confirmed copilot action. Re-authenticates, re-validates the
 * fields against the registry (never trusts the client), snapshots the
 * before-state for updates, runs the shared service fn inside a transaction, and
 * writes the audit row in the same transaction so the audit can't drift.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ExecuteActionRequest;
  try {
    body = (await request.json()) as ExecuteActionRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { objectType, operation, targetId, fields, conversationId } = body ?? {};
  const action = getAction(objectType, operation);
  if (!action) {
    return NextResponse.json(
      { error: `Unknown action "${objectType}.${operation}".` },
      { status: 400 },
    );
  }

  const hasTarget = targetId !== undefined && targetId !== null && targetId !== "";
  if (action.needsTarget && !hasTarget) {
    return NextResponse.json(
      { error: `${objectType}.${operation} requires a targetId.` },
      { status: 400 },
    );
  }

  const parsed = action.parse(fields ?? {});
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.errors.join("; ") },
      { status: 400 },
    );
  }

  try {
    const out = await prisma.$transaction(async (tx) => {
      const before =
        action.snapshot && hasTarget
          ? await action.snapshot(String(targetId), tx)
          : null;
      const result = await action.execute(parsed.fields, {
        targetId: hasTarget ? targetId : null,
        ctx: { userId: user.id, db: tx },
      });
      await tx.copilotActionLog.create({
        data: {
          userId: user.id,
          conversationId: conversationId ?? null,
          objectType,
          operation,
          targetId: hasTarget ? String(targetId) : null,
          beforeJson: before ? (before as Prisma.InputJsonValue) : Prisma.DbNull,
          afterJson: result ? (result as Prisma.InputJsonValue) : Prisma.DbNull,
          status: "success",
        },
      });
      return result;
    });

    return NextResponse.json({ status: "success", result: out });
  } catch (error) {
    const message = isServiceError(error)
      ? error.message
      : "Failed to execute action";
    const status = isServiceError(error) ? error.status : 500;
    // Best-effort failed-action audit row (outside the rolled-back transaction).
    prisma.copilotActionLog
      .create({
        data: {
          userId: user.id,
          conversationId: conversationId ?? null,
          objectType,
          operation,
          targetId: hasTarget ? String(targetId) : null,
          status: "error",
          errorMessage: message,
        },
      })
      .catch(() => {});
    if (!isServiceError(error)) {
      console.error("[copilot/actions/execute] failed", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
