import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";

/**
 * Plan stats shape returned only when `?stats=1` is set on the GET request.
 *
 * Computed on-read by joining Opportunity + Contact against the plan's
 * member-district leaids. Each row of the returned list payload has these
 * four fields appended; legacy callers without `?stats=1` see the original
 * shape unchanged.
 *
 * The numbers themselves:
 *   - progress: % of plan-aggregate target met (bookings / sum-of-targets).
 *     Returns null when the plan has no targets configured.
 *   - pipelineValue: sum of net_booking_amount for open (non-Closed Lost)
 *     opps in the plan's districts during the plan's fiscal year.
 *   - contactsCount: count of contacts in the plan's member districts.
 *   - oppsCount: count of open opps in the plan's districts for the plan
 *     fiscal year.
 */
interface PlanStats {
  progress: number | null;
  pipelineValue: number;
  contactsCount: number;
  oppsCount: number;
}

// Stages that count as "closed" — used to filter the open-opp aggregate.
// Mirrors the convention used elsewhere in the codebase.
const CLOSED_STAGES = ["Closed Won", "Closed Lost"];

async function computePlanStats(
  planLeaids: string[],
  fiscalYear: number,
  targetsTotal: number,
): Promise<PlanStats> {
  if (planLeaids.length === 0) {
    return { progress: null, pipelineValue: 0, contactsCount: 0, oppsCount: 0 };
  }
  const schoolYr = `FY${fiscalYear - 2000}`; // 2026 → "FY26"

  // Three aggregates issued in parallel. Each query uses an existing index:
  //   - opportunities(district_lea_id, school_yr, stage) — covers both opp
  //     aggregates without a sequential scan.
  //   - contacts(leaid) — single-column index.
  const [pipelineAgg, openOppsAgg, contactsAgg, bookingsAgg] = await Promise.all([
    prisma.opportunity.aggregate({
      where: {
        districtLeaId: { in: planLeaids },
        schoolYr,
        stage: { notIn: CLOSED_STAGES },
      },
      _sum: { netBookingAmount: true },
    }),
    prisma.opportunity.count({
      where: {
        districtLeaId: { in: planLeaids },
        schoolYr,
        stage: { notIn: CLOSED_STAGES },
      },
    }),
    prisma.contact.count({ where: { leaid: { in: planLeaids } } }),
    // Bookings = sum of closed-won net_booking_amount in the plan FY.
    prisma.opportunity.aggregate({
      where: {
        districtLeaId: { in: planLeaids },
        schoolYr,
        stage: "Closed Won",
      },
      _sum: { netBookingAmount: true },
    }),
  ]);

  const pipelineValue = Number(pipelineAgg._sum.netBookingAmount ?? 0);
  const bookings = Number(bookingsAgg._sum.netBookingAmount ?? 0);
  const progress =
    targetsTotal > 0 ? Math.max(0, Math.min(100, Math.round((bookings / targetsTotal) * 100))) : null;

  return {
    progress,
    pipelineValue,
    contactsCount: contactsAgg,
    oppsCount: openOppsAgg,
  };
}

// GET /api/territory-plans - List all plans with district counts
//
// Optional query params:
//   ?stats=1     — include progress / pipelineValue / contactsCount /
//                  oppsCount per plan (extra aggregate queries; opt-in).
//   ?showHidden=1 — include plans this user has per-user-hidden via
//                  POST /api/territory-plans/[id]/hide. Default: filter
//                  hidden out.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("stats") === "1";
    const showHidden = searchParams.get("showHidden") === "1";

    // Show all plans — the team shares visibility across plans
    const whereClause = {};

    const plans = await prisma.territoryPlan.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { districts: true },
        },
        districts: {
          select: {
            districtLeaid: true,
            renewalTarget: true,
            winbackTarget: true,
            expansionTarget: true,
            newBusinessTarget: true,
            district: {
              select: {
                enrollment: true,
                stateAbbrev: true,
                districtFinancials: {
                  where: { vendor: "fullmind" },
                  select: { fiscalYear: true, openPipeline: true },
                },
              },
            },
          },
        },
        taskLinks: {
          select: {
            task: {
              select: { status: true },
            },
          },
        },
        ownerUser: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        states: {
          select: {
            state: { select: { fips: true, abbrev: true, name: true } },
          },
        },
        collaborators: {
          select: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
        hidden: { where: { userId: user.id }, select: { hiddenAt: true } },
      },
    });

    // Filter per-user hidden plans unless showHidden=1.
    const visiblePlans = plans.filter((p) => showHidden || p.hidden.length === 0);

    // Stats are computed per-plan; we kick them off in parallel rather than
    // serially to keep the total latency near max(perPlanLatency).
    const statsByPlanId = new Map<string, PlanStats>();
    if (includeStats) {
      const statsPairs = await Promise.all(
        visiblePlans.map(async (plan) => {
          const leaids = plan.districts.map((d) => d.districtLeaid);
          const targetsTotal = plan.districts.reduce((sum, d) => {
            return (
              sum +
              Number(d.renewalTarget ?? 0) +
              Number(d.winbackTarget ?? 0) +
              Number(d.expansionTarget ?? 0) +
              Number(d.newBusinessTarget ?? 0)
            );
          }, 0);
          const stats = await computePlanStats(leaids, plan.fiscalYear, targetsTotal);
          return [plan.id, stats] as const;
        }),
      );
      for (const [id, s] of statsPairs) statsByPlanId.set(id, s);
    }

    const result = visiblePlans.map((plan) => {
      const districtLeaIds = plan.districts.map((d) => d.districtLeaid);

      const totalEnrollment = plan.districts.reduce(
        (sum, d) => sum + (d.district.enrollment ?? 0),
        0
      );

      // Aggregate open pipeline for the plan's fiscal year
      const fy = `FY${plan.fiscalYear - 2000}`; // 2026 → "FY26"
      const pipelineTotal = plan.districts.reduce((sum, d) => {
        const record = d.district.districtFinancials.find(
          (f) => f.fiscalYear === fy
        );
        return sum + (record ? Number(record.openPipeline ?? 0) : 0);
      }, 0);

      const taskCount = plan.taskLinks.length;
      const completedTaskCount = plan.taskLinks.filter(
        (tl) => tl.task.status === "done"
      ).length;

      const stats = statsByPlanId.get(plan.id);

      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        owner: plan.ownerUser
          ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
          : null,
        color: plan.color,
        status: plan.status,
        fiscalYear: plan.fiscalYear,
        startDate: plan.startDate?.toISOString() ?? null,
        endDate: plan.endDate?.toISOString() ?? null,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        districtCount: plan._count.districts,
        districtLeaids: districtLeaIds,
        schoolNcesIds: [],   // deferred — filter degrades gracefully via ?? [] guard
        totalEnrollment,
        stateCount: plan.states.length,
        states: plan.states.map((ps) => ({
          fips: ps.state.fips,
          abbrev: ps.state.abbrev,
          name: ps.state.name,
        })),
        collaborators: plan.collaborators.map((pc) => ({
          id: pc.user.id,
          fullName: pc.user.fullName,
          avatarUrl: pc.user.avatarUrl,
        })),
        taskCount,
        completedTaskCount,
        renewalRollup: Number(plan.renewalRollup),
        expansionRollup: Number(plan.expansionRollup),
        winbackRollup: Number(plan.winbackRollup),
        newBusinessRollup: Number(plan.newBusinessRollup),
        pipelineTotal,
        // Actuals deferred to detail view to avoid N*2 DB round-trips
        revenueActual: 0,
        takeActual: 0,
        priorFyRevenue: 0,
        // Per-user hide state — surfaces in the sidebar's "show hidden" toggle.
        hidden: plan.hidden.length > 0,
        // ?stats=1 fields. Omitted entirely when stats=0 so legacy callers
        // see the same payload they always saw.
        ...(stats
          ? {
              progress: stats.progress,
              pipelineValue: stats.pipelineValue,
              contactsCount: stats.contactsCount,
              oppsCount: stats.oppsCount,
            }
          : {}),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching territory plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch territory plans" },
      { status: 500 }
    );
  }
}

// POST /api/territory-plans - Create a new plan (associated with current user)
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, ownerId, color, status, fiscalYear, startDate, endDate, stateFips, collaboratorIds } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    // Validate fiscal year is required and valid
    if (!fiscalYear || typeof fiscalYear !== "number" || fiscalYear < 2024 || fiscalYear > 2030) {
      return NextResponse.json(
        { error: "fiscalYear is required and must be between 2024 and 2030" },
        { status: 400 }
      );
    }

    // Validate color format if provided
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json(
        { error: "color must be a valid hex color (e.g., #403770)" },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ["planning", "working", "stale", "archived"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const plan = await prisma.territoryPlan.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: ownerId || user.id,
        color: color || "#403770",
        status: status || "planning",
        fiscalYear,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId: user.id,
        ...(Array.isArray(stateFips) && stateFips.length > 0 && {
          states: {
            createMany: {
              data: stateFips.map((fips: string) => ({ stateFips: fips })),
              skipDuplicates: true,
            },
          },
        }),
        ...(Array.isArray(collaboratorIds) && collaboratorIds.length > 0 && {
          collaborators: {
            createMany: {
              data: collaboratorIds.map((uid: string) => ({ userId: uid })),
              skipDuplicates: true,
            },
          },
        }),
      },
      include: {
        ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
        states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
        collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
    });

    return NextResponse.json(
      {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        owner: plan.ownerUser
          ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
          : null,
        color: plan.color,
        status: plan.status,
        fiscalYear: plan.fiscalYear,
        startDate: plan.startDate?.toISOString() ?? null,
        endDate: plan.endDate?.toISOString() ?? null,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        districtCount: 0,
        districtLeaids: [],
        schoolNcesIds: [],
        totalEnrollment: 0,
        stateCount: plan.states.length,
        states: plan.states.map((ps) => ({ fips: ps.state.fips, abbrev: ps.state.abbrev, name: ps.state.name })),
        collaborators: plan.collaborators.map((pc) => ({ id: pc.user.id, fullName: pc.user.fullName, avatarUrl: pc.user.avatarUrl })),
        taskCount: 0,
        completedTaskCount: 0,
        renewalRollup: 0,
        expansionRollup: 0,
        winbackRollup: 0,
        newBusinessRollup: 0,
        pipelineTotal: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating territory plan:", error);
    return NextResponse.json(
      { error: "Failed to create territory plan" },
      { status: 500 }
    );
  }
}
