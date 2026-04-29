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

// Lazy: don't construct the Pool (or throw the missing-env error) at module
// load. `next build` collects page data by importing every route module, and
// throwing here would fail the build on environments where the readonly role
// isn't configured (e.g. preview deploys without DATABASE_READONLY_URL set).
// Defer to first use so the failure surfaces only when an actual request runs
// against the query tool.

let _pool: Pool | null = null;

function getPool(): Pool {
  if (_pool) return _pool;
  if (!process.env.DATABASE_READONLY_URL) {
    throw new Error(
      "DATABASE_READONLY_URL is not set. See prisma/migrations/manual/create-readonly-role.sql for setup instructions.",
    );
  }
  _pool = new Pool({
    connectionString: process.env.DATABASE_READONLY_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
  });
  return _pool;
}

export const readonlyPool = new Proxy({} as Pool, {
  get(_target, prop) {
    const pool = getPool();
    const value = Reflect.get(pool, prop, pool);
    return typeof value === "function" ? value.bind(pool) : value;
  },
});
