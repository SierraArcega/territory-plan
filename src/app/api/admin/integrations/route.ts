import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/admin/integrations — aggregate integration status
export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const totalUsers = await prisma.userProfile.count();

    // Google Calendar integration status (stored in user_integrations where service='google_calendar')
    const [calendarConnected, calendarError, calendarDisconnected, calendarLastSync] =
      await Promise.all([
        prisma.userIntegration.count({ where: { service: "google_calendar", status: "connected" } }),
        prisma.userIntegration.count({ where: { service: "google_calendar", status: "error" } }),
        prisma.userIntegration.count({ where: { service: "google_calendar", status: "disconnected" } }),
        prisma.userIntegration.findFirst({
          where: { service: "google_calendar", status: "connected" },
          orderBy: { lastSyncAt: "desc" },
          select: { lastSyncAt: true },
        }),
      ]);

    const calendarTotal = calendarConnected + calendarError + calendarDisconnected;
    const calendarStatus =
      calendarError > 0 ? "error" : calendarConnected > 0 ? "connected" : "disconnected";

    // OpenSearch / Scheduler sync status
    const latestSyncLog = await prisma.dataRefreshLog.findFirst({
      where: { dataSource: { contains: "opensearch", mode: "insensitive" } },
      orderBy: { completedAt: "desc" },
      select: { status: true, completedAt: true },
    });

    // If no opensearch-specific log, check the most recent log overall
    const latestAnySync = latestSyncLog ?? await prisma.dataRefreshLog.findFirst({
      orderBy: { completedAt: "desc" },
      select: { status: true, completedAt: true, dataSource: true },
    });

    const schedulerStatus = latestAnySync
      ? latestAnySync.status === "success" ? "healthy" : "error"
      : "unknown";

    const integrations = [
      {
        name: "Google Calendar",
        slug: "google-calendar",
        status: calendarStatus,
        connectedUsers: calendarConnected,
        totalUsers,
        lastSyncAt: calendarLastSync?.lastSyncAt ?? null,
        description: "Syncs calendar events for activity tracking",
      },
      {
        name: "OpenSearch Sync",
        slug: "opensearch-sync",
        status: schedulerStatus,
        connectedUsers: null,
        totalUsers: null,
        lastSyncAt: latestAnySync?.completedAt ?? null,
        description: "Hourly sync of opportunities from CRM via OpenSearch",
      },
    ];

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json({ error: "Failed to fetch integrations" }, { status: 500 });
  }
}
