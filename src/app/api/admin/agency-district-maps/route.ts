import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { normalizeState } from "@/lib/states";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["untriaged", "district", "state", "non_lea", "all"]);
const SORTABLE = new Set([
  "unresolved_rfp_count",
  "total_rfp_count",
  "latest_captured",
  "soonest_open_due",
  "total_value_low",
  "agency_name",
]);

interface AgencyRow {
  agency_key: number;
  agency_name: string;
  agency_path: string | null;
  state_abbrev: string | null;
  unresolved_rfp_count: bigint;
  total_rfp_count: bigint;
  latest_captured: Date | null;
  soonest_open_due: Date | null;
  total_value_low: string | null;
  total_value_high: string | null;
  kind: string | null;
  leaid: string | null;
  state_fips: string | null;
  notes: string | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolved_district_name: string | null;
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const status = (sp.get("status") ?? "untriaged").toLowerCase();
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: `Invalid status (must be one of: ${[...VALID_STATUSES].join(", ")})` },
      { status: 400 }
    );
  }
  const stateRaw = sp.get("state");
  const stateFilter = stateRaw ? normalizeState(stateRaw) : null;
  const q = sp.get("q")?.trim() || null;
  const sortBy = SORTABLE.has(sp.get("sort_by") ?? "") ? sp.get("sort_by")! : "unresolved_rfp_count";
  const sortDir = sp.get("sort_dir") === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(sp.get("page_size") ?? "50", 10)));
  const offset = (page - 1) * pageSize;

  // Build the status WHERE clause via Prisma.sql for safe interpolation.
  const statusWhere: Prisma.Sql =
    status === "untriaged" ? Prisma.sql`m.kind IS NULL` :
    status === "all"       ? Prisma.sql`TRUE` :
                             Prisma.sql`m.kind = ${status}`;

  const stateWhere = stateFilter
    ? Prisma.sql`AND agg.state_abbrev = ${stateFilter}`
    : Prisma.empty;
  const qWhere = q
    ? Prisma.sql`AND agg.agency_name ILIKE ${"%" + q + "%"}`
    : Prisma.empty;

  // sortBy/sortDir come from a whitelist, so direct interpolation via Prisma.raw is safe.
  const orderBy = Prisma.raw(`${sortBy} ${sortDir} NULLS LAST, agg.agency_key`);

  const baseCte = Prisma.sql`
    WITH agg AS (
      SELECT
        r.agency_key,
        MAX(r.agency_name)  AS agency_name,
        MAX(r.agency_path)  AS agency_path,
        MAX(r.state_abbrev) AS state_abbrev,
        COUNT(*) FILTER (WHERE r.leaid IS NULL)            AS unresolved_rfp_count,
        COUNT(*)                                           AS total_rfp_count,
        MAX(r.captured_date)                               AS latest_captured,
        MAX(r.due_date) FILTER (WHERE r.due_date >= now()) AS soonest_open_due,
        SUM(COALESCE(r.value_low,  0))                     AS total_value_low,
        SUM(COALESCE(r.value_high, 0))                     AS total_value_high
      FROM rfps r
      GROUP BY r.agency_key
    )
  `;

  const countRows = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    ${baseCte}
    SELECT COUNT(*)::bigint AS count
    FROM agg
    LEFT JOIN agency_district_maps m ON m.agency_key = agg.agency_key
    WHERE ${statusWhere}
      ${stateWhere}
      ${qWhere}
  `);
  const total = Number(countRows[0]?.count ?? 0);

  const rows = await prisma.$queryRaw<AgencyRow[]>(Prisma.sql`
    ${baseCte}
    SELECT
      agg.*,
      m.kind, m.leaid, m.state_fips, m.notes, m.resolved_at, m.resolved_by,
      d.name AS resolved_district_name
    FROM agg
    LEFT JOIN agency_district_maps m ON m.agency_key = agg.agency_key
    LEFT JOIN districts d            ON d.leaid     = m.leaid
    WHERE ${statusWhere}
      ${stateWhere}
      ${qWhere}
    ORDER BY ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const items = rows.map((r) => ({
    agencyKey: r.agency_key,
    agencyName: r.agency_name,
    agencyPath: r.agency_path,
    stateAbbrev: r.state_abbrev,
    unresolvedRfpCount: Number(r.unresolved_rfp_count),
    totalRfpCount: Number(r.total_rfp_count),
    latestCaptured: r.latest_captured?.toISOString() ?? null,
    soonestOpenDue: r.soonest_open_due?.toISOString() ?? null,
    totalValueLow: r.total_value_low,
    totalValueHigh: r.total_value_high,
    mapping: r.kind
      ? {
          kind: r.kind,
          leaid: r.leaid,
          stateFips: r.state_fips,
          districtName: r.resolved_district_name,
          notes: r.notes,
          resolvedBy: r.resolved_by,
          resolvedAt: r.resolved_at?.toISOString() ?? null,
        }
      : null,
  }));

  return NextResponse.json({ items, pagination: { page, pageSize, total } });
}

interface PostBody {
  agencyKeys: number[];
  kind: "district" | "state" | "non_lea";
  leaid?: string;
  stateFips?: string;
  notes?: string;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { agencyKeys, kind, leaid, stateFips, notes } = body;

  if (!Array.isArray(agencyKeys) || agencyKeys.length === 0) {
    return badRequest("agencyKeys must be a non-empty array");
  }
  if (!agencyKeys.every((k) => Number.isInteger(k) && k > 0)) {
    return badRequest("agencyKeys must contain positive integers");
  }
  if (!["district", "state", "non_lea"].includes(kind)) {
    return badRequest("kind must be one of: district, state, non_lea");
  }

  // Per-kind invariant validation.
  if (kind === "district") {
    // Districts use both NCES 7-digit leaids and 7-character manual ones (A*, M*).
    // FK to districts.leaid will reject any leaid that doesn't actually exist.
    if (!leaid || !/^[A-Za-z0-9]{7}$/.test(leaid)) return badRequest("kind=district requires a 7-character leaid");
    if (stateFips) return badRequest("kind=district must not set stateFips");
  } else if (kind === "state") {
    if (leaid) return badRequest("kind=state must not set leaid");
    if (agencyKeys.length === 1 && !stateFips) {
      return badRequest("kind=state with a single agency requires stateFips");
    }
    if (stateFips && !/^\d{2}$/.test(stateFips)) {
      return badRequest("stateFips must be a 2-digit FIPS code");
    }
  } else {
    if (leaid || stateFips) return badRequest("kind=non_lea must not set leaid or stateFips");
  }

  // For multi-agency state-only, derive stateFips per row from rfps.
  const perAgencyStateFips: Map<number, string> = new Map();
  if (kind === "state" && !stateFips) {
    const rows = await prisma.$queryRaw<{ agency_key: number; state_fips: string | null }[]>(
      Prisma.sql`
        SELECT agency_key, MAX(state_fips) AS state_fips
        FROM rfps
        WHERE agency_key = ANY(${agencyKeys}::int[])
        GROUP BY agency_key
      `
    );
    for (const r of rows) {
      if (!r.state_fips) {
        return badRequest(`Agency ${r.agency_key} has no state — cannot derive stateFips`);
      }
      perAgencyStateFips.set(r.agency_key, r.state_fips);
    }
    if (perAgencyStateFips.size !== agencyKeys.length) {
      return badRequest("Some agencyKeys have no RFPs in the database");
    }
  }

  // Run all writes in a single transaction.
  const cascadedRfpCount = await prisma.$transaction(async (tx) => {
    for (const agencyKey of agencyKeys) {
      const rowStateFips =
        kind === "state"
          ? (stateFips ?? perAgencyStateFips.get(agencyKey)!)
          : null;
      const data = {
        kind,
        leaid: kind === "district" ? leaid! : null,
        stateFips: rowStateFips,
        notes: notes ?? null,
        resolvedBy: user.id,
        resolvedAt: new Date(),
      };
      await tx.agencyDistrictMap.upsert({
        where: { agencyKey },
        create: { agencyKey, ...data },
        update: data,
      });
    }
    if (kind === "district") {
      const r = await tx.rfp.updateMany({
        where: { agencyKey: { in: agencyKeys } },
        data: { leaid: leaid! },
      });
      return r.count;
    } else {
      const r = await tx.rfp.updateMany({
        where: { agencyKey: { in: agencyKeys } },
        data: { leaid: null },
      });
      return r.count;
    }
  });

  return NextResponse.json({ mappedAgencyCount: agencyKeys.length, cascadedRfpCount });
}
