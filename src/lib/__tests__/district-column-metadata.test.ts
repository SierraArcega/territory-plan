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
});
