import { Pool } from "pg";

/**
 * Read-only Postgres pool for the Claude query tool (MAP-5) and MCP server (MAP-4).
 *
 * Connects as the `query_tool_readonly` role, which has:
 *   - SELECT-only grants on the whitelisted queryable tables
 *   - No access to user_profiles, user_integrations, calendar_events, etc.
 *   - 5-second statement timeout enforced at the role level
 *   - default_transaction_read_only = on
 *
 * See prisma/migrations/manual/create-readonly-role.sql for role setup.
 */

if (!process.env.DATABASE_READONLY_URL) {
  throw new Error(
    "DATABASE_READONLY_URL is not set. See prisma/migrations/manual/create-readonly-role.sql for setup instructions.",
  );
}

export const readonlyPool = new Pool({
  connectionString: process.env.DATABASE_READONLY_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});
