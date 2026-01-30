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
    // In serverless (Vercel), keep pool small since each function instance
    // creates its own pool, and Supabase Shared Pooler has limited connections
    max: process.env.NODE_ENV === "production" ? 2 : 5,
    idleTimeoutMillis: 10000, // Close idle connections quickly in serverless
    connectionTimeoutMillis: 10000, // Timeout after 10 seconds when connecting
  });

if (process.env.NODE_ENV !== "production") globalForPool.pool = pool;

export default pool;
