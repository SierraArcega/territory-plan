import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string; tagId: string }> }
) {
  try {
    const { leaid, tagId } = await params;
    const tagIdNum = parseInt(tagId);

    if (isNaN(tagIdNum)) {
      return NextResponse.json(
        { error: "Invalid tag ID" },
        { status: 400 }
      );
    }

    // deleteMany avoids throwing when the record doesn't exist
    const result = await prisma.districtTag.deleteMany({
      where: {
        districtLeaid: leaid,
        tagId: tagIdNum,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "Tag association not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing tag from district:", error);
    const message =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? `Database error (${error.code}): ${error.message}`
        : "Failed to remove tag from district";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
