import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;
    const body = await request.json();
    const { notes, owner, ownerId } = body;

    // Update notes and owner directly on the district
    const district = await prisma.district.update({
      where: { leaid },
      data: {
        notes: notes !== undefined ? notes : undefined,
        owner: owner !== undefined ? owner : undefined,
        ownerId: ownerId !== undefined ? ownerId : undefined,
        notesUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      leaid: district.leaid,
      notes: district.notes,
      owner: district.owner,
      ownerId: district.ownerId,
      updatedAt: district.notesUpdatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Error updating district edits:", error);
    return NextResponse.json(
      { error: "Failed to update district edits" },
      { status: 500 }
    );
  }
}
