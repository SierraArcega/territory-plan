// GET /api/integrations/slack/channels — List Slack channels from the user's workspace
// Returns: { channels: Array<{ id, name }> }

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/features/integrations/lib/encryption";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user's Slack integration
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "slack" } },
    });

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Slack is not connected" },
        { status: 400 }
      );
    }

    const accessToken = decrypt(integration.accessToken);

    // Fetch channels the bot/user has joined
    const res = await fetch("https://slack.com/api/conversations.list", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        types: "public_channel,private_channel",
        limit: "200",
        exclude_archived: "true",
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json(
        { error: `Slack API error: ${data.error}` },
        { status: 400 }
      );
    }

    const channels = (data.channels || []).map(
      (ch: { id: string; name: string }) => ({
        id: ch.id,
        name: ch.name,
      })
    );

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Slack channels error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Slack channels" },
      { status: 500 }
    );
  }
}
