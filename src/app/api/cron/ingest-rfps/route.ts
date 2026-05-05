import { NextRequest, NextResponse } from "next/server";
import { syncRfps } from "@/features/rfps/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const secretParam = new URL(request.url).searchParams.get("secret");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncRfps();
    return NextResponse.json(summary);
  } catch (err) {
    console.error(JSON.stringify({ event: "rfp_cron_error", error: String(err).slice(0, 1000) }));
    return NextResponse.json({ error: String(err).slice(0, 500) }, { status: 500 });
  }
}
