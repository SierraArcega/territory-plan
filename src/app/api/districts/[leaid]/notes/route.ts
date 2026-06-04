import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { createDistrictNote } from "@/features/districts/lib/note-service";
import { isServiceError } from "@/features/shared/lib/service-error";

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

  try {
    const body = await request.json().catch(() => ({}));
    const note = await createDistrictNote(
      leaid,
      { bodyText: body?.bodyText, bodyJson: body?.bodyJson, noteType: body?.noteType },
      user.id,
    );
    return NextResponse.json(note);
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating district note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
