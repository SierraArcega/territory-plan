import { TABLE_REGISTRY } from "@/lib/district-column-metadata";
import { readonlyPool } from "@/lib/db-readonly";

export async function handleGetColumnValues(
  table: string,
  column: string,
  limit = 30,
): Promise<string> {
  const meta = TABLE_REGISTRY[table];
  if (!meta) {
    return `Table "${table}" is not registered. Use list_tables to see available tables.`;
  }
  const col = meta.columns.find((c) => c.column === column && c.queryable);
  if (!col) {
    return `Column "${column}" not found on table "${table}" (or not queryable). Use describe_table to see available columns.`;
  }

  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));

  const sql = `SELECT DISTINCT "${column}" AS v FROM "${table}" WHERE "${column}" IS NOT NULL ORDER BY 1 LIMIT ${safeLimit}`;
  try {
    const res = await readonlyPool.query<{ v: unknown }>(sql);
    const values = res.rows.map((r) => String(r.v));
    if (values.length === 0) {
      return `No non-null values in ${table}.${column}.`;
    }
    return `Distinct values in ${table}.${column} (up to ${safeLimit}):\n${values
      .map((v) => `  - ${v}`)
      .join("\n")}`;
  } catch (err) {
    return `Query failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
