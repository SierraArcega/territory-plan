import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

function toNum(val: Decimal | null | undefined): number | null {
  return val != null ? Number(val) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bounds = searchParams.get("bounds"); // "west,south,east,north"

    if (!bounds) {
      return NextResponse.json(
        { error: "bounds parameter required (west,south,east,north)" },
        { status: 400 }
      );
    }

    const [west, south, east, north] = bounds.split(",").map(Number);
    if ([west, south, east, north].some(isNaN)) {
      return NextResponse.json(
        { error: "Invalid bounds format" },
        { status: 400 }
      );
    }

    const schools = await prisma.school.findMany({
      where: {
        latitude: { gte: south, lte: north },
        longitude: { gte: west, lte: east },
        schoolStatus: 1,
      },
      select: {
        ncessch: true,
        leaid: true,
        schoolName: true,
        schoolLevel: true,
        enrollment: true,
        latitude: true,
        longitude: true,
        lograde: true,
        higrade: true,
        charter: true,
      },
    });

    const features = schools
      .filter((s) => s.latitude && s.longitude)
      .map((s) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [toNum(s.longitude)!, toNum(s.latitude)!],
        },
        properties: {
          ncessch: s.ncessch,
          leaid: s.leaid,
          name: s.schoolName,
          schoolLevel: s.schoolLevel ?? 4,
          enrollment: s.enrollment ?? 0,
          lograde: s.lograde ?? "",
          higrade: s.higrade ?? "",
          charter: s.charter ?? 0,
        },
      }));

    return NextResponse.json(
      { type: "FeatureCollection", features },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching school GeoJSON:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 }
    );
  }
}
