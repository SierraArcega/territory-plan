/**
 * Exploratory-tool handlers for the AI list-builder agent variant.
 *
 * Two read-only tools:
 *   - describe_entity(source) — returns the field allowlist as JSON.
 *   - sample_values(source, fieldId, limit?) — returns up to N distinct
 *     values for an enum-ish field by SELECTing the DB column directly.
 *
 * Both run against the read-only Postgres pool. Sample queries are
 * parameterized; column names come from the allowlist, never from the
 * model's tool input.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { readonlyPool } from "@/lib/db-readonly";
import {
  SAVED_LIST_SOURCES,
  type SavedListSource,
} from "@/lib/saved-views/filter-tree";
import { SOURCE_FIELDS, SOURCE_TABLES, lookupField } from "@/lib/saved-views/source-fields";
import { EMIT_LIST_SPEC_TOOL_NAME } from "./tools";

const SAMPLE_VALUES_DEFAULT_LIMIT = 20;
const SAMPLE_VALUES_MAX_LIMIT = 50;

function isSavedListSource(value: unknown): value is SavedListSource {
  return (
    typeof value === "string" &&
    (SAVED_LIST_SOURCES as readonly string[]).includes(value)
  );
}

export async function handleDescribeEntity(input: unknown): Promise<string> {
  const obj = input as { source?: unknown };
  const source = obj?.source;
  if (!isSavedListSource(source)) {
    return `Error: source must be one of ${SAVED_LIST_SOURCES.join(", ")}.`;
  }
  const fields = SOURCE_FIELDS[source];
  // JSON-stringify for the model — clearer than a prose listing.
  return JSON.stringify(
    {
      source,
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        ops: f.ops,
        enumValues: f.enumValues ?? null,
      })),
    },
    null,
    2,
  );
}

export async function handleSampleValues(input: unknown): Promise<string> {
  const obj = input as { source?: unknown; fieldId?: unknown; limit?: unknown };
  const source = obj?.source;
  if (!isSavedListSource(source)) {
    return `Error: source must be one of ${SAVED_LIST_SOURCES.join(", ")}.`;
  }
  const fieldId = typeof obj?.fieldId === "string" ? obj.fieldId : null;
  if (!fieldId) {
    return "Error: fieldId is required.";
  }
  const field = lookupField(source, fieldId);
  if (!field) {
    return `Error: unknown fieldId "${fieldId}" for source "${source}".`;
  }
  // If the field already has an enum, return it directly — no DB hit needed.
  if (field.enumValues && field.enumValues.length > 0) {
    return JSON.stringify(
      { source, fieldId, values: field.enumValues.slice(0, SAMPLE_VALUES_MAX_LIMIT) },
      null,
      2,
    );
  }
  const limit = Math.max(
    1,
    Math.min(SAMPLE_VALUES_MAX_LIMIT, Number(obj?.limit) || SAMPLE_VALUES_DEFAULT_LIMIT),
  );
  const table = SOURCE_TABLES[source].table;
  // Defense in depth: validate identifiers before interpolation. The strings
  // come from the allowlist, but a parameterized DISTINCT column reference
  // isn't supported by pg — so we use a strict regex match.
  if (!/^[a-z_][a-z0-9_]*$/i.test(table) || !/^[a-z_][a-z0-9_]*$/i.test(field.column)) {
    return "Error: invalid identifier in sample_values.";
  }
  const sql = `SELECT DISTINCT "${field.column}" AS v FROM "${table}" WHERE "${field.column}" IS NOT NULL ORDER BY "${field.column}" LIMIT $1`;
  try {
    const res = await readonlyPool.query<{ v: string | number | boolean | null }>(sql, [limit]);
    return JSON.stringify(
      { source, fieldId, values: res.rows.map((r) => r.v) },
      null,
      2,
    );
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Generic dispatcher used by the agent loop's exploratoryToolHandler hook.
 * Routes describe_entity and sample_values to the right handler; rejects
 * unknown tool names (the terminal tool is handled separately by the loop).
 */
export async function listBuilderExploratoryHandler(
  toolUse: Anthropic.ToolUseBlock,
): Promise<string> {
  if (toolUse.name === EMIT_LIST_SPEC_TOOL_NAME) {
    return "Error: emit_list_spec is the terminal tool and should not be invoked as exploratory.";
  }
  if (toolUse.name === "describe_entity") {
    return handleDescribeEntity(toolUse.input);
  }
  if (toolUse.name === "sample_values") {
    return handleSampleValues(toolUse.input);
  }
  return `Error: unknown tool "${toolUse.name}".`;
}
