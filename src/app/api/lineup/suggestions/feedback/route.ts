import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // @ts-expect-error — suggestionFeedback exists in schema but Prisma client may not have regenerated yet
    await prisma.suggestionFeedback.create({
      data: { userId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error recording suggestion feedback:", error);
    return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
  }
}
