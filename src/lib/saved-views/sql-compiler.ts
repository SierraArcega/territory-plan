/**
 * Filter-tree → parameterized SQL compiler.
 *
 * Compiles a validated FilterNode + scope into a parameterized SQL WHERE
 * clause and parameter array, ready to run against the read-only Postgres
 * pool (@/lib/db-readonly).
 *
 * Hard rules:
 *   - Column names come ONLY from the allowlist in source-fields.ts. They are
 *     interpolated as raw identifiers (quoted with double-quotes) — never
 *     concatenated with user-supplied text.
 *   - Values are ALWAYS bound as $N parameters. No exception.
 *   - Operators are matched against a known set; unknowns produce an error.
 *
 * Output shape:
 *   { whereSql: string, params: unknown[] }
 * The caller composes the final SELECT/FROM/JOIN and concatenates the WHERE.
 */
import type { FilterNode, SavedListSource } from "./filter-tree";
import {
  SOURCE_FIELDS,
  SOURCE_TABLES,
  lookupField,
  validateFieldOp,
} from "./source-fields";

export type CompileResult =
  | { ok: true; whereSql: string; params: unknown[] }
  | { ok: false; error: string };

interface CompilerCtx {
  source: SavedListSource;
  /** SQL table alias for the source's primary table — keeps composed SQL stable. */
  alias: string;
  /** Mutable params array — grows as $N placeholders are emitted. */
  params: unknown[];
  /**
   * Bind-index offset — added to params.length when emitting $N placeholders.
   * Lets a caller concatenate two compiled fragments that share a params
   * array (e.g. primary filter + scope filter) without restarting the
   * positional bind numbering.
   */
  paramOffset: number;
}

function emitParam(ctx: CompilerCtx, value: unknown): string {
  ctx.params.push(value);
  return `$${ctx.paramOffset + ctx.params.length}`;
}

function quoteIdent(name: string): string {
  // Defense in depth: the column comes from the allowlist, but double-check
  // for unexpected characters before emission. Allow [a-z_0-9] only.
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid identifier in compiled SQL: ${name}`);
  }
  return `"${name}"`;
}

/**
 * Convert a relative-duration value like "30 days", "7 days", "6 months"
 * into a Postgres `INTERVAL` literal value. Returns null when the shape is
 * unrecognized — caller must reject the rule in that case.
 */
function durationToInterval(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  const m = /^(\d+)\s+(day|days|week|weeks|month|months|year|years)$/.exec(trimmed);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].replace(/s$/, "");
  return `${n} ${unit}`;
}

function compileNode(ctx: CompilerCtx, node: FilterNode): string {
  if (node.kind === "and") {
    if (node.children.length === 0) return "TRUE";
    const parts = node.children.map((c) => compileNode(ctx, c));
    return `(${parts.join(" AND ")})`;
  }

  // rule / any → both translate to a single predicate
  const field = lookupField(ctx.source, node.fieldId);
  if (!field) {
    throw new Error(`Unknown field "${node.fieldId}" for source "${ctx.source}".`);
  }
  const opErr = validateFieldOp(ctx.source, node.fieldId, node.op);
  if (opErr) throw new Error(opErr);

  const col = `${ctx.alias}.${quoteIdent(field.column)}`;

  if (node.kind === "any") {
    if (!["is any of", "is not any of"].includes(node.op)) {
      throw new Error(`'any' node requires "is any of" / "is not any of"; got "${node.op}".`);
    }
    if (node.values.length === 0) {
      return node.op === "is any of" ? "FALSE" : "TRUE";
    }
    const placeholders = node.values.map((v) => emitParam(ctx, v)).join(", ");
    const negate = node.op === "is not any of" ? "NOT " : "";
    return `(${col} ${negate}IN (${placeholders}))`;
  }

  // rule
  switch (node.op) {
    case "is":
      if (node.value === null) return `(${col} IS NULL)`;
      return `(${col} = ${emitParam(ctx, node.value)})`;
    case "is not":
      if (node.value === null) return `(${col} IS NOT NULL)`;
      return `(${col} <> ${emitParam(ctx, node.value)})`;
    case "is any of":
      // Single-value `any of` — equivalent to `is`. Harmless but rare.
      return `(${col} = ${emitParam(ctx, node.value)})`;
    case "is not any of":
      return `(${col} <> ${emitParam(ctx, node.value)})`;
    case ">":
    case "<":
    case ">=":
    case "<=": {
      return `(${col} ${node.op} ${emitParam(ctx, node.value)})`;
    }
    case "before": {
      // For dates, "before" = strict less-than the provided value.
      if (field.type === "date") {
        return `(${col} < ${emitParam(ctx, node.value)})`;
      }
      return `(${col} < ${emitParam(ctx, node.value)})`;
    }
    case "within": {
      // "within N days" — duration string. Apply to date/timestamp columns.
      // SQL: column >= NOW() - INTERVAL 'N days'
      const interval = durationToInterval(node.value);
      if (!interval) {
        throw new Error(
          `"within" requires a duration value like "30 days"; got ${JSON.stringify(node.value)}`,
        );
      }
      return `(${col} >= NOW() - INTERVAL '${interval}')`;
    }
    case "contains":
      // ILIKE for case-insensitive substring search. Values bound as $N.
      if (typeof node.value !== "string") {
        throw new Error(`"contains" requires a string value.`);
      }
      return `(${col} ILIKE ${emitParam(ctx, `%${node.value}%`)})`;
    case "is empty":
      return `(${col} IS NULL OR ${col} = '')`;
    case "is not empty":
      return `(${col} IS NOT NULL AND ${col} <> '')`;
    default:
      throw new Error(`Unknown operator "${node.op}".`);
  }
}

/**
 * Compile a filterTree against one source into a WHERE clause + params.
 *
 * `alias` is the SQL alias that the caller will use for the source's primary
 * table (e.g. "d" for districts). The compiler prefixes every column with
 * this alias to keep composed JOINs unambiguous.
 *
 * On failure (unknown field/op or invalid value), returns
 * `{ ok: false, error }` so the route can respond 400 cleanly.
 */
export function compileFilterTree(
  source: SavedListSource,
  filterTree: FilterNode,
  alias: string,
  paramOffset = 0,
): CompileResult {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) {
    return { ok: false, error: `Invalid SQL alias: ${alias}` };
  }
  const ctx: CompilerCtx = { source, alias, params: [], paramOffset };
  try {
    const whereSql = compileNode(ctx, filterTree);
    return { ok: true, whereSql, params: ctx.params };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Inspect a filterTree without compiling — used by the preview/ai-build
 * endpoints to validate fields/ops before constructing SQL, so a malformed
 * tree fails fast with a 400 instead of mid-SQL.
 *
 * Returns null on success or the first error message encountered.
 */
export function validateFilterTree(
  source: SavedListSource,
  filterTree: FilterNode,
): string | null {
  const visit = (node: FilterNode): string | null => {
    if (node.kind === "and") {
      for (const c of node.children) {
        const err = visit(c);
        if (err) return err;
      }
      return null;
    }
    return validateFieldOp(source, node.fieldId, node.op);
  };
  return visit(filterTree);
}

/** Convenience re-exports — keeps imports tidy at the route layer. */
export { SOURCE_FIELDS, SOURCE_TABLES };

/**
 * Compile a sort spec into an ORDER BY clause.
 *
 * Each sort item's `id` is resolved through the source-fields allowlist —
 * the same allowlist used by the WHERE compiler — so only known, safe column
 * names reach the SQL string. A defense-in-depth regex check mirrors the
 * `quoteIdent` discipline above. NULLS LAST matches sales-rep expectations:
 * a district with no ARR should not dominate a descending sort.
 *
 * Returns an empty string when `sort` is empty (caller omits ORDER BY).
 */
export function buildOrderBy(
  sort: { id: string; dir: "asc" | "desc" }[],
  source: SavedListSource,
): string {
  if (sort.length === 0) return "";
  const parts = sort.map(({ id, dir }) => {
    const field = lookupField(source, id);
    if (!field) throw new Error(`Unknown sort field "${id}" for source "${source}"`);
    if (!/^[a-z_][a-z0-9_]*$/i.test(field.column)) {
      throw new Error(`Invalid identifier in sort column: ${field.column}`);
    }
    const safeDir = dir === "asc" ? "ASC" : "DESC";
    return `"${field.column}" ${safeDir} NULLS LAST`;
  });
  return `ORDER BY ${parts.join(", ")}`;
}
