import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/districts/by-domain?domain={domain}
// Lookup districts where websiteUrl contains the given domain
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    if (!domain || !domain.trim()) {
      return NextResponse.json(
        { error: "domain parameter is required" },
        { status: 400 }
      );
    }

    const districts = await prisma.district.findMany({
      where: {
        websiteUrl: { contains: domain.trim(), mode: "insensitive" },
      },
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
      },
      take: 10,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ districts });
  } catch (error) {
    console.error("Error looking up districts by domain:", error);
    return NextResponse.json(
      { error: "Failed to look up districts" },
      { status: 500 }
    );
  }
}
