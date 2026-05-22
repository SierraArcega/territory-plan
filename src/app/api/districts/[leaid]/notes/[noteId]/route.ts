import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import { isNoteType } from "@/features/views/lib/note-types";

export const dynamic = "force-dynamic";

const AUTHOR_SELECT = { id: true, fullName: true, email: true, avatarUrl: true } as const;

// PATCH /api/districts/[leaid]/notes/[noteId] — edit own entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string; noteId: string }> },
) {
  const { leaid, noteId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.districtNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.districtLeaid !== leaid) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  if (existing.authorId !== user.id && !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const bodyText = typeof body?.bodyText === "string" ? body.bodyText.trim() : "";
  const bodyJson = body?.bodyJson;
  if (!bodyText || bodyJson == null || typeof bodyJson !== "object") {
    return NextResponse.json({ error: "bodyJson + non-empty bodyText required" }, { status: 400 });
  }

  if (body?.noteType !== undefined && !isNoteType(body.noteType)) {
    return NextResponse.json({ error: "Invalid noteType" }, { status: 400 });
  }

  const note = await prisma.districtNote.update({
    where: { id: noteId },
    data: { bodyJson, bodyText, ...(body?.noteType !== undefined ? { noteType: body.noteType } : {}) },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return NextResponse.json({
    id: note.id,
    bodyJson: note.bodyJson,
    bodyText: note.bodyText,
    noteType: note.noteType,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    author: note.author,
  });
}

// DELETE /api/districts/[leaid]/notes/[noteId] — delete own entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string; noteId: string }> },
) {
  const { leaid, noteId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.districtNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.districtLeaid !== leaid) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }
  if (existing.authorId !== user.id && !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.districtNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
