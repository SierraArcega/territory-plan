import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";

export const dynamic = "force-dynamic";

// GET /api/territory-plans/[id]/opportunities - Get all opportunities for plan districts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;

    const plan = await prisma.territoryPlan.findUnique({
      where: { id: planId },
      select: {
        fiscalYear: true,
        districts: {
          select: { districtLeaid: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    const leaIds = plan.districts.map((d) => d.districtLeaid);
    if (leaIds.length === 0) {
      return NextResponse.json([]);
    }

    const schoolYr = fiscalYearToSchoolYear(plan.fiscalYear);

    const rows = await prisma.opportunity.findMany({
      where: {
        districtLeaId: { in: leaIds },
        schoolYr,
      },
      select: {
        id: true,
        name: true,
        districtName: true,
        districtLeaId: true,
        stage: true,
        contractType: true,
        netBookingAmount: true,
        totalRevenue: true,
        totalTake: true,
        completedRevenue: true,
        scheduledRevenue: true,
        closeDate: true,
        detailsLink: true,
      },
      orderBy: { netBookingAmount: "desc" },
    });

    const opportunities = rows.map((r) => ({
      id: r.id,
      name: r.name,
      districtName: r.districtName,
      districtLeaId: r.districtLeaId,
      stage: r.stage,
      contractType: r.contractType,
      netBookingAmount: r.netBookingAmount ? Number(r.netBookingAmount) : 0,
      totalRevenue: r.totalRevenue ? Number(r.totalRevenue) : 0,
      totalTake: r.totalTake ? Number(r.totalTake) : 0,
      completedRevenue: r.completedRevenue ? Number(r.completedRevenue) : 0,
      scheduledRevenue: r.scheduledRevenue ? Number(r.scheduledRevenue) : 0,
      closeDate: r.closeDate?.toISOString() ?? null,
      detailsLink: r.detailsLink,
    }));

    return NextResponse.json(opportunities);
  } catch (error) {
    console.error("Error fetching plan opportunities:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan opportunities" },
      { status: 500 }
    );
  }
}
