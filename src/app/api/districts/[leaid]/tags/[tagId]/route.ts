import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

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

    // Delete the association
    await prisma.districtTag.delete({
      where: {
        districtLeaid_tagId: {
          districtLeaid: leaid,
          tagId: tagIdNum,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing tag from district:", error);
    return NextResponse.json(
      { error: "Failed to remove tag from district" },
      { status: 500 }
    );
  }
}
