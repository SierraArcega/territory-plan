import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";
import { calculateTier } from "@/features/leaderboard/lib/scoring";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { section, data } = body as { section: string; data: Record<string, unknown> };

    const initiative = await prisma.initiative.findFirst({
      where: { isActive: true },
      include: {
        thresholds: true,
        metrics: true,
        scores: { include: { user: { select: { fullName: true } } } },
      },
    });

    if (!initiative) {
      return NextResponse.json({ changes: [], repImpact: null });
    }

    const changes: { field: string; before: string; after: string }[] = [];
    let repImpact: {
      count: number;
      reps: { userId: string; fullName: string; beforeTier: string; afterTier: string }[];
    } | null = null;

    if (section === "tiers") {
      const newThresholds = (data as { thresholds: { tier: string; minPoints: number }[] })
        .thresholds;
      const oldThresholds = initiative.thresholds;

      for (const nt of newThresholds) {
        const old = oldThresholds.find((t) => t.tier === nt.tier);
        if (old && old.minPoints !== nt.minPoints) {
          changes.push({
            field: `${nt.tier} threshold`,
            before: `${old.minPoints} pts`,
            after: `${nt.minPoints} pts`,
          });
        }
      }

      const affectedReps: {
        userId: string;
        fullName: string;
        beforeTier: string;
        afterTier: string;
      }[] = [];
      for (const score of initiative.scores) {
        const beforeTier = calculateTier(score.totalPoints, oldThresholds);
        const afterTier = calculateTier(score.totalPoints, newThresholds);
        if (beforeTier !== afterTier) {
          affectedReps.push({
            userId: score.userId,
            fullName: score.user.fullName ?? "Unknown",
            beforeTier,
            afterTier,
          });
        }
      }

      if (affectedReps.length > 0) {
        repImpact = { count: affectedReps.length, reps: affectedReps };
      }
    } else if (section === "initiative") {
      const d = data as {
        name?: string;
        startDate?: string;
        endDate?: string | null;
        showName?: boolean;
        showDates?: boolean;
      };
      if (d.name !== undefined && d.name !== initiative.name) {
        changes.push({ field: "Initiative Name", before: initiative.name, after: d.name });
      }
      if (d.showName !== undefined && d.showName !== initiative.showName) {
        changes.push({
          field: "Show Name to Reps",
          before: String(initiative.showName),
          after: String(d.showName),
        });
      }
      if (d.showDates !== undefined && d.showDates !== initiative.showDates) {
        changes.push({
          field: "Show Dates to Reps",
          before: String(initiative.showDates),
          after: String(d.showDates),
        });
      }
    } else if (section === "weights") {
      const d = data as {
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
      if (d.initiativeWeight !== Number(initiative.initiativeWeight)) {
        changes.push({
          field: "Initiative Weight",
          before: `${Number(initiative.initiativeWeight) * 100}%`,
          after: `${d.initiativeWeight * 100}%`,
        });
      }
      if (d.pipelineWeight !== Number(initiative.pipelineWeight)) {
        changes.push({
          field: "Pipeline Weight",
          before: `${Number(initiative.pipelineWeight) * 100}%`,
          after: `${d.pipelineWeight * 100}%`,
        });
      }
      if (d.takeWeight !== Number(initiative.takeWeight)) {
        changes.push({
          field: "Take Weight",
          before: `${Number(initiative.takeWeight) * 100}%`,
          after: `${d.takeWeight * 100}%`,
        });
      }
      if (d.revenueWeight !== Number(initiative.revenueWeight)) {
        changes.push({
          field: "Revenue Weight",
          before: `${Number(initiative.revenueWeight) * 100}%`,
          after: `${d.revenueWeight * 100}%`,
        });
      }
      if (d.revenueTargetedWeight !== Number(initiative.revenueTargetedWeight)) {
        changes.push({
          field: "Revenue Targeted Weight",
          before: `${Number(initiative.revenueTargetedWeight) * 100}%`,
          after: `${d.revenueTargetedWeight * 100}%`,
        });
      }
      if (d.pipelineFiscalYear !== undefined && d.pipelineFiscalYear !== initiative.pipelineFiscalYear) {
        changes.push({
          field: "Pipeline Fiscal Year",
          before: initiative.pipelineFiscalYear ?? "Current FY",
          after: d.pipelineFiscalYear ?? "Current FY",
        });
      }
      if (d.takeFiscalYear !== undefined && d.takeFiscalYear !== initiative.takeFiscalYear) {
        changes.push({
          field: "Take Fiscal Year",
          before: initiative.takeFiscalYear ?? "Current FY",
          after: d.takeFiscalYear ?? "Current FY",
        });
      }
      if (d.revenueFiscalYear !== undefined && d.revenueFiscalYear !== initiative.revenueFiscalYear) {
        changes.push({
          field: "Revenue Fiscal Year",
          before: initiative.revenueFiscalYear ?? "Current FY",
          after: d.revenueFiscalYear ?? "Current FY",
        });
      }
      if (d.revenueTargetedFiscalYear !== undefined && d.revenueTargetedFiscalYear !== initiative.revenueTargetedFiscalYear) {
        changes.push({
          field: "Revenue Targeted Fiscal Year",
          before: initiative.revenueTargetedFiscalYear ?? "All Plans",
          after: d.revenueTargetedFiscalYear ?? "All Plans",
        });
      }
    } else if (section === "metrics") {
      const newMetrics = (data as { metrics: { action: string; label: string; pointValue: number; weight: number }[] }).metrics;
      const oldMetrics = initiative.metrics;

      // Check for removed metrics
      for (const old of oldMetrics) {
        if (!newMetrics.find((m) => m.action === old.action)) {
          changes.push({ field: `Removed metric`, before: `${old.label} (${old.pointValue} pts)`, after: "—" });
        }
      }

      // Check for added metrics
      for (const nm of newMetrics) {
        if (!oldMetrics.find((m) => m.action === nm.action)) {
          changes.push({ field: `Added metric`, before: "—", after: `${nm.label} (${nm.pointValue} pts)` });
        }
      }

      // Check for modified metrics
      for (const nm of newMetrics) {
        const old = oldMetrics.find((m) => m.action === nm.action);
        if (old) {
          if (old.pointValue !== nm.pointValue) {
            changes.push({ field: `${nm.label} points`, before: `${old.pointValue}`, after: `${nm.pointValue}` });
          }
          if (Number(old.weight) !== nm.weight) {
            changes.push({ field: `${nm.label} weight`, before: `${old.weight}`, after: `${nm.weight}` });
          }
        }
      }
    } else if (section === "transition") {
      const d = data as { softResetTiers: number };
      if (d.softResetTiers !== initiative.softResetTiers) {
        changes.push({
          field: "Soft Reset Depth",
          before: String(initiative.softResetTiers),
          after: String(d.softResetTiers),
        });
      }
    }

    return NextResponse.json({ changes, repImpact });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
