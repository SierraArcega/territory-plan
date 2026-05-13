import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { hideBodySchema } from "@/lib/saved-views/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/lists/[id]/hide
 *
 * Per-user hide toggle. Idempotent — setting `hidden: true` upserts a row in
 * `saved_list_hidden`; `hidden: false` removes it. Available to anyone with
 * visibility (owner or shared); the row is per-user and never leaks across
 * users.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  // Verify visibility — the user must be able to see the list before they
  // can hide it. Without this an attacker could probe for valid IDs by
  // hiding non-shared lists they don't own.
  const list = await prisma.savedList.findUnique({
    where: { id },
    select: { ownerId: true, shared: true },
  });

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  if (list.ownerId !== user.id && !list.shared) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = hideBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body — expected { hidden: boolean }" },
      { status: 400 },
    );
  }

  if (parsed.data.hidden) {
    await prisma.savedListHidden.upsert({
      where: { listId_userId: { listId: id, userId: user.id } },
      create: { listId: id, userId: user.id },
      update: {},
    });
  } else {
    await prisma.savedListHidden.deleteMany({
      where: { listId: id, userId: user.id },
    });
  }

  return NextResponse.json({ ok: true, hidden: parsed.data.hidden });
}
