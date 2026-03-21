import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;
    const url = request.nextUrl;
    const includeAll = url.searchParams.get("includeAll") === "true";

    const where: Record<string, unknown> = { leaid };
    if (!includeAll) {
      where.OR = [{ schoolStatus: 1 }, { schoolStatus: null }];
    }

    const schools = await prisma.school.findMany({
      where,
      include: {
        enrollmentHistory: {
          orderBy: { year: "asc" },
        },
        schoolContacts: {
          take: 1,
          include: {
            contact: {
              select: { name: true, title: true, email: true },
            },
          },
        },
      },
      orderBy: { schoolName: "asc" },
    });

    const schoolList = schools.map((s) => ({
      ncessch: s.ncessch,
      leaid: s.leaid,
      schoolName: s.schoolName,
      charter: s.charter,
      schoolLevel: s.schoolLevel,
      enrollment: s.enrollment,
      lograde: s.lograde,
      higrade: s.higrade,
      schoolStatus: s.schoolStatus,
      titleIStatus: s.titleIStatus,
      titleIEligible: s.titleIEligible,
      titleISchoolwide: s.titleISchoolwide,
      freeLunch: s.freeLunch,
      reducedPriceLunch: s.reducedPriceLunch,
      frplTotal: s.frplTotal,
      streetAddress: s.streetAddress,
      city: s.city,
      stateAbbrev: s.stateAbbrev,
      contact: s.schoolContacts[0]?.contact
        ? {
            name: s.schoolContacts[0].contact.name,
            title: s.schoolContacts[0].contact.title,
            email: s.schoolContacts[0].contact.email,
          }
        : null,
      enrollmentHistory: s.enrollmentHistory.map((eh) => ({
        year: eh.year,
        enrollment: eh.enrollment,
      })),
    }));

    const totalSchools = schoolList.length;
    const titleISchools = schoolList.filter((s) => s.titleIEligible === 1).length;
    const titleISchoolwide = schoolList.filter((s) => s.titleISchoolwide === 1).length;
    const frplTotal = schoolList.reduce((sum, s) => sum + (s.frplTotal || 0), 0);
    const enrollmentTotal = schoolList.reduce((sum, s) => sum + (s.enrollment || 0), 0);

    return NextResponse.json({
      schools: schoolList,
      total: totalSchools,
      summary: {
        totalSchools,
        titleISchools,
        titleISchoolwide,
        frplTotal,
        frplRate: enrollmentTotal > 0 ? Math.round((frplTotal / enrollmentTotal) * 10000) / 100 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching schools by district:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools for district" },
      { status: 500 }
    );
  }
}
