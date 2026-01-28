import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;
    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json(
        { error: "tagId is required" },
        { status: 400 }
      );
    }

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

    // Verify tag exists
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag) {
      return NextResponse.json(
        { error: "Tag not found" },
        { status: 404 }
      );
    }

    // Create association (ignore if already exists)
    await prisma.districtTag.upsert({
      where: {
        districtLeaid_tagId: {
          districtLeaid: leaid,
          tagId,
        },
      },
      update: {},
      create: {
        districtLeaid: leaid,
        tagId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding tag to district:", error);
    return NextResponse.json(
      { error: "Failed to add tag to district" },
      { status: 500 }
    );
  }
}
