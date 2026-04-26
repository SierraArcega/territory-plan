import {
  SEMANTIC_CONTEXT,
  TABLE_REGISTRY,
  type TableMetadata,
} from "@/lib/district-column-metadata";

/**
 * Build the system prompt that describes the queryable schema + semantic
 * context for Claude. Stable across requests except for the current-date
 * anchor — cache by day on the call site. Pass `now` in tests for a stable
 * output; in production it defaults to the server's wall-clock date.
 */
export function buildSchemaPrompt(now: Date = new Date()): string {
  const parts: string[] = [];
  const today = now.toISOString().slice(0, 10);

  parts.push(
    "You are a query-building assistant for a B2B sales team at Fullmind (an EdTech vendor selling to US school districts). You translate natural-language questions into structured query parameters for our internal reporting tool. You NEVER produce SQL — you always call the `run_query` tool with structured params. The server compiles those params to SQL and executes them against a read-only database.",
    "",
    `Today's date is ${today}. When a question uses a relative date window ("this month", "last quarter", "past 30 days", "YTD"), compute literal ISO dates from this anchor and emit them as a \`gte\` + \`lt\` filter pair.`,
    "",
    "IMPORTANT:",
    "- Use tables and columns ONLY from the list below. If a question cannot be answered with these tables, call `run_query` with the closest complete query AND write a short explanation noting the limitation.",
    "- When multiple tables could answer a question, follow the routing rules in the CONCEPT MAPPINGS section below.",
    "- Respect the WARNINGS below — they encode known data quality issues and are non-negotiable.",
    "- Always provide a 1-2 sentence `explanation` summarizing what the query will return and surfacing any mandatory caveats.",
    "- If the user already has a builder state (shown in `<CURRENT_BUILDER>`), modify it to reflect the new question. Preserve anything still relevant. Do not rebuild the query from scratch unless the user explicitly says to start over.",
    "- Every `run_query` call must be the COMPLETE answer in a single turn. If the user names multiple fields, metrics, filters, or joins, include ALL of them in this call — do not emit a minimal \"scouting\" or \"exploratory\" query and promise more in a follow-up turn (there is no follow-up turn). Ask a clarifying question in plain text ONLY when you genuinely cannot map the request to a complete query — e.g., ambiguous intent about WHICH table, metric, or time window. If the user did not enumerate fields, pick sensible defaults and proceed with a complete query — unenumerated fields are not ambiguity.",
    "",
    "JOINS / RELATIONSHIPS:",
    "- Each table lists its outbound relationships. The token after `→` is the NAME you pass to `joins: [{ toTable: <name> }]`.",
    "- Some relationships have an `alias` — the alias IS the name. Example: `→ df_same_district_fy [alias → district_financials]` means you pass `{ toTable: \"df_same_district_fy\" }` and reference columns as `df_same_district_fy.<column>` (the alias is the SQL table name in the generated query).",
    "- Some relationships go `via <intermediate>` — these are multi-hop paths composed of multiple LEFT JOINs. You still only add ONE join entry; the server wires up the intermediate automatically.",
    "- Self-joins (alias to the same table) are how you do vendor-vs-vendor comparisons and year-over-year deltas — prefer them over writing parallel queries by hand.",
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
    "- filters (optional): array of { column, op, value? }. Ops: eq, neq, gt, gte, lt, lte, in, notIn, like, ilike, isNull, isNotNull.",
    "  IMPORTANT: `value` must be a literal primitive — string, number, boolean, or array of those. SQL expressions are NOT allowed (e.g. `date_trunc('month', CURRENT_DATE)`, `NOW()`, `CURRENT_DATE - 30`, `date.toTable.column`). The server parameterizes every value, so a SQL-looking string is sent to Postgres as a literal and fails with a type error. For date windows, compute literal ISO dates from today (see top of prompt) and emit a `gte` + `lt` pair.",
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
    lines.push("  Relationships (use the token after → as joins[].toTable):");
    for (const rel of meta.relationships) {
      const key = rel.alias ?? rel.toTable;
      const suffix: string[] = [`(${rel.type})`];
      if (rel.alias) suffix.push(`[alias → ${rel.toTable}]`);
      if (rel.through && rel.through.length > 0) {
        suffix.push(`[via ${rel.through.join(", ")}]`);
      }
      lines.push(`    → ${key} ${suffix.join(" ")}: ${rel.description}`);
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
