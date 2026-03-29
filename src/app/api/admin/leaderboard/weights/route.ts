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
    const { seasonWeight, pipelineWeight, takeWeight } = body as {
      seasonWeight: number;
      pipelineWeight: number;
      takeWeight: number;
    };

    // Validate sum equals 1.0 (allow small floating point tolerance)
    const sum = seasonWeight + pipelineWeight + takeWeight;
    if (Math.abs(sum - 1.0) > 0.01) {
      return NextResponse.json(
        { error: `Weights must sum to 100%. Current sum: ${(sum * 100).toFixed(1)}%` },
        { status: 400 }
      );
    }

    const season = await prisma.season.findFirst({ where: { isActive: true } });
    if (!season) {
      return NextResponse.json({ error: "No active season" }, { status: 404 });
    }

    await prisma.season.update({
      where: { id: season.id },
      data: { seasonWeight, pipelineWeight, takeWeight },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating weights:", error);
    return NextResponse.json({ error: "Failed to update weights" }, { status: 500 });
  }
}
