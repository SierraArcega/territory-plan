import { TABLE_REGISTRY } from "@/lib/district-column-metadata";
import { type Aggregation, type Filter, type FilterOp, type QueryParams } from "./types";

/**
 * Compile validated QueryParams into a parameterized SQL query.
 * Callers must run `validateParams` FIRST — this function trusts its input.
 *
 * Returns { sql, values } suitable for pg's `client.query(sql, values)`.
 */
export function compileParams(params: QueryParams): {
  sql: string;
  values: unknown[];
} {
  const builder = new SqlBuilder(params);
  return builder.build();
}

class SqlBuilder {
  private readonly params: QueryParams;
  private readonly values: unknown[] = [];
  private readonly hasJoins: boolean;

  constructor(params: QueryParams) {
    this.params = params;
    this.hasJoins = !!params.joins && params.joins.length > 0;
  }

  build(): { sql: string; values: unknown[] } {
    const select = this.buildSelect();
    const from = this.buildFrom();
    const joins = this.buildJoins();
    const where = this.buildWhere();
    const groupBy = this.buildGroupBy();
    const orderBy = this.buildOrderBy();
    const limit = this.buildLimit();

    const parts = [select, from, joins, where, groupBy, orderBy, limit].filter(
      (s) => s.length > 0,
    );
    return { sql: parts.join("\n"), values: this.values };
  }

  // --- SELECT ---------------------------------------------------------------

  private buildSelect(): string {
    const pieces: string[] = [];
    for (const col of this.params.columns ?? []) {
      pieces.push(this.columnExpr(col));
    }
    for (const agg of this.params.aggregations ?? []) {
      pieces.push(this.aggregationExpr(agg));
    }
    if (pieces.length === 0) {
      // No explicit columns and no aggregations: SELECT all registered columns
      // on the root table (safer than SELECT * since we avoid geometry etc.).
      pieces.push(...this.defaultSelectColumns());
    }
    return `SELECT ${pieces.join(", ")}`;
  }

  private defaultSelectColumns(): string[] {
    const rootMeta = TABLE_REGISTRY[this.params.table];
    const excluded = new Set(rootMeta.excludedColumns ?? []);
    const cols = rootMeta.columns
      .filter((c) => c.queryable && !excluded.has(c.column))
      .map((c) => this.qualify(this.params.table, c.column));
    return cols.length > 0 ? cols : [`${quoteIdent(this.params.table)}.*`];
  }

  private columnExpr(ref: string): string {
    const { table, column } = splitRef(ref, this.params.table);
    return this.qualify(table, column);
  }

  private aggregationExpr(agg: Aggregation): string {
    const fn = agg.fn.toUpperCase();
    let inner: string;
    if (agg.column === "*") {
      inner = "*";
    } else {
      const { table, column } = splitRef(agg.column, this.params.table);
      inner = this.qualify(table, column);
    }
    const alias = agg.alias ?? `${agg.fn}_${agg.column === "*" ? "all" : agg.column.replace(/\./g, "_")}`;
    return `${fn}(${inner}) AS ${quoteIdent(alias)}`;
  }

  // --- FROM / JOIN ----------------------------------------------------------

  private buildFrom(): string {
    return `FROM ${quoteIdent(this.params.table)}`;
  }

  private buildJoins(): string {
    if (!this.params.joins || this.params.joins.length === 0) return "";
    const rootMeta = TABLE_REGISTRY[this.params.table];
    const lines: string[] = [];
    for (const join of this.params.joins) {
      const rel = rootMeta.relationships.find((r) => r.toTable === join.toTable);
      if (!rel) continue; // already validated upstream; defensive skip
      // joinSql is a literal fragment like "subscriptions.opportunity_id = opportunities.id"
      // — safe to inline because it comes from our own registry, not user input.
      lines.push(`LEFT JOIN ${quoteIdent(join.toTable)} ON ${rel.joinSql}`);
    }
    return lines.join("\n");
  }

  // --- WHERE ----------------------------------------------------------------

  private buildWhere(): string {
    if (!this.params.filters || this.params.filters.length === 0) return "";
    const clauses = this.params.filters.map((f) => this.filterClause(f));
    return `WHERE ${clauses.join(" AND ")}`;
  }

  private filterClause(f: Filter): string {
    const { table, column } = splitRef(f.column, this.params.table);
    const lhs = this.qualify(table, column);

    switch (f.op) {
      case "eq":
        return `${lhs} = ${this.bind(f.value)}`;
      case "neq":
        return `${lhs} <> ${this.bind(f.value)}`;
      case "gt":
        return `${lhs} > ${this.bind(f.value)}`;
      case "gte":
        return `${lhs} >= ${this.bind(f.value)}`;
      case "lt":
        return `${lhs} < ${this.bind(f.value)}`;
      case "lte":
        return `${lhs} <= ${this.bind(f.value)}`;
      case "like":
        return `${lhs} LIKE ${this.bind(f.value)}`;
      case "ilike":
        return `${lhs} ILIKE ${this.bind(f.value)}`;
      case "isNull":
        return `${lhs} IS NULL`;
      case "isNotNull":
        return `${lhs} IS NOT NULL`;
      case "in":
        return `${lhs} = ANY(${this.bind(f.value)})`;
      case "notIn":
        return `${lhs} <> ALL(${this.bind(f.value)})`;
      default: {
        const _exhaustive: never = f.op as never;
        return _exhaustive;
      }
    }
  }

  // --- GROUP BY / ORDER BY / LIMIT -----------------------------------------

  private buildGroupBy(): string {
    if (!this.params.groupBy || this.params.groupBy.length === 0) return "";
    const cols = this.params.groupBy.map((ref) => {
      const { table, column } = splitRef(ref, this.params.table);
      return this.qualify(table, column);
    });
    return `GROUP BY ${cols.join(", ")}`;
  }

  private buildOrderBy(): string {
    if (!this.params.orderBy || this.params.orderBy.length === 0) return "";
    const aggAliases = new Set(
      (this.params.aggregations ?? []).map(
        (a) => a.alias ?? `${a.fn}_${a.column === "*" ? "all" : a.column.replace(/\./g, "_")}`,
      ),
    );
    const parts = this.params.orderBy.map((o) => {
      const dir = o.direction === "desc" ? "DESC" : "ASC";
      if (aggAliases.has(o.column)) {
        return `${quoteIdent(o.column)} ${dir}`;
      }
      const { table, column } = splitRef(o.column, this.params.table);
      return `${this.qualify(table, column)} ${dir}`;
    });
    return `ORDER BY ${parts.join(", ")}`;
  }

  private buildLimit(): string {
    // Validator clamps to [1, 500]; fall back to 100 defensively.
    return `LIMIT ${this.params.limit ?? 100}`;
  }

  // --- helpers --------------------------------------------------------------

  private qualify(table: string, column: string): string {
    if (!this.hasJoins && table === this.params.table) {
      return quoteIdent(column);
    }
    return `${quoteIdent(table)}.${quoteIdent(column)}`;
  }

  private bind(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

function splitRef(ref: string, defaultTable: string): { table: string; column: string } {
  const dot = ref.indexOf(".");
  if (dot > -1) {
    return { table: ref.slice(0, dot), column: ref.slice(dot + 1) };
  }
  return { table: defaultTable, column: ref };
}

function quoteIdent(name: string): string {
  // Double any embedded double-quotes, then wrap.
  return `"${name.replace(/"/g, '""')}"`;
}
