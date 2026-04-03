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
    const {
      initiativeWeight, pipelineWeight, takeWeight, revenueWeight, revenueTargetedWeight,
      pipelineFiscalYear, takeFiscalYear, revenueFiscalYear, revenueTargetedFiscalYear,
    } = body as {
      initiativeWeight: number;
      pipelineWeight: number;
      takeWeight: number;
      revenueWeight: number;
      revenueTargetedWeight: number;
      pipelineFiscalYear?: string | null;
      takeFiscalYear?: string | null;
      revenueFiscalYear?: string | null;
      revenueTargetedFiscalYear?: string | null;
    };

    // Validate sum equals 1.0 (allow small floating point tolerance)
    const sum = initiativeWeight + pipelineWeight + takeWeight + revenueWeight + revenueTargetedWeight;
    if (Math.abs(sum - 1.0) > 0.01) {
      return NextResponse.json(
        { error: `Weights must sum to 100%. Current sum: ${(sum * 100).toFixed(1)}%` },
        { status: 400 }
      );
    }

    const initiative = await prisma.initiative.findFirst({ where: { isActive: true } });
    if (!initiative) {
      return NextResponse.json({ error: "No active initiative" }, { status: 404 });
    }

    await prisma.initiative.update({
      where: { id: initiative.id },
      data: {
        initiativeWeight,
        pipelineWeight,
        takeWeight,
        revenueWeight,
        revenueTargetedWeight,
        ...(pipelineFiscalYear !== undefined && { pipelineFiscalYear }),
        ...(takeFiscalYear !== undefined && { takeFiscalYear }),
        ...(revenueFiscalYear !== undefined && { revenueFiscalYear }),
        ...(revenueTargetedFiscalYear !== undefined && { revenueTargetedFiscalYear }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating weights:", error);
    return NextResponse.json({ error: "Failed to update weights" }, { status: 500 });
  }
}
