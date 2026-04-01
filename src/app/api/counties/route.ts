import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const counties = await prisma.district.groupBy({
      by: ["countyName", "stateAbbrev"],
      where: { countyName: { not: null } },
      orderBy: [{ countyName: "asc" }, { stateAbbrev: "asc" }],
    });

    return NextResponse.json(counties);
  } catch (error) {
    console.error("Error fetching counties:", error);
    return NextResponse.json(
      { error: "Failed to fetch counties" },
      { status: 500 }
    );
  }
}
