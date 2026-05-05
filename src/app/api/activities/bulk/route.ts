import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import { VALID_ACTIVITY_STATUSES } from "@/features/activities/types";

export const dynamic = "force-dynamic";

const MAX_IDS = 500;

type FailureReason = "not_found" | "forbidden" | "system_skip";

interface BulkBody {
  ids: unknown;
  updates: unknown;
}

// PATCH /api/activities/bulk — apply the same owner/status update to many
// activities in one round-trip. Powers the Table view's bulk action bar.
//
// Per-row authorization mirrors the single-row PATCH: the caller must be
// admin OR the row's current owner. Rows that fail auth, are not found,
// or originate from a system sync show up in the `failed` array with a
// reason; the response is always 200 so partial successes are visible.
export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: BulkBody;
  try {
    body = (await request.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // ---- Validate `ids` ----
  if (!Array.isArray(body.ids) || body.ids.length === 0 || !body.ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }
  if (body.ids.length > MAX_IDS) {
    return NextResponse.json({ error: "too_many_ids", max: MAX_IDS }, { status: 400 });
  }
  // Dedupe so the same id can't appear in succeeded AND failed.
  const ids: string[] = [...new Set(body.ids as string[])];

  // ---- Validate `updates` ----
  if (!body.updates || typeof body.updates !== "object") {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }
  const updates = body.updates as { ownerId?: unknown; status?: unknown };
  const data: { createdByUserId?: string; status?: string } = {};

  if (updates.ownerId !== undefined) {
    if (typeof updates.ownerId !== "string" || updates.ownerId.length === 0) {
      return NextResponse.json({ error: "invalid_owner" }, { status: 400 });
    }
    const newOwner = await prisma.userProfile.findUnique({
      where: { id: updates.ownerId },
      select: { id: true },
    });
    if (!newOwner) {
      return NextResponse.json({ error: "invalid_owner" }, { status: 400 });
    }
    data.createdByUserId = updates.ownerId;
  }

  if (updates.status !== undefined) {
    if (
      typeof updates.status !== "string" ||
      !(VALID_ACTIVITY_STATUSES as readonly string[]).includes(updates.status)
    ) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    data.status = updates.status;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  // ---- Per-row auth ----
  const candidates = await prisma.activity.findMany({
    where: { id: { in: ids } },
    select: { id: true, createdByUserId: true, source: true },
  });
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const adminCaller = await isAdmin(user.id);

  const succeeded: string[] = [];
  const failed: { id: string; reason: FailureReason }[] = [];
  const allowedIds: string[] = [];

  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      failed.push({ id, reason: "not_found" });
      continue;
    }
    if (row.source === "system") {
      failed.push({ id, reason: "system_skip" });
      continue;
    }
    // Match the [id] PATCH guard: rows with no owner are treated as the
    // caller's own (legacy backfill).
    const ownsIt = !row.createdByUserId || row.createdByUserId === user.id;
    if (!ownsIt && !adminCaller) {
      failed.push({ id, reason: "forbidden" });
      continue;
    }
    allowedIds.push(id);
  }

  if (allowedIds.length > 0) {
    await prisma.activity.updateMany({
      where: { id: { in: allowedIds } },
      data,
    });
    succeeded.push(...allowedIds);
  }

  return NextResponse.json({ succeeded, failed });
}
