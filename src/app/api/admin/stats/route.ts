import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/stats — KPI summary for admin dashboard
export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      unmatchedTotal,
      unmatchedNewThisWeek,
      usersTotal,
      usersActiveToday,
      calendarConnections,
      calendarErrors,
      latestSync,
      syncErrors,
    ] = await Promise.all([
      prisma.unmatchedOpportunity.count({ where: { resolved: false } }),
      prisma.unmatchedOpportunity.count({
        where: { resolved: false, syncedAt: { gte: oneWeekAgo } },
      }),
      prisma.userProfile.count(),
      prisma.userProfile.count({
        where: { lastLoginAt: { gte: todayStart } },
      }),
      prisma.userIntegration.count({ where: { service: "google_calendar", status: "connected" } }),
      prisma.userIntegration.count({ where: { service: "google_calendar", status: "error" } }),
      prisma.dataRefreshLog.findFirst({ orderBy: { completedAt: "desc" } }),
      prisma.dataRefreshLog.count({
        where: { status: "error", completedAt: { gte: oneWeekAgo } },
      }),
    ]);

    return NextResponse.json({
      unmatched: { total: unmatchedTotal, newThisWeek: unmatchedNewThisWeek },
      users: { total: usersTotal, activeToday: usersActiveToday },
      integrations: {
        total: calendarConnections,
        errors: calendarErrors,
      },
      sync: {
        status: syncErrors > 0 ? "errors" : "ok",
        recentErrors: syncErrors,
        lastSyncAt: latestSync?.completedAt ?? null,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
