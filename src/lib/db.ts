import { Pool } from "pg";

// Singleton pool for all API routes
// Uses globalThis to persist across hot reloads in development
const globalForPool = globalThis as unknown as {
  pool: Pool | undefined;
};

export const pool =
  globalForPool.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of connections
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout after 10 seconds when connecting
  });

if (process.env.NODE_ENV !== "production") globalForPool.pool = pool;

export default pool;
