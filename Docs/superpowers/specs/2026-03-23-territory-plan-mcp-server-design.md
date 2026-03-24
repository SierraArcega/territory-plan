# Territory Plan MCP Server — Design Spec

## Overview

A standalone MCP (Model Context Protocol) server that exposes the territory-plan Supabase/PostgreSQL database to Claude Code, AI agents, and other MCP-compatible tools. Provides full CRUD access to all 47 Prisma models via auto-generated tools, plus a raw SQL tool for complex queries.

**Repo:** `territory-plan-mcp` (separate from `territory-plan`)

## Goals

1. Let Claude Code query and mutate territory-plan data during coding sessions
2. Enable external AI agents and workflows to interact with the database programmatically
3. Provide a fast data exploration and debugging interface without needing a DB client

## Architecture

### Project Structure

```
territory-plan-mcp/
├── src/
│   ├── server.ts              # MCP server entry point (stdio transport)
│   ├── generator/
│   │   ├── generate.ts        # Reads Prisma DMMF → generates tool definitions
│   │   └── type-map.ts        # Prisma field type → MCP schema type mapping
│   ├── tools/
│   │   └── generated/         # Auto-generated CRUD tools (one file per model)
│   ├── auth/
│   │   └── api-key.ts         # API key validation middleware
│   ├── db/
│   │   ├── prisma.ts          # Prisma client instance
│   │   └── raw.ts             # pg Pool for raw SQL reads (read-only role)
│   └── utils/
│       └── sync-schema.ts     # Script to copy schema from territory-plan
├── prisma/
│   └── schema.prisma          # Copied from territory-plan (standalone)
├── package.json
├── tsconfig.json
└── .env
```

### Key Decisions

- **Separate repo** so any project can reference the server without depending on territory-plan
- **Schema-driven generation** — Prisma DMMF (the official structured output from `prisma generate`) is parsed at build time to auto-generate CRUD tools for all 47 models
- **Direct Prisma for all operations** — both reads and writes use Prisma directly (see Write Strategy below)
- **stdio transport** — standard for Claude Code MCP servers
- **Prisma schema is copied** with a sync script (`npm run sync-schema`) that copies from territory-plan and runs `prisma generate`

## Tool Design

### Generated CRUD Tools (5 per model × 47 models = 235 tools)

| Tool Pattern | Example (District) | Implementation |
|---|---|---|
| `list_{model}` | `list_districts` | Prisma `findMany` — pagination, filtering, sorting |
| `get_{model}` | `get_district` | Prisma `findUnique` by primary key |
| `create_{model}` | `create_district` | Prisma `create` |
| `update_{model}` | `update_district` | Prisma `update` |
| `delete_{model}` | `delete_district` | Prisma `delete` |

### Read Tool Features

- `where` — field-level filters derived from schema (e.g., `{ state: "TX", totalEnrollment: { gte: 5000 } }`)
- `orderBy` — sort by any field, asc/desc
- `take` — pagination limit (default 50, max 200)
- `skip` — pagination offset
- `include` — load relations, **max depth of 2 levels** (e.g., `{ schools: true }` or `{ schools: { include: { tags: true } } }` but no deeper)

### Write Strategy

Writes go directly through Prisma (not proxied through Next.js API routes). The API routes use cookie-based Supabase auth that the MCP server cannot replicate without significant complexity. Direct Prisma is simpler, and critical validation logic can be extracted into shared utility functions in the future if needed.

### Primary Key Handling

- Single `@id` fields: used directly for `get`, `update`, `delete`
- Composite `@@id` keys (e.g., `DistrictTag`, `TerritoryPlanDistrict`): tool accepts all key fields as separate parameters
- Primary key type and name derived from DMMF model metadata

### PostGIS / Unsupported Fields

Fields marked as `Unsupported` in the Prisma schema (e.g., PostGIS `geometry` columns) are excluded from generated tool input/output schemas. The `run_sql` tool can be used to query these fields directly.

### Type Mapping

| Prisma Type | MCP Schema Type |
|---|---|
| `String` | `string` |
| `Int`, `Float` | `number` |
| `Decimal` | `string` (to preserve precision — both reads and writes use strings to avoid floating-point loss) |
| `Boolean` | `boolean` |
| `DateTime` | `string` (ISO 8601) |
| `Json` | `object` |
| `Enum` | `string` with allowed values |
| `Unsupported` | excluded |

### Raw SQL Tool

`run_sql` — executes read-only SQL via pg Pool for complex joins, geospatial queries, aggregations.

**Input format:**
```json
{
  "query": "SELECT leaid, name FROM \"District\" WHERE state = $1 AND \"totalEnrollment\" > $2",
  "params": ["TX", 5000]
}
```

**Safety measures:**
- Uses a **read-only database role** (`DATABASE_URL_READONLY` env var) — the PostgreSQL role itself cannot execute DML/DDL
- Statement validation: rejects queries containing `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE` (defense in depth, not sole protection)
- Query timeout: 30 second limit per query
- Result limit: max 1000 rows returned
- Parameters must be passed via the `params` array; string interpolation in the query field is not supported

### Example Tool Invocation

**Request:**
```json
{
  "tool": "list_districts",
  "arguments": {
    "where": { "stateAbbrev": "TX" },
    "orderBy": { "totalEnrollment": "desc" },
    "take": 3,
    "include": { "schools": true }
  }
}
```

**Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "[{\"leaid\": \"4819380\", \"name\": \"Houston ISD\", \"stateAbbrev\": \"TX\", \"totalEnrollment\": 187000, \"schools\": [{...}]}, ...]"
  }]
}
```

## Authentication

### Current: API Key

- `MCP_API_KEY` env var required
- Validated at the server level before any tool executes
- Simple and sufficient for single-user / local development

### Future: Per-User Auth

- Replace API key check with Supabase JWT validation
- Pass user context to Prisma for RLS enforcement
- No structural changes needed — swap auth middleware only

## Configuration

### How to connect from any project

In `.claude/settings.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "territory-plan": {
      "command": "node",
      "args": ["/path/to/territory-plan-mcp/dist/server.js"],
      "env": {
        "MCP_API_KEY": "your-api-key"
      }
    }
  }
}
```

Sensitive values (`DATABASE_URL`, etc.) should be in the MCP server's own `.env` file, **not** in the MCP config JSON (which may be checked into version control).

### Environment Variables (in MCP server `.env`)

| Variable | Purpose | Required |
|---|---|---|
| `MCP_API_KEY` | API key for authentication | Yes |
| `DATABASE_URL` | Supabase PostgreSQL connection string (read/write) | Yes |
| `DATABASE_URL_READONLY` | Read-only role connection string (for `run_sql`) | Yes |
| `DIRECT_URL` | Direct connection for Prisma migrations/introspection (required by schema) | Yes |
| `QUERY_TIMEOUT_MS` | Max query execution time (default: 30000) | No |

## Tech Stack

- TypeScript, Node.js
- `@modelcontextprotocol/sdk` — official MCP SDK
- `@prisma/client` — ORM for generated CRUD tools
- Prisma DMMF — official structured schema representation (output of `prisma generate`) for code generation
- `pg` — raw SQL pool for `run_sql`
- `tsc` — no build framework, just TypeScript compiler

## Error Handling

- Tool errors return structured MCP error responses (no server crashes)
- Database connection failures surface with clear messages
- Invalid filters/fields return helpful messages listing available options
- Query timeouts return a clear timeout error with the configured limit

## Schema Sync

To keep the Prisma schema in sync with the main territory-plan repo:

```bash
npm run sync-schema -- /path/to/territory-plan
```

This script:
1. Copies `prisma/schema.prisma` from the source repo
2. Runs `prisma generate` to update the client
3. Runs `npm run generate` to regenerate tool definitions
4. Logs a diff summary of what changed

Run this after any schema migration in the main repo.

## Generator Workflow

1. `npm run generate` reads the Prisma DMMF output (from `prisma generate`)
2. Extracts model names, fields, types, relations, primary keys, and enums
3. Skips `Unsupported` fields, handles composite primary keys
4. Generates one TypeScript file per model in `src/tools/generated/`
5. Each file exports the 5 tool definitions (list, get, create, update, delete)
6. `server.ts` imports and registers all generated tools + `run_sql` at startup
7. Run `npm run build` to compile to `dist/`

## Scope

### In Scope

- All 47 Prisma models with full CRUD via direct Prisma
- Raw SQL read-only tool with safety measures
- API key authentication
- Build-time code generation from Prisma DMMF
- Schema sync tooling
- Include depth limiting (max 2 levels)
- PostGIS field exclusion
- Query timeouts and result limits

### Note on Tool Count

236 tools (235 CRUD + `run_sql`) is a large surface. Some MCP clients may have performance implications with this many tools. If this becomes an issue, future work could add tool grouping or lazy registration. For now, all tools are registered at startup.

### Out of Scope (Future)

- Per-user Supabase JWT authentication
- MCP resources (exposing schema docs as resources)
- Subscription/streaming tools
- Rate limiting
- npm package publishing
- Write proxying through Next.js API routes
