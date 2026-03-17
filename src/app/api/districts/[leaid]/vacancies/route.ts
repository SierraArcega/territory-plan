import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/districts/[leaid]/vacancies
 *
 * Fetch vacancies for a district.
 * Query params:
 *   ?status=open (default) — only open vacancies
 *   ?status=all — all vacancies regardless of status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "open";

    // Validate district exists
    const district = await prisma.district.findUnique({
      where: { leaid },
      select: { leaid: true, name: true },
    });

    if (!district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // Build vacancy query filter
    const whereClause: { leaid: string; status?: string } = { leaid };
    if (statusFilter !== "all") {
      whereClause.status = statusFilter;
    }

    // Query vacancies with school and contact relations
    const vacancies = await prisma.vacancy.findMany({
      where: whereClause,
      include: {
        school: {
          select: { ncessch: true, schoolName: true },
        },
        contact: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { fullmindRelevant: "desc" },
        { firstSeenAt: "desc" },
      ],
    });

    // Get most recent VacancyScan for lastScannedAt
    const lastScan = await prisma.vacancyScan.findFirst({
      where: {
        leaid,
        status: { in: ["completed", "completed_partial"] },
      },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });

    // Compute summary stats
    const now = new Date();
    const openVacancies = vacancies.filter((v) => v.status === "open");
    const totalOpen = openVacancies.length;
    const fullmindRelevant = openVacancies.filter(
      (v) => v.fullmindRelevant
    ).length;

    // Aggregate by category
    const byCategory: Record<string, number> = {};
    for (const v of openVacancies) {
      const cat = v.category || "Other";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    // Compute daysOpen for each vacancy
    const vacancyResponses = vacancies.map((v) => {
      const daysOpen = Math.floor(
        (now.getTime() - v.firstSeenAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: v.id,
        title: v.title,
        category: v.category,
        status: v.status,
        schoolName: v.schoolName,
        school: v.school
          ? { ncessch: v.school.ncessch, name: v.school.schoolName }
          : null,
        hiringManager: v.hiringManager,
        hiringEmail: v.hiringEmail,
        contact: v.contact
          ? { id: v.contact.id, name: v.contact.name }
          : null,
        startDate: v.startDate,
        datePosted: v.datePosted?.toISOString() ?? null,
        daysOpen,
        fullmindRelevant: v.fullmindRelevant,
        relevanceReason: v.relevanceReason,
        sourceUrl: v.sourceUrl,
      };
    });

    return NextResponse.json({
      summary: {
        totalOpen,
        fullmindRelevant,
        byCategory,
        lastScannedAt: lastScan?.completedAt?.toISOString() ?? null,
      },
      vacancies: vacancyResponses,
    });
  } catch (error) {
    console.error("Error fetching vacancies:", error);
    return NextResponse.json(
      { error: "Failed to fetch vacancies" },
      { status: 500 }
    );
  }
}
