import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getRepActuals } from "@/lib/opportunity-actuals";

export const dynamic = "force-dynamic";

// GET /api/leaderboard/revenue-rank?fy=current|next
// Returns the calling user's revenue rank for the requested fiscal year.
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const fyParam = url.searchParams.get("fy");
  if (fyParam !== "current" && fyParam !== "next") {
    return NextResponse.json({ error: "fy must be 'current' or 'next'" }, { status: 400 });
  }

  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  const currentSchoolYr = `${currentFY - 1}-${String(currentFY).slice(-2)}`;
  const nextSchoolYr = `${currentFY}-${String(currentFY + 1).slice(-2)}`;
  const schoolYear = fyParam === "current" ? currentSchoolYr : nextSchoolYr;

  const profiles = await prisma.userProfile.findMany({
    where: { role: { in: ["rep", "manager"] } },
    select: { id: true, email: true },
  });

  const withRevenue = await Promise.all(
    profiles.map(async (p) => {
      try {
        const actuals = await getRepActuals(p.email, schoolYear);
        return { id: p.id, revenue: actuals?.totalRevenue ?? 0, bookings: actuals?.bookings ?? 0 };
      } catch {
        return { id: p.id, revenue: 0, bookings: 0 };
      }
    }),
  );

  withRevenue.sort((a, b) => b.revenue - a.revenue);

  const totalReps = withRevenue.length;
  const callerIndex = withRevenue.findIndex((r) => r.id === user.id);
  const inRoster = callerIndex !== -1;

  const rank = inRoster ? callerIndex + 1 : totalReps + 1;
  const revenue = inRoster ? withRevenue[callerIndex].revenue : 0;
  const bookings = inRoster ? withRevenue[callerIndex].bookings : 0;

  return NextResponse.json({
    fy: fyParam,
    schoolYear,
    rank,
    totalReps,
    revenue,
    bookings,
    inRoster,
  });
}
