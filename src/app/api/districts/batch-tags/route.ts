import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leaids, action, tagId } = body as {
      leaids: string[];
      action: "add" | "remove";
      tagId: number;
    };

    if (!Array.isArray(leaids) || leaids.length === 0) {
      return NextResponse.json(
        { error: "leaids must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    if (typeof tagId !== "number") {
      return NextResponse.json(
        { error: "tagId must be a number" },
        { status: 400 }
      );
    }

    let count: number;

    if (action === "add") {
      const result = await prisma.districtTag.createMany({
        data: leaids.map((leaid) => ({
          districtLeaid: leaid,
          tagId,
        })),
        skipDuplicates: true,
      });
      count = result.count;
    } else {
      const result = await prisma.districtTag.deleteMany({
        where: {
          districtLeaid: { in: leaids },
          tagId,
        },
      });
      count = result.count;
    }

    return NextResponse.json({ updated: count });
  } catch (error) {
    console.error("Error in batch tags:", error);
    return NextResponse.json(
      { error: "Failed to batch update tags" },
      { status: 500 }
    );
  }
}
