import { ImageResponse } from "next/og";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  fetchLeaderboardData,
  NoActiveInitiativeError,
} from "@/features/leaderboard/lib/fetch-leaderboard";
import { LeaderboardImageLayout } from "@/features/leaderboard/lib/image-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FONTS_DIR = join(process.cwd(), "src/features/leaderboard/lib/fonts");

const fontRegular = readFile(join(FONTS_DIR, "PlusJakartaSans-Regular.ttf"));
const fontSemiBold = readFile(join(FONTS_DIR, "PlusJakartaSans-SemiBold.ttf"));

async function renderLeaderboardPng(): Promise<Buffer> {
  const [regular, semiBold] = await Promise.all([fontRegular, fontSemiBold]);
  const raw = await fetchLeaderboardData();
  const payload = { ...raw, entries: raw.entries.filter((e) => e.revenueCurrentFY > 0) };
  const height = 150 + 46 + payload.entries.length * 44 + 50 + 20;

  const response = new ImageResponse(
    <LeaderboardImageLayout payload={payload} />,
    {
      width: 1200,
      height,
      fonts: [
        { name: "Plus Jakarta Sans", data: regular, weight: 400, style: "normal" },
        { name: "Plus Jakarta Sans", data: semiBold, weight: 600, style: "normal" },
      ],
    },
  );

  return Buffer.from(await response.arrayBuffer());
}

async function resolveChannelId(token: string, channel: string): Promise<string> {
  if (/^[CDGM][A-Z0-9]{8,}$/.test(channel)) return channel;

  const name = channel.replace(/^#/, "");
  let cursor: string | undefined;
  do {
    const url = new URL("https://slack.com/api/conversations.list");
    url.searchParams.set("types", "public_channel,private_channel");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack conversations.list failed: ${data.error}`);

    const match = data.channels.find((c: { id: string; name: string }) => c.name === name);
    if (match) return match.id;

    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  throw new Error(`Slack channel not found: ${name} (bot must be a member)`);
}

async function uploadImageToSlack(
  token: string,
  channelId: string,
  pngBytes: Buffer,
  filename: string,
  comment: string,
): Promise<void> {
  const getUrlRes = await fetch("https://slack.com/api/files.getUploadURLExternal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      filename,
      length: pngBytes.byteLength.toString(),
    }),
  });
  const getUrlData = await getUrlRes.json();
  if (!getUrlData.ok) throw new Error(`Slack getUploadURLExternal failed: ${getUrlData.error}`);

  const { upload_url, file_id } = getUrlData;

  const uploadRes = await fetch(upload_url, {
    method: "POST",
    body: new Uint8Array(pngBytes),
  });
  if (!uploadRes.ok) {
    throw new Error(`Slack upload POST failed: ${uploadRes.status} ${uploadRes.statusText}`);
  }

  const completeRes = await fetch("https://slack.com/api/files.completeUploadExternal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: [{ id: file_id, title: filename }],
      channel_id: channelId,
      initial_comment: comment,
    }),
  });
  const completeData = await completeRes.json();
  if (!completeData.ok) {
    throw new Error(`Slack completeUploadExternal failed: ${completeData.error}`);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 });
  }

  const channel = process.env.SLACK_LEADERBOARD_CHANNEL || "test-automations";

  try {
    const channelId = await resolveChannelId(token, channel);
    const pngBytes = await renderLeaderboardPng();
    const today = new Date().toISOString().split("T")[0];

    const comment = [
      "🏆 *Fullmind Sales Leaderboard*",
      "",
      "Good morning, Sales Team! 🌅 Let's get after it today 💪🚀",
      "",
      "*Metric definitions*",
      "• *Revenue* — Sum of Subscriptions + Sessions",
      "• *Min Purchases* — Contracted floor per contract, summed across distinct contracts",
      "• *Pipeline* — Sum of Open Opportunities (stages 0–5)",
      "• *Targeted* — Sum of Plan District Targets minus Pipeline (untapped target)",
    ].join("\n");

    await uploadImageToSlack(
      token,
      channelId,
      pngBytes,
      `leaderboard-${today}.png`,
      comment,
    );

    return NextResponse.json({
      ok: true,
      bytes: pngBytes.byteLength,
      channel,
    });
  } catch (error) {
    console.error("leaderboard-slack-post failed", error);
    if (error instanceof NoActiveInitiativeError) {
      return NextResponse.json({ ok: false, reason: "no-active-initiative" }, { status: 200 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
