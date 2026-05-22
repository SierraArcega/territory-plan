import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { isNoteType, DEFAULT_NOTE_TYPE } from "@/features/views/lib/note-types";

export const dynamic = "force-dynamic";

const AUTHOR_SELECT = { id: true, fullName: true, email: true, avatarUrl: true } as const;

function serialize(n: {
  id: string;
  bodyJson: unknown;
  bodyText: string;
  noteType: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; fullName: string | null; email: string; avatarUrl: string | null };
}) {
  return {
    id: n.id,
    bodyJson: n.bodyJson,
    bodyText: n.bodyText,
    noteType: n.noteType,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    author: n.author,
  };
}

// GET /api/districts/[leaid]/notes — newest-first feed
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notes = await prisma.districtNote.findMany({
    where: { districtLeaid: leaid },
    orderBy: { createdAt: "desc" },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return NextResponse.json({ notes: notes.map(serialize) });
}

// POST /api/districts/[leaid]/notes — append an entry
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const bodyText = typeof body?.bodyText === "string" ? body.bodyText.trim() : "";
  const bodyJson = body?.bodyJson;
  if (!bodyText || bodyJson == null || typeof bodyJson !== "object") {
    return NextResponse.json({ error: "bodyJson + non-empty bodyText required" }, { status: 400 });
  }

  const noteType = body?.noteType === undefined ? DEFAULT_NOTE_TYPE : body.noteType;
  if (!isNoteType(noteType)) {
    return NextResponse.json({ error: "Invalid noteType" }, { status: 400 });
  }

  const note = await prisma.districtNote.create({
    data: { districtLeaid: leaid, authorId: user.id, bodyJson, bodyText, noteType },
    include: { author: { select: AUTHOR_SELECT } },
  });

  return NextResponse.json(serialize(note));
}
