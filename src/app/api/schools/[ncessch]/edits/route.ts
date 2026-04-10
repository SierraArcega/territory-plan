import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ncessch: string }> }
) {
  try {
    const { ncessch } = await params;
    const body = await request.json();
    const { ownerId, notes } = body;

    const school = await prisma.school.update({
      where: { ncessch },
      data: {
        ownerId: ownerId !== undefined ? (ownerId || null) : undefined,
        notes: notes !== undefined ? notes : undefined,
        notesUpdatedAt: new Date(),
      },
      include: {
        ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      ncessch: school.ncessch,
      notes: school.notes,
      owner: school.ownerUser
        ? { id: school.ownerUser.id, fullName: school.ownerUser.fullName, avatarUrl: school.ownerUser.avatarUrl }
        : null,
      updatedAt: school.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating school edits:", error);
    return NextResponse.json(
      { error: "Failed to update school edits" },
      { status: 500 }
    );
  }
}
