import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { readonlyPool } from "@/lib/db-readonly";
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

interface PlanForStats {
  id: string;
  fiscalYear: number;
  districts: { districtLeaid: string }[];
  targetsTotal: number;
}

/**
 * Batched per-plan stats. The earlier per-plan implementation fired 4 Prisma
 * aggregates per plan inside an outer Promise.all over every plan — at N plans
 * that's 4N concurrent connections, which saturated the Supabase pooler (cap
 * of 3 per server process) and caused the route to throw with
 * "Timed out fetching a new connection from the connection pool."
 *
 * The new shape issues two grouped SQL queries against the readonly pool,
 * keyed by (district_lea_id, school_yr) and (leaid). Cost is constant in N.
 * Per-plan numbers are then composed in JS by walking each plan's districts
 * and summing the matching rows.
 */
async function computeAllPlanStats(
  plans: PlanForStats[],
): Promise<Map<string, PlanStats>> {
  const result = new Map<string, PlanStats>();

  // Collect the union of leaids and school years we need to scan.
  const leaidSet = new Set<string>();
  const schoolYrSet = new Set<string>();
  for (const p of plans) {
    for (const d of p.districts) leaidSet.add(d.districtLeaid);
    schoolYrSet.add(`FY${p.fiscalYear - 2000}`);
  }

  // No plans touch any districts → every plan is zeros, skip DB entirely.
  if (leaidSet.size === 0) {
    for (const p of plans) {
      result.set(p.id, { progress: null, pipelineValue: 0, contactsCount: 0, oppsCount: 0 });
    }
    return result;
  }

  const leaids = Array.from(leaidSet);
  const schoolYrs = Array.from(schoolYrSet);

  // Two queries, both leaning on existing indexes:
  //   - opportunities(district_lea_id, school_yr, stage)
  //   - contacts(leaid)
  // CASE/FILTER inside SUM/COUNT folds the open-pipeline / bookings split
  // into one pass instead of two separate aggregates.
  const oppsRowsP = readonlyPool.query<{
    district_lea_id: string;
    school_yr: string;
    open_pipeline: string;
    open_count: string;
    bookings: string;
  }>(
    `SELECT
       district_lea_id,
       school_yr,
       COALESCE(SUM(net_booking_amount) FILTER (WHERE stage NOT IN ('Closed Won','Closed Lost')), 0) AS open_pipeline,
       COUNT(*) FILTER (WHERE stage NOT IN ('Closed Won','Closed Lost')) AS open_count,
       COALESCE(SUM(net_booking_amount) FILTER (WHERE stage = 'Closed Won'), 0) AS bookings
     FROM opportunities
     WHERE district_lea_id = ANY($1::text[])
       AND school_yr = ANY($2::text[])
     GROUP BY district_lea_id, school_yr`,
    [leaids, schoolYrs],
  );

  const contactsRowsP = readonlyPool.query<{ leaid: string; count: string }>(
    `SELECT leaid, COUNT(*) AS count
     FROM contacts
     WHERE leaid = ANY($1::text[])
     GROUP BY leaid`,
    [leaids],
  );

  const [oppsRows, contactsRows] = await Promise.all([oppsRowsP, contactsRowsP]);

  // (leaid, school_yr) → opps aggregates. School year matters because two
  // plans can share a district but care about different fiscal years.
  const oppsByKey = new Map<
    string,
    { openPipeline: number; openCount: number; bookings: number }
  >();
  for (const r of oppsRows.rows) {
    oppsByKey.set(`${r.district_lea_id}|${r.school_yr}`, {
      openPipeline: Number(r.open_pipeline),
      openCount: Number(r.open_count),
      bookings: Number(r.bookings),
    });
  }

  const contactsByLeaid = new Map<string, number>();
  for (const r of contactsRows.rows) {
    contactsByLeaid.set(r.leaid, Number(r.count));
  }

  for (const plan of plans) {
    if (plan.districts.length === 0) {
      result.set(plan.id, { progress: null, pipelineValue: 0, contactsCount: 0, oppsCount: 0 });
      continue;
    }
    const schoolYr = `FY${plan.fiscalYear - 2000}`;
    let pipelineValue = 0;
    let oppsCount = 0;
    let bookings = 0;
    let contactsCount = 0;
    for (const d of plan.districts) {
      const o = oppsByKey.get(`${d.districtLeaid}|${schoolYr}`);
      if (o) {
        pipelineValue += o.openPipeline;
        oppsCount += o.openCount;
        bookings += o.bookings;
      }
      contactsCount += contactsByLeaid.get(d.districtLeaid) ?? 0;
    }
    const progress =
      plan.targetsTotal > 0
        ? Math.max(0, Math.min(100, Math.round((bookings / plan.targetsTotal) * 100)))
        : null;
    result.set(plan.id, { progress, pipelineValue, contactsCount, oppsCount });
  }

  return result;
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

    // Stats are computed for every visible plan in two grouped SQL queries
    // (opportunities + contacts), not 4 Prisma aggregates per plan. This
    // keeps the connection-pool demand constant in N — the previous fan-out
    // was timing out the Supabase pooler on /views.
    let statsByPlanId = new Map<string, PlanStats>();
    if (includeStats) {
      const plansForStats: PlanForStats[] = visiblePlans.map((plan) => ({
        id: plan.id,
        fiscalYear: plan.fiscalYear,
        districts: plan.districts.map((d) => ({ districtLeaid: d.districtLeaid })),
        targetsTotal: plan.districts.reduce(
          (sum, d) =>
            sum +
            Number(d.renewalTarget ?? 0) +
            Number(d.winbackTarget ?? 0) +
            Number(d.expansionTarget ?? 0) +
            Number(d.newBusinessTarget ?? 0),
          0,
        ),
      }));
      statsByPlanId = await computeAllPlanStats(plansForStats);
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
