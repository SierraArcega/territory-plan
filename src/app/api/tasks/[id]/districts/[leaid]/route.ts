import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/tasks/[id]/districts/[leaid] - Unlink a district from a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leaid: string }> }
) {
  try {
    const { id, leaid } = await params;
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

    const existing = await prisma.taskDistrict.findUnique({
      where: { taskId_districtLeaid: { taskId: id, districtLeaid: leaid } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "District not linked to this task" },
        { status: 404 }
      );
    }

    await prisma.taskDistrict.delete({
      where: { taskId_districtLeaid: { taskId: id, districtLeaid: leaid } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking district from task:", error);
    return NextResponse.json(
      { error: "Failed to unlink district from task" },
      { status: 500 }
    );
  }
}
