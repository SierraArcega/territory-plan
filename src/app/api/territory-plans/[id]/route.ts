import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";
import { expandPlanRollups } from "@/features/districts/lib/expandRollups";

export const dynamic = "force-dynamic";

// GET /api/territory-plans/[id] - Get a single plan with its districts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Auto-migrate any rollup leaids in this plan to their children.
    // Safe to run on every GET — idempotent after first successful expansion.
    // Log-but-proceed on failure so a broken migration doesn't 500 the plan GET;
    // the rollup row stays in the plan for this request but the user still sees their plan.
    try {
      await expandPlanRollups(id, user.id);
    } catch (migrationErr) {
      console.error("expandPlanRollups failed; returning plan without migration", {
        planId: id,
        err: migrationErr,
      });
      // Fall through — the plan GET proceeds with the rollup row still present.
    }

    // Team shares visibility across plans (matches list endpoint)
    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        districts: {
          include: {
            district: {
              select: {
                name: true,
                stateAbbrev: true,
                enrollment: true,
                ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
                districtTags: {
                  select: {
                    tag: { select: { id: true, name: true, color: true } },
                  },
                },
              },
            },
            targetServices: {
              include: {
                service: {
                  select: { id: true, name: true, slug: true, color: true },
                },
              },
            },
          },
          orderBy: { addedAt: "desc" },
        },
        ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
        states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
        collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Batch-fetch per-district actuals (2 queries total, not 2 per district)
    const schoolYr = fiscalYearToSchoolYear(plan.fiscalYear);
    const priorSchoolYr = fiscalYearToSchoolYear(plan.fiscalYear - 1);
    const allLeaIds = plan.districts.map((d) => d.districtLeaid);

    let currentRows: { district_lea_id: string; total_revenue: number; total_take: number; weighted_pipeline: number }[] = [];
    let priorRows: { district_lea_id: string; total_revenue: number }[] = [];

    try {
      [currentRows, priorRows] = await Promise.all([
        prisma.$queryRaw<typeof currentRows>`
          SELECT district_lea_id,
                 COALESCE(SUM(total_revenue), 0) AS total_revenue,
                 COALESCE(SUM(total_take), 0) AS total_take,
                 COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline
          FROM district_opportunity_actuals
          WHERE district_lea_id = ANY(${allLeaIds})
            AND school_yr = ${schoolYr}
          GROUP BY district_lea_id
        `,
        prisma.$queryRaw<typeof priorRows>`
          SELECT district_lea_id,
                 COALESCE(SUM(total_revenue), 0) AS total_revenue
          FROM district_opportunity_actuals
          WHERE district_lea_id = ANY(${allLeaIds})
            AND school_yr = ${priorSchoolYr}
          GROUP BY district_lea_id
        `,
      ]);
    } catch {
      // View doesn't exist yet — continue with empty actuals
    }

    const currentByDistrict = new Map(currentRows.map((r) => [r.district_lea_id, r]));
    const priorByDistrict = new Map(priorRows.map((r) => [r.district_lea_id, r]));

    // Pacing data: current FY, prior FY same-date, prior FY full
    type PacingRow = { district_lea_id: string; revenue: number; pipeline: number; deals: number; sessions: number };
    let currentPacing: PacingRow[] = [];
    let priorSameDatePacing: PacingRow[] = [];
    let priorFullPacing: PacingRow[] = [];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    type SessionServiceRow = {
      district_lea_id: string;
      service_type: string;
      sessions: number;
      revenue: number;
    };
    let currentSessionsByService: SessionServiceRow[] = [];
    let priorSameDateSessionsByService: SessionServiceRow[] = [];
    let priorFullSessionsByService: SessionServiceRow[] = [];

    try {
      [currentPacing, priorSameDatePacing, priorFullPacing] = await Promise.all([
        prisma.$queryRaw<PacingRow[]>`
          SELECT district_lea_id,
                 COALESCE(SUM(total_revenue), 0) AS revenue,
                 COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost') THEN net_booking_amount ELSE 0 END), 0) AS pipeline,
                 COUNT(*)::int AS deals,
                 COALESCE(SUM(scheduled_sessions), 0)::int AS sessions
          FROM opportunities
          WHERE district_lea_id = ANY(${allLeaIds})
            AND school_yr = ${schoolYr}
          GROUP BY district_lea_id
        `,
        prisma.$queryRaw<PacingRow[]>`
          SELECT district_lea_id,
                 COALESCE(SUM(total_revenue), 0) AS revenue,
                 COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost') THEN net_booking_amount ELSE 0 END), 0) AS pipeline,
                 COUNT(*)::int AS deals,
                 COALESCE(SUM(scheduled_sessions), 0)::int AS sessions
          FROM opportunities
          WHERE district_lea_id = ANY(${allLeaIds})
            AND school_yr = ${priorSchoolYr}
            AND created_at <= ${oneYearAgo}
          GROUP BY district_lea_id
        `,
        prisma.$queryRaw<PacingRow[]>`
          SELECT district_lea_id,
                 COALESCE(SUM(total_revenue), 0) AS revenue,
                 COALESCE(SUM(CASE WHEN stage NOT IN ('Closed Won', 'Closed Lost') THEN net_booking_amount ELSE 0 END), 0) AS pipeline,
                 COUNT(*)::int AS deals,
                 COALESCE(SUM(scheduled_sessions), 0)::int AS sessions
          FROM opportunities
          WHERE district_lea_id = ANY(${allLeaIds})
            AND school_yr = ${priorSchoolYr}
          GROUP BY district_lea_id
        `,
      ]);
    } catch {
      // Opportunities table may not exist yet
    }

    try {
      [currentSessionsByService, priorSameDateSessionsByService, priorFullSessionsByService] = await Promise.all([
        prisma.$queryRaw<SessionServiceRow[]>`
          SELECT o.district_lea_id,
                 COALESCE(NULLIF(s.service_type, ''), 'Other') AS service_type,
                 COUNT(*)::int AS sessions,
                 COALESCE(SUM(s.session_price), 0) AS revenue
          FROM sessions s
          JOIN opportunities o ON o.id = s.opportunity_id
          WHERE o.district_lea_id = ANY(${allLeaIds})
            AND o.school_yr = ${schoolYr}
          GROUP BY o.district_lea_id, COALESCE(NULLIF(s.service_type, ''), 'Other')
        `,
        prisma.$queryRaw<SessionServiceRow[]>`
          SELECT o.district_lea_id,
                 COALESCE(NULLIF(s.service_type, ''), 'Other') AS service_type,
                 COUNT(*)::int AS sessions,
                 COALESCE(SUM(s.session_price), 0) AS revenue
          FROM sessions s
          JOIN opportunities o ON o.id = s.opportunity_id
          WHERE o.district_lea_id = ANY(${allLeaIds})
            AND o.school_yr = ${priorSchoolYr}
            AND s.start_time <= ${oneYearAgo}
          GROUP BY o.district_lea_id, COALESCE(NULLIF(s.service_type, ''), 'Other')
        `,
        prisma.$queryRaw<SessionServiceRow[]>`
          SELECT o.district_lea_id,
                 COALESCE(NULLIF(s.service_type, ''), 'Other') AS service_type,
                 COUNT(*)::int AS sessions,
                 COALESCE(SUM(s.session_price), 0) AS revenue
          FROM sessions s
          JOIN opportunities o ON o.id = s.opportunity_id
          WHERE o.district_lea_id = ANY(${allLeaIds})
            AND o.school_yr = ${priorSchoolYr}
          GROUP BY o.district_lea_id, COALESCE(NULLIF(s.service_type, ''), 'Other')
        `,
      ]);
    } catch {
      // Sessions table may not exist yet — breakdown will be empty
    }

    const currentPacingByDistrict = new Map(currentPacing.map((r) => [r.district_lea_id, r]));
    const priorSameDateByDistrict = new Map(priorSameDatePacing.map((r) => [r.district_lea_id, r]));
    const priorFullByDistrict = new Map(priorFullPacing.map((r) => [r.district_lea_id, r]));

    // Build per-district, per-service-type lookup
    type ServiceAgg = { revenue: number; sessions: number };
    const serviceTypeLookup = new Map<string, Map<string, { current: ServiceAgg; sameDate: ServiceAgg; full: ServiceAgg }>>();

    function ensureEntry(leaid: string, st: string) {
      if (!serviceTypeLookup.has(leaid)) serviceTypeLookup.set(leaid, new Map());
      const byType = serviceTypeLookup.get(leaid)!;
      if (!byType.has(st)) byType.set(st, {
        current: { revenue: 0, sessions: 0 },
        sameDate: { revenue: 0, sessions: 0 },
        full: { revenue: 0, sessions: 0 },
      });
      return byType.get(st)!;
    }

    for (const r of currentSessionsByService) {
      const e = ensureEntry(r.district_lea_id, r.service_type);
      e.current = { revenue: Number(r.revenue), sessions: Number(r.sessions) };
    }
    for (const r of priorSameDateSessionsByService) {
      const e = ensureEntry(r.district_lea_id, r.service_type);
      e.sameDate = { revenue: Number(r.revenue), sessions: Number(r.sessions) };
    }
    for (const r of priorFullSessionsByService) {
      const e = ensureEntry(r.district_lea_id, r.service_type);
      e.full = { revenue: Number(r.revenue), sessions: Number(r.sessions) };
    }

    const renewalRollup = Number(plan.renewalRollup);
    const expansionRollup = Number(plan.expansionRollup);
    const winbackRollup = Number(plan.winbackRollup);
    const newBusinessRollup = Number(plan.newBusinessRollup);
    const pipelineTotal = currentRows.reduce((sum, r) => sum + Number(r.weighted_pipeline), 0);
    const revenueActual = currentRows.reduce((sum, r) => sum + Number(r.total_revenue), 0);
    const takeActual = currentRows.reduce((sum, r) => sum + Number(r.total_take), 0);
    const totalEnrollment = plan.districts.reduce((sum, d) => sum + (d.district.enrollment ?? 0), 0);

    return NextResponse.json({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      owner: plan.ownerUser
        ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
        : null,
      states: plan.states.map((ps) => ({ fips: ps.state.fips, abbrev: ps.state.abbrev, name: ps.state.name })),
      collaborators: plan.collaborators.map((pc) => ({ id: pc.user.id, fullName: pc.user.fullName, avatarUrl: pc.user.avatarUrl })),
      color: plan.color,
      status: plan.status,
      fiscalYear: plan.fiscalYear,
      startDate: plan.startDate?.toISOString() ?? null,
      endDate: plan.endDate?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      districtCount: plan.districts.length,
      districtLeaids: plan.districts.map((d) => d.districtLeaid),
      schoolNcesIds: [],
      renewalRollup,
      expansionRollup,
      winbackRollup,
      newBusinessRollup,
      pipelineTotal,
      revenueActual,
      takeActual,
      totalEnrollment,
      stateCount: plan.states.length,
      taskCount: 0,
      completedTaskCount: 0,
      districts: plan.districts.map((pd) => {
        const curr = currentByDistrict.get(pd.districtLeaid);
        const prior = priorByDistrict.get(pd.districtLeaid);
        return {
          leaid: pd.districtLeaid,
          addedAt: pd.addedAt.toISOString(),
          name: pd.district.name,
          stateAbbrev: pd.district.stateAbbrev,
          enrollment: pd.district.enrollment,
          owner: pd.district.ownerUser
            ? { id: pd.district.ownerUser.id, fullName: pd.district.ownerUser.fullName, avatarUrl: pd.district.ownerUser.avatarUrl }
            : null,
          renewalTarget: pd.renewalTarget ? Number(pd.renewalTarget) : null,
          winbackTarget: pd.winbackTarget ? Number(pd.winbackTarget) : null,
          expansionTarget: pd.expansionTarget ? Number(pd.expansionTarget) : null,
          newBusinessTarget: pd.newBusinessTarget ? Number(pd.newBusinessTarget) : null,
          notes: pd.notes,
          returnServices: pd.targetServices
            .filter((ts) => ts.category === "return_services")
            .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
          newServices: pd.targetServices
            .filter((ts) => ts.category === "new_services")
            .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
          tags: pd.district.districtTags.map((dt) => ({
            id: dt.tag.id,
            name: dt.tag.name,
            color: dt.tag.color,
          })),
          actuals: curr
            ? {
                totalRevenue: Number(curr.total_revenue),
                totalTake: Number(curr.total_take),
                weightedPipeline: Number(curr.weighted_pipeline),
                priorFyRevenue: prior ? Number(prior.total_revenue) : 0,
              }
            : undefined,
          pacing: (() => {
            const cp = currentPacingByDistrict.get(pd.districtLeaid);
            const psd = priorSameDateByDistrict.get(pd.districtLeaid);
            const pf = priorFullByDistrict.get(pd.districtLeaid);
            const stMap = serviceTypeLookup.get(pd.districtLeaid);

            if (!cp && !psd && !pf && !stMap) return undefined;

            // Build serviceTypeBreakdown array
            const breakdown = stMap
              ? Array.from(stMap.entries())
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([serviceType, agg]) => ({
                    serviceType,
                    currentRevenue: agg.current.revenue,
                    currentSessions: agg.current.sessions,
                    priorSameDateRevenue: agg.sameDate.revenue,
                    priorSameDateSessions: agg.sameDate.sessions,
                    priorFullRevenue: agg.full.revenue,
                    priorFullSessions: agg.full.sessions,
                  }))
              : [];

            // Derive revenue/sessions totals from breakdown so parent = sum of children
            type NumericBreakdownKey = Exclude<keyof typeof breakdown[0], "serviceType">;
            const sumField = (field: NumericBreakdownKey) =>
              breakdown.reduce((acc, row) => acc + row[field], 0);

            return {
              currentRevenue: breakdown.length > 0 ? sumField("currentRevenue") : (cp ? Number(cp.revenue) : 0),
              currentPipeline: cp ? Number(cp.pipeline) : 0,
              currentDeals: cp ? Number(cp.deals) : 0,
              currentSessions: breakdown.length > 0 ? sumField("currentSessions") : (cp ? Number(cp.sessions) : 0),
              priorSameDateRevenue: breakdown.length > 0 ? sumField("priorSameDateRevenue") : (psd ? Number(psd.revenue) : 0),
              priorSameDatePipeline: psd ? Number(psd.pipeline) : 0,
              priorSameDateDeals: psd ? Number(psd.deals) : 0,
              priorSameDateSessions: breakdown.length > 0 ? sumField("priorSameDateSessions") : (psd ? Number(psd.sessions) : 0),
              priorFullRevenue: breakdown.length > 0 ? sumField("priorFullRevenue") : (pf ? Number(pf.revenue) : 0),
              priorFullPipeline: pf ? Number(pf.pipeline) : 0,
              priorFullDeals: pf ? Number(pf.deals) : 0,
              priorFullSessions: breakdown.length > 0 ? sumField("priorFullSessions") : (pf ? Number(pf.sessions) : 0),
              serviceTypeBreakdown: breakdown.length > 0 ? breakdown : undefined,
            };
          })(),
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching territory plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch territory plan" },
      { status: 500 }
    );
  }
}

// PUT /api/territory-plans/[id] - Update plan metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    const body = await request.json();
    const { name, description, ownerId, color, status, fiscalYear, startDate, endDate, stateFips, collaboratorIds } = body;

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Check if plan exists (any authenticated user can update)
    const existing = await prisma.territoryPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
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

    // Validate fiscal year if provided
    if (fiscalYear !== undefined && (typeof fiscalYear !== "number" || fiscalYear < 2024 || fiscalYear > 2030)) {
      return NextResponse.json(
        { error: "fiscalYear must be between 2024 and 2030" },
        { status: 400 }
      );
    }

    // Build update data - only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (ownerId !== undefined) updateData.ownerId = ownerId || null;
    if (color !== undefined) updateData.color = color;
    if (status !== undefined) updateData.status = status;
    if (fiscalYear !== undefined) updateData.fiscalYear = fiscalYear;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const plan = await prisma.$transaction(async (tx) => {
      // Update scalar fields
      await tx.territoryPlan.update({
        where: { id },
        data: updateData,
      });

      // Replace states if provided
      if (stateFips !== undefined) {
        await tx.territoryPlanState.deleteMany({ where: { planId: id } });
        if (Array.isArray(stateFips) && stateFips.length > 0) {
          await tx.territoryPlanState.createMany({
            data: stateFips.map((fips: string) => ({ planId: id, stateFips: fips })),
            skipDuplicates: true,
          });
        }
      }

      // Replace collaborators if provided
      if (collaboratorIds !== undefined) {
        await tx.territoryPlanCollaborator.deleteMany({ where: { planId: id } });
        if (Array.isArray(collaboratorIds) && collaboratorIds.length > 0) {
          await tx.territoryPlanCollaborator.createMany({
            data: collaboratorIds.map((uid: string) => ({ planId: id, userId: uid })),
            skipDuplicates: true,
          });
        }
      }

      // Re-fetch with relations
      return tx.territoryPlan.findUniqueOrThrow({
        where: { id },
        include: {
          _count: { select: { districts: true } },
          districts: { select: { districtLeaid: true } },
          ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
          states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
          collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        },
      });
    });

    return NextResponse.json({
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
      districtLeaids: plan.districts.map((d) => d.districtLeaid),
      schoolNcesIds: [],
      states: plan.states.map((ps) => ({ fips: ps.state.fips, abbrev: ps.state.abbrev, name: ps.state.name })),
      collaborators: plan.collaborators.map((pc) => ({ id: pc.user.id, fullName: pc.user.fullName, avatarUrl: pc.user.avatarUrl })),
    });
  } catch (error) {
    console.error("Error updating territory plan:", error);
    return NextResponse.json(
      { error: "Failed to update territory plan" },
      { status: 500 }
    );
  }
}

// DELETE /api/territory-plans/[id] - Delete a plan (user-scoped)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    // Check if plan exists and belongs to user
    const existing = await prisma.territoryPlan.findUnique({
      where: { id, userId: user?.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Delete will cascade to TerritoryPlanDistrict due to onDelete: Cascade
    await prisma.territoryPlan.delete({
      where: { id, userId: user?.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting territory plan:", error);
    return NextResponse.json(
      { error: "Failed to delete territory plan" },
      { status: 500 }
    );
  }
}
