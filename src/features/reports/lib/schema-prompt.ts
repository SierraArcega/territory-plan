import {
  SEMANTIC_CONTEXT,
  TABLE_REGISTRY,
  type TableMetadata,
} from "@/lib/district-column-metadata";

/**
 * Build the system prompt that describes the queryable schema + semantic
 * context for Claude. Stable across requests — put `cache_control` on this
 * block when calling the Messages API.
 */
export function buildSchemaPrompt(): string {
  const parts: string[] = [];

  parts.push(
    "You are a query-building assistant for a B2B sales team at Fullmind (an EdTech vendor selling to US school districts). You translate natural-language questions into structured query parameters for our internal reporting tool. You NEVER produce SQL — you always call the `run_query` tool with structured params. The server compiles those params to SQL and executes them against a read-only database.",
    "",
    "IMPORTANT:",
    "- Use tables and columns ONLY from the list below. If a question cannot be answered with these tables, call `run_query` with your best attempt AND write a short explanation noting the limitation.",
    "- When multiple tables could answer a question, follow the routing rules in the CONCEPT MAPPINGS section below.",
    "- Respect the WARNINGS below — they encode known data quality issues and are non-negotiable.",
    "- Always provide a 1-2 sentence `explanation` summarizing what the query will return and surfacing any mandatory caveats.",
    "",
    "=== AVAILABLE TABLES ===",
    "",
  );

  const tableNames = Object.keys(TABLE_REGISTRY).sort();
  for (const name of tableNames) {
    parts.push(serializeTable(TABLE_REGISTRY[name]));
    parts.push("");
  }

  parts.push("=== CONCEPT MAPPINGS (how to translate user intent) ===", "");
  for (const [name, mapping] of Object.entries(SEMANTIC_CONTEXT.conceptMappings)) {
    parts.push(`- "${name}":`);
    if (mapping.aggregated) parts.push(`    aggregated path: ${mapping.aggregated}`);
    if (mapping.dealLevel) parts.push(`    deal-level path: ${mapping.dealLevel}`);
    if (mapping.note) parts.push(`    note: ${mapping.note}`);
  }
  parts.push("");

  if (SEMANTIC_CONTEXT.formatMismatches.length > 0) {
    parts.push("=== FORMAT MISMATCHES ===", "");
    for (const mismatch of SEMANTIC_CONTEXT.formatMismatches) {
      parts.push(`- ${mismatch.concept}:`);
      if (mismatch.tables) {
        for (const [t, fmt] of Object.entries(mismatch.tables)) {
          parts.push(`    ${t}: ${fmt}`);
        }
      }
      if (mismatch.conversionSql) parts.push(`    conversion: ${mismatch.conversionSql}`);
      if (mismatch.note) parts.push(`    note: ${mismatch.note}`);
    }
    parts.push("");
  }

  const mandatoryWarnings = SEMANTIC_CONTEXT.warnings.filter(
    (w) => w.severity === "mandatory",
  );
  const infoWarnings = SEMANTIC_CONTEXT.warnings.filter(
    (w) => w.severity === "informational",
  );

  if (mandatoryWarnings.length > 0) {
    parts.push("=== MANDATORY WARNINGS — you MUST follow these ===", "");
    for (const w of mandatoryWarnings) {
      parts.push(`[${w.triggerTables.join(", ")}] ${w.message}`);
      parts.push("");
    }
  }

  if (infoWarnings.length > 0) {
    parts.push("=== INFORMATIONAL WARNINGS ===", "");
    for (const w of infoWarnings) {
      parts.push(`[${w.triggerTables.join(", ")}] ${w.message}`);
      parts.push("");
    }
  }

  parts.push(
    "=== QUERY PARAMS FORMAT ===",
    "",
    "Call the `run_query` tool with these fields:",
    "- table (required): the root table name",
    "- columns (optional): array of column names to return; use qualified 'table.column' when joining",
    "- filters (optional): array of { column, op, value? }. Ops: eq, neq, gt, gte, lt, lte, in, notIn, like, ilike, isNull, isNotNull",
    "- aggregations (optional): array of { column, fn, alias? }. Fns: sum, avg, min, max, count. Use column='*' only with fn='count'.",
    "- groupBy (optional): array of column names. REQUIRED when mixing aggregations with non-aggregated selected columns.",
    "- orderBy (optional): array of { column, direction: 'asc' | 'desc' }",
    "- limit (optional): integer 1–500. Defaults to 100.",
    "- joins (optional): array of { toTable } where toTable has a declared relationship from the root table.",
    "- explanation (required): 1–2 sentences summarizing what the query returns and surfacing any caveats.",
  );

  return parts.join("\n");
}

function serializeTable(meta: TableMetadata): string {
  const lines: string[] = [];
  const pk = Array.isArray(meta.primaryKey)
    ? `(${meta.primaryKey.join(", ")})`
    : meta.primaryKey;
  lines.push(`## ${meta.table}  (pk: ${pk})`);
  lines.push(meta.description);
  if (meta.relationships.length > 0) {
    lines.push("  Relationships:");
    for (const rel of meta.relationships) {
      lines.push(`    → ${rel.toTable} (${rel.type}): ${rel.description}`);
    }
  }
  if (meta.columns.length > 0) {
    lines.push("  Columns:");
    for (const c of meta.columns) {
      const flags = [c.format, c.domain].filter(Boolean).join("/");
      lines.push(`    ${c.column} [${flags}] — ${c.description}`);
    }
  }
  return lines.join("\n");
}
