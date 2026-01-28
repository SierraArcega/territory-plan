import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;

    const district = await prisma.district.findUnique({
      where: { leaid },
      include: {
        fullmindData: true,
        edits: true,
        districtTags: {
          include: {
            tag: true,
          },
        },
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        },
      },
    });

    if (!district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // Transform to API response format
    const response = {
      district: {
        leaid: district.leaid,
        name: district.name,
        stateAbbrev: district.stateAbbrev,
        stateFips: district.stateFips,
        enrollment: district.enrollment,
        lograde: district.lograde,
        higrade: district.higrade,
      },
      fullmindData: district.fullmindData
        ? {
            leaid: district.fullmindData.leaid,
            accountName: district.fullmindData.accountName,
            salesExecutive: district.fullmindData.salesExecutive,
            lmsid: district.fullmindData.lmsid,
            // FY25 Sessions
            fy25SessionsRevenue: Number(district.fullmindData.fy25SessionsRevenue),
            fy25SessionsTake: Number(district.fullmindData.fy25SessionsTake),
            fy25SessionsCount: district.fullmindData.fy25SessionsCount,
            // FY26 Sessions
            fy26SessionsRevenue: Number(district.fullmindData.fy26SessionsRevenue),
            fy26SessionsTake: Number(district.fullmindData.fy26SessionsTake),
            fy26SessionsCount: district.fullmindData.fy26SessionsCount,
            // FY25 Bookings
            fy25ClosedWonOppCount: district.fullmindData.fy25ClosedWonOppCount,
            fy25ClosedWonNetBooking: Number(district.fullmindData.fy25ClosedWonNetBooking),
            fy25NetInvoicing: Number(district.fullmindData.fy25NetInvoicing),
            // FY26 Bookings
            fy26ClosedWonOppCount: district.fullmindData.fy26ClosedWonOppCount,
            fy26ClosedWonNetBooking: Number(district.fullmindData.fy26ClosedWonNetBooking),
            fy26NetInvoicing: Number(district.fullmindData.fy26NetInvoicing),
            // FY26 Pipeline
            fy26OpenPipelineOppCount: district.fullmindData.fy26OpenPipelineOppCount,
            fy26OpenPipeline: Number(district.fullmindData.fy26OpenPipeline),
            fy26OpenPipelineWeighted: Number(district.fullmindData.fy26OpenPipelineWeighted),
            // FY27 Pipeline
            fy27OpenPipelineOppCount: district.fullmindData.fy27OpenPipelineOppCount,
            fy27OpenPipeline: Number(district.fullmindData.fy27OpenPipeline),
            fy27OpenPipelineWeighted: Number(district.fullmindData.fy27OpenPipelineWeighted),
            // Computed
            isCustomer: district.fullmindData.isCustomer,
            hasOpenPipeline: district.fullmindData.hasOpenPipeline,
          }
        : null,
      edits: district.edits
        ? {
            leaid: district.edits.leaid,
            notes: district.edits.notes,
            owner: district.edits.owner,
            updatedAt: district.edits.updatedAt.toISOString(),
          }
        : null,
      tags: district.districtTags.map((dt: { tag: { id: number; name: string; color: string } }) => ({
        id: dt.tag.id,
        name: dt.tag.name,
        color: dt.tag.color,
      })),
      contacts: district.contacts.map((c: { id: number; leaid: string; name: string; title: string | null; email: string | null; phone: string | null; isPrimary: boolean }) => ({
        id: c.id,
        leaid: c.leaid,
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        isPrimary: c.isPrimary,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching district detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch district" },
      { status: 500 }
    );
  }
}
