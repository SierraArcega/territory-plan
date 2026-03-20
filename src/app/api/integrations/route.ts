import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import type { IntegrationConnection } from "@/features/integrations/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integrations = await prisma.userIntegration.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        service: true,
        accountEmail: true,
        accountName: true,
        status: true,
        syncEnabled: true,
        lastSyncAt: true,
        metadata: true,
        createdAt: true,
      },
    });

    const connections: IntegrationConnection[] = integrations.map((i) => ({
      id: i.id,
      service: i.service as IntegrationConnection["service"],
      accountEmail: i.accountEmail,
      accountName: i.accountName,
      status: i.status as IntegrationConnection["status"],
      syncEnabled: i.syncEnabled,
      lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
      metadata: i.metadata as Record<string, unknown> | null,
      connectedAt: i.createdAt.toISOString(),
    }));

    return NextResponse.json(connections);
  } catch (error) {
    console.error("Failed to list integrations:", error);
    return NextResponse.json({ error: "Failed to list integrations" }, { status: 500 });
  }
}
