import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import { updateDistrictNote } from "@/features/districts/lib/note-service";
import { isServiceError } from "@/features/shared/lib/service-error";

export const dynamic = "force-dynamic";

// PATCH /api/districts/[leaid]/notes/[noteId] — edit own entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string; noteId: string }> },
) {
  const { leaid, noteId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const note = await updateDistrictNote(
      leaid,
      noteId,
      { bodyText: body?.bodyText, bodyJson: body?.bodyJson, noteType: body?.noteType },
      user.id,
      () => isAdmin(user.id),
    );
    return NextResponse.json(note);
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating district note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
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
