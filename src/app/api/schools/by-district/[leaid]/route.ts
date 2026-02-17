import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;

    const schools = await prisma.school.findMany({
      where: { leaid },
      include: {
        enrollmentHistory: {
          orderBy: { year: "asc" },
        },
      },
      orderBy: { schoolName: "asc" },
    });

    const schoolList = schools.map((s) => ({
      ncessch: s.ncessch,
      schoolName: s.schoolName,
      charter: s.charter,
      schoolLevel: s.schoolLevel,
      enrollment: s.enrollment,
      lograde: s.lograde,
      higrade: s.higrade,
      schoolStatus: s.schoolStatus,
      enrollmentHistory: s.enrollmentHistory.map((eh) => ({
        year: eh.year,
        enrollment: eh.enrollment,
      })),
    }));

    return NextResponse.json({
      schools: schoolList,
      total: schoolList.length,
    });
  } catch (error) {
    console.error("Error fetching schools by district:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools for district" },
      { status: 500 }
    );
  }
}
