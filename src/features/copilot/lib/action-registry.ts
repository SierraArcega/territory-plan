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
        { label: "Note", value: snippet(f.text) },
        ...(f.noteType ? [{ label: "Type", value: NOTE_TYPE_LABELS[f.noteType] ?? f.noteType }] : []),
      ],
      destructive: false,
    }),
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
        { label: "New text", value: snippet(f.text) },
        ...(f.noteType ? [{ label: "Type", value: NOTE_TYPE_LABELS[f.noteType] ?? f.noteType }] : []),
      ],
      destructive: false,
    }),
    snapshot: (targetId, db) =>
      db.districtNote.findUnique({
        where: { id: targetId },
        select: { id: true, bodyText: true, noteType: true },
      }),
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
