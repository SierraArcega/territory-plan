import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.userIntegration.delete({
      where: { userId_service: { userId: user.id, service: "slack" } },
    }).catch(() => null); // Ignore if not found

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Slack disconnect error:", error);
    return NextResponse.json({ error: "Failed to disconnect Slack" }, { status: 500 });
  }
}
