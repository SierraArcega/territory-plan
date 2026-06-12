import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { isServiceError } from "@/features/shared/lib/service-error";
import { readMulti } from "@/features/shared/lib/query-params";
import {
  createLead,
  serializeLead,
  LEAD_INCLUDE,
  LEAD_STATUSES,
  type CreateLeadInput,
} from "@/features/leads/lib/server/lead-service";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

// Table/board sort keys — anything else falls through to the default
// (created desc). Serialized query primitives only (CLAUDE.md rule).
const ALLOWED_SORT_KEYS = ["created", "assigned", "score", "status", "name", "district"] as const;
type SortKey = (typeof ALLOWED_SORT_KEYS)[number];

// GET /api/leads — list leads with owner scoping, filters, sort, pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statuses = readMulti(searchParams, "status").filter((s) =>
      (LEAD_STATUSES as readonly string[]).includes(s),
    );
    const leadTypes = readMulti(searchParams, "leadType");
    const districtLeaids = readMulti(searchParams, "districtLeaids");
    const owners = readMulti(searchParams, "owner");
    const search = searchParams.get("search");
    const ownerId = searchParams.get("ownerId"); // specific user ID, "all", or null (defaults to current user)

    const limitRaw = parseInt(searchParams.get("limit") || `${DEFAULT_PAGE_SIZE}`, 10);
    const limit = Math.min(
      Math.max(Number.isFinite(limitRaw) ? limitRaw : DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );
    const offsetRaw = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Math.max(Number.isFinite(offsetRaw) ? offsetRaw : 0, 0);

    const sortByRaw = searchParams.get("sortBy");
    const sortBy: SortKey = (ALLOWED_SORT_KEYS as readonly string[]).includes(sortByRaw ?? "")
      ? (sortByRaw as SortKey)
      : "created";
    const sortDir: "asc" | "desc" = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    const where: Prisma.LeadWhereInput = {};

    // Owner scoping — clone of the activities pattern: multi-select wins,
    // then "all" (team), then a specific user, defaulting to the caller.
    if (owners.length > 0) {
      where.assignedBdrId = { in: owners };
    } else if (ownerId === "all") {
      // Show the whole team's leads
    } else if (ownerId) {
      where.assignedBdrId = ownerId;
    } else {
      where.assignedBdrId = user.id;
    }

    if (statuses.length === 1) {
      where.status = statuses[0];
    } else if (statuses.length > 1) {
      where.status = { in: statuses };
    }
    if (leadTypes.length > 0) {
      where.leadType = { in: leadTypes };
    }
    if (districtLeaids.length > 0) {
      where.leaid = { in: districtLeaids };
    }

    // Search across contact name/title and district name/city/state.
    if (search) {
      where.OR = [
        { contact: { name: { contains: search, mode: "insensitive" } } },
        { contact: { title: { contains: search, mode: "insensitive" } } },
        { district: { name: { contains: search, mode: "insensitive" } } },
        { district: { cityLocation: { contains: search, mode: "insensitive" } } },
        { district: { stateAbbrev: { equals: search, mode: "insensitive" } } },
      ];
    }

    let orderBy: Prisma.LeadOrderByWithRelationInput[];
    switch (sortBy) {
      case "assigned":
        orderBy = [{ assignedAt: sortDir }, { createdAt: sortDir }];
        break;
      case "score":
        orderBy = [{ score: sortDir }, { createdAt: "desc" }];
        break;
      case "status":
        orderBy = [{ status: sortDir }, { createdAt: "desc" }];
        break;
      case "name":
        orderBy = [{ contact: { name: sortDir } }];
        break;
      case "district":
        orderBy = [{ district: { name: sortDir } }];
        break;
      case "created":
      default:
        orderBy = [{ createdAt: sortDir }];
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy,
        take: limit,
        skip: offset,
      }),
    ]);

    return NextResponse.json({
      leads: leads.map(serializeLead),
      total,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

// POST /api/leads — create a lead (ensures/creates the contact record)
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const lead = await createLead(body as CreateLeadInput, user.id);
    return NextResponse.json(serializeLead(lead));
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating lead:", error);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
