/**
 * Shape the copilot audit log for the rep-facing activity view. Derives a plain
 * label ("Created task: …") from the after-snapshot's title/name and never
 * surfaces the raw target id (reps aren't engineers — see the no-raw-ids rule).
 */

export interface ActionLogRow {
  id: number;
  objectType: string;
  operation: string;
  status: string;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: Date;
}

export interface ActionLogEntry {
  id: number;
  objectType: string;
  operation: string;
  status: string;
  label: string;
  createdAt: string;
}

const VERB: Record<string, string> = { create: "Created", update: "Updated" };
const NOUN: Record<string, string> = {
  task: "task",
  activity: "activity",
  contact: "contact",
  plan: "plan",
  district_note: "district note",
};

export function formatActionLogEntry(row: ActionLogRow): ActionLogEntry {
  const verb = VERB[row.operation] ?? row.operation;
  const noun = NOUN[row.objectType] ?? row.objectType;
  const after =
    row.afterJson && typeof row.afterJson === "object" && !Array.isArray(row.afterJson)
      ? (row.afterJson as Record<string, unknown>)
      : null;
  const name =
    after && typeof after.title === "string"
      ? after.title
      : after && typeof after.name === "string"
        ? after.name
        : null;
  const label = name ? `${verb} ${noun}: ${name}` : `${verb} ${noun}`;
  return {
    id: row.id,
    objectType: row.objectType,
    operation: row.operation,
    status: row.status,
    label,
    createdAt: row.createdAt.toISOString(),
  };
}
