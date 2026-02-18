import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leaids, owner, notes } = body as {
      leaids: string[];
      owner?: string;
      notes?: string;
    };

    if (!Array.isArray(leaids) || leaids.length === 0) {
      return NextResponse.json(
        { error: "leaids must be a non-empty array" },
        { status: 400 }
      );
    }

    if (owner === undefined && notes === undefined) {
      return NextResponse.json(
        { error: "At least one of owner or notes must be provided" },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = { notesUpdatedAt: new Date() };
    if (owner !== undefined) data.owner = owner || null;
    if (notes !== undefined) data.notes = notes || null;

    const result = await prisma.district.updateMany({
      where: { leaid: { in: leaids } },
      data,
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Error in batch edits:", error);
    return NextResponse.json(
      { error: "Failed to batch update districts" },
      { status: 500 }
    );
  }
}
