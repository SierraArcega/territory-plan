// POST /api/integrations/slack/send — Send a Slack message via the user's connected workspace
// Creates an Activity record linked to the district if provided
// Returns: { success: true, activityId: string }

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/features/integrations/lib/encryption";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { channelId, message, districtLeaid } = body as {
      channelId: string;
      message: string;
      districtLeaid?: string;
    };

    if (!channelId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: channelId, message" },
        { status: 400 }
      );
    }

    // Step 1: Get the user's Slack integration
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "slack" } },
    });

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Slack is not connected" },
        { status: 400 }
      );
    }

    // Step 2: Decrypt the access token
    const accessToken = decrypt(integration.accessToken);

    // Step 3: Send via Slack chat.postMessage API
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        text: message,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json(
        { error: `Slack API error: ${data.error}` },
        { status: 400 }
      );
    }

    // Step 4: Create an Activity record
    const activity = await prisma.activity.create({
      data: {
        type: "slack_message",
        title: `Slack message in #${data.channel || channelId}`,
        notes: message.length > 500 ? message.slice(0, 497) + "..." : message,
        source: "slack_sync",
        slackChannelId: channelId,
        slackMessageTs: data.ts || undefined,
        startDate: new Date(),
        status: "completed",
        createdByUserId: user.id,
      },
    });

    // Link to district if provided
    if (districtLeaid) {
      await prisma.activityDistrict.create({
        data: {
          activityId: activity.id,
          districtLeaid,
        },
      });
    }

    return NextResponse.json({
      success: true,
      activityId: activity.id,
    });
  } catch (error) {
    console.error("Slack send error:", error);
    return NextResponse.json(
      { error: "Failed to send Slack message" },
      { status: 500 }
    );
  }
}
