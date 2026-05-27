import prisma from "@/lib/prisma";
import { ServiceError, type DbClient } from "@/features/shared/lib/service-error";

/**
 * Territory-plan mutation core. Extracted from the plan routes so the create and
 * the scalar-field update — the parts the AI copilot exercises — share the same
 * validation. The routes keep their own orchestration: the POST keeps its static
 * response shape; the PUT calls `updatePlan` INSIDE its `$transaction` (passing
 * `tx` as `db`) and keeps the states/collaborator replace-alls + re-fetch, so
 * atomicity is preserved.
 */

const VALID_PLAN_STATUSES = ["planning", "working", "stale", "archived"];
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

function validateColor(color: unknown): void {
  if (color && !HEX_COLOR.test(color as string)) {
    throw new ServiceError("color must be a valid hex color (e.g., #403770)", 400);
  }
}
function validateStatus(status: unknown): void {
  if (status && !VALID_PLAN_STATUSES.includes(status as string)) {
    throw new ServiceError(`status must be one of: ${VALID_PLAN_STATUSES.join(", ")}`, 400);
  }
}

const PLAN_INCLUDE = {
  ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
  states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
  collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
} as const;

export interface CreatePlanInput {
  name?: string;
  description?: string | null;
  ownerId?: string | null;
  color?: string;
  status?: string;
  fiscalYear?: number;
  startDate?: string | null;
  endDate?: string | null;
  stateFips?: string[];
  collaboratorIds?: string[];
}

export async function createPlan(input: CreatePlanInput, userId: string, db: DbClient = prisma) {
  const { name, description, ownerId, color, status, fiscalYear, startDate, endDate, stateFips, collaboratorIds } = input;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw new ServiceError("name is required", 400);
  }
  if (!fiscalYear || typeof fiscalYear !== "number" || fiscalYear < 2024 || fiscalYear > 2030) {
    throw new ServiceError("fiscalYear is required and must be between 2024 and 2030", 400);
  }
  validateColor(color);
  validateStatus(status);

  return db.territoryPlan.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: ownerId || userId,
      color: color || "#403770",
      status: status || "planning",
      fiscalYear,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      userId,
      ...(Array.isArray(stateFips) && stateFips.length > 0 && {
        states: {
          createMany: { data: stateFips.map((fips) => ({ stateFips: fips })), skipDuplicates: true },
        },
      }),
      ...(Array.isArray(collaboratorIds) && collaboratorIds.length > 0 && {
        collaborators: {
          createMany: { data: collaboratorIds.map((uid) => ({ userId: uid })), skipDuplicates: true },
        },
      }),
    },
    include: PLAN_INCLUDE,
  });
}

export interface UpdatePlanInput {
  name?: string;
  description?: string | null;
  ownerId?: string | null;
  color?: string;
  status?: string;
  fiscalYear?: number;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Scalar-field update + validation. Any authenticated user may update a plan
 * (matching the route — there is no per-plan ownership gate). States and
 * collaborators are relations the caller reconciles; this only touches scalars.
 */
export async function updatePlan(id: string, input: UpdatePlanInput, db: DbClient = prisma) {
  const { name, description, ownerId, color, status, fiscalYear, startDate, endDate } = input;

  const existing = await db.territoryPlan.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Territory plan not found", 404);
  }

  validateColor(color);
  validateStatus(status);
  if (fiscalYear !== undefined && (typeof fiscalYear !== "number" || fiscalYear < 2024 || fiscalYear > 2030)) {
    throw new ServiceError("fiscalYear must be between 2024 and 2030", 400);
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description?.trim() || null;
  if (ownerId !== undefined) updateData.ownerId = ownerId || null;
  if (color !== undefined) updateData.color = color;
  if (status !== undefined) updateData.status = status;
  if (fiscalYear !== undefined) updateData.fiscalYear = fiscalYear;
  if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
  if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

  return db.territoryPlan.update({ where: { id }, data: updateData });
}
