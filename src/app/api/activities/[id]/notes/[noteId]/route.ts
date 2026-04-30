import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/activities/[id]/notes/[noteId] — remove own note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id, noteId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const note = await prisma.activityNote.findUnique({ where: { id: noteId } });
  if (!note || note.activityId !== id) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  if (note.authorId !== user.id && !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.activityNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
