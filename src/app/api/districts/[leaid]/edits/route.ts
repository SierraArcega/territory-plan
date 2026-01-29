import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;
    const user = await getUser();
    const body = await request.json();

    const { notes, owner } = body;

    // Verify district exists
    const district = await prisma.district.findUnique({
      where: { leaid },
    });

    if (!district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // Upsert edits (scoped to user)
    const edits = await prisma.districtEdits.upsert({
      where: { leaid },
      update: {
        notes: notes !== undefined ? notes : undefined,
        owner: owner !== undefined ? owner : undefined,
        userId: user?.id || undefined,
      },
      create: {
        leaid,
        notes: notes || null,
        owner: owner || null,
        userId: user?.id || null,
      },
    });

    return NextResponse.json({
      leaid: edits.leaid,
      notes: edits.notes,
      owner: edits.owner,
      updatedAt: edits.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating district edits:", error);
    return NextResponse.json(
      { error: "Failed to update district edits" },
      { status: 500 }
    );
  }
}
