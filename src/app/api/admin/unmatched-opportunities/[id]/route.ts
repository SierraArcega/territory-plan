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
    const { resolvedDistrictLeaid } = body as { resolvedDistrictLeaid?: string };

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

    const updated = await prisma.unmatchedOpportunity.update({
      where: { id },
      data: {
        resolved: true,
        resolvedDistrictLeaid,
      },
    });

    return NextResponse.json({ ...updated, resolvedDistrict: district });
  } catch (error) {
    console.error("Error resolving unmatched opportunity:", error);
    return NextResponse.json({ error: "Failed to resolve opportunity" }, { status: 500 });
  }
}
