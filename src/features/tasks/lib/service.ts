import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ServiceError, type DbClient } from "@/features/shared/lib/service-error";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/features/tasks/types";

/**
 * Task mutation service. Extracted from the route handlers so the same logic is
 * shared by `POST /api/tasks` + `PATCH /api/tasks/[id]` and the AI copilot's
 * execute endpoint. Validation + authorization live here; callers map
 * `ServiceError` to their own response shape.
 */

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  position?: number;
  assignedToUserId?: string | null;
  planIds?: string[];
  activityIds?: string[];
  leaids?: string[];
  contactIds?: number[];
}

const CREATE_INCLUDE = {
  plans: { include: { plan: { select: { id: true, name: true, color: true } } } },
  districts: {
    include: { district: { select: { leaid: true, name: true, stateAbbrev: true } } },
  },
  activities: { include: { activity: { select: { id: true, title: true, type: true } } } },
  contacts: { include: { contact: { select: { id: true, name: true, title: true } } } },
  assignedTo: { select: { id: true, fullName: true, avatarUrl: true } },
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof CREATE_INCLUDE }>;

function serializeTask(task: TaskWithRelations) {
  return {
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
  };
}

export async function createTask(
  input: CreateTaskInput,
  userId: string,
  db: DbClient = prisma,
) {
  const {
    title,
    description,
    status = "todo",
    priority = "medium",
    dueDate,
    position = 0,
    assignedToUserId,
    planIds = [],
    activityIds = [],
    leaids = [],
    contactIds = [],
  } = input;

  if (!title || !title.trim()) {
    throw new ServiceError("title is required", 400);
  }
  if (!(TASK_STATUSES as readonly string[]).includes(status)) {
    throw new ServiceError(`status must be one of: ${TASK_STATUSES.join(", ")}`, 400);
  }
  if (!(TASK_PRIORITIES as readonly string[]).includes(priority)) {
    throw new ServiceError(`priority must be one of: ${TASK_PRIORITIES.join(", ")}`, 400);
  }
  if (assignedToUserId) {
    const assignee = await db.userProfile.findUnique({
      where: { id: assignedToUserId },
      select: { id: true },
    });
    if (!assignee) {
      throw new ServiceError("Assigned user not found", 400);
    }
  }

  const task = await db.task.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      status,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      position,
      createdByUserId: userId,
      ...(assignedToUserId && { assignedToUserId }),
      plans: { create: planIds.map((planId) => ({ planId })) },
      activities: { create: activityIds.map((activityId) => ({ activityId })) },
      districts: { create: leaids.map((leaid) => ({ districtLeaid: leaid })) },
      contacts: { create: contactIds.map((contactId) => ({ contactId })) },
    },
    include: CREATE_INCLUDE,
  });

  return serializeTask(task);
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  position?: number;
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput,
  userId: string,
  db: DbClient = prisma,
) {
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Task not found", 404);
  }
  if (existing.createdByUserId !== userId) {
    throw new ServiceError("Not authorized to edit this task", 403);
  }

  const { title, description, status, priority, dueDate, position } = input;

  if (status && !(TASK_STATUSES as readonly string[]).includes(status)) {
    throw new ServiceError(`status must be one of: ${TASK_STATUSES.join(", ")}`, 400);
  }
  if (priority && !(TASK_PRIORITIES as readonly string[]).includes(priority)) {
    throw new ServiceError(`priority must be one of: ${TASK_PRIORITIES.join(", ")}`, 400);
  }

  const task = await db.task.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(position !== undefined && { position }),
    },
  });

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    position: task.position,
    updatedAt: task.updatedAt.toISOString(),
  };
}
