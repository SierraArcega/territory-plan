import { readonlyPool } from "@/lib/db-readonly";

const SELECT_ONLY = /^\s*(with\s+[\s\S]+?\s+)?select\b/i;
const LIMIT_MATCH = /\blimit\s+(\d+)\b/i;

export async function handleSampleRows(sql: string): Promise<string> {
  if (!SELECT_ONLY.test(sql.trim())) {
    return "sample_rows only accepts SELECT statements (optionally preceded by a WITH).";
  }
  const limitMatch = LIMIT_MATCH.exec(sql);
  if (!limitMatch) {
    return "sample_rows requires an explicit LIMIT clause (max 20).";
  }
  const limitValue = Number(limitMatch[1]);
  if (limitValue > 20) {
    return `sample_rows caps LIMIT at 20 (you used ${limitValue}).`;
  }
  if (sql.includes(";")) {
    return "sample_rows rejects SQL containing semicolons.";
  }

  try {
    const res = await readonlyPool.query(sql);
    const columns = res.fields?.map((f: { name: string }) => f.name) ?? [];
    const rows = res.rows ?? [];
    if (rows.length === 0) return "No rows returned.";

    const lines: string[] = [`columns: ${columns.join(", ")}`, "rows:"];
    for (const row of rows) {
      lines.push(`  ${JSON.stringify(row)}`);
    }
    return lines.join("\n");
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
