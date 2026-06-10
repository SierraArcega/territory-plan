// GET /api/document-generation/documents/[id] — signature-request status for the
// send-feedback banner (and, later, the monitoring view). Owner-scoped: a row
// belonging to someone else 404s rather than confirming it exists.
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const docId = Number(id);
    if (!Number.isInteger(docId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const row = await prisma.generatedDocument.findUnique({
      where: { id: docId },
      select: { id: true, status: true, errorMessage: true, recipientEmail: true, docUrl: true, ownerProfileId: true },
    });
    if (!row || row.ownerProfileId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ownerProfileId: _owner, ...doc } = row;
    return NextResponse.json(doc);
  } catch (error) {
    console.error("Generated document status error:", error);
    return NextResponse.json({ error: "Failed to load document status" }, { status: 500 });
  }
}
