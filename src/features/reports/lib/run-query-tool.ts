import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tool definition for Claude: `run_query`. Claude emits structured query
 * params matching the QueryParams shape defined in types.ts. The server
 * validates + compiles them; Claude never writes SQL.
 */
export const runQueryTool: Anthropic.Tool = {
  name: "run_query",
  description:
    "Build a structured query against the reporting database. Produce the query by choosing a root table, optional columns, filters, aggregations, and ordering. You MUST call this tool to answer any data question — do not write SQL, do not answer from memory.",
  input_schema: {
    type: "object" as const,
    properties: {
      table: {
        type: "string",
        description: "The root table for the query (must be one of the available tables in the schema).",
      },
      columns: {
        type: "array",
        items: { type: "string" },
        description:
          "Columns to return. Use 'column_name' for the root table or 'table.column' when joining. Omit when only aggregations are needed.",
      },
      filters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            op: {
              type: "string",
              enum: [
                "eq",
                "neq",
                "gt",
                "gte",
                "lt",
                "lte",
                "in",
                "notIn",
                "like",
                "ilike",
                "isNull",
                "isNotNull",
              ],
            },
            value: {
              description:
                "Required for all ops except isNull/isNotNull. Use an array for in/notIn. For like/ilike include % wildcards explicitly.",
            },
          },
          required: ["column", "op"],
        },
        description: "Filter conditions, ANDed together.",
      },
      aggregations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string", description: "Column name or '*' for count." },
            fn: {
              type: "string",
              enum: ["sum", "avg", "min", "max", "count"],
            },
            alias: {
              type: "string",
              description: "Optional alias for the output column.",
            },
          },
          required: ["column", "fn"],
        },
      },
      groupBy: {
        type: "array",
        items: { type: "string" },
        description:
          "Columns to GROUP BY. Required when mixing aggregations with non-aggregated selected columns.",
      },
      orderBy: {
        type: "array",
        items: {
          type: "object",
          properties: {
            column: { type: "string" },
            direction: { type: "string", enum: ["asc", "desc"] },
          },
          required: ["column", "direction"],
        },
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 500,
        description: "Row limit (max 500, default 100).",
      },
      joins: {
        type: "array",
        items: {
          type: "object",
          properties: {
            toTable: { type: "string" },
          },
          required: ["toTable"],
        },
        description:
          "Tables to LEFT JOIN. Must have a declared relationship from the root table.",
      },
      explanation: {
        type: "string",
        description:
          "1-2 sentences summarizing what this query returns and surfacing any mandatory data caveats (e.g., EK12 session-revenue gap, child-op stages). This call is the FINAL answer — do NOT describe the query as 'scouting', 'initial', 'exploratory', or 'first pass', and do NOT promise a follow-up query in a later turn. Always provide this.",
      },
    },
    required: ["table", "explanation"],
  },
};
