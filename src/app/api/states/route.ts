import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    // Get states from the states table (which has fips codes)
    const states = await prisma.state.findMany({
      select: {
        fips: true,
        abbrev: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(states);
  } catch (error) {
    console.error("Error fetching states:", error);
    return NextResponse.json(
      { error: "Failed to fetch states" },
      { status: 500 }
    );
  }
}
