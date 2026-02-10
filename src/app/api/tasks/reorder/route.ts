import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH /api/tasks/reorder - Batch update task status + position for drag-and-drop
export async function PATCH(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "updates must be a non-empty array of { taskId, status, position }" },
        { status: 400 }
      );
    }

    // Verify all tasks belong to the user before updating
    const taskIds = updates.map((u: { taskId: string }) => u.taskId);
    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, createdByUserId: user.id },
      select: { id: true },
    });

    if (tasks.length !== taskIds.length) {
      return NextResponse.json(
        { error: "One or more tasks not found or not owned by user" },
        { status: 400 }
      );
    }

    // Update all tasks in a single transaction for consistency
    await prisma.$transaction(
      updates.map((u: { taskId: string; status: string; position: number }) =>
        prisma.task.update({
          where: { id: u.taskId },
          data: {
            status: u.status,
            position: u.position,
          },
        })
      )
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error("Error reordering tasks:", error);
    return NextResponse.json(
      { error: "Failed to reorder tasks" },
      { status: 500 }
    );
  }
}
