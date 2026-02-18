// GET /api/explore/[entity] — Unified explore endpoint for districts, activities, tasks, contacts
// Supports JSON-encoded filters, sorting, and pagination.
// Returns { data, aggregates, pagination }.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import {
  type FilterDef,
  buildWhereClause,
  DISTRICT_FIELD_MAP,
} from "@/lib/explore-filters";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Parse query params shared across all entities
// ---------------------------------------------------------------------------

function parseQueryParams(req: NextRequest) {
  const url = req.nextUrl;

  // Filters
  let filters: FilterDef[] = [];
  const filtersParam = url.searchParams.get("filters");
  if (filtersParam) {
    try {
      filters = JSON.parse(filtersParam);
    } catch {
      // ignore malformed filters
    }
  }

  // Multi-sort: ?sorts=[{"column":"name","direction":"asc"},{"column":"enrollment","direction":"desc"}]
  // Backwards-compatible: also accept ?sort=name&order=asc for single-sort
  let sorts: { column: string; direction: "asc" | "desc" }[] = [];
  const sortsParam = url.searchParams.get("sorts");
  if (sortsParam) {
    try {
      sorts = JSON.parse(sortsParam);
    } catch {
      // ignore malformed
    }
  } else {
    // Legacy single-sort fallback
    const sort = url.searchParams.get("sort") ?? undefined;
    const order = (url.searchParams.get("order") ?? "asc") as "asc" | "desc";
    if (sort) sorts = [{ column: sort, direction: order }];
  }

  // Pagination
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "50", 10))
  );

  return { filters, sorts, page, pageSize };
}

// ---------------------------------------------------------------------------
// DISTRICTS handler
// ---------------------------------------------------------------------------

async function handleDistricts(req: NextRequest) {
  const { filters, sorts, page, pageSize } = parseQueryParams(req);
  const where = buildWhereClause(filters, DISTRICT_FIELD_MAP);

  // Build orderBy (multi-sort: Prisma accepts an array of single-key objects)
  const orderBy: Record<string, string>[] = [];
  for (const s of sorts) {
    const field = DISTRICT_FIELD_MAP[s.column];
    if (field) orderBy.push({ [field]: s.direction });
  }
  if (orderBy.length === 0) orderBy.push({ name: "asc" });

  const [rows, total, aggResult] = await Promise.all([
    prisma.district.findMany({
      where,
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        enrollment: true,
        isCustomer: true,
        hasOpenPipeline: true,
        fy26OpenPipeline: true,
        fy26ClosedWonNetBooking: true,
        salesExecutive: true,
        urbanCentricLocale: true,
        graduationRateTotal: true,
        mathProficiencyPct: true,
        readProficiencyPct: true,
        swdPct: true,
        ellPct: true,
        childrenPovertyPercent: true,
        accountType: true,
        notes: true,
        owner: true,
        // point location for mini-map
        // Prisma cannot select Unsupported fields via select, so we omit geometry
        // Relations
        districtTags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
        territoryPlans: { select: { planId: true } },
        activityLinks: {
          select: {
            activity: { select: { startDate: true } },
          },
          orderBy: { activity: { startDate: "desc" } },
          take: 1,
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.district.count({ where }),
    prisma.district.aggregate({
      where,
      _count: { leaid: true },
      _sum: {
        enrollment: true,
        fy26OpenPipeline: true,
        fy26ClosedWonNetBooking: true,
      },
    }),
  ]);

  // Reshape rows for the client
  const data = rows.map((d) => ({
    leaid: d.leaid,
    name: d.name,
    state: d.stateAbbrev,
    enrollment: d.enrollment,
    isCustomer: d.isCustomer,
    hasOpenPipeline: d.hasOpenPipeline,
    fy26_open_pipeline_value: d.fy26OpenPipeline,
    fy26_closed_won_net_booking: d.fy26ClosedWonNetBooking,
    salesExecutive: d.salesExecutive,
    urbanicity: d.urbanCentricLocale,
    graduationRate: d.graduationRateTotal,
    mathProficiency: d.mathProficiencyPct,
    readProficiency: d.readProficiencyPct,
    sped_percent: d.swdPct,
    ell_percent: d.ellPct,
    free_lunch_percent: d.childrenPovertyPercent,
    accountType: d.accountType,
    notes: d.notes,
    owner: d.owner,
    tags: d.districtTags.map((dt) => dt.tag),
    planCount: d.territoryPlans.length,
    lastActivity: d.activityLinks[0]?.activity?.startDate ?? null,
  }));

  return {
    data,
    aggregates: {
      count: aggResult._count.leaid,
      enrollment_sum: aggResult._sum.enrollment,
      fy26_open_pipeline_sum: aggResult._sum.fy26OpenPipeline,
      fy26_closed_won_sum: aggResult._sum.fy26ClosedWonNetBooking,
    },
    pagination: { page, pageSize, total },
  };
}

// ---------------------------------------------------------------------------
// ACTIVITIES handler
// ---------------------------------------------------------------------------

async function handleActivities(req: NextRequest, userId: string) {
  const { filters, sorts, page, pageSize } = parseQueryParams(req);
  const filterWhere = buildWhereClause(filters);

  const where = { createdByUserId: userId, ...filterWhere };

  // Build orderBy (multi-sort)
  const orderBy: Record<string, string>[] = [];
  for (const s of sorts) {
    orderBy.push({ [s.column]: s.direction });
  }
  if (orderBy.length === 0) orderBy.push({ startDate: "desc" });

  // Fetch paginated rows + aggregates in parallel using COUNT queries
  // (avoids loading the entire result set into memory)
  const [rows, total, completedCount, positiveOutcomes, uniqueDistrictsResult] = await Promise.all([
    prisma.activity.findMany({
      where,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        startDate: true,
        endDate: true,
        outcomeType: true,
        outcome: true,
        districts: {
          select: {
            district: { select: { name: true, leaid: true } },
          },
        },
        plans: {
          select: {
            plan: { select: { name: true, id: true } },
          },
        },
        contacts: {
          select: {
            contact: { select: { name: true, id: true } },
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activity.count({ where }),
    // Count completed activities (database-side)
    prisma.activity.count({ where: { ...where, status: "completed" } }),
    // Count positive outcomes (database-side)
    prisma.activity.count({ where: { ...where, outcomeType: "positive_progress" } }),
    // Count distinct districts touched — Prisma doesn't support COUNT(DISTINCT)
    // natively, so we use the join table with a groupBy to get unique district IDs
    prisma.activityDistrict.groupBy({
      by: ["districtLeaid"],
      where: { activity: where },
    }),
  ]);

  const data = rows.map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    status: a.status,
    startDate: a.startDate,
    endDate: a.endDate,
    outcomeType: a.outcomeType,
    outcome: a.outcome,
    districtNames: a.districts.map((d) => d.district.name),
    planNames: a.plans.map((p) => p.plan.name),
    contactNames: a.contacts.map((c) => c.contact.name),
  }));

  return {
    data,
    aggregates: {
      count: total,
      completed_count: completedCount,
      positive_outcomes: positiveOutcomes,
      unique_districts_touched: uniqueDistrictsResult.length,
    },
    pagination: { page, pageSize, total },
  };
}

// ---------------------------------------------------------------------------
// TASKS handler
// ---------------------------------------------------------------------------

async function handleTasks(req: NextRequest, userId: string) {
  const { filters, sorts, page, pageSize } = parseQueryParams(req);
  const filterWhere = buildWhereClause(filters);

  const where = { createdByUserId: userId, ...filterWhere };

  // Build orderBy (multi-sort)
  const orderBy: Record<string, string>[] = [];
  for (const s of sorts) {
    orderBy.push({ [s.column]: s.direction });
  }
  if (orderBy.length === 0) orderBy.push({ dueDate: "asc" });

  const now = new Date();

  const [rows, total, aggCounts] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        districts: {
          select: {
            district: { select: { name: true, leaid: true } },
          },
        },
        plans: {
          select: {
            plan: { select: { name: true, id: true } },
          },
        },
        contacts: {
          select: {
            contact: { select: { name: true, id: true } },
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.task.count({ where }),
    // Aggregate counts in parallel
    Promise.all([
      prisma.task.count({
        where: {
          ...where,
          dueDate: { lt: now },
          status: { not: "done" },
        },
      }),
      prisma.task.count({
        where: { ...where, status: "done" },
      }),
      prisma.task.count({
        where: { ...where, status: "blocked" },
      }),
    ]),
  ]);

  const [overdueCount, completedCount, blockedCount] = aggCounts;

  const data = rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    districtNames: t.districts.map((d) => d.district.name),
    planNames: t.plans.map((p) => p.plan.name),
    contactNames: t.contacts.map((c) => c.contact.name),
  }));

  return {
    data,
    aggregates: {
      count: total,
      overdue_count: overdueCount,
      completed_count: completedCount,
      blocked_count: blockedCount,
    },
    pagination: { page, pageSize, total },
  };
}

// ---------------------------------------------------------------------------
// CONTACTS handler
// ---------------------------------------------------------------------------

async function handleContacts(req: NextRequest) {
  const { filters, sorts, page, pageSize } = parseQueryParams(req);
  const filterWhere = buildWhereClause(filters);

  const where = { ...filterWhere };

  // Build orderBy (multi-sort)
  const orderBy: Record<string, string>[] = [];
  for (const s of sorts) {
    orderBy.push({ [s.column]: s.direction });
  }
  if (orderBy.length === 0) orderBy.push({ name: "asc" });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch paginated rows + aggregates in parallel using COUNT queries
  // (avoids loading the entire contact set into memory)
  const [rows, total, primaryCount, uniqueDistrictsResult, contactsWithRecentActivity] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        phone: true,
        isPrimary: true,
        district: { select: { name: true, leaid: true } },
        activityLinks: {
          select: {
            activity: { select: { startDate: true } },
          },
          orderBy: { activity: { startDate: "desc" } },
          take: 1,
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contact.count({ where }),
    prisma.contact.count({ where: { ...where, isPrimary: true } }),
    // Count distinct districts — groupBy gives us one row per unique leaid
    prisma.contact.groupBy({
      by: ["leaid"],
      where,
    }),
    // Count contacts with activity in the last 30 days (database-side)
    prisma.contact.count({
      where: {
        ...where,
        activityLinks: {
          some: { activity: { startDate: { gte: thirtyDaysAgo } } },
        },
      },
    }),
  ]);

  const data = rows.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    email: c.email,
    phone: c.phone,
    isPrimary: c.isPrimary,
    districtName: c.district.name,
    districtLeaid: c.district.leaid,
    lastActivity: c.activityLinks[0]?.activity?.startDate ?? null,
  }));

  return {
    data,
    aggregates: {
      count: total,
      primary_count: primaryCount,
      unique_districts: uniqueDistrictsResult.length,
      contacts_with_recent_activity: contactsWithRecentActivity,
    },
    pagination: { page, pageSize, total },
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const VALID_ENTITIES = new Set(["districts", "activities", "tasks", "contacts"]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params;

    if (!VALID_ENTITIES.has(entity)) {
      return NextResponse.json(
        { error: `Invalid entity: ${entity}. Must be one of: ${[...VALID_ENTITIES].join(", ")}` },
        { status: 400 }
      );
    }

    // Auth check
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let result;

    switch (entity) {
      case "districts":
        result = await handleDistricts(req);
        break;
      case "activities":
        result = await handleActivities(req, user.id);
        break;
      case "tasks":
        result = await handleTasks(req, user.id);
        break;
      case "contacts":
        result = await handleContacts(req);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in explore API:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
