import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/districts/websites
 * Returns website URLs for a list of district LEAIDs.
 */
export async function POST(request: NextRequest) {
  try {
    const { leaids } = await request.json();

    if (!Array.isArray(leaids) || leaids.length === 0) {
      return NextResponse.json([]);
    }

    const districts = await prisma.district.findMany({
      where: { leaid: { in: leaids } },
      select: { leaid: true, websiteUrl: true },
    });

    return NextResponse.json(
      districts.map((d) => ({ leaid: d.leaid, websiteUrl: d.websiteUrl }))
    );
  } catch (error) {
    console.error("Error fetching district websites:", error);
    return NextResponse.json(
      { error: "Failed to fetch district websites" },
      { status: 500 }
    );
  }
}
