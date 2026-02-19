// GET /api/explore/[entity] — Unified explore endpoint for districts, activities, tasks, contacts
// Supports JSON-encoded filters, sorting, and pagination.
// Returns { data, aggregates, pagination }.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getUser } from "@/lib/supabase/server";
import {
  type FilterDef,
  buildWhereClause,
  DISTRICT_FIELD_MAP,
  PLANS_FIELD_MAP,
} from "@/lib/explore-filters";
import { parseCompetitorColumnKey, COMPETITORS } from "@/components/map-v2/explore/columns/districtColumns";

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
  if (!columns) {
    return buildFullDistrictSelect();
  }

  const select: Record<string, unknown> = {};

  for (const f of ALWAYS_SELECT) {
    select[f] = true;
  }

  let needsCompetitorSpend = false;

  for (const col of columns) {
    const prismaField = CLIENT_TO_PRISMA[col];
    if (prismaField && !(prismaField in select)) {
      select[prismaField] = true;
    }
    const relSelect = RELATION_SELECTS[col];
    if (relSelect) {
      Object.assign(select, relSelect);
    }
    if (parseCompetitorColumnKey(col)) {
      needsCompetitorSpend = true;
    }
    if (col === "ltv") {
      // LTV is virtual — ensure source columns are fetched
      select.fy25ClosedWonNetBooking = true;
      select.fy26ClosedWonNetBooking = true;
      select.fy25NetInvoicing = true;
      select.fy26NetInvoicing = true;
      select.fy25SessionsRevenue = true;
      select.fy26SessionsRevenue = true;
    }
  }

  if (needsCompetitorSpend) {
    select.competitorSpend = {
      select: { competitor: true, fiscalYear: true, totalSpend: true },
    };
  }

  select.enrollment = true;
  select.fy26OpenPipeline = true;
  select.fy26ClosedWonNetBooking = true;

  return select;
}

function buildFullDistrictSelect(): Record<string, unknown> {
  const select: Record<string, unknown> = {};
  const seen = new Set<string>();
  for (const prismaField of Object.values(DISTRICT_FIELD_MAP)) {
    if (!seen.has(prismaField)) {
      select[prismaField] = true;
      seen.add(prismaField);
    }
  }
  for (const relSelect of Object.values(RELATION_SELECTS)) {
    Object.assign(select, relSelect);
  }
  select.competitorSpend = {
    select: { competitor: true, fiscalYear: true, totalSpend: true },
  };
  return select;
}

// ---------------------------------------------------------------------------
// DISTRICTS handler
// ---------------------------------------------------------------------------

// Build Prisma where clauses for relation-based filters (tags, plans)
function buildRelationWhere(filters: FilterDef[]): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const f of filters) {
    // Value can be a single string or array of strings
    const names = Array.isArray(f.value) ? f.value as string[] : typeof f.value === "string" ? [f.value] : [];

    if (f.column === "tags") {
      if (f.op === "eq" && names.length > 0) {
        // "includes any of" — match districts with at least one of the named tags
        where.districtTags = { some: { tag: { name: { in: names, mode: "insensitive" } } } };
      } else if (f.op === "neq" && names.length > 0) {
        where.districtTags = { none: { tag: { name: { in: names, mode: "insensitive" } } } };
      } else if (f.op === "is_empty") {
        where.districtTags = { none: {} };
      } else if (f.op === "is_not_empty") {
        where.districtTags = { some: {} };
      }
    } else if (f.column === "planNames") {
      if (f.op === "eq" && names.length > 0) {
        where.territoryPlans = { some: { plan: { name: { in: names, mode: "insensitive" } } } };
      } else if (f.op === "neq" && names.length > 0) {
        where.territoryPlans = { none: { plan: { name: { in: names, mode: "insensitive" } } } };
      } else if (f.op === "is_empty") {
        where.territoryPlans = { none: {} };
      } else if (f.op === "is_not_empty") {
        where.territoryPlans = { some: {} };
      }
    }

    // Competitor spend filters (comp_{slug}_{fy})
    const compParsed = parseCompetitorColumnKey(f.column);
    if (compParsed) {
      const fyValue = compParsed.fiscalYear.toUpperCase(); // DB stores "FY25" not "fy25"
      const compFilter: Record<string, unknown> = {
        competitor: compParsed.competitor,
        fiscalYear: fyValue,
      };

      switch (f.op) {
        case "eq":
          compFilter.totalSpend = f.value;
          break;
        case "neq":
          compFilter.totalSpend = { not: f.value };
          break;
        case "gt":
          compFilter.totalSpend = { gt: f.value };
          break;
        case "lt":
          compFilter.totalSpend = { lt: f.value };
          break;
        case "between": {
          const [min, max] = f.value as [number, number];
          compFilter.totalSpend = { gte: min, lte: max };
          break;
        }
      }

      if (f.op === "is_empty") {
        if (!where.AND) where.AND = [];
        (where.AND as unknown[]).push({
          competitorSpend: { none: { competitor: compParsed.competitor, fiscalYear: fyValue } },
        });
      } else if (f.op === "is_not_empty") {
        if (!where.AND) where.AND = [];
        (where.AND as unknown[]).push({
          competitorSpend: { some: { competitor: compParsed.competitor, fiscalYear: fyValue } },
        });
      } else {
        if (!where.AND) where.AND = [];
        (where.AND as unknown[]).push({
          competitorSpend: { some: compFilter },
        });
      }
    }
  }

  return where;
}

async function handleDistricts(req: NextRequest) {
  const { filters, sorts, page, pageSize, columns } = parseQueryParams(req);

  // Separate relation filters (tags, planNames) from scalar filters
  const RELATION_COLUMNS = new Set(["tags", "planNames"]);
  const scalarFilters = filters.filter((f) => !RELATION_COLUMNS.has(f.column) && !f.column.startsWith("comp_"));
  const relationFilters = filters.filter((f) => RELATION_COLUMNS.has(f.column) || f.column.startsWith("comp_"));

  const where = {
    ...buildWhereClause(scalarFilters, DISTRICT_FIELD_MAP),
    ...buildRelationWhere(relationFilters),
  };

  // Build orderBy (multi-sort: Prisma accepts an array of single-key objects)
  const compSortEntry = sorts.find((s) => parseCompetitorColumnKey(s.column));
  const scalarSorts = sorts.filter((s) => !parseCompetitorColumnKey(s.column));
  const orderBy: Record<string, string>[] = [];
  for (const s of scalarSorts) {
    const field = DISTRICT_FIELD_MAP[s.column];
    if (field) orderBy.push({ [field]: s.direction });
  }
  const districtSelect = buildDistrictSelect(columns);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[];
  let total: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aggResult: any;

  if (compSortEntry) {
    // Competitor sort requires raw SQL since Prisma can't sort by a filtered relation field.
    // 1) Get all matching leaids + aggregates using Prisma (respects all filters)
    // 2) Sort those leaids by competitor spend via raw SQL + paginate
    // 3) Fetch full data for the resulting page
    const compParsed = parseCompetitorColumnKey(compSortEntry.column)!;
    const fyValue = compParsed.fiscalYear.toUpperCase();
    const dir = compSortEntry.direction === "desc" ? Prisma.raw("DESC") : Prisma.raw("ASC");

    const [matchingIds, aggRes] = await Promise.all([
      prisma.district.findMany({ where, select: { leaid: true } }),
      prisma.district.aggregate({
        where,
        _count: { leaid: true },
        _sum: { enrollment: true, fy26OpenPipeline: true, fy26ClosedWonNetBooking: true },
      }),
    ]);
    total = matchingIds.length;
    aggResult = aggRes;

    const leaidArray = matchingIds.map((r) => r.leaid);

    const sortedPage = await prisma.$queryRaw<{ leaid: string }[]>`
      SELECT sub.leaid
      FROM unnest(${leaidArray}::varchar[]) AS sub(leaid)
      LEFT JOIN competitor_spend cs
        ON cs.leaid = sub.leaid
        AND cs.competitor = ${compParsed.competitor}
        AND cs.fiscal_year = ${fyValue}
      ORDER BY cs.total_spend ${dir} NULLS LAST
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;

    const pageLeaids = sortedPage.map((r) => r.leaid);
    rows = await prisma.district.findMany({
      where: { leaid: { in: pageLeaids } },
      select: districtSelect,
    });

    // Maintain sort order from raw SQL
    const orderMap = new Map(pageLeaids.map((id, i) => [id, i]));
    rows.sort((a, b) => (orderMap.get(a.leaid) ?? 0) - (orderMap.get(b.leaid) ?? 0));
  } else {
    // Standard Prisma sort path
    if (orderBy.length === 0) orderBy.push({ name: "asc" });

    [rows, total, aggResult] = await Promise.all([
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
  }

  // Reshape rows: map Prisma field names → client keys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (rows as any[]).map((d) => {
    const row: Record<string, unknown> = {};

    // Map scalar fields using DISTRICT_FIELD_MAP (clientKey → prismaField)
    // Prisma Decimal objects must be converted to numbers for proper JSON serialization
    for (const [clientKey, prismaField] of Object.entries(DISTRICT_FIELD_MAP)) {
      if (prismaField in d) {
        const val = d[prismaField];
        row[clientKey] = val != null && typeof val === "object" && "toNumber" in val ? Number(val) : val;
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

    // LTV — virtual computed field: EK12 bookings + MAX(Fullmind invoicing, sessions revenue) per FY
    {
      const toNum = (v: unknown) =>
        v != null && typeof v === "object" && "toNumber" in (v as Record<string, unknown>) ? Number(v) : (typeof v === "number" ? v : 0);
      const fy25Booking = toNum(d.fy25ClosedWonNetBooking);
      const fy26Booking = toNum(d.fy26ClosedWonNetBooking);
      const fy25Invoicing = toNum(d.fy25NetInvoicing);
      const fy26Invoicing = toNum(d.fy26NetInvoicing);
      const fy25Sessions = toNum(d.fy25SessionsRevenue);
      const fy26Sessions = toNum(d.fy26SessionsRevenue);
      const ltv =
        fy25Booking + fy26Booking +
        Math.max(fy25Invoicing, fy25Sessions) +
        Math.max(fy26Invoicing, fy26Sessions);
      row.ltv = ltv || null;
    }

    // Competitor spend → flat keys
    if (d.competitorSpend) {
      for (const cs of d.competitorSpend as { competitor: string; fiscalYear: string; totalSpend: unknown }[]) {
        const comp = COMPETITORS.find((c) => c.name === cs.competitor);
        if (comp) {
          const key = `comp_${comp.slug}_${cs.fiscalYear.toLowerCase()}`;
          row[key] = cs.totalSpend != null ? Number(cs.totalSpend) : null;
        }
      }
    }

    return row;
  });

  return {
    data,
    aggregates: {
      count: aggResult._count.leaid,
      enrollment_sum: aggResult._sum.enrollment,
      pipeline_sum: aggResult._sum.fy26OpenPipeline,
      closed_won_sum: aggResult._sum.fy26ClosedWonNetBooking,
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
      completed: completedCount,
      positiveOutcomes: positiveOutcomes,
      districtsTouched: uniqueDistrictCount,
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
      overdue: overdueCount,
      completed: completedCount,
      blocked: blockedCount,
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
      primaryCount: primaryCount,
      districtsCovered: uniqueDistrictCount,
      withRecentActivity: contactsWithRecentActivity,
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
        districtCount: true,
        stateCount: true,
        renewalRollup: true,
        expansionRollup: true,
        winbackRollup: true,
        newBusinessRollup: true,
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
            district: {
              select: {
                name: true,
                leaid: true,
                districtTags: {
                  select: { tag: { select: { id: true, name: true, color: true } } },
                },
              },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.territoryPlan.count({ where }),
  ]);

  // Reshape rows — read rollups from denormalized plan columns
  const data = rows.map((p) => {
    const planDistricts = p.districts.map((d) => ({
      leaid: d.districtLeaid,
      name: d.district.name,
      renewalTarget: d.renewalTarget ? Number(d.renewalTarget) : 0,
      expansionTarget: d.expansionTarget ? Number(d.expansionTarget) : 0,
      winbackTarget: d.winbackTarget ? Number(d.winbackTarget) : 0,
      newBusinessTarget: d.newBusinessTarget ? Number(d.newBusinessTarget) : 0,
      notes: d.notes,
      tags: d.district.districtTags.map((dt: { tag: { id: number; name: string; color: string } }) => dt.tag),
    }));

    const renewal = Number(p.renewalRollup);
    const expansion = Number(p.expansionRollup);
    const winback = Number(p.winbackRollup);
    const newBiz = Number(p.newBusinessRollup);

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      fiscalYear: p.fiscalYear,
      color: p.color,
      ownerName: p.ownerUser?.fullName ?? null,
      districtCount: p.districtCount,
      stateCount: p.stateCount,
      renewalRollup: renewal,
      expansionRollup: expansion,
      winbackRollup: winback,
      newBusinessRollup: newBiz,
      totalTargets: renewal + expansion + winback + newBiz,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      _districts: planDistricts,
    };
  });

  // If no explicit sort was requested, default to totalTargets descending
  const hasTotalTargetsSort = sorts.some((s) => s.column === "totalTargets");
  if (sorts.length === 0 || hasTotalTargetsSort) {
    const dir = hasTotalTargetsSort
      ? sorts.find((s) => s.column === "totalTargets")!.direction
      : "desc";
    data.sort((a, b) =>
      dir === "desc"
        ? (b.totalTargets || 0) - (a.totalTargets || 0)
        : (a.totalTargets || 0) - (b.totalTargets || 0)
    );
  }

  // Compute aggregates across ALL matching plans (respects filters)
  const aggResult = await prisma.territoryPlan.aggregate({
    where,
    _sum: {
      districtCount: true,
      renewalRollup: true,
      expansionRollup: true,
      winbackRollup: true,
      newBusinessRollup: true,
    },
  });

  // Sum FY27 pipeline across plan districts (non-blocking — fallback to 0 on error)
  let fy27PipelineSum = 0;
  try {
    const fy27Result = await prisma.$queryRaw<[{ total: number | null }]>`
      SELECT COALESCE(SUM(d.fy27_open_pipeline), 0)::float AS total
      FROM territory_plan_districts tpd
      JOIN districts d ON d.leaid = tpd.district_leaid
      WHERE tpd.plan_id IN (
        SELECT id FROM territory_plans WHERE user_id = ${userId}::uuid
      )
    `;
    fy27PipelineSum = fy27Result[0]?.total ?? 0;
  } catch (e) {
    console.error("FY27 pipeline aggregate failed:", e);
  }

  return {
    data,
    aggregates: {
      totalDistricts: aggResult._sum.districtCount ?? 0,
      renewalSum: Number(aggResult._sum.renewalRollup ?? 0),
      expansionSum: Number(aggResult._sum.expansionRollup ?? 0),
      winbackSum: Number(aggResult._sum.winbackRollup ?? 0),
      newBusinessSum: Number(aggResult._sum.newBusinessRollup ?? 0),
      fy27PipelineSum,
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
