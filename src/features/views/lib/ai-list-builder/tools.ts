/**
 * Tool definitions for the AI list-builder agent variant.
 *
 * The list-builder runs in a sandboxed, read-only mode — no SQL execution,
 * only entity schema introspection plus the terminal `emit_list_spec` tool.
 * Lower blast radius than the reports agent's run_sql terminal.
 *
 * Tools:
 *   - describe_entity(source) — returns the user-facing field allowlist
 *     for one of the six entity sources.
 *   - sample_values(source, fieldId, limit?) — returns up to N distinct
 *     example values for an enum-ish field (typed via the allowlist).
 *   - emit_list_spec — TERMINAL. Model emits the structured filter tree
 *     spec which the loop persists / passes to the preview endpoint.
 */
import type Anthropic from "@anthropic-ai/sdk";

export const EMIT_LIST_SPEC_TOOL_NAME = "emit_list_spec" as const;

const describeEntity: Anthropic.Tool = {
  name: "describe_entity",
  description:
    "Return the list of user-facing fields available for one of the six list-builder sources. Each field includes its `id` (use in filterTree), human label, data type, allowed operators, and (for enums) the allowed value set. Call this BEFORE emit_list_spec for any source you're not already familiar with.",
  input_schema: {
    type: "object" as const,
    properties: {
      source: {
        type: "string",
        enum: ["districts", "contacts", "opps", "vacancies", "news", "rfps"],
        description: "Which of the six list-builder sources to describe.",
      },
    },
    required: ["source"],
  },
};

const sampleValues: Anthropic.Tool = {
  name: "sample_values",
  description:
    "Return up to N example values for a specific field on one source. Useful before constraining an enum-ish field (state, stage, category) so you use real values, not invented ones. NEVER use sample_values to introspect IDs — the list builder operates on user-facing fields only.",
  input_schema: {
    type: "object" as const,
    properties: {
      source: {
        type: "string",
        enum: ["districts", "contacts", "opps", "vacancies", "news", "rfps"],
      },
      fieldId: { type: "string", description: "The field id from describe_entity." },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    },
    required: ["source", "fieldId"],
  },
};

const emitListSpec: Anthropic.Tool = {
  name: EMIT_LIST_SPEC_TOOL_NAME,
  description:
    "TERMINAL. Emit the structured list specification — filter tree, scope, proposed name. Only call this once the filters are clearly defined. After this call, the turn ends and the client receives the spec to populate the list builder modal.\n\nThe filterTree shape:\n  - A rule: { kind: 'rule', fieldId, op, value }\n  - An any-of: { kind: 'any', fieldId, op: 'is any of', values: [...] }\n  - AND-of-rules: { kind: 'and', children: [ ... ] }\nUse 'any' for OR-of-same-field; prefer AND for everything else. Do NOT emit raw 'or' nodes — the v1 schema doesn't accept them.",
  input_schema: {
    type: "object" as const,
    properties: {
      source: {
        type: "string",
        enum: ["districts", "contacts", "opps", "vacancies", "news", "rfps"],
        description: "Entity source. Must match the source of every field in filterTree.",
      },
      filterTree: {
        type: "object",
        description:
          "Recursive AND tree. Top level is typically { kind: 'and', children: [rules...] }. Empty children means no filter.",
      },
      scope: {
        type: "object",
        description:
          "How to seed the candidate set. Use { mode: 'none' } unless the user explicitly asked to scope to a plan or another list.",
        properties: {
          mode: { type: "string", enum: ["none", "rules", "reference"] },
          filterTree: {
            type: "object",
            description: "Required when mode='rules' — a districts filter tree used to scope the candidate set.",
          },
          kind: {
            type: "string",
            enum: ["plan", "list"],
            description: "Required when mode='reference'.",
          },
          id: {
            type: "string",
            description: "Required when mode='reference' — the plan or list id.",
          },
        },
        required: ["mode"],
      },
      name: {
        type: "string",
        description:
          "Suggested rep-friendly name for the list, under 80 chars. Used as the prefilled 'Save as' value in the list builder. E.g., 'NY tier-A districts with open pipeline' (not 'state = NY AND tier = A'). Never expose field IDs in the name.",
      },
    },
    required: ["source", "filterTree", "scope", "name"],
  },
};

export const LIST_BUILDER_TOOLS: Anthropic.Tool[] = [
  describeEntity,
  sampleValues,
  emitListSpec,
];

/** The shape the model emits via `emit_list_spec`. The route validates it. */
export interface EmitListSpecInput {
  source: string;
  filterTree: unknown;
  scope: unknown;
  name: string;
}
