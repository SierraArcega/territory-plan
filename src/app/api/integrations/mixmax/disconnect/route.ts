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
      where: { userId_service: { userId: user.id, service: "mixmax" } },
    }).catch(() => null);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mixmax disconnect error:", error);
    return NextResponse.json({ error: "Failed to disconnect Mixmax" }, { status: 500 });
  }
}
