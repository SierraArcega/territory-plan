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
    const { name, startDate, endDate, showName, showDates } = body as {
      name?: string;
      startDate?: string;
      endDate?: string | null;
      showName?: boolean;
      showDates?: boolean;
    };

    const season = await prisma.season.findFirst({ where: { isActive: true } });
    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    const updated = await prisma.season.update({
      where: { id: season.id },
      data: {
        ...(name !== undefined && { name }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(showName !== undefined && { showName }),
        ...(showDates !== undefined && { showDates }),
      },
    });

    return NextResponse.json({ success: true, season: updated });
  } catch (error) {
    console.error("Error updating season identity:", error);
    return NextResponse.json({ error: "Failed to update season" }, { status: 500 });
  }
}
