import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface VacancyRow {
  id: string;
  leaid: string;
  title: string;
  category: string | null;
  status: string;
  schoolName: string | null;
  hiringManager: string | null;
  hiringEmail: string | null;
  startDate: string | null;
  datePosted: Date | null;
  fullmindRelevant: boolean;
  relevanceReason: string | null;
  sourceUrl: string | null;
  district: { name: string };
  school: { schoolName: string } | null;
  contact: { name: string; email: string | null } | null;
}

interface CategoryCount {
  [key: string]: number;
}

interface DistrictCount {
  [key: string]: number;
}

// GET /api/territory-plans/[id]/vacancies - Get all vacancies across districts in a plan
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Fetch the plan and its district leaids
    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        districts: {
          select: {
            districtLeaid: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    const leaids = plan.districts.map((d) => d.districtLeaid);

    if (leaids.length === 0) {
      return NextResponse.json({
        vacancies: [],
        summary: {
          total: 0,
          fullmindRelevant: 0,
          byCategory: {},
          byDistrict: {},
        },
      });
    }

    // Fetch all open, district-verified vacancies for these districts
    const { searchParams } = new URL(request.url);
    const includeUnverified = searchParams.get("includeUnverified") === "true";
    const vacancies = await prisma.vacancy.findMany({
      where: {
        leaid: { in: leaids },
        status: "open",
        ...(!includeUnverified && { districtVerified: true }),
      },
      include: {
        district: {
          select: { name: true },
        },
        school: {
          select: { schoolName: true },
        },
        contact: {
          select: { name: true, email: true },
        },
      },
      orderBy: { datePosted: "desc" },
    });

    const now = new Date();

    // Build summary
    const byCategory: CategoryCount = {};
    const byDistrict: DistrictCount = {};
    let fullmindRelevantCount = 0;

    const mapped = (vacancies as unknown as VacancyRow[]).map((v) => {
      // Category counts
      const cat = v.category || "Other";
      byCategory[cat] = (byCategory[cat] || 0) + 1;

      // District counts
      const distName = v.district.name;
      byDistrict[distName] = (byDistrict[distName] || 0) + 1;

      // Fullmind relevant count
      if (v.fullmindRelevant) fullmindRelevantCount++;

      // Days open calculation
      const posted = v.datePosted ? new Date(v.datePosted) : null;
      const daysOpen = posted
        ? Math.floor((now.getTime() - posted.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        id: v.id,
        title: v.title,
        category: v.category,
        status: v.status,
        districtName: v.district.name,
        districtLeaid: v.leaid,
        schoolName: v.school?.schoolName || v.schoolName || null,
        hiringManager: v.contact?.name || v.hiringManager || null,
        hiringEmail: v.contact?.email || v.hiringEmail || null,
        startDate: v.startDate || null,
        datePosted: v.datePosted ? new Date(v.datePosted).toISOString() : null,
        daysOpen,
        fullmindRelevant: v.fullmindRelevant,
        relevanceReason: v.relevanceReason,
        sourceUrl: v.sourceUrl,
      };
    });

    return NextResponse.json({
      vacancies: mapped,
      summary: {
        total: mapped.length,
        fullmindRelevant: fullmindRelevantCount,
        byCategory,
        byDistrict,
      },
    });
  } catch (error) {
    console.error("Error fetching plan vacancies:", error);
    return NextResponse.json(
      { error: "Failed to fetch vacancies" },
      { status: 500 }
    );
  }
}
