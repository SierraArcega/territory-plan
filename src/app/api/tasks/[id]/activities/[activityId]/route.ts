import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/tasks/[id]/activities/[activityId] - Unlink an activity from a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  try {
    const { id, activityId } = await params;
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

    const existing = await prisma.taskActivity.findUnique({
      where: { taskId_activityId: { taskId: id, activityId } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Activity not linked to this task" },
        { status: 404 }
      );
    }

    await prisma.taskActivity.delete({
      where: { taskId_activityId: { taskId: id, activityId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking activity from task:", error);
    return NextResponse.json(
      { error: "Failed to unlink activity from task" },
      { status: 500 }
    );
  }
}
