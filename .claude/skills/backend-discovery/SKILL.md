---
name: backend-discovery
description: Use before implementing backend features to explore the existing architecture. Discovers data models, API patterns, auth patterns, shared utilities, and testing conventions. Produces a structured context document that implementation agents use.
---

# Backend Discovery

Explores the backend architecture before implementation. Produces a structured context document that guides correct backend code.

## When to Use

- Invoked by `/new-feature` orchestrator during stage 1c
- Standalone via `/backend-discovery` before any backend work
- When an implementation agent needs to understand existing backend patterns

## Inputs

- **Feature description** — what the feature needs from the backend
- **Slug and date** (optional) — for naming the output file when invoked by the orchestrator

## Context Bootstrapping

Before exploring, read these for a warm start:
- `docs/architecture.md` — feature map, entry points, cross-feature dependencies
- `docs/architecture.md` § "Key Metrics" — Fullmind's sales funnel metrics and how they map to DB columns
- `Documentation/.md Files/TECHSTACK.md` § "Database" and "API Layer" — schema overview, connection patterns, route structure

This gives you the project's conventions before you grep. Your job is to discover **feature-specific** context that these general docs don't cover.

## Process

### 1. Explore Data Models

Schema is at `prisma/schema.prisma`. Prisma client at `src/lib/prisma.ts`,
raw SQL pool at `src/lib/db.ts`. Grep the schema for models relevant to
the feature — don't read the whole file.

For each relevant model, document: name, key fields, relationships, and any custom types or enums.

### 2. Explore Existing APIs

Search for API routes, server actions, and tRPC routers related to the feature domain:

```
Grep for route handlers: "export async function (GET|POST|PUT|PATCH|DELETE)"
Grep for server actions: "use server"
Grep for tRPC routers: "router\(" or "publicProcedure" or "protectedProcedure"
```

Document: route pattern, request/response shapes, middleware applied.

### 3. Explore Database Patterns

How are queries structured in this codebase?

- ORM (Prisma, Drizzle, raw SQL?)
- Query patterns (findMany with includes, raw queries, query builders)
- Connection handling (pooling, transactions)
- Migration conventions

### 4. Explore Auth Patterns

How is authentication/authorization handled?

- Session management
- Role/permission checks
- Route-level vs function-level auth guards
- Middleware patterns

### 5. Explore Shared Utilities

Search these directories for relevant helpers:

- `src/lib/` — general utilities
- `src/server/` — server-side utilities
- `src/features/shared/` — shared feature code

Document: what exists, what it does, where it lives.

### 6. Explore Testing Patterns

How are backend tests structured?

- Test framework and conventions
- Fixtures, factories, seed data
- Database setup/teardown patterns
- Mocking conventions

## Output

Save the context document. When invoked by the orchestrator, save to:
`docs/superpowers/specs/[date]-[slug]-backend-context.md`

When invoked standalone, present the output to the user.

```markdown
## Backend Context: [Feature Name]

### Relevant Models
- Model A: [description, key fields, relationships]
- Model B: [description, key fields, relationships]

### Existing API Patterns
- Route pattern: [how routes are structured]
- Auth pattern: [how auth is applied]
- Error handling: [how errors are returned]

### Database Conventions
- ORM: [which one]
- Query patterns: [examples of how queries are written]
- Migration conventions: [how migrations are created]

### Shared Utilities
- [utility]: [purpose, where it lives]

### What Needs to Be Created
- New model/table: [if needed]
- New API route: [endpoint, method, purpose]
- New queries: [what data needs to be fetched/mutated]
```

This document is passed forward through the pipeline:
- Stage 4 (spec writing): referenced in the Backend Design section
- Stage 6 (implementation): passed to the implementer subagent via `{{IMPLEMENTATION_CONTEXT}}`
