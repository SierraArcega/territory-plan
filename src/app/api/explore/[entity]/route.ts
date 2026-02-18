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
  PLANS_FIELD_MAP,
} from "@/lib/explore-filters";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Simple TTL cache — avoids redundant DB hits for identical explore queries
// (e.g. React Query refetches on focus, rapid filter toggling, etc.)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000; // 30 seconds
const CACHE_MAX_ENTRIES = 50;

const queryCache = new Map<string, { data: unknown; expiresAt: number }>();

function getCached<T>(key: string): T | undefined {
  const entry = queryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  // Evict oldest entries if at capacity
  if (queryCache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = queryCache.keys().next().value;
    if (firstKey !== undefined) queryCache.delete(firstKey);
  }
  queryCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

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

  // Visible columns (comma-separated client keys) — used to trim the select
  const columnsParam = url.searchParams.get("columns");
  const columns: string[] | null = columnsParam
    ? columnsParam.split(",").filter(Boolean)
    : null;

  return { filters, sorts, page, pageSize, columns };
}

// ---------------------------------------------------------------------------
// Map from client column key → Prisma field name for districts
// (Reverse of DISTRICT_FIELD_MAP for scalar fields; relations handled separately)
// ---------------------------------------------------------------------------

const CLIENT_TO_PRISMA: Record<string, string> = Object.fromEntries(
  Object.entries(DISTRICT_FIELD_MAP).map(([clientKey, prismaField]) => [
    clientKey,
    prismaField,
  ])
);

// Relation columns that need special select objects
const RELATION_SELECTS: Record<string, Record<string, unknown>> = {
  tags: {
    districtTags: {
      select: { tag: { select: { id: true, name: true, color: true } } },
    },
  },
  planNames: {
    territoryPlans: { select: { plan: { select: { id: true, name: true, color: true } } } },
  },
  lastActivity: {
    activityLinks: {
      select: { activity: { select: { startDate: true } } },
      orderBy: { activity: { startDate: "desc" } },
      take: 1,
    },
  },
};

// Columns always fetched (needed for row identity and aggregates)
const ALWAYS_SELECT = ["leaid", "name", "stateAbbrev"] as const;

function buildDistrictSelect(columns: string[] | null): Record<string, unknown> {
  // No column restriction → fetch everything (backwards-compatible)
  if (!columns) {
    return buildFullDistrictSelect();
  }

  const select: Record<string, unknown> = {};

  // Always include identity columns
  for (const f of ALWAYS_SELECT) {
    select[f] = true;
  }

  // Add requested scalar columns
  for (const col of columns) {
    const prismaField = CLIENT_TO_PRISMA[col];
    if (prismaField && !(prismaField in select)) {
      select[prismaField] = true;
    }
    // Add relation columns
    const relSelect = RELATION_SELECTS[col];
    if (relSelect) {
      Object.assign(select, relSelect);
    }
  }

  // Also select any fields used in aggregate (enrollment, fy26OpenPipeline, fy26ClosedWonNetBooking)
  select.enrollment = true;
  select.fy26OpenPipeline = true;
  select.fy26ClosedWonNetBooking = true;

  return select;
}

function buildFullDistrictSelect(): Record<string, unknown> {
  // Original full select — all scalar + relation fields
  const select: Record<string, unknown> = {};
  // Include all mapped scalar fields
  const seen = new Set<string>();
  for (const prismaField of Object.values(DISTRICT_FIELD_MAP)) {
    if (!seen.has(prismaField)) {
      select[prismaField] = true;
      seen.add(prismaField);
    }
  }
  // Include all relations
  for (const relSelect of Object.values(RELATION_SELECTS)) {
    Object.assign(select, relSelect);
  }
  return select;
}

// ---------------------------------------------------------------------------
// DISTRICTS handler
// ---------------------------------------------------------------------------

async function handleDistricts(req: NextRequest) {
  const { filters, sorts, page, pageSize, columns } = parseQueryParams(req);
  const where = buildWhereClause(filters, DISTRICT_FIELD_MAP);

  // Build orderBy (multi-sort: Prisma accepts an array of single-key objects)
  const orderBy: Record<string, string>[] = [];
  for (const s of sorts) {
    const field = DISTRICT_FIELD_MAP[s.column];
    if (field) orderBy.push({ [field]: s.direction });
  }
  if (orderBy.length === 0) orderBy.push({ name: "asc" });

  const districtSelect = buildDistrictSelect(columns);

  const [rows, total, aggResult] = await Promise.all([
    prisma.district.findMany({
      where,
      select: districtSelect,
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

  // Reshape rows: map Prisma field names → client keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (rows as any[]).map((d) => {
    const row: Record<string, unknown> = {};

    // Map scalar fields using DISTRICT_FIELD_MAP (clientKey → prismaField)
    for (const [clientKey, prismaField] of Object.entries(DISTRICT_FIELD_MAP)) {
      if (prismaField in d) {
        row[clientKey] = d[prismaField];
      }
    }

    // Relations (only if fetched)
    if (d.districtTags) {
      row.tags = d.districtTags.map((dt: { tag: unknown }) => dt.tag);
    }
    if (d.territoryPlans) {
      row.planNames = d.territoryPlans.map((tp: { plan: { id: string; name: string; color: string } }) => tp.plan);
    }
    if (d.activityLinks) {
      row.lastActivity = d.activityLinks[0]?.activity?.startDate ?? null;
    }

    return row;
  });

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
  const [rows, total, completedCount, positiveOutcomes, uniqueDistrictCount] = await Promise.all([
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
        notes: true,
        source: true,
        createdAt: true,
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
    // Count distinct districts touched — use raw SQL COUNT(DISTINCT) when
    // no explore filters are active (common case), avoiding the expensive
    // groupBy that loads all unique district rows into Node memory.
    filters.length === 0
      ? prisma.$queryRaw<[{ count: number }]>`
          SELECT COUNT(DISTINCT ad.district_leaid)::int AS count
          FROM activity_districts ad
          JOIN activities a ON a.id = ad.activity_id
          WHERE a.created_by_user_id = ${userId}
        `.then((r) => r[0].count)
      : prisma.activityDistrict
          .groupBy({ by: ["districtLeaid"], where: { activity: where } })
          .then((r) => r.length),
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
    notes: a.notes,
    source: a.source,
    createdAt: a.createdAt,
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
      unique_districts_touched: uniqueDistrictCount,
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
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
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
        activities: {
          select: {
            activity: { select: { title: true, id: true } },
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
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    districtNames: t.districts.map((d) => d.district.name),
    planNames: t.plans.map((p) => p.plan.name),
    contactNames: t.contacts.map((c) => c.contact.name),
    activityNames: t.activities.map((a) => a.activity.title),
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
  const [rows, total, primaryCount, uniqueDistrictCount, contactsWithRecentActivity] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        phone: true,
        isPrimary: true,
        linkedinUrl: true,
        persona: true,
        seniorityLevel: true,
        createdAt: true,
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
    // Count distinct districts — use raw SQL COUNT(DISTINCT) when no filters,
    // avoiding groupBy that loads all unique rows into Node memory.
    filters.length === 0
      ? prisma.$queryRaw<[{ count: number }]>`
          SELECT COUNT(DISTINCT leaid)::int AS count FROM contacts
        `.then((r) => r[0].count)
      : prisma.contact
          .groupBy({ by: ["leaid"], where })
          .then((r) => r.length),
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
    linkedinUrl: c.linkedinUrl,
    persona: c.persona,
    seniorityLevel: c.seniorityLevel,
    createdAt: c.createdAt,
    districtName: c.district.name,
    districtLeaid: c.district.leaid,
    lastActivity: c.activityLinks[0]?.activity?.startDate ?? null,
  }));

  return {
    data,
    aggregates: {
      count: total,
      primary_count: primaryCount,
      unique_districts: uniqueDistrictCount,
      contacts_with_recent_activity: contactsWithRecentActivity,
    },
    pagination: { page, pageSize, total },
  };
}

// ---------------------------------------------------------------------------
// PLANS handler
// ---------------------------------------------------------------------------

async function handlePlans(req: NextRequest, userId: string) {
  const { filters, sorts, page, pageSize } = parseQueryParams(req);

  // Build where — filter out virtual/computed fields that Prisma can't handle
  const prismaFilters = filters.filter((f) => PLANS_FIELD_MAP[f.column]);
  const where: Record<string, unknown> = {
    ...buildWhereClause(prismaFilters, PLANS_FIELD_MAP),
    userId,
  };

  // Build orderBy
  const orderBy: Record<string, unknown>[] = [];
  for (const s of sorts) {
    if (s.column === "ownerName") {
      orderBy.push({ ownerUser: { fullName: s.direction } });
    } else {
      const field = PLANS_FIELD_MAP[s.column];
      if (field) orderBy.push({ [field]: s.direction });
    }
  }
  if (orderBy.length === 0) orderBy.push({ updatedAt: "desc" });

  const [rows, total] = await Promise.all([
    prisma.territoryPlan.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        fiscalYear: true,
        color: true,
        createdAt: true,
        updatedAt: true,
        ownerUser: { select: { fullName: true } },
        districts: {
          select: {
            districtLeaid: true,
            renewalTarget: true,
            expansionTarget: true,
            winbackTarget: true,
            newBusinessTarget: true,
            notes: true,
            district: { select: { name: true, leaid: true } },
          },
        },
        states: { select: { stateFips: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.territoryPlan.count({ where }),
  ]);

  // Reshape rows and compute rollups
  const data = rows.map((p) => {
    let renewalRollup = 0;
    let expansionRollup = 0;
    let winbackRollup = 0;
    let newBusinessRollup = 0;

    const planDistricts = p.districts.map((d) => {
      const renewal = d.renewalTarget ? Number(d.renewalTarget) : 0;
      const expansion = d.expansionTarget ? Number(d.expansionTarget) : 0;
      const winback = d.winbackTarget ? Number(d.winbackTarget) : 0;
      const newBiz = d.newBusinessTarget ? Number(d.newBusinessTarget) : 0;
      renewalRollup += renewal;
      expansionRollup += expansion;
      winbackRollup += winback;
      newBusinessRollup += newBiz;
      return {
        leaid: d.districtLeaid,
        name: d.district.name,
        renewalTarget: renewal,
        expansionTarget: expansion,
        winbackTarget: winback,
        newBusinessTarget: newBiz,
        notes: d.notes,
      };
    });

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      fiscalYear: p.fiscalYear,
      color: p.color,
      ownerName: p.ownerUser?.fullName ?? null,
      districtCount: p.districts.length,
      stateCount: p.states.length,
      renewalRollup,
      expansionRollup,
      winbackRollup,
      newBusinessRollup,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      _districts: planDistricts,
    };
  });

  // Compute aggregates across ALL matching plans (not just current page)
  const aggResult = await prisma.$queryRaw<
    [{ total_districts: number; renewal_sum: number; expansion_sum: number; winback_sum: number; new_business_sum: number }]
  >`
    SELECT
      COUNT(DISTINCT tpd.district_leaid)::int AS total_districts,
      COALESCE(SUM(tpd.renewal_target), 0)::float AS renewal_sum,
      COALESCE(SUM(tpd.expansion_target), 0)::float AS expansion_sum,
      COALESCE(SUM(tpd.winback_target), 0)::float AS winback_sum,
      COALESCE(SUM(tpd.new_business_target), 0)::float AS new_business_sum
    FROM territory_plan_districts tpd
    JOIN territory_plans tp ON tp.id = tpd.plan_id
    WHERE tp.user_id = ${userId}::uuid
  `;

  const agg = aggResult[0];

  return {
    data,
    aggregates: {
      totalDistricts: agg.total_districts,
      renewalSum: agg.renewal_sum,
      expansionSum: agg.expansion_sum,
      winbackSum: agg.winback_sum,
      newBusinessSum: agg.new_business_sum,
    },
    pagination: { page, pageSize, total },
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const VALID_ENTITIES = new Set(["districts", "activities", "tasks", "contacts", "plans"]);

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

    // Build cache key from entity + user + query string
    const cacheKey = `${entity}:${user.id}:${req.nextUrl.search}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
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
      case "plans":
        result = await handlePlans(req, user.id);
        break;
    }

    setCache(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error in explore API:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
