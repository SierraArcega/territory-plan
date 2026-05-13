import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities/[id]
 *
 * Detail-panel data for a single opportunity. Returns the full Opportunity
 * row plus its district relation. Other related lists (sessions /
 * subscriptions / activity links) are intentionally NOT included by default
 * to keep the detail-panel cold load fast — the panel fetches those on a
 * separate query if/when the user opens the relevant sub-tab.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      district: {
        select: {
          leaid: true,
          name: true,
          stateAbbrev: true,
          enrollment: true,
        },
      },
    },
  });

  if (!opp) {
    return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: opp.id,
    name: opp.name,
    schoolYr: opp.schoolYr,
    contractType: opp.contractType,
    state: opp.state,
    stateFips: opp.stateFips,
    salesRepName: opp.salesRepName,
    salesRepEmail: opp.salesRepEmail,
    salesRepId: opp.salesRepId,
    districtName: opp.districtName,
    districtLmsId: opp.districtLmsId,
    districtNcesId: opp.districtNcesId,
    districtLeaId: opp.districtLeaId,
    district: opp.district
      ? {
          leaid: opp.district.leaid,
          name: opp.district.name,
          stateAbbrev: opp.district.stateAbbrev,
          enrollment: opp.district.enrollment,
        }
      : null,
    stage: opp.stage,
    netBookingAmount: opp.netBookingAmount ? Number(opp.netBookingAmount) : null,
    closeDate: opp.closeDate?.toISOString() ?? null,
    createdAt: opp.createdAt?.toISOString() ?? null,
    contractThrough: opp.contractThrough,
    fundingThrough: opp.fundingThrough,
    paymentType: opp.paymentType,
    paymentTerms: opp.paymentTerms,
    leadSource: opp.leadSource,
    invoiced: opp.invoiced ? Number(opp.invoiced) : null,
    credited: opp.credited ? Number(opp.credited) : null,
    completedRevenue: opp.completedRevenue ? Number(opp.completedRevenue) : null,
    completedTake: opp.completedTake ? Number(opp.completedTake) : null,
    scheduledSessions: opp.scheduledSessions,
    scheduledRevenue: opp.scheduledRevenue ? Number(opp.scheduledRevenue) : null,
    scheduledTake: opp.scheduledTake ? Number(opp.scheduledTake) : null,
    totalRevenue: opp.totalRevenue ? Number(opp.totalRevenue) : null,
    totalTake: opp.totalTake ? Number(opp.totalTake) : null,
    averageTakeRate: opp.averageTakeRate ? Number(opp.averageTakeRate) : null,
    serviceTypes: opp.serviceTypes,
    minimumPurchaseAmount: opp.minimumPurchaseAmount
      ? Number(opp.minimumPurchaseAmount)
      : null,
    maximumBudget: opp.maximumBudget ? Number(opp.maximumBudget) : null,
    detailsLink: opp.detailsLink,
    stageHistory: opp.stageHistory,
    startDate: opp.startDate?.toISOString() ?? null,
    expiration: opp.expiration?.toISOString() ?? null,
  });
}
