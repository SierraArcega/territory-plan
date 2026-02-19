import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toNum(val: Decimal | null | undefined): number {
  return val != null ? Number(val) : 0;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params;
    const user = await getUser();

    // Fetch plan with its districts and states
    const plan = await prisma.territoryPlan.findUnique({
      where: { id: planId, userId: user?.id },
      include: {
        districts: {
          select: { districtLeaid: true },
        },
        states: {
          select: {
            stateFips: true,
            state: { select: { abbrev: true, name: true } },
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const planLeaids = plan.districts.map((d) => d.districtLeaid);
    const stateAbbrevs = plan.states.map((s) => s.state.abbrev);

    // For each state, aggregate data for plan districts AND all state districts
    const stateData = await Promise.all(
      stateAbbrevs.map(async (abbrev) => {
        const stateName = plan.states.find((s) => s.state.abbrev === abbrev)?.state.name || abbrev;

        // All districts in this state
        const [stateAgg, stateCustomerCount, statePipelineCount] = await Promise.all([
          prisma.district.aggregate({
            where: { stateAbbrev: abbrev },
            _count: { leaid: true },
            _sum: {
              enrollment: true,
              fy25ClosedWonNetBooking: true,
              fy25NetInvoicing: true,
              fy26ClosedWonNetBooking: true,
              fy26NetInvoicing: true,
              fy26OpenPipeline: true,
              fy27OpenPipeline: true,
            },
          }),
          prisma.district.count({
            where: { stateAbbrev: abbrev, isCustomer: true },
          }),
          prisma.district.count({
            where: { stateAbbrev: abbrev, hasOpenPipeline: true },
          }),
        ]);

        // Plan districts in this state only
        const planLeaidsInState = await prisma.district.findMany({
          where: { stateAbbrev: abbrev, leaid: { in: planLeaids } },
          select: { leaid: true },
        });
        const planLeaidList = planLeaidsInState.map((d) => d.leaid);

        const [planAgg, planCustomerCount] = planLeaidList.length > 0
          ? await Promise.all([
              prisma.district.aggregate({
                where: { leaid: { in: planLeaidList } },
                _sum: {
                  fy25ClosedWonNetBooking: true,
                  fy25NetInvoicing: true,
                  fy26ClosedWonNetBooking: true,
                  fy26NetInvoicing: true,
                  fy26OpenPipeline: true,
                  fy27OpenPipeline: true,
                },
              }),
              prisma.district.count({
                where: { leaid: { in: planLeaidList }, isCustomer: true },
              }),
            ])
          : [null, 0];

        // Top 3 plan districts by FY26 net invoicing
        const topDistricts = planLeaidList.length > 0
          ? await prisma.district.findMany({
              where: { leaid: { in: planLeaidList }, fy26NetInvoicing: { not: null } },
              orderBy: { fy26NetInvoicing: "desc" },
              take: 3,
              select: {
                leaid: true,
                name: true,
                fy26NetInvoicing: true,
              },
            })
          : [];

        return {
          abbrev,
          name: stateName,
          state: {
            totalDistricts: stateAgg._count.leaid,
            totalCustomers: stateCustomerCount,
            totalWithPipeline: statePipelineCount,
            fy25ClosedWon: toNum(stateAgg._sum.fy25ClosedWonNetBooking),
            fy25Invoicing: toNum(stateAgg._sum.fy25NetInvoicing),
            fy26ClosedWon: toNum(stateAgg._sum.fy26ClosedWonNetBooking),
            fy26Invoicing: toNum(stateAgg._sum.fy26NetInvoicing),
            fy26Pipeline: toNum(stateAgg._sum.fy26OpenPipeline),
            fy27Pipeline: toNum(stateAgg._sum.fy27OpenPipeline),
          },
          plan: {
            districtCount: planLeaidList.length,
            customerCount: planCustomerCount,
            fy25ClosedWon: toNum(planAgg?._sum?.fy25ClosedWonNetBooking),
            fy25Invoicing: toNum(planAgg?._sum?.fy25NetInvoicing),
            fy26ClosedWon: toNum(planAgg?._sum?.fy26ClosedWonNetBooking),
            fy26Invoicing: toNum(planAgg?._sum?.fy26NetInvoicing),
            fy26Pipeline: toNum(planAgg?._sum?.fy26OpenPipeline),
            fy27Pipeline: toNum(planAgg?._sum?.fy27OpenPipeline),
          },
          topDistricts: topDistricts.map((d) => ({
            leaid: d.leaid,
            name: d.name,
            fy26Invoicing: toNum(d.fy26NetInvoicing),
          })),
        };
      })
    );

    return NextResponse.json({
      planId: plan.id,
      planName: plan.name ?? null,
      fiscalYear: plan.fiscalYear,
      states: stateData,
    });
  } catch (error) {
    console.error("Error fetching focus mode data:", error);
    return NextResponse.json(
      { error: "Failed to fetch focus mode data" },
      { status: 500 }
    );
  }
}
