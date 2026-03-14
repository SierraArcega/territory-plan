// GET /api/team-progress — Team progress dashboard data
// Combines territory plan targets with opportunity actuals to show
// how the team is performing against revenue targets by category.
//
// Categories are derived from district revenue history:
//   Renewal:      min(currentRev, priorRev) for returning districts
//   Expansion:    max(0, currentRev - priorRev) for returning districts
//   Winback:      currentRev for districts with no prior year rev but had 2-years-ago rev
//   New Business: currentRev for brand new districts (no prior or 2-years-ago rev)

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";

export const dynamic = "force-dynamic";

interface RawDistrictRevenue {
  district_lea_id: string;
  total_revenue: number;
  total_take: number;
}

interface RawOpportunity {
  id: string;
  name: string;
  stage: string;
  contract_type: string | null;
  net_booking_amount: number;
  total_revenue: number;
  total_take: number;
  district_lea_id: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fiscalYear = parseInt(searchParams.get("fiscalYear") || "2026", 10);

    if (fiscalYear < 2024 || fiscalYear > 2030) {
      return NextResponse.json({ error: "fiscalYear must be between 2024 and 2030" }, { status: 400 });
    }

    const currentSchoolYr = fiscalYearToSchoolYear(fiscalYear);
    const priorSchoolYr = fiscalYearToSchoolYear(fiscalYear - 1);
    const twoYearsAgoSchoolYr = fiscalYearToSchoolYear(fiscalYear - 2);

    // 1. Fetch all territory plans with districts and targets
    const plans = await prisma.territoryPlan.findMany({
      where: { fiscalYear },
      orderBy: { updatedAt: "desc" },
      include: {
        ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
        districts: {
          select: {
            districtLeaid: true,
            renewalTarget: true,
            expansionTarget: true,
            winbackTarget: true,
            newBusinessTarget: true,
            district: {
              select: { name: true, stateAbbrev: true },
            },
          },
        },
      },
    });

    // Collect all district IDs across all plans
    const allPlanDistrictIds = new Set<string>();
    for (const plan of plans) {
      for (const d of plan.districts) {
        allPlanDistrictIds.add(d.districtLeaid);
      }
    }

    // 2. Batch query district revenue for 3 school years
    let currentRevRows: RawDistrictRevenue[] = [];
    let priorRevRows: RawDistrictRevenue[] = [];
    let twoYearsAgoRevRows: RawDistrictRevenue[] = [];
    let currentOpps: RawOpportunity[] = [];

    try {
      [currentRevRows, priorRevRows, twoYearsAgoRevRows, currentOpps] = await Promise.all([
        // Current year revenue per district (all districts, not just plan districts)
        prisma.$queryRaw<RawDistrictRevenue[]>`
          SELECT district_lea_id, COALESCE(SUM(total_revenue), 0) AS total_revenue, COALESCE(SUM(total_take), 0) AS total_take
          FROM district_opportunity_actuals
          WHERE school_yr = ${currentSchoolYr}
          GROUP BY district_lea_id
        `,
        // Prior year revenue per district
        prisma.$queryRaw<RawDistrictRevenue[]>`
          SELECT district_lea_id, COALESCE(SUM(total_revenue), 0) AS total_revenue
          FROM district_opportunity_actuals
          WHERE school_yr = ${priorSchoolYr}
          GROUP BY district_lea_id
        `,
        // Two-years-ago revenue per district
        prisma.$queryRaw<RawDistrictRevenue[]>`
          SELECT district_lea_id, COALESCE(SUM(total_revenue), 0) AS total_revenue
          FROM district_opportunity_actuals
          WHERE school_yr = ${twoYearsAgoSchoolYr}
          GROUP BY district_lea_id
        `,
        // Individual opportunities for current FY (for drill-down)
        prisma.$queryRaw<RawOpportunity[]>`
          SELECT id, name, stage, contract_type,
                 COALESCE(net_booking_amount, 0) AS net_booking_amount,
                 COALESCE(total_revenue, 0) AS total_revenue,
                 COALESCE(total_take, 0) AS total_take,
                 district_lea_id
          FROM opportunities
          WHERE school_yr = ${currentSchoolYr}
            AND district_lea_id IS NOT NULL
          ORDER BY total_revenue DESC
        `,
      ]);
    } catch {
      // Materialized view or table doesn't exist yet — continue with empty data
    }

    // Build lookup maps
    const currentRevByDistrict = new Map(currentRevRows.map((r) => [r.district_lea_id, { revenue: Number(r.total_revenue) || 0, take: Number(r.total_take) || 0 }]));
    const priorRevByDistrict = new Map(priorRevRows.map((r) => [r.district_lea_id, Number(r.total_revenue)]));
    const twoYearsAgoRevByDistrict = new Map(twoYearsAgoRevRows.map((r) => [r.district_lea_id, Number(r.total_revenue)]));

    // Group opportunities by district
    const oppsByDistrict = new Map<string, RawOpportunity[]>();
    for (const opp of currentOpps) {
      const list = oppsByDistrict.get(opp.district_lea_id) || [];
      list.push(opp);
      oppsByDistrict.set(opp.district_lea_id, list);
    }

    // 3. Classify each district and build plan-level data
    const teamTotals = {
      renewal: { target: 0, actual: 0 },
      expansion: { target: 0, actual: 0 },
      winback: { target: 0, actual: 0 },
      newBusiness: { target: 0, actual: 0 },
    };
    let teamTotalTake = 0;

    const planResults = plans.map((plan) => {
      const planTotals = {
        renewal: { target: 0, actual: 0 },
        expansion: { target: 0, actual: 0 },
        winback: { target: 0, actual: 0 },
        newBusiness: { target: 0, actual: 0 },
      };
      let planTake = 0;

      const districts = plan.districts.map((pd) => {
        const leaid = pd.districtLeaid;
        const currentData = currentRevByDistrict.get(leaid) || { revenue: 0, take: 0 };
        const currentRev = currentData.revenue;
        const currentTake = currentData.take;
        const priorRev = priorRevByDistrict.get(leaid) || 0;
        const twoYearsAgoRev = twoYearsAgoRevByDistrict.get(leaid) || 0;

        // Classify based on revenue history
        let renewalActual = 0;
        let expansionActual = 0;
        let winbackActual = 0;
        let newBusinessActual = 0;
        let category: string;

        if (priorRev > 0) {
          // Returning district — split into renewal + expansion
          renewalActual = Math.min(currentRev, priorRev);
          expansionActual = Math.max(0, currentRev - priorRev);
          category = expansionActual > 0 ? "renewal+expansion" : "renewal";
        } else if (twoYearsAgoRev > 0) {
          // Winback — no prior year but had 2 years ago
          winbackActual = currentRev;
          category = "winback";
        } else {
          // New business — never had revenue
          newBusinessActual = currentRev;
          category = "new_business";
        }

        // Targets
        const renewalTarget = Number(pd.renewalTarget ?? 0);
        const expansionTarget = Number(pd.expansionTarget ?? 0);
        const winbackTarget = Number(pd.winbackTarget ?? 0);
        const newBusinessTarget = Number(pd.newBusinessTarget ?? 0);

        // Accumulate plan totals
        planTotals.renewal.target += renewalTarget;
        planTotals.renewal.actual += renewalActual;
        planTotals.expansion.target += expansionTarget;
        planTotals.expansion.actual += expansionActual;
        planTotals.winback.target += winbackTarget;
        planTotals.winback.actual += winbackActual;
        planTotals.newBusiness.target += newBusinessTarget;
        planTotals.newBusiness.actual += newBusinessActual;
        planTake += currentTake;

        // Opportunities for this district
        const districtOpps = (oppsByDistrict.get(leaid) || []).map((o) => ({
          id: o.id,
          name: o.name || "Unnamed",
          stage: o.stage || "Unknown",
          contractType: o.contract_type,
          netBookingAmount: Number(o.net_booking_amount),
          totalRevenue: Number(o.total_revenue),
          totalTake: Number(o.total_take),
        }));

        return {
          leaid,
          name: pd.district.name,
          stateAbbrev: pd.district.stateAbbrev,
          category,
          renewalActual,
          expansionActual,
          winbackActual,
          newBusinessActual,
          renewalTarget,
          expansionTarget,
          winbackTarget,
          newBusinessTarget,
          currentRevenue: currentRev,
          currentTake: currentTake,
          priorRevenue: priorRev,
          opportunities: districtOpps,
        };
      });

      // Accumulate team totals
      teamTotals.renewal.target += planTotals.renewal.target;
      teamTotals.renewal.actual += planTotals.renewal.actual;
      teamTotals.expansion.target += planTotals.expansion.target;
      teamTotals.expansion.actual += planTotals.expansion.actual;
      teamTotals.winback.target += planTotals.winback.target;
      teamTotals.winback.actual += planTotals.winback.actual;
      teamTotals.newBusiness.target += planTotals.newBusiness.target;
      teamTotals.newBusiness.actual += planTotals.newBusiness.actual;
      teamTotalTake += planTake;

      const totalTarget =
        planTotals.renewal.target + planTotals.expansion.target +
        planTotals.winback.target + planTotals.newBusiness.target;
      const totalActual =
        planTotals.renewal.actual + planTotals.expansion.actual +
        planTotals.winback.actual + planTotals.newBusiness.actual;

      return {
        id: plan.id,
        name: plan.name,
        color: plan.color,
        owner: plan.ownerUser
          ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
          : null,
        districtCount: plan.districts.length,
        renewal: planTotals.renewal,
        expansion: planTotals.expansion,
        winback: planTotals.winback,
        newBusiness: planTotals.newBusiness,
        total: { target: totalTarget, actual: totalActual },
        totalTake: planTake,
        districts,
      };
    });

    // 4. Find unmapped districts — districts with current revenue NOT in any plan
    const unmappedDistricts: Array<{
      leaid: string;
      name: string;
      stateAbbrev: string | null;
      currentRevenue: number;
      currentTake: number;
      opportunities: Array<{
        id: string;
        name: string;
        stage: string;
        contractType: string | null;
        netBookingAmount: number;
        totalRevenue: number;
        totalTake: number;
      }>;
    }> = [];

    const unmappedLeaIds: string[] = [];
    for (const [leaid, data] of currentRevByDistrict) {
      if (data.revenue > 0 && !allPlanDistrictIds.has(leaid)) {
        unmappedLeaIds.push(leaid);
      }
    }

    if (unmappedLeaIds.length > 0) {
      // Fetch district names for unmapped districts
      const unmappedDistrictInfo = await prisma.district.findMany({
        where: { leaid: { in: unmappedLeaIds } },
        select: { leaid: true, name: true, stateAbbrev: true },
      });

      const nameMap = new Map(unmappedDistrictInfo.map((d) => [d.leaid, d]));

      for (const leaid of unmappedLeaIds) {
        const info = nameMap.get(leaid);
        const distData = currentRevByDistrict.get(leaid) || { revenue: 0, take: 0 };
        const districtOpps = (oppsByDistrict.get(leaid) || []).map((o) => ({
          id: o.id,
          name: o.name || "Unnamed",
          stage: o.stage || "Unknown",
          contractType: o.contract_type,
          netBookingAmount: Number(o.net_booking_amount),
          totalRevenue: Number(o.total_revenue),
          totalTake: Number(o.total_take),
        }));

        unmappedDistricts.push({
          leaid,
          name: info?.name || leaid,
          stateAbbrev: info?.stateAbbrev || null,
          currentRevenue: distData.revenue,
          currentTake: distData.take || 0,
          opportunities: districtOpps,
        });
      }

      // Sort unmapped by revenue descending
      unmappedDistricts.sort((a, b) => b.currentRevenue - a.currentRevenue);
    }

    const unmappedTotalRevenue = unmappedDistricts.reduce((sum, d) => sum + d.currentRevenue, 0);
    const unmappedTotalTake = unmappedDistricts.reduce((sum, d) => sum + d.currentTake, 0);

    const combinedTarget =
      teamTotals.renewal.target + teamTotals.expansion.target +
      teamTotals.winback.target + teamTotals.newBusiness.target;
    const combinedActual =
      teamTotals.renewal.actual + teamTotals.expansion.actual +
      teamTotals.winback.actual + teamTotals.newBusiness.actual;

    return NextResponse.json({
      fiscalYear,
      totals: {
        ...teamTotals,
        combined: { target: combinedTarget, actual: combinedActual },
        totalTake: teamTotalTake,
      },
      plans: planResults,
      unmapped: {
        totalRevenue: unmappedTotalRevenue,
        totalTake: unmappedTotalTake,
        districtCount: unmappedDistricts.length,
        districts: unmappedDistricts,
      },
    });
  } catch (error) {
    console.error("Error fetching team progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch team progress" },
      { status: 500 }
    );
  }
}
