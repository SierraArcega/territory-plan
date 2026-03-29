import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const entries = await prisma.metricRegistry.findMany({
      orderBy: [{ category: "asc" }, { label: "asc" }],
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Error fetching metric registry:", error);
    return NextResponse.json({ error: "Failed to fetch metric registry" }, { status: 500 });
  }
}
