import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Helper to convert Decimal to number (handles null)
function toNumber(val: Decimal | null | undefined): number | null {
  return val != null ? Number(val) : null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const charter = searchParams.get("charter");
    const state = searchParams.get("state");
    const leaid = searchParams.get("leaid");
    const schoolLevel = searchParams.get("school_level");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: Prisma.SchoolWhereInput = {};

    if (charter) {
      where.charter = parseInt(charter, 10);
    }

    if (state) {
      where.stateAbbrev = state;
    }

    if (leaid) {
      where.leaid = leaid;
    }

    if (schoolLevel) {
      where.schoolLevel = parseInt(schoolLevel, 10);
    }

    if (search) {
      where.schoolName = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Get total count
    const total = await prisma.school.count({ where });

    // Get schools
    const schools = await prisma.school.findMany({
      where,
      select: {
        ncessch: true,
        leaid: true,
        schoolName: true,
        charter: true,
        schoolLevel: true,
        enrollment: true,
        latitude: true,
        longitude: true,
        city: true,
        stateAbbrev: true,
        lograde: true,
        higrade: true,
        owner: true,
        schoolStatus: true,
      },
      take: limit,
      skip: offset,
      orderBy: { schoolName: "asc" },
    });

    const schoolList = schools.map((s) => ({
      ncessch: s.ncessch,
      leaid: s.leaid,
      schoolName: s.schoolName,
      charter: s.charter,
      schoolLevel: s.schoolLevel,
      enrollment: s.enrollment,
      latitude: toNumber(s.latitude),
      longitude: toNumber(s.longitude),
      city: s.city,
      stateAbbrev: s.stateAbbrev,
      lograde: s.lograde,
      higrade: s.higrade,
      owner: s.owner,
      schoolStatus: s.schoolStatus,
    }));

    return NextResponse.json({
      schools: schoolList,
      total,
    });
  } catch (error) {
    console.error("Error fetching schools:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 }
    );
  }
}
