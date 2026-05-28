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

/**
 * Add districts to a plan (the plan↔district junction). Focused core for the
 * copilot: validates the plan + that every leaid is a real district, then
 * inserts junction rows with skipDuplicates. The rich route additionally sets
 * per-district targets/services and syncs auto-tags + rollup totals; those are
 * intentionally omitted here — rollup totals and the no-rollup-leaid invariant
 * self-heal on the plan's next GET (expandPlanRollups), so the core add stays
 * transaction-safe for the audit log.
 */
export async function addDistrictsToPlan(
  planId: string,
  leaids: string[],
  db: DbClient = prisma,
): Promise<{ added: number; planId: string }> {
  if (!Array.isArray(leaids) || leaids.length === 0) {
    throw new ServiceError("provide at least one district", 400);
  }

  const plan = await db.territoryPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ServiceError("Territory plan not found", 404);
  }

  const existing = await db.district.findMany({
    where: { leaid: { in: leaids } },
    select: { leaid: true },
  });
  const existingSet = new Set(existing.map((d) => d.leaid));
  const invalid = leaids.filter((l) => !existingSet.has(l));
  if (invalid.length > 0) {
    throw new ServiceError(`Districts not found: ${invalid.join(", ")}`, 400);
  }

  const result = await db.territoryPlanDistrict.createMany({
    data: leaids.map((leaid) => ({ planId, districtLeaid: leaid })),
    skipDuplicates: true,
  });
  return { added: result.count, planId };
}

/**
 * Remove districts from a plan (the plan↔district junction) — the counterpart to
 * addDistrictsToPlan. Validates the plan, then deletes the junction rows for the
 * given leaids; removing a leaid that isn't in the plan is a harmless no-op.
 * Lean and transaction-safe like the add core: no inline rollup/tag sync —
 * districtCount + target rollups self-heal from current membership on the plan's
 * next GET. Junction target-service rows clear via the existing onDelete: Cascade.
 */
export async function removeDistrictsFromPlan(
  planId: string,
  leaids: string[],
  db: DbClient = prisma,
): Promise<{ removed: number; planId: string }> {
  if (!Array.isArray(leaids) || leaids.length === 0) {
    throw new ServiceError("provide at least one district", 400);
  }

  const plan = await db.territoryPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ServiceError("Territory plan not found", 404);
  }

  const result = await db.territoryPlanDistrict.deleteMany({
    where: { planId, districtLeaid: { in: leaids } },
  });
  return { removed: result.count, planId };
}

/**
 * Link existing activities to a plan (the activity↔plan junction) — the
 * activity counterpart to addDistrictsToPlan. Validates the plan and that every
 * activity id exists, then inserts junction rows (skipDuplicates → idempotent).
 */
export async function addActivitiesToPlan(
  planId: string,
  activityIds: string[],
  db: DbClient = prisma,
): Promise<{ added: number; planId: string }> {
  if (!Array.isArray(activityIds) || activityIds.length === 0) {
    throw new ServiceError("provide at least one activity", 400);
  }

  const plan = await db.territoryPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ServiceError("Territory plan not found", 404);
  }

  const existing = await db.activity.findMany({
    where: { id: { in: activityIds } },
    select: { id: true },
  });
  const existingSet = new Set(existing.map((a) => a.id));
  const invalid = activityIds.filter((id) => !existingSet.has(id));
  if (invalid.length > 0) {
    throw new ServiceError(`Activities not found: ${invalid.join(", ")}`, 400);
  }

  const result = await db.activityPlan.createMany({
    data: activityIds.map((activityId) => ({ planId, activityId })),
    skipDuplicates: true,
  });
  return { added: result.count, planId };
}

/**
 * Remove activities from a plan (the activity↔plan junction) — counterpart to
 * addActivitiesToPlan. Validates the plan, then deletes the junction rows for
 * the given activity ids; removing one that isn't linked is a harmless no-op.
 */
export async function removeActivitiesFromPlan(
  planId: string,
  activityIds: string[],
  db: DbClient = prisma,
): Promise<{ removed: number; planId: string }> {
  if (!Array.isArray(activityIds) || activityIds.length === 0) {
    throw new ServiceError("provide at least one activity", 400);
  }

  const plan = await db.territoryPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ServiceError("Territory plan not found", 404);
  }

  const result = await db.activityPlan.deleteMany({
    where: { planId, activityId: { in: activityIds } },
  });
  return { removed: result.count, planId };
}
