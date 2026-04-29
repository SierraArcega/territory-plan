import type Anthropic from "@anthropic-ai/sdk";

export const RUN_SQL_TOOL_NAME = "run_sql" as const;

const listTables: Anthropic.Tool = {
  name: "list_tables",
  description:
    "List every queryable table with its description. Use at the start of a new conversation when you need orientation. Returns table name, one-line description, and tag set.",
  input_schema: { type: "object" as const, properties: {}, required: [] },
};

const describeTable: Anthropic.Tool = {
  name: "describe_table",
  description:
    "Get full details for one table: columns with types + descriptions, its join relationships, and any warnings or semantic-context entries scoped to it. Use this when you know which table you want and need column-level understanding.",
  input_schema: {
    type: "object" as const,
    properties: {
      table: { type: "string", description: "Table name, e.g. 'districts'." },
    },
    required: ["table"],
  },
};

const searchMetadata: Anthropic.Tool = {
  name: "search_metadata",
  description:
    "Full-text search across column descriptions and SEMANTIC_CONTEXT entries. Use this FIRST when the user mentions a concept (bookings, pipeline, win rate, renew, closed-won) — it returns ranked matches with full prose so you can find the right column and understand its gotchas. Example queries: 'bookings', 'closed won stage', 'renewal rate'.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Keyword(s) to search for in metadata descriptions.",
      },
    },
    required: ["query"],
  },
};

const getColumnValues: Anthropic.Tool = {
  name: "get_column_values",
  description:
    "Return up to N distinct values for a column. Use before filtering on an unfamiliar column to see the real value shapes (e.g. what stage strings actually exist).",
  input_schema: {
    type: "object" as const,
    properties: {
      table: { type: "string" },
      column: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
    },
    required: ["table", "column"],
  },
};

const countRows: Anthropic.Tool = {
  name: "count_rows",
  description:
    "Count rows matching a FROM + optional WHERE. Use to sanity-check a filter before building the full query. If the count is 0 or unexpectedly huge, adjust. SQL must be parameter-free (bind literals inline only for constants you fully control).",
  input_schema: {
    type: "object" as const,
    properties: {
      from_sql: {
        type: "string",
        description:
          "FROM clause SQL (without the word FROM), e.g. 'districts d JOIN district_financials df ON df.leaid = d.leaid'.",
      },
      where_sql: {
        type: "string",
        description:
          "Optional WHERE clause SQL (without the word WHERE), e.g. \"d.state = 'TX'\".",
      },
    },
    required: ["from_sql"],
  },
};

const sampleRows: Anthropic.Tool = {
  name: "sample_rows",
  description:
    "Execute a SELECT that returns up to 20 rows, for your own inspection. Results come back to you, NOT to the user. Use to peek at query shape before committing to run_sql.",
  input_schema: {
    type: "object" as const,
    properties: {
      sql: { type: "string", description: "SELECT statement. Must include a LIMIT ≤ 20." },
    },
    required: ["sql"],
  },
};

const runSql: Anthropic.Tool = {
  name: RUN_SQL_TOOL_NAME,
  description:
    "TERMINAL. Execute the final query and send results to the user. Include a one-line `summary.source` describing the query in rep-friendly language (never show SQL to the user). Only call this once per turn — after this, the turn ends.",
  input_schema: {
    type: "object" as const,
    properties: {
      sql: {
        type: "string",
        description:
          "Final SELECT statement. MUST include LIMIT ≤ 500. Do NOT SELECT primary-key ID columns (leaid, opportunity_id, uuid) unless the user asked by name; prefer name columns.",
      },
      summary: {
        type: "object",
        description:
          "One-line rep-friendly description of the query, shown as a header above the results table.",
        properties: {
          source: {
            type: "string",
            description:
              "One-line description of what's being queried and any constraints, e.g. 'Open-pipeline opportunities stuck > 90 days in current stage' or 'Texas districts with closed-won FY26 contracts'.",
          },
        },
        required: ["source"],
      },
    },
    required: ["sql", "summary"],
  },
};

const searchSavedReports: Anthropic.Tool = {
  name: "search_saved_reports",
  description:
    "Search the user's saved reports by name and summary content. Use when the user says 'like that one about Texas' or asks for a saved report by description.",
  input_schema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Keyword(s) to search report names and summaries." },
    },
    required: ["query"],
  },
};

const getSavedReport: Anthropic.Tool = {
  name: "get_saved_report",
  description:
    "Load a specific saved report's SQL + summary, usually so you can adapt it for a variant question.",
  input_schema: {
    type: "object" as const,
    properties: {
      id: { type: "integer", description: "Saved report id (from search_saved_reports)." },
    },
    required: ["id"],
  },
};

export const AGENT_TOOLS: Anthropic.Tool[] = [
  listTables,
  describeTable,
  searchMetadata,
  getColumnValues,
  countRows,
  sampleRows,
  runSql,
  searchSavedReports,
  getSavedReport,
];
