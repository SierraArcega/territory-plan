import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/features/tasks/types";

export const dynamic = "force-dynamic";

// GET /api/tasks/[id] - Get task detail with all linked entities
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        plans: {
          include: { plan: { select: { id: true, name: true, color: true } } },
        },
        districts: {
          include: {
            district: { select: { leaid: true, name: true, stateAbbrev: true } },
          },
        },
        activities: {
          include: {
            activity: { select: { id: true, title: true, type: true } },
          },
        },
        contacts: {
          include: { contact: { select: { id: true, name: true, title: true } } },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Verify ownership
    if (task.createdByUserId !== user.id) {
      return NextResponse.json({ error: "Not authorized to view this task" }, { status: 403 });
    }

    return NextResponse.json({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      position: task.position,
      createdByUserId: task.createdByUserId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      plans: task.plans.map((p) => ({
        planId: p.plan.id,
        planName: p.plan.name,
        planColor: p.plan.color,
      })),
      districts: task.districts.map((d) => ({
        leaid: d.district.leaid,
        name: d.district.name,
        stateAbbrev: d.district.stateAbbrev,
      })),
      activities: task.activities.map((a) => ({
        activityId: a.activity.id,
        title: a.activity.title,
        type: a.activity.type,
      })),
      contacts: task.contacts.map((c) => ({
        contactId: c.contact.id,
        name: c.contact.name,
        title: c.contact.title,
      })),
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] - Update task fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify task exists and user owns it
    const existing = await prisma.task.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (existing.createdByUserId !== user.id) {
      return NextResponse.json({ error: "Not authorized to edit this task" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, status, priority, dueDate, position } = body;

    // Validate status if provided
    if (status && !TASK_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${TASK_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate priority if provided
    if (priority && !TASK_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: `priority must be one of: ${TASK_PRIORITIES.join(", ")}` },
        { status: 400 }
      );
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && {
          dueDate: dueDate ? new Date(dueDate) : null,
        }),
        ...(position !== undefined && { position }),
      },
    });

    return NextResponse.json({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      position: task.position,
      updatedAt: task.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete task (cascades junction records)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.createdByUserId !== user.id) {
      return NextResponse.json({ error: "Not authorized to delete this task" }, { status: 403 });
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
