import { TABLE_REGISTRY, SEMANTIC_CONTEXT } from "@/lib/district-column-metadata";

/**
 * Slim schema for inclusion in the system prompt. Includes column name + type +
 * one-liner only — no relationship paragraphs, no value examples. Used to
 * eliminate per-conversation `describe_table` calls on the most common tables.
 */
export function buildCompactSchema(table: string): string {
  const meta = TABLE_REGISTRY[table];
  if (!meta) return "";
  const out: string[] = [];
  out.push(
    `## ${meta.table} — ${meta.description.split("\n")[0].slice(0, 200)}`,
  );
  const pk = Array.isArray(meta.primaryKey) ? meta.primaryKey.join(", ") : meta.primaryKey;
  out.push(`PK: ${pk}`);
  for (const col of meta.columns) {
    if (!col.queryable) continue;
    const desc = col.description.split("\n")[0].slice(0, 120);
    out.push(`- ${col.column} (${col.format}): ${desc}`);
  }
  if (meta.relationships.length > 0) {
    const joins = meta.relationships
      .map((r) => r.toTable)
      .slice(0, 8)
      .join(", ");
    out.push(`Joins: ${joins}`);
  }
  if (meta.warnings && meta.warnings.length > 0) {
    out.push(`Warnings: ${meta.warnings.join(" | ")}`);
  }
  return out.join("\n");
}

export async function handleDescribeTable(table: string): Promise<string> {
  const meta = TABLE_REGISTRY[table];
  if (!meta) {
    return `Table "${table}" is not registered. Call list_tables to see available tables.`;
  }

  const out: string[] = [];
  out.push(`# ${meta.table}`);
  out.push(meta.description);
  out.push("");
  out.push(`Primary key: ${Array.isArray(meta.primaryKey) ? meta.primaryKey.join(", ") : meta.primaryKey}`);
  out.push("");

  out.push("## Columns");
  for (const col of meta.columns) {
    if (!col.queryable) continue;
    out.push(`- ${col.column} (${col.format}): ${col.description}`);
  }

  if (meta.relationships.length > 0) {
    out.push("");
    out.push("## Relationships");
    for (const rel of meta.relationships) {
      out.push(`- ${rel.toTable} — ${rel.description ?? "join available"}`);
    }
  }

  if (meta.warnings && meta.warnings.length > 0) {
    out.push("");
    out.push("## Warnings");
    for (const w of meta.warnings) out.push(`- ${w}`);
  }

  const triggered = SEMANTIC_CONTEXT.warnings.filter((w) =>
    w.triggerTables.includes(table),
  );
  if (triggered.length > 0) {
    out.push("");
    out.push("## Semantic context warnings");
    for (const w of triggered) out.push(`- [${w.severity}] ${w.message}`);
  }

  return out.join("\n");
}
