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

  describe("relationship integrity", () => {
    it("every TableRelationship.toTable is in TABLE_REGISTRY", () => {
      const errors: string[] = [];
      for (const [from, meta] of Object.entries(TABLE_REGISTRY)) {
        for (const rel of meta.relationships) {
          if (!TABLE_REGISTRY[rel.toTable]) {
            errors.push(`${from} → ${rel.toTable}: target table not in TABLE_REGISTRY`);
          }
        }
      }
      expect(errors, errors.join("\n")).toEqual([]);
    });
  });

  describe("warning triggers", () => {
    it("every Warning.triggerTables entry exists in TABLE_REGISTRY", () => {
      const errors: string[] = [];
      for (const warning of SEMANTIC_CONTEXT.warnings) {
        for (const t of warning.triggerTables) {
          if (!TABLE_REGISTRY[t]) {
            errors.push(`Warning trigger '${t}' not in TABLE_REGISTRY`);
          }
        }
      }
      expect(errors, errors.join("\n")).toEqual([]);
    });
  });

  describe("excluded tables don't overlap with registry", () => {
    it("no table appears in both TABLE_REGISTRY and excludedTables", () => {
      const registered = new Set(Object.keys(TABLE_REGISTRY));
      const overlap = SEMANTIC_CONTEXT.excludedTables.filter((t) => registered.has(t));
      expect(
        overlap,
        `Tables in both registry and excluded: ${overlap.join(", ")}`,
      ).toEqual([]);
    });
  });

  describe("existing exports still work", () => {
    it("DISTRICT_COLUMNS contains the 'leaid' column", () => {
      expect(DISTRICT_COLUMNS.find((c) => c.field === "leaid")).toBeDefined();
    });

    it("DISTRICT_FINANCIALS_COLUMNS contains both sessionCount and subscriptionCount", () => {
      expect(DISTRICT_FINANCIALS_COLUMNS.find((c) => c.field === "sessionCount")).toBeDefined();
      expect(
        DISTRICT_FINANCIALS_COLUMNS.find((c) => c.field === "subscriptionCount"),
      ).toBeDefined();
    });

    it("COLUMN_BY_FIELD and FINANCIALS_COLUMN_BY_FIELD are populated", () => {
      expect(COLUMN_BY_FIELD.get("leaid")).toBeDefined();
      expect(FINANCIALS_COLUMN_BY_FIELD.get("totalRevenue")).toBeDefined();
    });

    it("KNOWN_VENDORS includes fullmind", () => {
      expect(KNOWN_VENDORS).toContain("fullmind");
    });

    it("formatFiscalYear pads single-digit years", () => {
      expect(formatFiscalYear(26)).toBe("FY26");
      expect(formatFiscalYear("5")).toBe("FY05");
      expect(formatFiscalYear("FY26")).toBe("FY26");
    });
  });
});
