// POST /api/reports/[id]/share — Update the sharedWith array for a saved report.
// Only the report owner can modify sharing.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { sharedWith } = body as { sharedWith: string[] };

    if (!Array.isArray(sharedWith)) {
      return NextResponse.json(
        { error: "sharedWith must be an array of user IDs" },
        { status: 400 }
      );
    }

    // Check ownership
    const existing = await prisma.savedReport.findUnique({
      where: { id },
      select: { createdBy: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (existing.createdBy !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const report = await prisma.savedReport.update({
      where: { id },
      data: { sharedWith },
      select: {
        id: true,
        name: true,
        sharedWith: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error sharing report:", error);
    return NextResponse.json(
      { error: "Failed to share report" },
      { status: 500 }
    );
  }
}
