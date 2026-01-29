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

    // Fetch education data separately (tables may not exist yet)
    let educationData = null;
    let enrollmentDemographics = null;
    try {
      const eduResult = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM district_education_data WHERE leaid = ${leaid} LIMIT 1
      `;
      if (eduResult.length > 0) {
        const row = eduResult[0];
        educationData = {
          leaid: row.leaid as string,
          totalRevenue: row.total_revenue ? Number(row.total_revenue) : null,
          federalRevenue: row.federal_revenue ? Number(row.federal_revenue) : null,
          stateRevenue: row.state_revenue ? Number(row.state_revenue) : null,
          localRevenue: row.local_revenue ? Number(row.local_revenue) : null,
          totalExpenditure: row.total_expenditure ? Number(row.total_expenditure) : null,
          expenditurePerPupil: row.expenditure_per_pupil ? Number(row.expenditure_per_pupil) : null,
          financeDataYear: row.finance_data_year as number | null,
          childrenPovertyCount: row.children_poverty_count as number | null,
          childrenPovertyPercent: row.children_poverty_percent ? Number(row.children_poverty_percent) : null,
          medianHouseholdIncome: row.median_household_income ? Number(row.median_household_income) : null,
          saipeDataYear: row.saipe_data_year as number | null,
          graduationRateTotal: row.graduation_rate_total ? Number(row.graduation_rate_total) : null,
          graduationRateMale: row.graduation_rate_male ? Number(row.graduation_rate_male) : null,
          graduationRateFemale: row.graduation_rate_female ? Number(row.graduation_rate_female) : null,
          graduationDataYear: row.graduation_data_year as number | null,
        };
      }

      const demoResult = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT * FROM district_enrollment_demographics WHERE leaid = ${leaid} LIMIT 1
      `;
      if (demoResult.length > 0) {
        const row = demoResult[0];
        enrollmentDemographics = {
          leaid: row.leaid as string,
          enrollmentWhite: row.enrollment_white as number | null,
          enrollmentBlack: row.enrollment_black as number | null,
          enrollmentHispanic: row.enrollment_hispanic as number | null,
          enrollmentAsian: row.enrollment_asian as number | null,
          enrollmentAmericanIndian: row.enrollment_american_indian as number | null,
          enrollmentPacificIslander: row.enrollment_pacific_islander as number | null,
          enrollmentTwoOrMore: row.enrollment_two_or_more as number | null,
          totalEnrollment: row.total_enrollment as number | null,
          demographicsDataYear: row.demographics_data_year as number | null,
        };
      }
    } catch {
      // Tables don't exist yet - that's okay, just return null
    }

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
        // Contact info
        phone: district.phone,
        streetLocation: district.streetLocation,
        cityLocation: district.cityLocation,
        stateLocation: district.stateLocation,
        zipLocation: district.zipLocation,
        // Geographic context
        countyName: district.countyName,
        urbanCentricLocale: district.urbanCentricLocale,
        // Additional characteristics
        numberOfSchools: district.numberOfSchools,
        specEdStudents: district.specEdStudents,
        ellStudents: district.ellStudents,
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
      educationData,
      enrollmentDemographics,
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
