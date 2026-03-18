import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { enqueueScan } from "@/features/vacancies/lib/scan-queue";

export const dynamic = "force-dynamic";

/**
 * POST /api/vacancies/scan
 *
 * Trigger a vacancy scan for a single district.
 *
 * Request body: { leaid: string }
 * Response: { scanId: string, status: "pending" }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leaid } = body as { leaid?: string };

    if (!leaid || typeof leaid !== "string") {
      return NextResponse.json(
        { error: "leaid is required" },
        { status: 400 }
      );
    }

    // Validate district exists and has a job board URL
    const district = await prisma.district.findUnique({
      where: { leaid },
      select: { leaid: true, name: true, jobBoardUrl: true },
    });

    if (!district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    if (!district.jobBoardUrl) {
      return NextResponse.json(
        { error: "District does not have a job board URL configured" },
        { status: 400 }
      );
    }

    // Create VacancyScan row
    const scan = await prisma.vacancyScan.create({
      data: {
        leaid,
        status: "pending",
        triggeredBy: user.email ?? user.id,
      },
    });

    // Enqueue the scan job
    await enqueueScan(scan.id);

    return NextResponse.json({
      scanId: scan.id,
      status: "pending",
    });
  } catch (error) {
    console.error("Error triggering vacancy scan:", error);
    return NextResponse.json(
      { error: "Failed to trigger vacancy scan" },
      { status: 500 }
    );
  }
}
