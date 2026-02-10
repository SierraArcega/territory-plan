import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/tasks/[id]/contacts/[contactId] - Unlink a contact from a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const { id, contactId } = await params;
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

    const contactIdNum = parseInt(contactId);
    const existing = await prisma.taskContact.findUnique({
      where: { taskId_contactId: { taskId: id, contactId: contactIdNum } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Contact not linked to this task" },
        { status: 404 }
      );
    }

    await prisma.taskContact.delete({
      where: { taskId_contactId: { taskId: id, contactId: contactIdNum } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking contact from task:", error);
    return NextResponse.json(
      { error: "Failed to unlink contact from task" },
      { status: 500 }
    );
  }
}
