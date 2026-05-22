import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/rfps/[id]
 *
 * Detail-panel data for a single RFP. Includes the description/ai_summary
 * + classification fields + the matched district relation. The list
 * endpoint already returns the raw Rfp row, but the detail panel needs
 * the matched district name (joined here) rather than the raw leaid.
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
  const idNum = parseInt(id, 10);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rfp = await prisma.rfp.findUnique({
    where: { id: idNum },
    include: {
      district: {
        select: { leaid: true, name: true, stateAbbrev: true },
      },
    },
  });

  if (!rfp) {
    return NextResponse.json({ error: "RFP not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: rfp.id,
    externalId: rfp.externalId,
    versionKey: rfp.versionKey,
    source: rfp.source,
    title: rfp.title,
    solicitationNumber: rfp.solicitationNumber,
    oppType: rfp.oppType,
    description: rfp.description,
    aiSummary: rfp.aiSummary,
    agencyKey: rfp.agencyKey,
    agencyName: rfp.agencyName,
    agencyPath: rfp.agencyPath,
    stateAbbrev: rfp.stateAbbrev,
    stateFips: rfp.stateFips,
    popCity: rfp.popCity,
    popZip: rfp.popZip,
    leaid: rfp.leaid,
    district: rfp.district
      ? {
          leaid: rfp.district.leaid,
          name: rfp.district.name,
          stateAbbrev: rfp.district.stateAbbrev,
        }
      : null,
    naicsCode: rfp.naicsCode,
    pscCode: rfp.pscCode,
    setAside: rfp.setAside,
    valueLow: rfp.valueLow ? Number(rfp.valueLow) : null,
    valueHigh: rfp.valueHigh ? Number(rfp.valueHigh) : null,
    primaryContactName: rfp.primaryContactName,
    primaryContactEmail: rfp.primaryContactEmail,
    primaryContactPhone: rfp.primaryContactPhone,
    postedDate: rfp.postedDate?.toISOString() ?? null,
    dueDate: rfp.dueDate?.toISOString() ?? null,
    capturedDate: rfp.capturedDate.toISOString(),
    highergovUrl: rfp.highergovUrl,
    sourceUrl: rfp.sourceUrl,
    fullmindRelevance: rfp.fullmindRelevance,
    keywords: rfp.keywords,
    fundingSources: rfp.fundingSources,
    setAsideType: rfp.setAsideType,
    inStateOnly: rfp.inStateOnly,
    cooperativeEligible: rfp.cooperativeEligible,
    requiresW9State: rfp.requiresW9State,
    classifiedAt: rfp.classifiedAt?.toISOString() ?? null,
    districtPipelineState: rfp.districtPipelineState,
    isNew: rfp.isNew,
    isUrgent: rfp.isUrgent,
    signalsRefreshedAt: rfp.signalsRefreshedAt?.toISOString() ?? null,
    status: rfp.status,
    firstSeenAt: rfp.firstSeenAt.toISOString(),
    lastSeenAt: rfp.lastSeenAt.toISOString(),
  });
}
