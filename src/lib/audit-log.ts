import prisma from "@/lib/prisma";

export interface FieldChange {
  columnName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: Date;
  changedBy: string | null;
}

/**
 * Full change history for one row in one table.
 * `rowPk` uses the same colon-joined convention as the audit trigger
 * (e.g. "plan_abc:1203510" for territory_plan_districts).
 */
export async function getRowHistory(
  tableName: string,
  rowPk: string
): Promise<FieldChange[]> {
  const rows = await prisma.auditLog.findMany({
    where: { tableName, rowPk },
    orderBy: { changedAt: "asc" },
  });
  return rows.map((r) => ({
    columnName: r.columnName,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedAt: r.changedAt,
    changedBy: r.changedBy,
  }));
}

/**
 * History of a single column across one row.
 * Useful for "show me how this deal's min_commit evolved."
 */
export async function getFieldHistory(
  tableName: string,
  rowPk: string,
  columnName: string
): Promise<FieldChange[]> {
  const rows = await prisma.auditLog.findMany({
    where: { tableName, rowPk, columnName },
    orderBy: { changedAt: "asc" },
  });
  return rows.map((r) => ({
    columnName: r.columnName,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedAt: r.changedAt,
    changedBy: r.changedBy,
  }));
}

/**
 * Every change to a given column across every row in a table within a time
 * window. Powers "what min_commits changed last week" board reports.
 */
export async function getColumnChangesInWindow(
  tableName: string,
  columnName: string,
  since: Date,
  until: Date = new Date()
): Promise<Array<FieldChange & { rowPk: string }>> {
  const rows = await prisma.auditLog.findMany({
    where: {
      tableName,
      columnName,
      changedAt: { gte: since, lte: until },
    },
    orderBy: { changedAt: "asc" },
  });
  return rows.map((r) => ({
    rowPk: r.rowPk,
    columnName: r.columnName,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedAt: r.changedAt,
    changedBy: r.changedBy,
  }));
}

/**
 * Set the current actor on the DB session so triggers record changed_by.
 * Must be called inside the same transaction as the mutation, e.g.:
 *
 *   await prisma.$transaction(async (tx) => {
 *     await setAuditActor(tx, user.id);
 *     await tx.opportunity.update({ ... });
 *   });
 *
 * No-op if userId is falsy (trigger will record NULL).
 */
export async function setAuditActor(
  tx: { $executeRawUnsafe: (q: string) => Promise<number> },
  userId: string | null | undefined
): Promise<void> {
  if (!userId) return;
  // SET LOCAL keeps the setting scoped to the current transaction.
  // Escape via parameterised call — user IDs are UUIDs so this is safe, but we
  // strip non-uuid chars defensively.
  const clean = userId.replace(/[^a-f0-9-]/gi, "");
  await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${clean}'`);
}
