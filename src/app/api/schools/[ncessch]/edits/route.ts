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
    const { owner, notes } = body;

    const school = await prisma.school.update({
      where: { ncessch },
      data: {
        owner: owner !== undefined ? owner : undefined,
        notes: notes !== undefined ? notes : undefined,
        notesUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      ncessch: school.ncessch,
      notes: school.notes,
      owner: school.owner,
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
