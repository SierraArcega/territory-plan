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
    const { leaids, filters, action, tagId } = body as {
      leaids?: string[];
      filters?: FilterDef[];
      action: "add" | "remove";
      tagId: number;
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

    if (!["add", "remove"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'add' or 'remove'" },
        { status: 400 }
      );
    }

    if (typeof tagId !== "number") {
      return NextResponse.json(
        { error: "tagId must be a number" },
        { status: 400 }
      );
    }

    let count: number;

    if (action === "add") {
      // For add with filters, resolve matching leaids first (createMany needs explicit rows)
      let targetLeaids: string[];
      if (hasFilters) {
        const where = buildWhereClause(filters!, DISTRICT_FIELD_MAP);
        const districts = await prisma.district.findMany({
          where,
          select: { leaid: true },
        });
        targetLeaids = districts.map((d) => d.leaid);
      } else {
        targetLeaids = leaids!;
      }

      const result = await prisma.districtTag.createMany({
        data: targetLeaids.map((leaid) => ({
          districtLeaid: leaid,
          tagId,
        })),
        skipDuplicates: true,
      });
      count = result.count;
    } else {
      // For remove, we can use a WHERE clause directly
      const districtWhere = hasFilters
        ? { district: buildWhereClause(filters!, DISTRICT_FIELD_MAP) }
        : { districtLeaid: { in: leaids } };

      const result = await prisma.districtTag.deleteMany({
        where: { ...districtWhere, tagId },
      });
      count = result.count;
    }

    return NextResponse.json({ updated: count });
  } catch (error) {
    console.error("Error in batch tags:", error);
    return NextResponse.json(
      { error: "Failed to batch update tags" },
      { status: 500 }
    );
  }
}
