import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

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

    // Try to find state in the states table first
    const state = await prisma.state.findUnique({
      where: { abbrev: stateCode },
    });

    // If state exists in the states table, fetch related data and return
    if (state) {
      const [goals, plans] = await Promise.all([
        prisma.stateGoal.findMany({
          where: { stateFips: state.fips },
          orderBy: { fiscalYear: "desc" },
        }),
        prisma.territoryPlan.findMany({
          where: {
            stateFips: state.fips,
            status: { not: "archived" },
          },
          orderBy: { updatedAt: "desc" },
          include: {
            _count: { select: { districts: true } },
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
        territoryOwner: state.territoryOwner,
        notes: state.notes,
        goals: goals.map((g) => ({
          id: g.id,
          fiscalYear: g.fiscalYear,
          revenueGoal: toNumber(g.revenueGoal),
          districtCountGoal: g.districtCountGoal,
        })),
        territoryPlans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          owner: p.owner,
          color: p.color,
          status: p.status,
          districtCount: p._count.districts,
        })),
      });
    }

    // Fallback: compute aggregates from districts if state not in states table
    const [aggregates, customerCount, pipelineCount] = await Promise.all([
      prisma.district.aggregate({
        where: { stateAbbrev: stateCode },
        _count: { leaid: true },
        _sum: {
          enrollment: true,
          numberOfSchools: true,
          fy26OpenPipeline: true,
          fy27OpenPipeline: true,
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
    ]);

    // Get territory plans that include districts from this state
    const districtLeaids = await prisma.district.findMany({
      where: { stateAbbrev: stateCode },
      select: { leaid: true },
    });

    const leaidList = districtLeaids.map((d) => d.leaid);

    const plans = leaidList.length > 0
      ? await prisma.territoryPlan.findMany({
          where: {
            status: { not: "archived" },
            districts: {
              some: { districtLeaid: { in: leaidList } },
            },
          },
          include: {
            _count: { select: { districts: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        })
      : [];

    const pipelineValue = (toNumber(aggregates._sum.fy26OpenPipeline) ?? 0) +
      (toNumber(aggregates._sum.fy27OpenPipeline) ?? 0);

    return NextResponse.json({
      code: stateCode,
      fips: null,
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
      goals: [],
      territoryPlans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        owner: p.owner,
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
    const { notes, territoryOwner } = body;

    // Check if state exists
    let state = await prisma.state.findUnique({
      where: { abbrev: stateCode },
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
          territoryOwner: territoryOwner ?? undefined,
        },
      });
    } else {
      // Update existing state
      state = await prisma.state.update({
        where: { abbrev: stateCode },
        data: {
          ...(notes !== undefined && { notes }),
          ...(territoryOwner !== undefined && { territoryOwner }),
        },
      });
    }

    return NextResponse.json({
      code: state.abbrev,
      notes: state.notes,
      territoryOwner: state.territoryOwner,
    });
  } catch (error) {
    console.error("Error updating state:", error);
    return NextResponse.json(
      { error: "Failed to update state" },
      { status: 500 }
    );
  }
}
