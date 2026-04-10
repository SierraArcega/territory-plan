import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Helper to convert Decimal to number
function toNumber(val: Decimal | null | undefined): number | null {
  return val != null ? Number(val) : null;
}

// State names mapping
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  AS: "American Samoa",
  GU: "Guam",
  MP: "Northern Mariana Islands",
  PR: "Puerto Rico",
  VI: "Virgin Islands",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const stateCode = code.toUpperCase();
    const user = await getUser();

    // Try to find state in the states table first
    const state = await prisma.state.findUnique({
      where: { abbrev: stateCode },
      include: {
        territoryOwnerUser: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // If state exists in the states table, fetch related data and return
    if (state) {
      const [plans, assessments] = await Promise.all([
        prisma.territoryPlan.findMany({
          where: {
            states: { some: { stateFips: state.fips } },
            status: { not: "archived" },
            userId: user?.id,
          },
          orderBy: { updatedAt: "desc" },
          include: {
            ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
            _count: { select: { districts: true } },
          },
        }),
        prisma.stateAssessment.findMany({
          where: { stateFips: state.fips },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            subjects: true,
            grades: true,
            testingWindow: true,
            vendor: true,
            notes: true,
          },
        }),
      ]);

      return NextResponse.json({
        code: state.abbrev,
        fips: state.fips,
        name: state.name,
        aggregates: {
          totalDistricts: state.totalDistricts,
          totalEnrollment: state.totalEnrollment,
          totalSchools: state.totalSchools,
          totalCustomers: state.totalCustomers,
          totalWithPipeline: state.totalWithPipeline,
          totalPipelineValue: toNumber(state.totalPipelineValue),
          avgExpenditurePerPupil: toNumber(state.avgExpenditurePerPupil),
          avgGraduationRate: toNumber(state.avgGraduationRate),
          avgPovertyRate: toNumber(state.avgPovertyRate),
        },
        territoryOwner: state.territoryOwnerUser
          ? { id: state.territoryOwnerUser.id, fullName: state.territoryOwnerUser.fullName, avatarUrl: state.territoryOwnerUser.avatarUrl }
          : state.territoryOwner
          ? { id: null, fullName: state.territoryOwner, avatarUrl: null }
          : null,
        notes: state.notes,
        assessments,
        territoryPlans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          owner: p.ownerUser
            ? { id: p.ownerUser.id, fullName: p.ownerUser.fullName, avatarUrl: p.ownerUser.avatarUrl }
            : null,
          color: p.color,
          status: p.status,
          districtCount: p._count.districts,
        })),
      });
    }

    // Fallback: compute aggregates from districts if state not in states table
    const [aggregates, customerCount, pipelineCount, pipelineAgg] = await Promise.all([
      prisma.district.aggregate({
        where: { stateAbbrev: stateCode },
        _count: { leaid: true },
        _sum: {
          enrollment: true,
          numberOfSchools: true,
        },
        _avg: {
          expenditurePerPupil: true,
          graduationRateTotal: true,
          childrenPovertyPercent: true,
        },
      }),
      prisma.district.count({
        where: { stateAbbrev: stateCode, isCustomer: true },
      }),
      prisma.district.count({
        where: { stateAbbrev: stateCode, hasOpenPipeline: true },
      }),
      prisma.$queryRaw<[{ fy26_pipeline: number; fy27_pipeline: number }]>`
        SELECT
          COALESCE(SUM(CASE WHEN df.fiscal_year = 'FY26' THEN df.open_pipeline END), 0)::float AS fy26_pipeline,
          COALESCE(SUM(CASE WHEN df.fiscal_year = 'FY27' THEN df.open_pipeline END), 0)::float AS fy27_pipeline
        FROM district_financials df
        JOIN districts d ON d.leaid = df.leaid
        WHERE d.state_abbrev = ${stateCode}
          AND df.vendor = 'fullmind'
          AND df.fiscal_year IN ('FY26', 'FY27')
      `,
    ]);

    // Get territory plans and assessments for this state
    const districtLeaids = await prisma.district.findMany({
      where: { stateAbbrev: stateCode },
      select: { leaid: true, stateFips: true },
    });

    const leaidList = districtLeaids.map((d) => d.leaid);

    const plans = leaidList.length > 0
      ? await prisma.territoryPlan.findMany({
          where: {
            status: { not: "archived" },
            userId: user?.id,
            districts: {
              some: { districtLeaid: { in: leaidList } },
            },
          },
          include: {
            ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
            _count: { select: { districts: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        })
      : [];

    const pipelineValue = (pipelineAgg[0]?.fy26_pipeline ?? 0) +
      (pipelineAgg[0]?.fy27_pipeline ?? 0);

    // Look up assessments using FIPS from first district
    const fallbackFips = districtLeaids[0]?.stateFips;
    const assessments = fallbackFips
      ? await prisma.stateAssessment.findMany({
          where: { stateFips: fallbackFips },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            subjects: true,
            grades: true,
            testingWindow: true,
            vendor: true,
            notes: true,
          },
        })
      : [];

    return NextResponse.json({
      code: stateCode,
      fips: fallbackFips || null,
      name: STATE_NAMES[stateCode] || stateCode,
      aggregates: {
        totalDistricts: aggregates._count.leaid,
        totalEnrollment: aggregates._sum.enrollment,
        totalSchools: aggregates._sum.numberOfSchools,
        totalCustomers: customerCount,
        totalWithPipeline: pipelineCount,
        totalPipelineValue: pipelineValue,
        avgExpenditurePerPupil: toNumber(aggregates._avg.expenditurePerPupil),
        avgGraduationRate: toNumber(aggregates._avg.graduationRateTotal),
        avgPovertyRate: toNumber(aggregates._avg.childrenPovertyPercent),
      },
      territoryOwner: null,
      notes: null,
      assessments,
      territoryPlans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        owner: p.ownerUser
          ? { id: p.ownerUser.id, fullName: p.ownerUser.fullName, avatarUrl: p.ownerUser.avatarUrl }
          : null,
        color: p.color,
        status: p.status,
        districtCount: p._count.districts,
      })),
    });
  } catch (error) {
    console.error("Error fetching state detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch state", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const stateCode = code.toUpperCase();
    const body = await request.json();
    const { notes, territoryOwnerId } = body;

    // Check if state exists
    let state = await prisma.state.findUnique({
      where: { abbrev: stateCode },
      include: {
        territoryOwnerUser: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // Get the state FIPS code from districts if state doesn't exist
    if (!state) {
      const district = await prisma.district.findFirst({
        where: { stateAbbrev: stateCode },
        select: { stateFips: true },
      });

      if (!district) {
        return NextResponse.json(
          { error: "State not found" },
          { status: 404 }
        );
      }

      // Create the state record
      state = await prisma.state.create({
        data: {
          fips: district.stateFips,
          abbrev: stateCode,
          name: STATE_NAMES[stateCode] || stateCode,
          notes: notes ?? undefined,
          territoryOwnerId: territoryOwnerId ?? undefined,
        },
        include: {
          territoryOwnerUser: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });
    } else {
      // Update existing state
      state = await prisma.state.update({
        where: { abbrev: stateCode },
        data: {
          ...(notes !== undefined && { notes }),
          ...(territoryOwnerId !== undefined && { territoryOwnerId: territoryOwnerId || null }),
        },
        include: {
          territoryOwnerUser: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      });
    }

    return NextResponse.json({
      code: state.abbrev,
      notes: state.notes,
      territoryOwner: state.territoryOwnerUser
        ? { id: state.territoryOwnerUser.id, fullName: state.territoryOwnerUser.fullName, avatarUrl: state.territoryOwnerUser.avatarUrl }
        : null,
    });
  } catch (error) {
    console.error("Error updating state:", error);
    return NextResponse.json(
      { error: "Failed to update state" },
      { status: 500 }
    );
  }
}
