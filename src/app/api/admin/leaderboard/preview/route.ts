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

    const season = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        thresholds: true,
        scores: { include: { user: { select: { fullName: true } } } },
      },
    });

    if (!season) {
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
      const oldThresholds = season.thresholds;

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
      for (const score of season.scores) {
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
    } else if (section === "season") {
      const d = data as {
        name?: string;
        startDate?: string;
        endDate?: string | null;
        showName?: boolean;
        showDates?: boolean;
      };
      if (d.name !== undefined && d.name !== season.name) {
        changes.push({ field: "Season Name", before: season.name, after: d.name });
      }
      if (d.showName !== undefined && d.showName !== season.showName) {
        changes.push({
          field: "Show Name to Reps",
          before: String(season.showName),
          after: String(d.showName),
        });
      }
      if (d.showDates !== undefined && d.showDates !== season.showDates) {
        changes.push({
          field: "Show Dates to Reps",
          before: String(season.showDates),
          after: String(d.showDates),
        });
      }
    } else if (section === "weights") {
      const d = data as {
        seasonWeight: number;
        pipelineWeight: number;
        takeWeight: number;
      };
      if (d.seasonWeight !== Number(season.seasonWeight)) {
        changes.push({
          field: "Season Weight",
          before: `${Number(season.seasonWeight) * 100}%`,
          after: `${d.seasonWeight * 100}%`,
        });
      }
      if (d.pipelineWeight !== Number(season.pipelineWeight)) {
        changes.push({
          field: "Pipeline Weight",
          before: `${Number(season.pipelineWeight) * 100}%`,
          after: `${d.pipelineWeight * 100}%`,
        });
      }
      if (d.takeWeight !== Number(season.takeWeight)) {
        changes.push({
          field: "Take Weight",
          before: `${Number(season.takeWeight) * 100}%`,
          after: `${d.takeWeight * 100}%`,
        });
      }
    } else if (section === "transition") {
      const d = data as { softResetTiers: number };
      if (d.softResetTiers !== season.softResetTiers) {
        changes.push({
          field: "Soft Reset Depth",
          before: String(season.softResetTiers),
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
