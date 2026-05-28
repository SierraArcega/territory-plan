import { z } from "zod";
import type { DbClient } from "@/features/shared/lib/service-error";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/features/tasks/types";
import { createTask, updateTask } from "@/features/tasks/lib/service";
import { createContact, updateContact } from "@/features/contacts/lib/service";
import { isValidPersona, isValidSeniorityLevel } from "@/features/shared/types/contact-types";
import { createDistrictNote, updateDistrictNote } from "@/features/districts/lib/note-service";
import { plainTextToNoteDoc } from "@/features/views/lib/note-doc";
import { isNoteType, NOTE_TYPE_LABELS } from "@/features/views/lib/note-types";
import { createActivity, updateActivity } from "@/features/activities/lib/service";
import { ALL_ACTIVITY_TYPES, VALID_ACTIVITY_STATUSES } from "@/features/activities/types";
import {
  createPlan,
  updatePlan,
  addDistrictsToPlan,
  removeDistrictsFromPlan,
  addActivitiesToPlan,
  removeActivitiesFromPlan,
} from "@/features/plans/lib/service";
import { isAdmin } from "@/lib/supabase/server";
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
  /**
   * Optional async existence/permission check run at PROPOSE time (before any
   * card is shown). Returns human-readable error strings; a non-empty result
   * becomes a validation_error the agent loop feeds back so the model can
   * self-correct (e.g. look up the real leaid). Keep it to reads.
   */
  validate?: (fields: z.infer<S>, ctx: ActionContext) => Promise<string[]>;
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
  validate?: (fields: unknown, ctx: ActionContext) => Promise<string[]>;
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
    validate: def.validate
      ? (fields, ctx) => def.validate!(fields as z.infer<S>, ctx)
      : undefined,
    execute: (fields, opts) => def.execute(fields as z.infer<S>, opts),
  };
}

/** Returns the subset of leaids that don't exist in `districts` (read-only). */
async function missingLeaids(
  leaids: ReadonlyArray<string> | undefined,
  db: DbClient,
): Promise<string[]> {
  const list = (leaids ?? []).filter(Boolean);
  if (list.length === 0) return [];
  const found = await db.district.findMany({
    where: { leaid: { in: [...list] } },
    select: { leaid: true },
  });
  const have = new Set(found.map((d) => d.leaid));
  return list.filter((l) => !have.has(l));
}

/** Propose-time error guiding the model to look up real leaids, never guess. */
function leaidErrors(missing: string[]): string[] {
  if (missing.length === 0) return [];
  return [
    `No district found for leaid(s): ${missing.join(", ")}. Look up the correct leaid with ` +
      `run_sql (e.g. SELECT leaid, name, state FROM districts WHERE name ILIKE '%…%') and use only ` +
      `a returned value, or tell the rep you couldn't find that district. Do not guess.`,
  ];
}

/** Returns the subset of activity ids that don't exist in `activity` (read-only). */
async function missingActivityIds(
  ids: ReadonlyArray<string> | undefined,
  db: DbClient,
): Promise<string[]> {
  const list = (ids ?? []).filter(Boolean);
  if (list.length === 0) return [];
  const found = await db.activity.findMany({
    where: { id: { in: [...list] } },
    select: { id: true },
  });
  const have = new Set(found.map((a) => a.id));
  return list.filter((id) => !have.has(id));
}

/** Propose-time error guiding the model to look up real activity ids, never guess. */
function activityIdErrors(missing: string[]): string[] {
  if (missing.length === 0) return [];
  return [
    `No activity found for id(s): ${missing.join(", ")}. Look up real activity ids with ` +
      `run_sql (e.g. SELECT id, title FROM activities WHERE …) and use only a returned ` +
      `value, or tell the rep you couldn't find that activity. Do not guess.`,
  ];
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
const personaField = z
  .string()
  .refine((s) => isValidPersona(s), { message: "invalid persona" });
const seniorityField = z
  .string()
  .refine((s) => isValidSeniorityLevel(s), { message: "invalid seniority level" });
const noteTypeField = z
  .string()
  .refine((s) => isNoteType(s), { message: "invalid note type" });
const activityTypeField = z
  .string()
  .refine((s) => (ALL_ACTIVITY_TYPES as readonly string[]).includes(s), { message: "invalid activity type" });
const activityStatusField = z
  .string()
  .refine((s) => (VALID_ACTIVITY_STATUSES as readonly string[]).includes(s), { message: "invalid activity status" });
const planStatusField = z
  .string()
  .refine((s) => ["planning", "working", "stale", "archived"].includes(s), { message: "invalid plan status" });
const hexColorField = z
  .string()
  .refine((s) => /^#[0-9A-Fa-f]{6}$/.test(s), { message: "must be a hex color like #403770" });
const fiscalYearField = z.number().int().min(2024).max(2030);

// Truncate free text for a confirm-card row so a long note doesn't blow out the card.
function snippet(text: string): string {
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

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
    validate: async (f, { db }) => leaidErrors(await missingLeaids(f.leaids, db)),
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

// ===== contact.create =====
register(
  defineAction({
    objectType: "contact",
    operation: "create",
    fieldsSchema: z.object({
      // leaid links the contact to a district; it's an internal id, so it's
      // never shown on the confirm card (the model names the district in the
      // summary instead).
      leaid: z.string().min(1, "leaid is required"),
      name: z.string().min(1, "name is required"),
      title: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      salutation: z.string().optional(),
      isPrimary: z.boolean().optional(),
      linkedinUrl: z.string().optional(),
      persona: personaField.optional(),
      seniorityLevel: seniorityField.optional(),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Create contact",
      summary: summary || `${f.name}${f.title ? ` — ${f.title}` : ""}`,
      rows: [
        { label: "Name", value: f.name },
        ...(f.title ? [{ label: "Title", value: f.title }] : []),
        ...(f.email ? [{ label: "Email", value: f.email }] : []),
        ...(f.phone ? [{ label: "Phone", value: f.phone }] : []),
        ...(f.isPrimary ? [{ label: "Primary contact", value: "yes" }] : []),
      ],
      destructive: false,
    }),
    validate: async (f, { db }) => leaidErrors(await missingLeaids([f.leaid], db)),
    execute: (f, { ctx }) => createContact(f, ctx.db),
  }),
);

// ===== contact.update =====
register(
  defineAction({
    objectType: "contact",
    operation: "update",
    fieldsSchema: z
      .object({
        name: z.string().min(1).optional(),
        title: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
        salutation: z.string().nullable().optional(),
        isPrimary: z.boolean().optional(),
        linkedinUrl: z.string().nullable().optional(),
        persona: personaField.optional(),
        seniorityLevel: seniorityField.optional(),
      })
      .refine((o) => Object.keys(o).length > 0, {
        message: "provide at least one field to update",
      }),
    buildPreview: (f, { targetId, summary }) => ({
      title: "Update contact",
      summary: summary || `Update contact ${targetId ?? ""}`.trim(),
      rows: Object.entries(f).map(([label, value]) => ({
        label,
        value: value === null ? "(cleared)" : String(value),
      })),
      destructive: false,
    }),
    snapshot: (targetId, db) =>
      db.contact.findUnique({
        where: { id: Number(targetId) },
        select: {
          id: true,
          name: true,
          title: true,
          email: true,
          phone: true,
          salutation: true,
          isPrimary: true,
          linkedinUrl: true,
          persona: true,
          seniorityLevel: true,
        },
      }),
    execute: (f, { targetId, ctx }) => updateContact(Number(targetId), f, ctx.db),
  }),
);

// ===== district_note.create =====
register(
  defineAction({
    objectType: "district_note",
    operation: "create",
    fieldsSchema: z.object({
      // leaid is the district the note is logged against — an internal id, kept
      // off the confirm card. `text` is plain text; converted to a TipTap doc.
      leaid: z.string().min(1, "leaid is required"),
      text: z.string().min(1, "text is required"),
      noteType: noteTypeField.optional(),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Add district note",
      summary: summary || snippet(f.text),
      rows: [
        // Full note text (not truncated) — the rep must read it to approve it.
        { label: "Note", value: f.text },
        ...(f.noteType ? [{ label: "Type", value: NOTE_TYPE_LABELS[f.noteType] ?? f.noteType }] : []),
      ],
      destructive: false,
    }),
    validate: async (f, { db }) => leaidErrors(await missingLeaids([f.leaid], db)),
    execute: (f, { ctx }) => {
      const { bodyJson, bodyText } = plainTextToNoteDoc(f.text);
      return createDistrictNote(
        f.leaid,
        { bodyText, bodyJson, noteType: f.noteType },
        ctx.userId,
        ctx.db,
      );
    },
  }),
);

// ===== district_note.update =====
register(
  defineAction({
    objectType: "district_note",
    operation: "update",
    fieldsSchema: z.object({
      leaid: z.string().min(1, "leaid is required"),
      text: z.string().min(1, "text is required"),
      noteType: noteTypeField.optional(),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Update district note",
      summary: summary || snippet(f.text),
      rows: [
        // Full note text (not truncated) — the rep must read it to approve it.
        { label: "New text", value: f.text },
        ...(f.noteType ? [{ label: "Type", value: NOTE_TYPE_LABELS[f.noteType] ?? f.noteType }] : []),
      ],
      destructive: false,
    }),
    snapshot: (targetId, db) =>
      db.districtNote.findUnique({
        where: { id: targetId },
        select: { id: true, bodyText: true, noteType: true },
      }),
    validate: async (f, { db }) => leaidErrors(await missingLeaids([f.leaid], db)),
    execute: (f, { targetId, ctx }) => {
      const { bodyJson, bodyText } = plainTextToNoteDoc(f.text);
      return updateDistrictNote(
        f.leaid,
        String(targetId),
        { bodyText, bodyJson, noteType: f.noteType },
        ctx.userId,
        () => isAdmin(ctx.userId),
        ctx.db,
      );
    },
  }),
);

// ===== activity.create =====
register(
  defineAction({
    objectType: "activity",
    operation: "create",
    fieldsSchema: z.object({
      type: activityTypeField,
      title: z.string().min(1, "title is required"),
      notes: z.string().optional(),
      startDate: dateField.optional(),
      endDate: dateField.optional(),
      status: activityStatusField.optional(),
      outcome: z.string().optional(),
      leaids: z.array(z.string()).optional(),
      planIds: z.array(z.string()).optional(),
      contactIds: z.array(z.number()).optional(),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Log activity",
      summary: summary || f.title,
      rows: [
        { label: "Type", value: f.type },
        { label: "Title", value: f.title },
        ...(f.startDate ? [{ label: "When", value: f.startDate }] : []),
        ...(f.status ? [{ label: "Status", value: f.status }] : []),
        ...(f.leaids?.length
          ? [{ label: "Linked districts", value: String(f.leaids.length) }]
          : []),
      ],
      destructive: false,
    }),
    validate: async (f, { db }) => leaidErrors(await missingLeaids(f.leaids, db)),
    execute: (f, { ctx }) =>
      createActivity(
        {
          type: f.type,
          title: f.title,
          notes: f.notes,
          startDate: f.startDate,
          endDate: f.endDate,
          status: f.status,
          outcome: f.outcome,
          districtLeaids: f.leaids,
          planIds: f.planIds,
          contactIds: f.contactIds,
        },
        ctx.userId,
        ctx.db,
      ),
  }),
);

// ===== activity.update =====
register(
  defineAction({
    objectType: "activity",
    operation: "update",
    fieldsSchema: z
      .object({
        title: z.string().min(1).optional(),
        type: activityTypeField.optional(),
        status: activityStatusField.optional(),
        notes: z.string().nullable().optional(),
        startDate: dateField.nullable().optional(),
        endDate: dateField.nullable().optional(),
        outcome: z.string().nullable().optional(),
        nextStep: z.string().nullable().optional(),
        followUpDate: dateField.nullable().optional(),
        rating: z.number().int().min(1).max(5).optional(),
      })
      .refine((o) => Object.keys(o).length > 0, {
        message: "provide at least one field to update",
      }),
    buildPreview: (f, { targetId, summary }) => ({
      title: "Update activity",
      summary: summary || `Update activity ${targetId ?? ""}`.trim(),
      rows: Object.entries(f).map(([label, value]) => ({
        label,
        value: value === null ? "(cleared)" : String(value),
      })),
      destructive: false,
    }),
    snapshot: (targetId, db) =>
      db.activity.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          type: true,
          title: true,
          status: true,
          notes: true,
          startDate: true,
          endDate: true,
          outcome: true,
        },
      }),
    execute: (f, { targetId, ctx }) =>
      updateActivity(String(targetId), f, ctx.userId, () => isAdmin(ctx.userId), ctx.db),
  }),
);

// ===== plan.create =====
register(
  defineAction({
    objectType: "plan",
    operation: "create",
    fieldsSchema: z.object({
      name: z.string().min(1, "name is required"),
      fiscalYear: fiscalYearField,
      description: z.string().optional(),
      status: planStatusField.optional(),
      color: hexColorField.optional(),
      startDate: dateField.optional(),
      endDate: dateField.optional(),
      stateFips: z.array(z.string()).optional(),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Create territory plan",
      summary: summary || f.name,
      rows: [
        { label: "Name", value: f.name },
        { label: "Fiscal year", value: String(f.fiscalYear) },
        ...(f.status ? [{ label: "Status", value: f.status }] : []),
      ],
      destructive: false,
    }),
    execute: (f, { ctx }) => createPlan(f, ctx.userId, ctx.db),
  }),
);

// ===== plan.update =====
register(
  defineAction({
    objectType: "plan",
    operation: "update",
    fieldsSchema: z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: planStatusField.optional(),
        color: hexColorField.optional(),
        fiscalYear: fiscalYearField.optional(),
        startDate: dateField.nullable().optional(),
        endDate: dateField.nullable().optional(),
      })
      .refine((o) => Object.keys(o).length > 0, {
        message: "provide at least one field to update",
      }),
    buildPreview: (f, { targetId, summary }) => ({
      title: "Update territory plan",
      summary: summary || `Update plan ${targetId ?? ""}`.trim(),
      rows: Object.entries(f).map(([label, value]) => ({
        label,
        value: value === null ? "(cleared)" : String(value),
      })),
      destructive: false,
    }),
    snapshot: (targetId, db) =>
      db.territoryPlan.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          color: true,
          fiscalYear: true,
          startDate: true,
          endDate: true,
        },
      }),
    execute: (f, { targetId, ctx }) => updatePlan(String(targetId), f, ctx.db),
  }),
);

// ===== plan.add_districts — link existing districts to a plan =====
register(
  defineAction({
    objectType: "plan",
    operation: "add_districts",
    needsTarget: true,
    fieldsSchema: z.object({
      leaids: z.array(z.string().min(1)).min(1, "provide at least one district"),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Add districts to plan",
      summary:
        summary || `Add ${f.leaids.length} district${f.leaids.length === 1 ? "" : "s"} to the plan`,
      rows: [{ label: "Districts", value: String(f.leaids.length) }],
      destructive: false,
    }),
    validate: async (f, { db }) => leaidErrors(await missingLeaids(f.leaids, db)),
    execute: (f, { targetId, ctx }) => addDistrictsToPlan(String(targetId), f.leaids, ctx.db),
  }),
);

// ===== plan.remove_districts — unlink existing districts from a plan =====
register(
  defineAction({
    objectType: "plan",
    operation: "remove_districts",
    needsTarget: true,
    fieldsSchema: z.object({
      leaids: z.array(z.string().min(1)).min(1, "provide at least one district"),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Remove districts from plan",
      summary:
        summary ||
        `Remove ${f.leaids.length} district${f.leaids.length === 1 ? "" : "s"} from the plan`,
      rows: [{ label: "Districts", value: String(f.leaids.length) }],
      destructive: true,
    }),
    validate: async (f, { db }) => leaidErrors(await missingLeaids(f.leaids, db)),
    execute: (f, { targetId, ctx }) =>
      removeDistrictsFromPlan(String(targetId), f.leaids, ctx.db),
  }),
);

// ===== plan.add_activities — link existing activities to a plan =====
register(
  defineAction({
    objectType: "plan",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operation: "add_activities" as any,
    needsTarget: true,
    fieldsSchema: z.object({
      activityIds: z.array(z.string().min(1)).min(1, "provide at least one activity"),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Add activities to plan",
      summary:
        summary ||
        `Add ${f.activityIds.length} activit${f.activityIds.length === 1 ? "y" : "ies"} to the plan`,
      rows: [{ label: "Activities", value: String(f.activityIds.length) }],
      destructive: false,
    }),
    validate: async (f, { db }) => activityIdErrors(await missingActivityIds(f.activityIds, db)),
    execute: (f, { targetId, ctx }) =>
      addActivitiesToPlan(String(targetId), f.activityIds, ctx.db),
  }),
);

// ===== plan.remove_activities — unlink existing activities from a plan =====
register(
  defineAction({
    objectType: "plan",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operation: "remove_activities" as any,
    needsTarget: true,
    fieldsSchema: z.object({
      activityIds: z.array(z.string().min(1)).min(1, "provide at least one activity"),
    }),
    buildPreview: (f, { summary }) => ({
      title: "Remove activities from plan",
      summary:
        summary ||
        `Remove ${f.activityIds.length} activit${f.activityIds.length === 1 ? "y" : "ies"} from the plan`,
      rows: [{ label: "Activities", value: String(f.activityIds.length) }],
      destructive: true,
    }),
    validate: async (f, { db }) => activityIdErrors(await missingActivityIds(f.activityIds, db)),
    execute: (f, { targetId, ctx }) =>
      removeActivitiesFromPlan(String(targetId), f.activityIds, ctx.db),
  }),
);
