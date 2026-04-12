import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  TABLE_REGISTRY,
  SEMANTIC_CONTEXT,
  DISTRICT_COLUMNS,
  DISTRICT_FINANCIALS_COLUMNS,
  COLUMN_BY_FIELD,
  FINANCIALS_COLUMN_BY_FIELD,
  KNOWN_VENDORS,
  formatFiscalYear,
} from "../district-column-metadata";

/**
 * Parse prisma/schema.prisma to extract { prismaModelName: physicalTableName }.
 * Used by the schema-coverage tests to assert metadata stays in sync with the DB.
 */
function parsePrismaModels(): Map<string, string> {
  const schemaPath = join(__dirname, "../../../prisma/schema.prisma");
  const schema = readFileSync(schemaPath, "utf-8");
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  const models = new Map<string, string>();

  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schema)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const mapMatch = body.match(/@@map\("(\w+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : modelName;
    models.set(modelName, tableName);
  }

  return models;
}

/**
 * Parse the per-table column sets from prisma/schema.prisma.
 * Returns a Map<tableName, Set<columnName>> where columnName is the snake_case
 * physical column name (the @map value when present, else the field name).
 */
function parsePrismaTableColumns(): Map<string, Set<string>> {
  const schemaPath = join(__dirname, "../../../prisma/schema.prisma");
  const schema = readFileSync(schemaPath, "utf-8");
  const modelRegex = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  const tableColumns = new Map<string, Set<string>>();

  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schema)) !== null) {
    const body = match[2];
    const mapMatch = body.match(/@@map\("(\w+)"\)/);
    if (!mapMatch) continue;
    const tableName = mapMatch[1];

    const columns = new Set<string>();
    // Match each line that looks like a field declaration:
    //   fieldName  Type  ... [@map("snake_name")]
    // Skip lines that start with @@ (model-level directives) or // (comments)
    // or that don't have a recognizable type token after the field name.
    const lines = body.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      // Field line shape: "name Type modifiers..."
      const fieldMatch = line.match(/^(\w+)\s+\w/);
      if (!fieldMatch) continue;
      const fieldName = fieldMatch[1];
      const mapM = line.match(/@map\("(\w+)"\)/);
      columns.add(mapM ? mapM[1] : toSnakeCase(fieldName));
    }
    tableColumns.set(tableName, columns);
  }

  return tableColumns;
}

function toSnakeCase(s: string): string {
  return s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
}

describe("district-column-metadata", () => {
  describe("schema coverage", () => {
    it("every Prisma model is either in TABLE_REGISTRY or SEMANTIC_CONTEXT.excludedTables", () => {
      const models = parsePrismaModels();
      const tableNames = Array.from(models.values());

      const registered = new Set(Object.keys(TABLE_REGISTRY));
      const excluded = new Set(SEMANTIC_CONTEXT.excludedTables);

      const missing = tableNames.filter(
        (t) => !registered.has(t) && !excluded.has(t),
      );

      expect(
        missing,
        `Tables missing from both TABLE_REGISTRY and excludedTables: ${missing.join(", ")}`,
      ).toEqual([]);
    });
  });

  describe("column existence", () => {
    it("every ColumnMetadata.column in per-table arrays maps to a real Prisma field", () => {
      const tableColumns = parsePrismaTableColumns();
      const errors: string[] = [];

      for (const [tableName, meta] of Object.entries(TABLE_REGISTRY)) {
        if (meta.columns.length === 0) continue; // junction tables intentionally empty
        const realColumns = tableColumns.get(tableName);
        if (!realColumns) {
          errors.push(`TABLE_REGISTRY entry '${tableName}' has no matching Prisma model`);
          continue;
        }
        for (const col of meta.columns) {
          if (!realColumns.has(col.column)) {
            errors.push(
              `${tableName}.${col.column} (field=${col.field}) does not exist in Prisma model`,
            );
          }
        }
      }

      expect(errors, `Column existence errors:\n${errors.join("\n")}`).toEqual([]);
    });
  });
});
