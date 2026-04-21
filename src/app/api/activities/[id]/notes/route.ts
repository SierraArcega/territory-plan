import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function assertCanReadActivity(activityId: string, userId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, createdByUserId: true },
  });
  if (!activity) return { error: "not_found" as const };
  if (activity.createdByUserId && activity.createdByUserId !== userId) {
    const linkedToPlan = await prisma.activityPlan.findFirst({
      where: { activityId },
      select: { planId: true },
    });
    if (!linkedToPlan && !(await isAdmin(userId))) return { error: "forbidden" as const };
  }
  return { activity };
}

// GET /api/activities/[id]/notes — list note entries (threaded log)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await assertCanReadActivity(id, user.id);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "not_found" ? 404 : 403 }
    );
  }

  const notes = await prisma.activityNote.findMany({
    where: { activityId: id },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    notes: notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      author: {
        id: n.author.id,
        fullName: n.author.fullName,
        email: n.author.email,
        avatarUrl: n.author.avatarUrl,
      },
    })),
  });
}

// POST /api/activities/[id]/notes — append an entry to the log
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await assertCanReadActivity(id, user.id);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "not_found" ? 404 : 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  const note = await prisma.activityNote.create({
    data: { activityId: id, authorId: user.id, body: text },
    include: {
      author: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    id: note.id,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    author: {
      id: note.author.id,
      fullName: note.author.fullName,
      email: note.author.email,
      avatarUrl: note.author.avatarUrl,
    },
  });
}
