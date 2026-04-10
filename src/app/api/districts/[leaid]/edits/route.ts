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
    const { notes, ownerId } = body;

    const district = await prisma.district.update({
      where: { leaid },
      data: {
        notes: notes !== undefined ? notes : undefined,
        ownerId: ownerId !== undefined ? (ownerId || null) : undefined,
        notesUpdatedAt: new Date(),
      },
      include: {
        ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      leaid: district.leaid,
      notes: district.notes,
      owner: district.ownerUser
        ? { id: district.ownerUser.id, fullName: district.ownerUser.fullName, avatarUrl: district.ownerUser.avatarUrl }
        : null,
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
