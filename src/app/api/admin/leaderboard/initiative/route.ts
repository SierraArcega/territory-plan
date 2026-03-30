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
    const { name, startDate, endDate, showName, showDates, fiscalYear } = body as {
      name?: string;
      startDate?: string;
      endDate?: string | null;
      showName?: boolean;
      showDates?: boolean;
      fiscalYear?: string | null;
    };

    const initiative = await prisma.initiative.findFirst({ where: { isActive: true } });
    if (!initiative) {
      return NextResponse.json({ error: "No active initiative" }, { status: 404 });
    }

    const updated = await prisma.initiative.update({
      where: { id: initiative.id },
      data: {
        ...(name !== undefined && { name }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(showName !== undefined && { showName }),
        ...(showDates !== undefined && { showDates }),
        ...(fiscalYear !== undefined && { fiscalYear }),
      },
    });

    return NextResponse.json({ success: true, initiative: updated });
  } catch (error) {
    console.error("Error updating initiative identity:", error);
    return NextResponse.json({ error: "Failed to update initiative" }, { status: 500 });
  }
}
