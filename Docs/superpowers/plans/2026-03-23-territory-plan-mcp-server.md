# Territory Plan MCP Server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone MCP server that exposes all 47 Prisma models from the territory-plan database as CRUD tools, plus a raw SQL tool.

**Architecture:** Separate repo (`territory-plan-mcp`). A build-time generator reads the Prisma DMMF and produces TypeScript tool files — one per model with list/get/create/update/delete operations. The MCP server registers all generated tools + a `run_sql` tool at startup via stdio transport.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk`, Prisma Client, `pg`, Zod, `tsc`

**Spec:** `docs/superpowers/specs/2026-03-23-territory-plan-mcp-server-design.md`

---

## File Map

```
territory-plan-mcp/
├── src/
│   ├── server.ts                    # MCP server entry point
│   ├── generator/
│   │   ├── generate.ts              # Reads DMMF, writes tool files
│   │   └── type-map.ts              # Prisma type → Zod schema mapping
│   ├── tools/
│   │   ├── run-sql.ts               # Raw SQL read-only tool
│   │   └── generated/               # (created by generator)
│   │       ├── index.ts             # Re-exports all model tools
│   │       ├── district.ts          # Example: District CRUD
│   │       └── ... (one per model)
│   ├── auth/
│   │   └── api-key.ts               # API key validation
│   └── db/
│       ├── prisma.ts                # Prisma client singleton
│       └── raw.ts                   # pg Pool for run_sql
├── src/__tests__/
│   ├── type-map.test.ts
│   ├── generator.test.ts
│   ├── auth.test.ts
│   ├── run-sql.test.ts
│   └── server.test.ts
├── prisma/
│   └── schema.prisma                # Copied from territory-plan
├── scripts/
│   └── sync-schema.ts               # Schema sync utility
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── .gitignore
└── README.md
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `territory-plan-mcp/package.json`
- Create: `territory-plan-mcp/tsconfig.json`
- Create: `territory-plan-mcp/vitest.config.ts`
- Create: `territory-plan-mcp/.gitignore`
- Create: `territory-plan-mcp/.env.example`
- Copy: `territory-plan-mcp/prisma/schema.prisma` (from territory-plan)

- [ ] **Step 1: Create the project directory**

```bash
mkdir -p ~/territory-plan-mcp
cd ~/territory-plan-mcp
```

- [ ] **Step 2: Initialize package.json**

```bash
cd ~/territory-plan-mcp
npm init -y
```

Then edit `package.json`:

```json
{
  "name": "territory-plan-mcp",
  "version": "1.0.0",
  "description": "MCP server for territory-plan Supabase database",
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "generate": "tsx src/generator/generate.ts",
    "sync-schema": "tsx scripts/sync-schema.ts",
    "start": "node dist/server.js",
    "dev": "tsx src/server.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@prisma/client": "^6.5.0",
    "pg": "^8.13.0",
    "zod": "^3.24.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.0",
    "prisma": "^6.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.env
src/tools/generated/
```

- [ ] **Step 6: Create .env.example**

```bash
MCP_API_KEY=your-api-key-here
DATABASE_URL=postgresql://user:pass@host:port/db
DATABASE_URL_READONLY=postgresql://readonly_user:pass@host:port/db
DIRECT_URL=postgresql://user:pass@host:port/db
QUERY_TIMEOUT_MS=30000
```

- [ ] **Step 7: Copy Prisma schema**

```bash
mkdir -p ~/territory-plan-mcp/prisma
cp ~/territory-plan/prisma/schema.prisma ~/territory-plan-mcp/prisma/schema.prisma
```

- [ ] **Step 8: Install dependencies and generate Prisma client**

```bash
cd ~/territory-plan-mcp
npm install
npx prisma generate
```

- [ ] **Step 9: Initialize git and commit**

```bash
cd ~/territory-plan-mcp
git init
git add .
git commit -m "chore: scaffold territory-plan-mcp project"
```

---

## Task 2: Database Layer

**Files:**
- Create: `src/db/prisma.ts`
- Create: `src/db/raw.ts`

- [ ] **Step 1: Create Prisma client singleton**

Create `src/db/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
```

- [ ] **Step 2: Create raw SQL pool**

Create `src/db/raw.ts`:

```typescript
import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL_READONLY;
    if (!connectionString) {
      throw new Error('DATABASE_URL_READONLY is required for run_sql');
    }
    pool = new Pool({
      connectionString,
      max: 5,
      statement_timeout: parseInt(process.env.QUERY_TIMEOUT_MS || '30000', 10),
    });
  }
  return pool;
}

export async function disconnectPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/db/
git commit -m "feat: add database layer (Prisma client + pg pool)"
```

---

## Task 3: API Key Auth

**Files:**
- Create: `src/auth/api-key.ts`
- Create: `src/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateApiKey } from '../auth/api-key.js';

describe('validateApiKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true when key matches MCP_API_KEY', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    expect(validateApiKey('test-key-123')).toBe(true);
  });

  it('returns false when key does not match', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    expect(validateApiKey('wrong-key')).toBe(false);
  });

  it('returns false when MCP_API_KEY is not set', () => {
    delete process.env.MCP_API_KEY;
    expect(validateApiKey('any-key')).toBe(false);
  });

  it('returns false when provided key is empty', () => {
    process.env.MCP_API_KEY = 'test-key-123';
    expect(validateApiKey('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/auth.test.ts
```

Expected: FAIL — `validateApiKey` not found.

- [ ] **Step 3: Implement**

Create `src/auth/api-key.ts`:

```typescript
export function validateApiKey(key: string): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected || !key) return false;
  return key === expected;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/auth.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/auth/ src/__tests__/auth.test.ts
git commit -m "feat: add API key validation"
```

---

## Task 4: Type Mapping

**Files:**
- Create: `src/generator/type-map.ts`
- Create: `src/__tests__/type-map.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/type-map.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { prismaTypeToZod, prismaTypeToJsonSchema } from '../generator/type-map.js';

describe('prismaTypeToZod', () => {
  it('maps String to z.string()', () => {
    expect(prismaTypeToZod('String', false)).toBe('z.string()');
  });

  it('maps Int to z.number().int()', () => {
    expect(prismaTypeToZod('Int', false)).toBe('z.number().int()');
  });

  it('maps Float to z.number()', () => {
    expect(prismaTypeToZod('Float', false)).toBe('z.number()');
  });

  it('maps Decimal to z.string() for precision', () => {
    expect(prismaTypeToZod('Decimal', false)).toBe('z.string()');
  });

  it('maps Boolean to z.boolean()', () => {
    expect(prismaTypeToZod('Boolean', false)).toBe('z.boolean()');
  });

  it('maps DateTime to z.string().datetime()', () => {
    expect(prismaTypeToZod('DateTime', false)).toBe('z.string().datetime()');
  });

  it('maps Json to z.any()', () => {
    expect(prismaTypeToZod('Json', false)).toBe('z.any()');
  });

  it('wraps optional fields with .optional()', () => {
    expect(prismaTypeToZod('String', true)).toBe('z.string().optional()');
  });

  it('returns null for Unsupported types', () => {
    expect(prismaTypeToZod('Unsupported', false)).toBeNull();
  });

  it('maps enum types to z.enum()', () => {
    expect(prismaTypeToZod('ServiceCategory', false, ['return_services', 'new_services']))
      .toBe("z.enum(['return_services', 'new_services'])");
  });

  it('wraps optional enum with .optional()', () => {
    expect(prismaTypeToZod('UserRole', true, ['admin', 'manager', 'rep']))
      .toBe("z.enum(['admin', 'manager', 'rep']).optional()");
  });
});

describe('prismaTypeToJsonSchema', () => {
  it('maps String to { type: "string" }', () => {
    expect(prismaTypeToJsonSchema('String')).toEqual({ type: 'string' });
  });

  it('maps Int to { type: "integer" }', () => {
    expect(prismaTypeToJsonSchema('Int')).toEqual({ type: 'integer' });
  });

  it('maps Boolean to { type: "boolean" }', () => {
    expect(prismaTypeToJsonSchema('Boolean')).toEqual({ type: 'boolean' });
  });

  it('returns null for Unsupported', () => {
    expect(prismaTypeToJsonSchema('Unsupported')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/type-map.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement type-map**

Create `src/generator/type-map.ts`:

```typescript
export function prismaTypeToZod(type: string, isOptional: boolean, enumValues?: string[]): string | null {
  // Handle enum types
  if (enumValues && enumValues.length > 0) {
    const zodType = `z.enum([${enumValues.map((v) => `'${v}'`).join(', ')}])`;
    return isOptional ? `${zodType}.optional()` : zodType;
  }

  const mapping: Record<string, string> = {
    String: 'z.string()',
    Int: 'z.number().int()',
    Float: 'z.number()',
    Decimal: 'z.string()',
    Boolean: 'z.boolean()',
    DateTime: 'z.string().datetime()',
    Json: 'z.any()',
    BigInt: 'z.string()',
    Bytes: 'z.string()',
  };

  const zodType = mapping[type];
  if (!zodType) return null; // Unsupported or relation types

  return isOptional ? `${zodType}.optional()` : zodType;
}

export function prismaTypeToJsonSchema(type: string): Record<string, unknown> | null {
  const mapping: Record<string, Record<string, unknown>> = {
    String: { type: 'string' },
    Int: { type: 'integer' },
    Float: { type: 'number' },
    Decimal: { type: 'string' },
    Boolean: { type: 'boolean' },
    DateTime: { type: 'string' },
    Json: { type: 'object' },
    BigInt: { type: 'string' },
    Bytes: { type: 'string' },
  };

  return mapping[type] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/type-map.test.ts
```

Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/generator/type-map.ts src/__tests__/type-map.test.ts
git commit -m "feat: add Prisma-to-Zod/JSON-Schema type mapping"
```

---

## Task 5: Code Generator

**Files:**
- Create: `src/generator/generate.ts`
- Create: `src/__tests__/generator.test.ts`

This is the core of the project. The generator reads the Prisma DMMF and writes one TypeScript file per model into `src/tools/generated/`, plus an `index.ts` that re-exports all tools.

- [ ] **Step 1: Write failing test for generator helpers**

Create `src/__tests__/generator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  modelToSnakeCase,
  modelToToolNames,
  getPrimaryKeyFields,
  getScalarFields,
  generateToolFile,
} from '../generator/generate.js';

describe('modelToSnakeCase', () => {
  it('converts PascalCase to snake_case', () => {
    expect(modelToSnakeCase('District')).toBe('district');
    expect(modelToSnakeCase('TerritoryPlan')).toBe('territory_plan');
    expect(modelToSnakeCase('TerritoryPlanDistrict')).toBe('territory_plan_district');
    expect(modelToSnakeCase('UserProfile')).toBe('user_profile');
  });
});

describe('modelToToolNames', () => {
  it('generates plural tool names', () => {
    const names = modelToToolNames('District');
    expect(names.list).toBe('list_districts');
    expect(names.get).toBe('get_district');
    expect(names.create).toBe('create_district');
    expect(names.update).toBe('update_district');
    expect(names.delete).toBe('delete_district');
  });

  it('handles models ending in y', () => {
    const names = modelToToolNames('Activity');
    expect(names.list).toBe('list_activities');
  });

  it('handles models ending in s', () => {
    const names = modelToToolNames('CalendarStatus');
    expect(names.list).toBe('list_calendar_statuses');
  });
});

describe('getPrimaryKeyFields', () => {
  it('extracts single @id field', () => {
    const mockModel = {
      name: 'District',
      primaryKey: null,
      fields: [
        { name: 'leaid', type: 'String', isId: true, kind: 'scalar' },
        { name: 'name', type: 'String', isId: false, kind: 'scalar' },
      ],
    };
    expect(getPrimaryKeyFields(mockModel as any)).toEqual([
      { name: 'leaid', type: 'String' },
    ]);
  });

  it('extracts composite @@id fields', () => {
    const mockModel = {
      name: 'DistrictTag',
      primaryKey: { fields: ['districtLeaid', 'tagId'] },
      fields: [
        { name: 'districtLeaid', type: 'String', isId: false, kind: 'scalar' },
        { name: 'tagId', type: 'Int', isId: false, kind: 'scalar' },
      ],
    };
    expect(getPrimaryKeyFields(mockModel as any)).toEqual([
      { name: 'districtLeaid', type: 'String' },
      { name: 'tagId', type: 'Int' },
    ]);
  });
});

describe('getScalarFields', () => {
  it('excludes relation and unsupported fields', () => {
    const mockModel = {
      fields: [
        { name: 'leaid', type: 'String', kind: 'scalar' },
        { name: 'name', type: 'String', kind: 'scalar' },
        { name: 'geometry', type: 'Unsupported', kind: 'unsupported' },
        { name: 'schools', type: 'School', kind: 'object' },
      ],
    };
    const fields = getScalarFields(mockModel as any);
    expect(fields).toHaveLength(2);
    expect(fields.map((f: any) => f.name)).toEqual(['leaid', 'name']);
  });
});

describe('generateToolFile', () => {
  it('generates valid TypeScript for a simple model', () => {
    const mockModel = {
      name: 'Tag',
      primaryKey: null,
      fields: [
        { name: 'id', type: 'Int', isId: true, kind: 'scalar', isRequired: true, isList: false, hasDefaultValue: true },
        { name: 'name', type: 'String', isId: false, kind: 'scalar', isRequired: true, isList: false, hasDefaultValue: false },
        { name: 'color', type: 'String', isId: false, kind: 'scalar', isRequired: false, isList: false, hasDefaultValue: false },
        { name: 'districtTags', type: 'DistrictTag', kind: 'object', isRequired: false, isList: true, hasDefaultValue: false },
      ],
    };
    const code = generateToolFile(mockModel as any);
    expect(code).toContain('list_tags');
    expect(code).toContain('get_tag');
    expect(code).toContain('create_tag');
    expect(code).toContain('update_tag');
    expect(code).toContain('delete_tag');
    expect(code).toContain('z.string()');
    expect(code).toContain('z.number().int()');
    expect(code).not.toContain('districtTags'); // relations excluded from schema
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/generator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the generator**

Create `src/generator/generate.ts`:

```typescript
import { Prisma } from '@prisma/client';
import { prismaTypeToZod } from './type-map.js';
import * as fs from 'fs';
import * as path from 'path';

type DMMFModel = (typeof Prisma.dmmf.datamodel.models)[number];
type DMMFField = DMMFModel['fields'][number];
type DMMFEnum = (typeof Prisma.dmmf.datamodel.enums)[number];

// Build a lookup of enum name -> values for use in type mapping
function buildEnumMap(): Map<string, string[]> {
  const enums = Prisma.dmmf.datamodel.enums;
  const map = new Map<string, string[]>();
  for (const e of enums) {
    map.set(e.name, e.values.map((v) => v.name));
  }
  return map;
}

const enumMap = buildEnumMap();

export function modelToSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

export function pluralize(word: string): string {
  if (word.endsWith('y') && !word.endsWith('ey') && !word.endsWith('ay') && !word.endsWith('oy')) {
    return word.slice(0, -1) + 'ies';
  }
  if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
    return word + 'es';
  }
  return word + 's';
}

export function modelToToolNames(modelName: string): {
  list: string; get: string; create: string; update: string; delete: string;
} {
  const snake = modelToSnakeCase(modelName);
  const plural = pluralize(snake);
  return {
    list: `list_${plural}`,
    get: `get_${snake}`,
    create: `create_${snake}`,
    update: `update_${snake}`,
    delete: `delete_${snake}`,
  };
}

export function getPrimaryKeyFields(model: DMMFModel): { name: string; type: string; kind?: string }[] {
  // Composite key via @@id
  if (model.primaryKey?.fields) {
    return model.primaryKey.fields.map((fieldName) => {
      const field = model.fields.find((f) => f.name === fieldName)!;
      return { name: field.name, type: field.type, kind: field.kind };
    });
  }
  // Single @id
  const idField = model.fields.find((f) => f.isId);
  if (idField) {
    return [{ name: idField.name, type: idField.type, kind: idField.kind }];
  }
  return [];
}

export function getScalarFields(model: DMMFModel): DMMFField[] {
  return model.fields.filter(
    (f) => f.kind === 'scalar' || f.kind === 'enum'
  );
}

export function getRelationFields(model: DMMFModel): DMMFField[] {
  return model.fields.filter((f) => f.kind === 'object');
}

function generateWhereSchema(fields: DMMFField[]): string {
  const entries = fields
    .map((f) => {
      const enumValues = f.kind === 'enum' ? enumMap.get(f.type) : undefined;
      const zodType = prismaTypeToZod(f.type, true, enumValues);
      if (!zodType) return null;
      return `    ${f.name}: ${zodType},`;
    })
    .filter(Boolean);
  return `z.object({\n${entries.join('\n')}\n  }).optional()`;
}

function generateCreateSchema(fields: DMMFField[], pkFields: { name: string }[]): string {
  const entries = fields
    .filter((f) => {
      // Skip auto-generated fields for create
      if (f.hasDefaultValue && (f.name === 'createdAt' || f.name === 'updatedAt')) return false;
      return true;
    })
    .map((f) => {
      const isOptional = !f.isRequired || f.hasDefaultValue;
      const enumValues = f.kind === 'enum' ? enumMap.get(f.type) : undefined;
      const zodType = prismaTypeToZod(f.type, isOptional, enumValues);
      if (!zodType) return null;
      return `    ${f.name}: ${zodType},`;
    })
    .filter(Boolean);
  return `z.object({\n${entries.join('\n')}\n  })`;
}

function generateUpdateDataSchema(fields: DMMFField[], pkFields: { name: string }[]): string {
  const pkNames = new Set(pkFields.map((f) => f.name));
  const entries = fields
    .filter((f) => !pkNames.has(f.name))
    .map((f) => {
      const enumValues = f.kind === 'enum' ? enumMap.get(f.type) : undefined;
      const zodType = prismaTypeToZod(f.type, true, enumValues); // all optional for update
      if (!zodType) return null;
      return `    ${f.name}: ${zodType},`;
    })
    .filter(Boolean);
  return `z.object({\n${entries.join('\n')}\n  })`;
}

function generatePkSchema(pkFields: { name: string; type: string; kind?: string }[]): string {
  const entries = pkFields.map((f) => {
    const enumValues = f.kind === 'enum' ? enumMap.get(f.type) : undefined;
    const zodType = prismaTypeToZod(f.type, false, enumValues);
    if (!zodType) throw new Error(`Cannot map PK field type: ${f.type} on field ${f.name}`);
    return `    ${f.name}: ${zodType},`;
  });
  return `z.object({\n${entries.join('\n')}\n  })`;
}

function generatePkWhere(pkFields: { name: string }[]): string {
  if (pkFields.length === 1) {
    return `{ ${pkFields[0].name}: args.${pkFields[0].name} }`;
  }
  // Composite key: Prisma uses { field1_field2: { field1, field2 } }
  const compoundName = pkFields.map((f) => f.name).join('_');
  const compoundObj = pkFields.map((f) => `${f.name}: args.${f.name}`).join(', ');
  return `{ ${compoundName}: { ${compoundObj} } }`;
}

export function generateToolFile(model: DMMFModel): string {
  const names = modelToToolNames(model.name);
  const scalarFields = getScalarFields(model);
  const relationFields = getRelationFields(model);
  const pkFields = getPrimaryKeyFields(model);
  const prismaModel = model.name.charAt(0).toLowerCase() + model.name.slice(1);

  const pkSchema = generatePkSchema(pkFields);
  const whereSchema = generateWhereSchema(scalarFields);
  const createSchema = generateCreateSchema(scalarFields, pkFields);
  const updateDataSchema = generateUpdateDataSchema(scalarFields, pkFields);
  const pkWhere = generatePkWhere(pkFields);

  // Build include options string from relations
  const includeOptions = relationFields.map((f) => `'${f.name}'`).join(' | ');
  const includeComment = relationFields.length > 0
    ? `// Available relations: ${relationFields.map((f) => f.name).join(', ')}`
    : '// No relations available';

  return `// Auto-generated CRUD tools for ${model.name}
// Do not edit — regenerate with \`npm run generate\`

import { z } from 'zod';
import { getPrisma } from '../../db/prisma.js';

${includeComment}

const whereSchema = ${whereSchema};

const createSchema = ${createSchema};

const updateDataSchema = ${updateDataSchema};

const pkSchema = ${pkSchema};

function validateIncludeDepth(include: any, depth = 0): any {
  if (!include || typeof include !== 'object' || depth >= 2) return depth >= 2 ? undefined : include;
  const result: any = {};
  for (const [key, value] of Object.entries(include)) {
    if (typeof value === 'object' && value !== null && 'include' in (value as any)) {
      result[key] = { ...value as any, include: validateIncludeDepth((value as any).include, depth + 1) };
    } else {
      result[key] = value;
    }
  }
  return result;
}

export function registerTools(server: any) {
  // LIST
  server.tool(
    '${names.list}',
    'List ${model.name} records with filtering, sorting, and pagination',
    {
      where: whereSchema,
      orderBy: z.record(z.enum(['asc', 'desc'])).optional(),
      take: z.number().int().min(1).max(200).optional().default(50),
      skip: z.number().int().min(0).optional().default(0),
      include: z.record(z.any()).optional(),
    },
    async (args: any) => {
      try {
        const prisma = getPrisma();
        const results = await (prisma as any).${prismaModel}.findMany({
          where: args.where,
          orderBy: args.orderBy,
          take: args.take,
          skip: args.skip,
          include: args.include ? validateIncludeDepth(args.include) : undefined,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: \`Error: \${error instanceof Error ? error.message : String(error)}\` }], isError: true };
      }
    }
  );

  // GET
  server.tool(
    '${names.get}',
    'Get a single ${model.name} by primary key',
    {
      ...pkSchema.shape,
      include: z.record(z.any()).optional(),
    },
    async (args: any) => {
      try {
        const prisma = getPrisma();
        const result = await (prisma as any).${prismaModel}.findUnique({
          where: ${pkWhere},
          include: args.include ? validateIncludeDepth(args.include) : undefined,
        });
        if (!result) {
          return { content: [{ type: 'text' as const, text: '${model.name} not found' }], isError: true };
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: \`Error: \${error instanceof Error ? error.message : String(error)}\` }], isError: true };
      }
    }
  );

  // CREATE
  server.tool(
    '${names.create}',
    'Create a new ${model.name}',
    { data: createSchema },
    async (args: any) => {
      try {
        const prisma = getPrisma();
        const result = await (prisma as any).${prismaModel}.create({ data: args.data });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: \`Error: \${error instanceof Error ? error.message : String(error)}\` }], isError: true };
      }
    }
  );

  // UPDATE
  server.tool(
    '${names.update}',
    'Update an existing ${model.name} by primary key',
    {
      ...pkSchema.shape,
      data: updateDataSchema,
    },
    async (args: any) => {
      try {
        const prisma = getPrisma();
        const result = await (prisma as any).${prismaModel}.update({
          where: ${pkWhere},
          data: args.data,
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: \`Error: \${error instanceof Error ? error.message : String(error)}\` }], isError: true };
      }
    }
  );

  // DELETE
  server.tool(
    '${names.delete}',
    'Delete a ${model.name} by primary key',
    pkSchema.shape,
    async (args: any) => {
      try {
        const prisma = getPrisma();
        const result = await (prisma as any).${prismaModel}.delete({
          where: ${pkWhere},
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: \`Error: \${error instanceof Error ? error.message : String(error)}\` }], isError: true };
      }
    }
  );
}
`;
}

// --- Main generator entry point ---

export async function generate() {
  const models = Prisma.dmmf.datamodel.models;
  const outDir = path.resolve(import.meta.dirname, '../tools/generated');

  // Clean and recreate output directory
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const modelNames: string[] = [];

  for (const model of models) {
    const fileName = modelToSnakeCase(model.name) + '.ts';
    const filePath = path.join(outDir, fileName);
    const code = generateToolFile(model);
    fs.writeFileSync(filePath, code);
    modelNames.push(modelToSnakeCase(model.name));
    console.log(`  Generated: ${fileName}`);
  }

  // Generate index.ts
  const indexContent = `// Auto-generated index — do not edit
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

${modelNames.map((name) => `import { registerTools as register_${name} } from './${name}.js';`).join('\n')}

export function registerAllTools(server: McpServer) {
${modelNames.map((name) => `  register_${name}(server);`).join('\n')}
}
`;

  fs.writeFileSync(path.join(outDir, 'index.ts'), indexContent);
  console.log(`  Generated: index.ts`);
  console.log(`\nDone! Generated tools for ${models.length} models.`);
}

// Run when called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generate().catch(console.error);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/generator.test.ts
```

Expected: PASS — all tests pass.

- [ ] **Step 5: Run the generator to produce tool files**

```bash
cd ~/territory-plan-mcp
npm run generate
```

Expected: Output like `Generated: district.ts`, `Generated: tag.ts`, etc. for all models, plus `Generated: index.ts`.

- [ ] **Step 6: Verify generated output**

```bash
ls src/tools/generated/ | head -20
wc -l src/tools/generated/*.ts
```

Expected: ~48 files (47 models + index.ts).

- [ ] **Step 7: Commit**

```bash
git add src/generator/ src/__tests__/generator.test.ts
git commit -m "feat: add DMMF-based tool generator with tests"
```

---

## Task 6: Raw SQL Tool

**Files:**
- Create: `src/tools/run-sql.ts`
- Create: `src/__tests__/run-sql.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/run-sql.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateSqlQuery } from '../tools/run-sql.js';

describe('validateSqlQuery', () => {
  it('allows SELECT queries', () => {
    expect(validateSqlQuery('SELECT * FROM "District"')).toBe(true);
  });

  it('allows WITH (CTE) queries', () => {
    expect(validateSqlQuery('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(true);
  });

  it('rejects INSERT queries', () => {
    expect(validateSqlQuery('INSERT INTO "District" (name) VALUES ($1)')).toBe(false);
  });

  it('rejects UPDATE queries', () => {
    expect(validateSqlQuery('UPDATE "District" SET name = $1')).toBe(false);
  });

  it('rejects DELETE queries', () => {
    expect(validateSqlQuery('DELETE FROM "District"')).toBe(false);
  });

  it('rejects DROP queries', () => {
    expect(validateSqlQuery('DROP TABLE "District"')).toBe(false);
  });

  it('rejects ALTER queries', () => {
    expect(validateSqlQuery('ALTER TABLE "District" ADD COLUMN foo TEXT')).toBe(false);
  });

  it('rejects TRUNCATE queries', () => {
    expect(validateSqlQuery('TRUNCATE "District"')).toBe(false);
  });

  it('rejects CREATE queries', () => {
    expect(validateSqlQuery('CREATE TABLE foo (id INT)')).toBe(false);
  });

  it('rejects GRANT queries', () => {
    expect(validateSqlQuery('GRANT ALL ON "District" TO public')).toBe(false);
  });

  it('rejects mixed case attacks', () => {
    expect(validateSqlQuery('sElEcT 1; DrOp TABLE "District"')).toBe(false);
  });

  it('rejects queries with semicolons (multi-statement)', () => {
    expect(validateSqlQuery('SELECT 1; SELECT 2')).toBe(false);
  });

  it('allows semicolons inside string literals', () => {
    // This is a known limitation — we reject all semicolons for safety
    expect(validateSqlQuery("SELECT * FROM \"District\" WHERE name = 'foo;bar'")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/__tests__/run-sql.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement run-sql**

Create `src/tools/run-sql.ts`:

```typescript
import { z } from 'zod';
import { getPool } from '../db/raw.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER',
  'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE',
];

const MAX_ROWS = 1000;

export function validateSqlQuery(query: string): boolean {
  const normalized = query.toUpperCase();

  // Reject multi-statement queries (semicolons)
  if (query.includes(';')) return false;

  // Reject forbidden DML/DDL keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Match keyword as a whole word
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(query)) return false;
  }

  return true;
}

export function registerRunSql(server: McpServer) {
  server.tool(
    'run_sql',
    'Execute a read-only SQL query against the database. Use parameterized queries ($1, $2, etc.) with the params array. No DML/DDL allowed.',
    {
      query: z.string().describe('SQL query with $1, $2, etc. placeholders'),
      params: z.array(z.any()).optional().default([]).describe('Parameter values for query placeholders'),
    },
    async (args) => {
      if (!validateSqlQuery(args.query)) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Error: Query rejected. Only SELECT/WITH queries are allowed. No INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, or multi-statement queries.',
          }],
          isError: true,
        };
      }

      try {
        const pool = getPool();
        const result = await pool.query(args.query, args.params);
        const truncated = result.rows.length > MAX_ROWS;
        const rows = truncated ? result.rows.slice(0, MAX_ROWS) : result.rows;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              rows,
              rowCount: result.rowCount,
              truncated,
              fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `SQL Error: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/__tests__/run-sql.test.ts
```

Expected: PASS — all validation tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tools/run-sql.ts src/__tests__/run-sql.test.ts
git commit -m "feat: add run_sql tool with safety validation"
```

---

## Task 7: MCP Server Entry Point

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Implement server.ts**

Create `src/server.ts`:

```typescript
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './tools/generated/index.js';
import { registerRunSql } from './tools/run-sql.js';
import { disconnectPrisma } from './db/prisma.js';
import { disconnectPool } from './db/raw.js';

// Validate required env vars at startup
const required = ['DATABASE_URL', 'MCP_API_KEY'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const server = new McpServer({
  name: 'territory-plan',
  version: '1.0.0',
});

// Register all auto-generated CRUD tools
registerAllTools(server);

// Register raw SQL tool
registerRunSql(server);

// Note: API key auth is validated at startup via env var check.
// For stdio transport, the server runs in the same process context as the client,
// so per-request auth is not applicable. When HTTP transport is added in the future,
// per-request API key validation should be added using the auth middleware.

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Territory Plan MCP server running on stdio');
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectPrisma();
  await disconnectPool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectPrisma();
  await disconnectPool();
  process.exit(0);
});

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/territory-plan-mcp
npm run build
```

Expected: Compiles with no errors. `dist/` directory created.

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add MCP server entry point with stdio transport"
```

---

## Task 8: Schema Sync Script

**Files:**
- Create: `scripts/sync-schema.ts`

- [ ] **Step 1: Implement sync script**

Create `scripts/sync-schema.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const sourcePath = process.argv[2];

if (!sourcePath) {
  console.error('Usage: npm run sync-schema -- /path/to/territory-plan');
  process.exit(1);
}

const sourceSchema = path.resolve(sourcePath, 'prisma/schema.prisma');
const destSchema = path.resolve(import.meta.dirname, '../prisma/schema.prisma');

if (!fs.existsSync(sourceSchema)) {
  console.error(`Schema not found at: ${sourceSchema}`);
  process.exit(1);
}

// Read current schema for diff
const currentSchema = fs.existsSync(destSchema) ? fs.readFileSync(destSchema, 'utf-8') : '';
const newSchema = fs.readFileSync(sourceSchema, 'utf-8');

if (currentSchema === newSchema) {
  console.log('Schema is already up to date.');
  process.exit(0);
}

// Copy schema
fs.copyFileSync(sourceSchema, destSchema);
console.log('✓ Copied schema.prisma');

// Run prisma generate
console.log('Running prisma generate...');
execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(import.meta.dirname, '..') });
console.log('✓ Prisma client regenerated');

// Run tool generator
console.log('Running tool generator...');
execSync('npm run generate', { stdio: 'inherit', cwd: path.resolve(import.meta.dirname, '..') });
console.log('✓ Tool definitions regenerated');

// Show diff summary
const oldModels = (currentSchema.match(/^model \w+/gm) || []).length;
const newModels = (newSchema.match(/^model \w+/gm) || []).length;
console.log(`\nSync complete: ${oldModels} → ${newModels} models`);
```

- [ ] **Step 2: Test the sync script**

```bash
cd ~/territory-plan-mcp
npm run sync-schema -- ~/territory-plan
```

Expected: "Schema is already up to date." (since we just copied it in Task 1).

- [ ] **Step 3: Commit**

```bash
git add scripts/
git commit -m "feat: add schema sync script"
```

---

## Task 9: End-to-End Smoke Test

**Files:**
- Create: `src/__tests__/server.test.ts`

- [ ] **Step 1: Write a smoke test for the generated tools**

Create `src/__tests__/server.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const generatedDir = path.resolve(import.meta.dirname, '../tools/generated');

describe('Generated tools', () => {
  it('generated directory exists', () => {
    expect(fs.existsSync(generatedDir)).toBe(true);
  });

  it('has an index.ts file', () => {
    expect(fs.existsSync(path.join(generatedDir, 'index.ts'))).toBe(true);
  });

  it('generated a file for District model', () => {
    expect(fs.existsSync(path.join(generatedDir, 'district.ts'))).toBe(true);
  });

  it('generated a file for TerritoryPlan model', () => {
    expect(fs.existsSync(path.join(generatedDir, 'territory_plan.ts'))).toBe(true);
  });

  it('generated files for composite key models', () => {
    expect(fs.existsSync(path.join(generatedDir, 'district_tag.ts'))).toBe(true);
    expect(fs.existsSync(path.join(generatedDir, 'territory_plan_district.ts'))).toBe(true);
  });

  it('District tool file excludes Unsupported geometry fields', () => {
    const content = fs.readFileSync(path.join(generatedDir, 'district.ts'), 'utf-8');
    expect(content).not.toContain('pointLocation');
    expect(content).not.toContain('geometry');
    expect(content).not.toContain('centroid');
  });

  it('index.ts exports registerAllTools', () => {
    const content = fs.readFileSync(path.join(generatedDir, 'index.ts'), 'utf-8');
    expect(content).toContain('registerAllTools');
  });
});
```

- [ ] **Step 2: Run all tests**

```bash
cd ~/territory-plan-mcp
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Verify full build**

```bash
npm run build
```

Expected: Clean compile, `dist/server.js` exists.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/server.test.ts
git commit -m "test: add smoke tests for generated tools"
```

---

## Task 10: Configuration & README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```markdown
# Territory Plan MCP Server

MCP server exposing the Territory Plan Supabase database to Claude Code and AI agents.

## Setup

1. Copy `.env.example` to `.env` and fill in your database credentials
2. Install dependencies: `npm install`
3. Generate Prisma client: `npx prisma generate`
4. Generate tools: `npm run generate`
5. Build: `npm run build`

## Usage

Add to your Claude Code settings (`.claude/settings.json`):

\`\`\`json
{
  "mcpServers": {
    "territory-plan": {
      "command": "node",
      "args": ["/absolute/path/to/territory-plan-mcp/dist/server.js"],
      "env": {
        "MCP_API_KEY": "your-api-key"
      }
    }
  }
}
\`\`\`

## Syncing Schema

After schema changes in the main territory-plan repo:

\`\`\`bash
npm run sync-schema -- /path/to/territory-plan
\`\`\`

## Development

- `npm run dev` — run server with tsx
- `npm test` — run tests
- `npm run generate` — regenerate tools from Prisma DMMF
- `npm run build` — compile TypeScript
```

- [ ] **Step 2: Final commit**

```bash
git add README.md
git commit -m "docs: add README with setup and usage instructions"
```

- [ ] **Step 3: Configure in territory-plan project**

Add MCP server config to `~/territory-plan/.claude/settings.local.json`:

```json
{
  "mcpServers": {
    "territory-plan-db": {
      "command": "node",
      "args": ["/Users/sierraarcega/territory-plan-mcp/dist/server.js"],
      "env": {
        "MCP_API_KEY": "your-api-key"
      }
    }
  }
}
```

- [ ] **Step 4: Test the MCP connection**

Restart Claude Code in the territory-plan project and verify the MCP server tools appear.
