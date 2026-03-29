import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { softResetTiers } = body as { softResetTiers: number };

    if (typeof softResetTiers !== "number" || softResetTiers < 0 || softResetTiers > 3) {
      return NextResponse.json({ error: "softResetTiers must be 0-3" }, { status: 400 });
    }

    const season = await prisma.season.findFirst({ where: { isActive: true } });
    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    await prisma.season.update({
      where: { id: season.id },
      data: { softResetTiers },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating transition:", error);
    return NextResponse.json({ error: "Failed to update transition settings" }, { status: 500 });
  }
}
