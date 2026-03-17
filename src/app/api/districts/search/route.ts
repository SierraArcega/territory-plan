// GET /api/districts/search — Viewport-bound district search with filters
// Used by the Zillow-style district search panel on the map.
// Supports bounding box, ZIP+radius, filters, sorting, and pagination.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import {
  type FilterDef,
  buildWhereClause,
  DISTRICT_FIELD_MAP,
} from "@/features/explore/lib/filters";

export const dynamic = "force-dynamic";

// Competitor vendor IDs → competitor names in the database
const COMPETITOR_NAMES: Record<string, string> = {
  proximity: "Proximity Learning",
  elevate: "Elevate K12",
  tbt: "Tutored By Teachers",
  educere: "Educere",
};

// Fields returned per district card
const CARD_SELECT = {
  leaid: true,
  name: true,
  stateAbbrev: true,
  countyName: true,
  enrollment: true,
  isCustomer: true,
  accountType: true,
  owner: true,
  ellPct: true,
  swdPct: true,
  childrenPovertyPercent: true,
  medianHouseholdIncome: true,
  expenditurePerPupil: true,
  urbanCentricLocale: true,
  fy26OpenPipeline: true,
  fy26ClosedWonNetBooking: true,
  territoryPlans: {
    select: { plan: { select: { id: true, name: true, color: true } } },
  },
} as const;

// Map client sort keys to Prisma fields
const SORT_FIELD_MAP: Record<string, string> = {
  ...DISTRICT_FIELD_MAP,
  name: "name",
  enrollment: "enrollment",
};

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;

  // Parse bounding box: bounds=west,south,east,north
  const boundsParam = url.searchParams.get("bounds");
  let bounds: [number, number, number, number] | null = null;
  if (boundsParam) {
    const parts = boundsParam.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
      bounds = parts as [number, number, number, number];
    }
  }

  // Parse filters — separate _zipRadius from regular filters
  let filters: FilterDef[] = [];
  let zipRadius: { lat: number; lng: number; miles: number } | null = null;
  const filtersParam = url.searchParams.get("filters");
  if (filtersParam) {
    try {
      const parsed = JSON.parse(filtersParam) as any[];
      for (const f of parsed) {
        if (f.column === "_zipRadius" && f.value) {
          zipRadius = { lat: f.value.lat, lng: f.value.lng, miles: f.value.miles };
        } else {
          filters.push(f);
        }
      }
    } catch {
      // ignore malformed
    }
  }

  // Sort
  const sortCol = url.searchParams.get("sort") ?? "enrollment";
  const sortDir = (url.searchParams.get("order") ?? "desc") as "asc" | "desc";

  // Pagination
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));

  // Separate relation/special filters from scalar filters
  // Scalar filters map directly to District columns via DISTRICT_FIELD_MAP.
  // Relation filters need custom Prisma where clauses (tags, plans, competitors).
  const RELATION_COLUMNS = new Set(["tags", "planNames", "competitorChurned", "competitorEngagement"]);
  const scalarFilters: FilterDef[] = [];
  const relationFilters: FilterDef[] = [];
  for (const f of filters) {
    if (f.column.startsWith("competitor_") || RELATION_COLUMNS.has(f.column)) {
      relationFilters.push(f);
    } else {
      scalarFilters.push(f);
    }
  }

  // Coerce filter values to match DB column types before building where clause
  // urbanicity (urbanCentricLocale) is Int but client sends string[]
  for (const f of scalarFilters) {
    if (f.column === "urbanicity" && f.op === "in" && Array.isArray(f.value)) {
      f.value = (f.value as string[]).map(Number);
    }
  }

  // Build where clause from regular scalar filters
  // All filters are AND'd across columns. Same-column "in" values are OR'd (merged).
  const filterWhere = buildWhereClause(scalarFilters, DISTRICT_FIELD_MAP);

  // Build relation-based where clauses (tags, plans, competitors)
  const relationWhere: Record<string, unknown> = {};
  for (const f of relationFilters) {
    const names = Array.isArray(f.value) ? f.value as string[] : typeof f.value === "string" ? [f.value] : [];

    // Tags relation filter
    if (f.column === "tags") {
      if (f.op === "eq" && names.length > 0) {
        if (!relationWhere.AND) relationWhere.AND = [];
        (relationWhere.AND as unknown[]).push({
          districtTags: { some: { tag: { name: { in: names, mode: "insensitive" } } } },
        });
      } else if (f.op === "neq" && names.length > 0) {
        if (!relationWhere.AND) relationWhere.AND = [];
        (relationWhere.AND as unknown[]).push({
          districtTags: { none: { tag: { name: { in: names, mode: "insensitive" } } } },
        });
      } else if (f.op === "is_empty") {
        relationWhere.districtTags = { none: {} };
      } else if (f.op === "is_not_empty") {
        relationWhere.districtTags = { some: {} };
      }
    }

    // Plan membership relation filter
    if (f.column === "planNames") {
      if (f.op === "eq" && names.length > 0) {
        if (!relationWhere.AND) relationWhere.AND = [];
        (relationWhere.AND as unknown[]).push({
          territoryPlans: { some: { plan: { name: { in: names, mode: "insensitive" } } } },
        });
      } else if (f.op === "neq" && names.length > 0) {
        if (!relationWhere.AND) relationWhere.AND = [];
        (relationWhere.AND as unknown[]).push({
          territoryPlans: { none: { plan: { name: { in: names, mode: "insensitive" } } } },
        });
      } else if (f.op === "is_empty") {
        relationWhere.territoryPlans = { none: {} };
      } else if (f.op === "is_not_empty") {
        relationWhere.territoryPlans = { some: {} };
      }
    }

    // competitor_proximity, competitor_elevate, etc. → "has competitor spend"
    if (f.column.startsWith("competitor_")) {
      const vendorId = f.column.replace("competitor_", "");
      const competitorName = COMPETITOR_NAMES[vendorId];
      if (!competitorName) continue;

      if (f.op === "is_not_empty") {
        if (!relationWhere.AND) relationWhere.AND = [];
        (relationWhere.AND as unknown[]).push({
          competitorSpend: { some: { competitor: competitorName } },
        });
      } else if (f.op === "is_empty") {
        if (!relationWhere.AND) relationWhere.AND = [];
        (relationWhere.AND as unknown[]).push({
          competitorSpend: { none: { competitor: competitorName } },
        });
      }
    }

    // competitorEngagement → has any competitor spend at all
    if (f.column === "competitorEngagement") {
      if (f.op === "is_not_empty") {
        relationWhere.competitorSpend = { some: {} };
      }
    }

    // competitorChurned → had competitor revenue in prior FY but not current
    // vendor_financials uses lowercase vendor names ('proximity', 'elevate', etc.)
    if (f.column === "competitorChurned" && f.op === "is_true") {
      if (!relationWhere.AND) relationWhere.AND = [];
      (relationWhere.AND as unknown[]).push({
        vendorFinancials: {
          some: {
            vendor: { not: "fullmind" },
            fiscalYear: "FY25",
            totalRevenue: { gt: 0 },
          },
        },
      });
      (relationWhere.AND as unknown[]).push({
        vendorFinancials: {
          none: {
            vendor: { not: "fullmind" },
            fiscalYear: "FY26",
            totalRevenue: { gt: 0 },
          },
        },
      });
    }
  }

  // ZIP + radius: find districts within X miles of a point using PostGIS
  let zipRadiusLeaids: string[] | null = null;
  if (zipRadius) {
    const meters = zipRadius.miles * 1609.34;
    const result = await prisma.$queryRaw<{ leaid: string }[]>`
      SELECT leaid FROM districts
      WHERE ST_DWithin(
        COALESCE(centroid, point_location)::geography,
        ST_SetSRID(ST_MakePoint(${zipRadius.lng}, ${zipRadius.lat}), 4326)::geography,
        ${meters}
      )
    `;
    zipRadiusLeaids = result.map((r) => r.leaid);
  }

  // Viewport bounding box — only used when no ZIP radius AND no attribute filters
  // are active. When attribute filters narrow the result set, we show ALL matching
  // districts regardless of viewport (many districts lack geometry and would be
  // silently excluded by a bounds query).
  const hasAttributeFilters = scalarFilters.length > 0 || relationFilters.length > 0;
  let boundsLeaids: string[] | null = null;
  if (!zipRadius && bounds && !hasAttributeFilters) {
    const [west, south, east, north] = bounds;
    const result = await prisma.$queryRaw<{ leaid: string }[]>`
      SELECT leaid FROM districts
      WHERE ST_X(COALESCE(centroid::geometry, point_location::geometry)) BETWEEN ${west} AND ${east}
        AND ST_Y(COALESCE(centroid::geometry, point_location::geometry)) BETWEEN ${south} AND ${north}
    `;
    boundsLeaids = result.map((r) => r.leaid);
  }

  // Combine all spatial + attribute + competitor filters
  const where: Record<string, unknown> = { ...filterWhere, ...relationWhere };
  // Merge AND arrays if both exist
  if (filterWhere.AND && relationWhere.AND) {
    where.AND = [...(filterWhere.AND as unknown[]), ...(relationWhere.AND as unknown[])];
  }
  if (zipRadiusLeaids !== null) {
    where.leaid = { in: zipRadiusLeaids };
  } else if (boundsLeaids !== null) {
    where.leaid = { in: boundsLeaids };
  }

  // Sort
  const prismaSort = SORT_FIELD_MAP[sortCol] ?? "enrollment";
  const orderBy = { [prismaSort]: sortDir };

  // Count + fetch in parallel
  const [total, districts] = await Promise.all([
    prisma.district.count({ where }),
    prisma.district.findMany({
      where,
      select: CARD_SELECT,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  // Return all matching leaids + centroids for map highlighting
  // Fetch when we have any filters active (attribute or spatial)
  let matchingLeaids: string[] | undefined;
  let matchingCentroids: Array<{ leaid: string; lat: number; lng: number }> = [];
  const hasActiveFilters = scalarFilters.length > 0 || relationFilters.length > 0 || zipRadiusLeaids !== null;
  if (hasActiveFilters) {
    // For map dimming we want all matches regardless of viewport
    const matchWhere: Record<string, unknown> = { ...filterWhere, ...relationWhere };
    if (filterWhere.AND && relationWhere.AND) {
      matchWhere.AND = [...(filterWhere.AND as unknown[]), ...(relationWhere.AND as unknown[])];
    }
    if (zipRadiusLeaids !== null) {
      matchWhere.leaid = { in: zipRadiusLeaids };
    }
    const leaidRows = await prisma.district.findMany({
      where: matchWhere,
      select: { leaid: true },
    });
    matchingLeaids = leaidRows.map((r) => r.leaid);

    // Fetch centroids for dot markers (always visible regardless of zoom)
    if (matchingLeaids.length > 0 && matchingLeaids.length <= 5000) {
      const centroidRows = await prisma.$queryRaw<Array<{ leaid: string; lat: number; lng: number }>>`
        SELECT leaid,
          ST_Y(COALESCE(centroid::geometry, point_location::geometry)) as lat,
          ST_X(COALESCE(centroid::geometry, point_location::geometry)) as lng
        FROM districts
        WHERE leaid = ANY(${matchingLeaids})
          AND COALESCE(centroid, point_location) IS NOT NULL
      `;
      matchingCentroids = centroidRows.map((r) => ({
        leaid: r.leaid,
        lat: Number(r.lat),
        lng: Number(r.lng),
      }));
    }
  }

  return NextResponse.json({
    data: districts,
    matchingLeaids,
    matchingCentroids,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
