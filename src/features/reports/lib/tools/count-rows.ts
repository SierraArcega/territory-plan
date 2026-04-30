import { readonlyPool } from "@/lib/db-readonly";

const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i;

export async function handleCountRows(
  fromSql: string,
  whereSql?: string,
): Promise<string> {
  if (FORBIDDEN.test(fromSql) || (whereSql && FORBIDDEN.test(whereSql))) {
    return "Invalid: count_rows only accepts read-only SELECT-style fragments. Rejected.";
  }
  if (fromSql.includes(";") || (whereSql && whereSql.includes(";"))) {
    return "Invalid: SQL fragments must not contain semicolons.";
  }

  const sql = whereSql
    ? `SELECT COUNT(*)::text AS c FROM ${fromSql} WHERE ${whereSql}`
    : `SELECT COUNT(*)::text AS c FROM ${fromSql}`;

  try {
    const res = await readonlyPool.query<{ c: string }>(sql);
    const count = res.rows[0]?.c ?? "0";
    return `Row count: ${count}`;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
