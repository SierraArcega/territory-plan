import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // "active", "completed", etc.
    const sequenceId = searchParams.get("sequenceId");

    const where: Record<string, unknown> = { userId: user.id };
    if (status) where.status = status;
    if (sequenceId) where.sequenceId = parseInt(sequenceId, 10);

    const executions = await prisma.sequenceExecution.findMany({
      where,
      include: {
        sequence: {
          select: {
            name: true,
            steps: {
              orderBy: { position: "asc" },
              select: { id: true, type: true, position: true },
            },
          },
        },
        _count: {
          select: { stepExecutions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ executions });
  } catch (error) {
    console.error("Error fetching executions:", error);
    return NextResponse.json(
      { error: "Failed to fetch executions" },
      { status: 500 }
    );
  }
}
