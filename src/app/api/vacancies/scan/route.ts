import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { runScan } from "@/features/vacancies/lib/scan-runner";

export const dynamic = "force-dynamic";

// Allow up to 60s for the scan to complete on Vercel
export const maxDuration = 60;

/**
 * POST /api/vacancies/scan
 *
 * Trigger a vacancy scan for a single district.
 * Runs the scan inline (awaited) so it completes before the response is sent,
 * which is required for Vercel serverless where background work is killed.
 *
 * Request body: { leaid: string }
 * Response: { scanId: string, status: "completed" | "failed", ... }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leaid, jobBoardUrl } = body as {
      leaid?: string;
      jobBoardUrl?: string;
    };

    if (!leaid || typeof leaid !== "string") {
      return NextResponse.json(
        { error: "leaid is required" },
        { status: 400 }
      );
    }

    // Validate district exists
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

    // If a job board URL was provided, save it to the district
    if (jobBoardUrl && typeof jobBoardUrl === "string") {
      await prisma.district.update({
        where: { leaid },
        data: { jobBoardUrl },
      });
      district.jobBoardUrl = jobBoardUrl;
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

    // Run the scan inline — await it so it completes before the response
    await runScan(scan.id);

    // Fetch final status to return
    const result = await prisma.vacancyScan.findUnique({
      where: { id: scan.id },
      select: {
        id: true,
        status: true,
        vacancyCount: true,
        fullmindRelevantCount: true,
        errorMessage: true,
      },
    });

    return NextResponse.json({
      scanId: scan.id,
      status: result?.status ?? "completed",
      vacancyCount: result?.vacancyCount ?? 0,
      fullmindRelevantCount: result?.fullmindRelevantCount ?? 0,
      errorMessage: result?.errorMessage ?? null,
    });
  } catch (error) {
    console.error("Error triggering vacancy scan:", error);
    return NextResponse.json(
      { error: "Failed to trigger vacancy scan" },
      { status: 500 }
    );
  }
}
