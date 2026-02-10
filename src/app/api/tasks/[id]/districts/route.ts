import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/tasks/[id]/districts - Link districts to a task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify task ownership
    const task = await prisma.task.findUnique({
      where: { id, createdByUserId: user.id },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const body = await request.json();
    const { leaids } = body;

    if (!Array.isArray(leaids) || leaids.length === 0) {
      return NextResponse.json(
        { error: "leaids must be a non-empty array" },
        { status: 400 }
      );
    }

    // Create TaskDistrict records (skip duplicates)
    const result = await prisma.taskDistrict.createMany({
      data: leaids.map((leaid: string) => ({
        taskId: id,
        districtLeaid: leaid,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ linked: result.count, taskId: id });
  } catch (error) {
    console.error("Error linking districts to task:", error);
    return NextResponse.json(
      { error: "Failed to link districts to task" },
      { status: 500 }
    );
  }
}
