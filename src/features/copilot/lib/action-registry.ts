import { z } from "zod";
import type { DbClient } from "@/features/shared/lib/service-error";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/features/tasks/types";
import { createTask, updateTask } from "@/features/tasks/lib/service";
import type {
  ActionPreview,
  CopilotObjectType,
  CopilotOperation,
} from "./types";

/**
 * The action registry is the heart of the write layer. One entry per
 * (objectType, operation). The `propose_actions` terminal handler validates a
 * model proposal against `parse` and renders a confirm card via `buildPreview`;
 * the execute endpoint re-validates, snapshots the before-state (updates), and
 * runs `execute` inside a transaction. Field validation + preview live here so
 * the model can self-correct at propose time, before anything is written.
 */

export interface ActionContext {
  userId: string;
  db: DbClient;
}

interface PreviewOpts {
  targetId?: string | number | null;
  summary?: string;
}

interface ExecuteOpts {
  targetId?: string | number | null;
  ctx: ActionContext;
}

interface ActionDef<S extends z.ZodTypeAny> {
  objectType: CopilotObjectType;
  operation: CopilotOperation;
  /** Defaults to true for `update`. */
  needsTarget?: boolean;
  fieldsSchema: S;
  buildPreview: (fields: z.infer<S>, opts: PreviewOpts) => ActionPreview;
  /** Update-only: capture before-state for the audit log. */
  snapshot?: (targetId: string, db: DbClient) => Promise<unknown>;
  execute: (fields: z.infer<S>, opts: ExecuteOpts) => Promise<unknown>;
}

export interface RegisteredAction {
  objectType: CopilotObjectType;
  operation: CopilotOperation;
  needsTarget: boolean;
  parse: (
    raw: unknown,
  ) => { ok: true; fields: unknown } | { ok: false; errors: string[] };
  buildPreview: (fields: unknown, opts: PreviewOpts) => ActionPreview;
  snapshot?: (targetId: string, db: DbClient) => Promise<unknown>;
  execute: (fields: unknown, opts: ExecuteOpts) => Promise<unknown>;
}

function defineAction<S extends z.ZodTypeAny>(def: ActionDef<S>): RegisteredAction {
  return {
    objectType: def.objectType,
    operation: def.operation,
    needsTarget: def.needsTarget ?? def.operation === "update",
    parse: (raw) => {
      const r = def.fieldsSchema.safeParse(raw);
      if (!r.success) {
        return {
          ok: false,
          errors: r.error.errors.map(
            (e) => `${e.path.join(".") || "fields"}: ${e.message}`,
          ),
        };
      }
      return { ok: true, fields: r.data };
    },
    // Casts are safe: `parse` validated `fields` against the same schema before
    // these are ever called.
    buildPreview: (fields, opts) => def.buildPreview(fields as z.infer<S>, opts),
    snapshot: def.snapshot,
    execute: (fields, opts) => def.execute(fields as z.infer<S>, opts),
  };
}

const statusField = z
  .string()
  .refine((s) => (TASK_STATUSES as readonly string[]).includes(s), {
    message: `must be one of: ${TASK_STATUSES.join(", ")}`,
  });
const priorityField = z
  .string()
  .refine((s) => (TASK_PRIORITIES as readonly string[]).includes(s), {
    message: `must be one of: ${TASK_PRIORITIES.join(", ")}`,
  });
const dateField = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "must be a parseable date" });

const ACTION_REGISTRY: Record<string, RegisteredAction> = {};

function register(action: RegisteredAction): void {
  ACTION_REGISTRY[`${action.objectType}.${action.operation}`] = action;
}

export function getAction(
  objectType: string,
  operation: string,
): RegisteredAction | undefined {
  return ACTION_REGISTRY[`${objectType}.${operation}`];
}

// ===== task.create =====
register(
  defineAction({
    objectType: "task",
    operation: "create",
    fieldsSchema: z.object({
      title: z.string().min(1, "title is required"),
      description: z.string().optional(),
      status: statusField.optional(),
      priority: priorityField.optional(),
      dueDate: dateField.optional(),
      assignedToUserId: z.string().optional(),
      leaids: z.array(z.string()).optional(),
      planIds: z.array(z.string()).optional(),
      contactIds: z.array(z.number()).optional(),
      activityIds: z.array(z.string()).optional(),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Create task",
      summary: summary || f.title,
      rows: [
        { label: "Title", value: f.title },
        ...(f.dueDate ? [{ label: "Due", value: f.dueDate }] : []),
        ...(f.priority ? [{ label: "Priority", value: f.priority }] : []),
        ...(f.status ? [{ label: "Status", value: f.status }] : []),
        ...(f.leaids?.length
          ? [{ label: "Linked districts", value: String(f.leaids.length) }]
          : []),
      ],
      destructive: false,
    }),
    execute: (f, { ctx }) =>
      // Owner is always the rep (createdByUserId); assignee defaults to the rep
      // per the UX defaults when the model doesn't specify one.
      createTask(
        { ...f, assignedToUserId: f.assignedToUserId ?? ctx.userId },
        ctx.userId,
        ctx.db,
      ),
  }),
);

// ===== task.update =====
register(
  defineAction({
    objectType: "task",
    operation: "update",
    fieldsSchema: z
      .object({
        title: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: statusField.optional(),
        priority: priorityField.optional(),
        dueDate: dateField.nullable().optional(),
        position: z.number().optional(),
      })
      .refine((o) => Object.keys(o).length > 0, {
        message: "provide at least one field to update",
      }),
    buildPreview: (f, { targetId, summary }) => ({
      title: "Update task",
      summary: summary || `Update task ${targetId ?? ""}`.trim(),
      rows: Object.entries(f).map(([label, value]) => ({
        label,
        value: value === null ? "(cleared)" : String(value),
      })),
      destructive: false,
    }),
    snapshot: (targetId, db) =>
      db.task.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          position: true,
        },
      }),
    execute: (f, { targetId, ctx }) =>
      updateTask(String(targetId), f, ctx.userId, ctx.db),
  }),
);
