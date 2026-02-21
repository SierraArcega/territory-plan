import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  type FilterDef,
  buildWhereClause,
  DISTRICT_FIELD_MAP,
} from "@/features/explore/lib/filters";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leaids, filters, owner, notes } = body as {
      leaids?: string[];
      filters?: FilterDef[];
      owner?: string;
      notes?: string;
    };

    // Require exactly one of leaids or filters
    const hasLeaids = Array.isArray(leaids) && leaids.length > 0;
    const hasFilters = Array.isArray(filters) && filters.length > 0;

    if (!hasLeaids && !hasFilters) {
      return NextResponse.json(
        { error: "Either leaids or filters must be provided" },
        { status: 400 }
      );
    }

    if (owner === undefined && notes === undefined) {
      return NextResponse.json(
        { error: "At least one of owner or notes must be provided" },
        { status: 400 }
      );
    }

    const where = hasFilters
      ? buildWhereClause(filters!, DISTRICT_FIELD_MAP)
      : { leaid: { in: leaids } };

    const data: Record<string, unknown> = { notesUpdatedAt: new Date() };
    if (owner !== undefined) data.owner = owner || null;
    if (notes !== undefined) data.notes = notes || null;

    const result = await prisma.district.updateMany({ where, data });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error("Error in batch edits:", error);
    return NextResponse.json(
      { error: "Failed to batch update districts" },
      { status: 500 }
    );
  }
}
