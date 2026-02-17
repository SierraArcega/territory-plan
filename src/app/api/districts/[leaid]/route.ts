import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

// Helper to convert Decimal to number (handles null)
function toNumber(val: Decimal | null | undefined): number | null {
  return val != null ? Number(val) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> }
) {
  try {
    const { leaid } = await params;

    // Single query gets everything - no more separate queries or raw SQL
    const district = await prisma.district.findUnique({
      where: { leaid },
      include: {
        districtTags: {
          include: { tag: true },
        },
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        },
        territoryPlans: {
          select: { planId: true },
        },
      },
    });

    if (!district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // Get centroid coordinates for tether line (PostGIS geometry → lat/lng)
    const centroidResult = await prisma.$queryRaw<
      { lat: number; lng: number }[]
    >`SELECT
  COALESCE(ST_Y(centroid::geometry), ST_Y(point_location::geometry)) as lat,
  COALESCE(ST_X(centroid::geometry), ST_X(point_location::geometry)) as lng
FROM districts WHERE leaid = ${leaid} LIMIT 1`;
    const centroid = centroidResult.length > 0 ? centroidResult[0] : null;

    // Build response - data is now all on the district model
    // Keeping the same response shape for backward compatibility with frontend
    const response = {
      // Core district info
      district: {
        leaid: district.leaid,
        name: district.name,
        stateAbbrev: district.stateAbbrev,
        stateFips: district.stateFips,
        enrollment: district.enrollment,
        lograde: district.lograde,
        higrade: district.higrade,
        phone: district.phone,
        streetLocation: district.streetLocation,
        cityLocation: district.cityLocation,
        stateLocation: district.stateLocation,
        zipLocation: district.zipLocation,
        countyName: district.countyName,
        urbanCentricLocale: district.urbanCentricLocale,
        numberOfSchools: district.numberOfSchools,
        specEdStudents: district.specEdStudents,
        ellStudents: district.ellStudents,
        websiteUrl: district.websiteUrl,
        jobBoardUrl: district.jobBoardUrl,
        centroidLat: centroid ? Number(centroid.lat) : null,
        centroidLng: centroid ? Number(centroid.lng) : null,
        accountType: district.accountType || "district",
      },

      // Fullmind CRM data (now on district)
      fullmindData: district.isCustomer != null ? {
        leaid: district.leaid,
        accountName: district.accountName,
        salesExecutive: district.salesExecutive,
        lmsid: district.lmsid,
        fy25SessionsRevenue: toNumber(district.fy25SessionsRevenue) ?? 0,
        fy25SessionsTake: toNumber(district.fy25SessionsTake) ?? 0,
        fy25SessionsCount: district.fy25SessionsCount ?? 0,
        fy26SessionsRevenue: toNumber(district.fy26SessionsRevenue) ?? 0,
        fy26SessionsTake: toNumber(district.fy26SessionsTake) ?? 0,
        fy26SessionsCount: district.fy26SessionsCount ?? 0,
        fy25ClosedWonOppCount: district.fy25ClosedWonOppCount ?? 0,
        fy25ClosedWonNetBooking: toNumber(district.fy25ClosedWonNetBooking) ?? 0,
        fy25NetInvoicing: toNumber(district.fy25NetInvoicing) ?? 0,
        fy26ClosedWonOppCount: district.fy26ClosedWonOppCount ?? 0,
        fy26ClosedWonNetBooking: toNumber(district.fy26ClosedWonNetBooking) ?? 0,
        fy26NetInvoicing: toNumber(district.fy26NetInvoicing) ?? 0,
        fy26OpenPipelineOppCount: district.fy26OpenPipelineOppCount ?? 0,
        fy26OpenPipeline: toNumber(district.fy26OpenPipeline) ?? 0,
        fy26OpenPipelineWeighted: toNumber(district.fy26OpenPipelineWeighted) ?? 0,
        fy27OpenPipelineOppCount: district.fy27OpenPipelineOppCount ?? 0,
        fy27OpenPipeline: toNumber(district.fy27OpenPipeline) ?? 0,
        fy27OpenPipelineWeighted: toNumber(district.fy27OpenPipelineWeighted) ?? 0,
        isCustomer: district.isCustomer ?? false,
        hasOpenPipeline: district.hasOpenPipeline ?? false,
      } : null,

      // User edits (now on district)
      edits: district.notes != null || district.owner != null ? {
        leaid: district.leaid,
        notes: district.notes,
        owner: district.owner,
        updatedAt: district.notesUpdatedAt?.toISOString() ?? null,
      } : null,

      // Tags (still a relation)
      tags: district.districtTags.map((dt) => ({
        id: dt.tag.id,
        name: dt.tag.name,
        color: dt.tag.color,
      })),

      // Contacts (still a relation)
      contacts: district.contacts.map((c) => ({
        id: c.id,
        leaid: c.leaid,
        name: c.name,
        title: c.title,
        email: c.email,
        phone: c.phone,
        isPrimary: c.isPrimary,
      })),

      // Territory plans (still a relation)
      territoryPlanIds: district.territoryPlans.map((tp) => tp.planId),

      // Education data (now on district)
      // Include if ANY education data exists (finance, staff, poverty, or graduation)
      educationData: (district.financeDataYear != null || district.staffDataYear != null || district.saipeDataYear != null || district.graduationDataYear != null) ? {
        leaid: district.leaid,
        totalRevenue: toNumber(district.totalRevenue),
        federalRevenue: toNumber(district.federalRevenue),
        stateRevenue: toNumber(district.stateRevenue),
        localRevenue: toNumber(district.localRevenue),
        totalExpenditure: toNumber(district.totalExpenditure),
        expenditurePerPupil: toNumber(district.expenditurePerPupil),
        financeDataYear: district.financeDataYear,
        childrenPovertyCount: district.childrenPovertyCount,
        childrenPovertyPercent: toNumber(district.childrenPovertyPercent),
        medianHouseholdIncome: toNumber(district.medianHouseholdIncome),
        saipeDataYear: district.saipeDataYear,
        graduationRateTotal: toNumber(district.graduationRateTotal),
        graduationDataYear: district.graduationDataYear,
        salariesTotal: toNumber(district.salariesTotal),
        salariesInstruction: toNumber(district.salariesInstruction),
        salariesTeachersRegular: toNumber(district.salariesTeachersRegular),
        salariesTeachersSpecialEd: toNumber(district.salariesTeachersSpecialEd),
        salariesTeachersVocational: toNumber(district.salariesTeachersVocational),
        salariesTeachersOther: toNumber(district.salariesTeachersOther),
        salariesSupportAdmin: toNumber(district.salariesSupportAdmin),
        salariesSupportInstructional: toNumber(district.salariesSupportInstructional),
        benefitsTotal: toNumber(district.benefitsTotal),
        teachersFte: toNumber(district.teachersFte),
        teachersElementaryFte: toNumber(district.teachersElementaryFte),
        teachersSecondaryFte: toNumber(district.teachersSecondaryFte),
        adminFte: toNumber(district.adminFte),
        guidanceCounselorsFte: toNumber(district.guidanceCounselorsFte),
        instructionalAidesFte: toNumber(district.instructionalAidesFte),
        supportStaffFte: toNumber(district.supportStaffFte),
        staffTotalFte: toNumber(district.staffTotalFte),
        staffDataYear: district.staffDataYear,
        chronicAbsenteeismCount: district.chronicAbsenteeismCount,
        chronicAbsenteeismRate: toNumber(district.chronicAbsenteeismRate),
        absenteeismDataYear: district.absenteeismDataYear,
      } : null,

      // Demographics (now on district)
      enrollmentDemographics: district.demographicsDataYear != null ? {
        leaid: district.leaid,
        enrollmentWhite: district.enrollmentWhite,
        enrollmentBlack: district.enrollmentBlack,
        enrollmentHispanic: district.enrollmentHispanic,
        enrollmentAsian: district.enrollmentAsian,
        enrollmentAmericanIndian: district.enrollmentAmericanIndian,
        enrollmentPacificIslander: district.enrollmentPacificIslander,
        enrollmentTwoOrMore: district.enrollmentTwoOrMore,
        totalEnrollment: district.totalEnrollment,
        demographicsDataYear: district.demographicsDataYear,
      } : null,

      // Trend & comparison data (computed by ETL)
      trends: district.enrollmentTrend3yr != null || district.staffingTrend3yr != null || district.graduationTrend3yr != null ? {
        swdPct: toNumber(district.swdPct),
        ellPct: toNumber(district.ellPct),
        studentTeacherRatio: toNumber(district.studentTeacherRatio),
        studentStaffRatio: toNumber(district.studentStaffRatio),
        spedStudentTeacherRatio: toNumber(district.spedStudentTeacherRatio),
        enrollmentTrend3yr: toNumber(district.enrollmentTrend3yr),
        staffingTrend3yr: toNumber(district.staffingTrend3yr),
        vacancyPressureSignal: toNumber(district.vacancyPressureSignal),
        swdTrend3yr: toNumber(district.swdTrend3yr),
        ellTrend3yr: toNumber(district.ellTrend3yr),
        absenteeismTrend3yr: toNumber(district.absenteeismTrend3yr),
        graduationTrend3yr: toNumber(district.graduationTrend3yr),
        studentTeacherRatioTrend3yr: toNumber(district.studentTeacherRatioTrend3yr),
        mathProficiencyTrend3yr: toNumber(district.mathProficiencyTrend3yr),
        readProficiencyTrend3yr: toNumber(district.readProficiencyTrend3yr),
        expenditurePpTrend3yr: toNumber(district.expenditurePpTrend3yr),
        absenteeismVsState: toNumber(district.absenteeismVsState),
        graduationVsState: toNumber(district.graduationVsState),
        studentTeacherRatioVsState: toNumber(district.studentTeacherRatioVsState),
        swdPctVsState: toNumber(district.swdPctVsState),
        ellPctVsState: toNumber(district.ellPctVsState),
        mathProficiencyVsState: toNumber(district.mathProficiencyVsState),
        readProficiencyVsState: toNumber(district.readProficiencyVsState),
        expenditurePpVsState: toNumber(district.expenditurePpVsState),
        absenteeismVsNational: toNumber(district.absenteeismVsNational),
        graduationVsNational: toNumber(district.graduationVsNational),
        studentTeacherRatioVsNational: toNumber(district.studentTeacherRatioVsNational),
        swdPctVsNational: toNumber(district.swdPctVsNational),
        ellPctVsNational: toNumber(district.ellPctVsNational),
        mathProficiencyVsNational: toNumber(district.mathProficiencyVsNational),
        readProficiencyVsNational: toNumber(district.readProficiencyVsNational),
        expenditurePpVsNational: toNumber(district.expenditurePpVsNational),
        absenteeismQuartileState: district.absenteeismQuartileState,
        graduationQuartileState: district.graduationQuartileState,
        studentTeacherRatioQuartileState: district.studentTeacherRatioQuartileState,
        swdPctQuartileState: district.swdPctQuartileState,
        ellPctQuartileState: district.ellPctQuartileState,
        mathProficiencyQuartileState: district.mathProficiencyQuartileState,
        readProficiencyQuartileState: district.readProficiencyQuartileState,
        expenditurePpQuartileState: district.expenditurePpQuartileState,
      } : null,
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
