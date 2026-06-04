import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { createTask } from "@/features/tasks/lib/service";
import { isServiceError } from "@/features/shared/lib/service-error";

export const dynamic = "force-dynamic";

// GET /api/tasks - List tasks with filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const planId = searchParams.get("planId");
    const activityId = searchParams.get("activityId");
    const leaid = searchParams.get("leaid");
    const contactId = searchParams.get("contactId");
    const search = searchParams.get("search");
    const dueBefore = searchParams.get("dueBefore");
    const dueAfter = searchParams.get("dueAfter");

    // Build where clause — always scoped to the current user
    const where: Prisma.TaskWhereInput = {
      createdByUserId: user.id,
    };


    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by priority
    if (priority) {
      where.priority = priority;
    }

    // Filter by linked plan
    if (planId) {
      where.plans = { some: { planId } };
    }

    // Filter by linked activity
    if (activityId) {
      where.activities = { some: { activityId } };
    }

    // Filter by linked district
    if (leaid) {
      where.districts = { some: { districtLeaid: leaid } };
    }

    // Filter by linked contact
    if (contactId) {
      where.contacts = { some: { contactId: parseInt(contactId) } };
    }

    // Search by title
    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    // Filter by due date range
    if (dueBefore) {
      where.dueDate = { ...(where.dueDate as object), lte: new Date(dueBefore) };
    }
    if (dueAfter) {
      where.dueDate = { ...(where.dueDate as object), gte: new Date(dueAfter) };
    }

    // Run count and data fetch in parallel
    const [totalCount, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          position: true,
          createdAt: true,
          updatedAt: true,
          // Fetch linked entity counts and basic info for list view
          districts: {
            select: {
              districtLeaid: true,
              district: { select: { name: true, stateAbbrev: true } },
            },
          },
          plans: {
            select: {
              planId: true,
              plan: { select: { name: true, color: true } },
            },
          },
          activities: {
            select: {
              activityId: true,
              activity: { select: { title: true, type: true } },
            },
          },
          contacts: {
            select: {
              contactId: true,
              contact: { select: { name: true, title: true } },
            },
          },
          assignedTo: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
        orderBy: [
          { position: "asc" },
          { dueDate: { sort: "asc", nulls: "last" } },
          { createdAt: "desc" },
        ],
      }),
    ]);

    // Transform for client
    const transformed = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      position: task.position,
      assignedTo: task.assignedTo
        ? {
            id: task.assignedTo.id,
            fullName: task.assignedTo.fullName,
            avatarUrl: task.assignedTo.avatarUrl,
          }
        : null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      districts: task.districts.map((d) => ({
        leaid: d.districtLeaid,
        name: d.district.name,
        stateAbbrev: d.district.stateAbbrev,
      })),
      plans: task.plans.map((p) => ({
        planId: p.planId,
        planName: p.plan.name,
        planColor: p.plan.color,
      })),
      activities: task.activities.map((a) => ({
        activityId: a.activityId,
        title: a.activity.title,
        type: a.activity.type,
      })),
      contacts: task.contacts.map((c) => ({
        contactId: c.contactId,
        name: c.contact.name,
        title: c.contact.title,
      })),
    }));

    return NextResponse.json({ tasks: transformed, totalCount });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const task = await createTask(body, user.id);
    return NextResponse.json(task);
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
