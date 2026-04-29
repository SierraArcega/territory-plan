import { TABLE_REGISTRY, SEMANTIC_CONTEXT } from "@/lib/district-column-metadata";

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
