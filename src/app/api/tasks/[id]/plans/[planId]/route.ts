import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/tasks/[id]/plans/[planId] - Unlink a plan from a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  try {
    const { id, planId } = await params;
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

    // Check if the link exists
    const existing = await prisma.taskPlan.findUnique({
      where: { taskId_planId: { taskId: id, planId } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Plan not linked to this task" },
        { status: 404 }
      );
    }

    await prisma.taskPlan.delete({
      where: { taskId_planId: { taskId: id, planId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking plan from task:", error);
    return NextResponse.json(
      { error: "Failed to unlink plan from task" },
      { status: 500 }
    );
  }
}
