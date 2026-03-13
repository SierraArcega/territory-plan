import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/districts/search?q=... — search districts for resolution picker
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ items: [] });
    }

    const items = await prisma.district.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { leaid: { startsWith: q } },
          ...(q.length === 2 ? [{ stateAbbrev: q.toUpperCase() }] : []),
        ],
      },
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        enrollment: true,
        cityLocation: true,
      },
      orderBy: { name: "asc" },
      take: 20,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error searching districts:", error);
    return NextResponse.json({ error: "Failed to search districts" }, { status: 500 });
  }
}
