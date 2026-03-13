import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH /api/admin/unmatched-opportunities/[id] — resolve an unmatched opportunity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { resolvedDistrictLeaid, reason } = body as {
      resolvedDistrictLeaid?: string;
      reason?: string | null;
    };

    // Reason-only update (no resolution)
    if (reason !== undefined && !resolvedDistrictLeaid) {
      const VALID_REASONS = [
        "Needs Review",
        "Missing District",
        "Remove Child Opp",
        "Organization",
        "University",
        "Private/Charter",
      ];
      if (reason !== null && !VALID_REASONS.includes(reason)) {
        return NextResponse.json(
          { error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` },
          { status: 400 }
        );
      }

      const updated = await prisma.unmatchedOpportunity.update({
        where: { id },
        data: { reason },
        select: { id: true, reason: true },
      });

      return NextResponse.json(updated);
    }

    if (!resolvedDistrictLeaid || typeof resolvedDistrictLeaid !== "string") {
      return NextResponse.json(
        { error: "resolvedDistrictLeaid is required" },
        { status: 400 }
      );
    }

    // Verify the district exists
    const district = await prisma.district.findUnique({
      where: { leaid: resolvedDistrictLeaid },
      select: { leaid: true, name: true, stateAbbrev: true },
    });

    if (!district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // Look up the source opportunity to get its accountName
    const source = await prisma.unmatchedOpportunity.findUnique({
      where: { id },
      select: { accountName: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    // Resolve all unresolved opportunities with the same accountName
    const where = source.accountName
      ? {
          accountName: { equals: source.accountName, mode: "insensitive" as const },
          resolved: false,
        }
      : { id };

    const { count } = await prisma.unmatchedOpportunity.updateMany({
      where,
      data: {
        resolved: true,
        resolvedDistrictLeaid,
      },
    });

    return NextResponse.json({ resolvedDistrict: district, resolvedCount: count });
  } catch (error) {
    console.error("Error resolving unmatched opportunity:", error);
    return NextResponse.json({ error: "Failed to resolve opportunity" }, { status: 500 });
  }
}
