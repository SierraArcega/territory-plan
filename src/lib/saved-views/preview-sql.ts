/**
 * Build the count + sample SQL for the preview endpoint.
 *
 * Combines:
 *   - The source's primary table + an alias (`p`).
 *   - The compiled WHERE clause from `compileFilterTree`.
 *   - Optional scope:
 *       * mode 'rules' — compile a districts WHERE and EXISTS-join it.
 *       * mode 'reference' — restrict to plan-member districts or to another
 *         list's compiled candidate set.
 *
 * Returns two SQL strings (count + sample) that share the same param array.
 *
 * The caller runs these against `@/lib/db-readonly`. Param ordering matters —
 * Postgres positional binds are 1-indexed and ordered by appearance.
 */
import type { FilterNode, SavedListSource, ScopeMode, ScopeRefKind } from "./filter-tree";
import { compileFilterTree } from "./sql-compiler";
import { SOURCE_TABLES } from "./source-fields";

export interface ScopeSpec {
  mode: ScopeMode;
  filterTree?: FilterNode | null;
  refKind?: ScopeRefKind | null;
  refId?: string | null;
}

export interface PreviewSql {
  countSql: string;
  sampleSql: string;
  params: unknown[];
}

export type BuildPreviewResult =
  | { ok: true; sql: PreviewSql }
  | { ok: false; error: string };

const PRIMARY_ALIAS = "p";
const SCOPE_DISTRICT_ALIAS = "scoped";

/**
 * Build SELECT-projection columns for the 3-row sample. Per-source we project
 * a small set of human-readable columns the UI can render in the preview pane.
 */
function buildSampleProjection(source: SavedListSource): string {
  const a = PRIMARY_ALIAS;
  switch (source) {
    case "districts":
      return `${a}."leaid" AS id, ${a}."name" AS primary_label, ${a}."state_abbrev" AS secondary_label, ${a}."enrollment" AS meta`;
    case "contacts":
      return `${a}."id"::text AS id, ${a}."name" AS primary_label, ${a}."title" AS secondary_label, ${a}."email" AS meta`;
    case "opps":
      return `${a}."id" AS id, ${a}."name" AS primary_label, ${a}."district_name" AS secondary_label, ${a}."stage" AS meta`;
    case "vacancies":
      return `${a}."id" AS id, ${a}."title" AS primary_label, ${a}."category" AS secondary_label, ${a}."status" AS meta`;
    case "news":
      return `${a}."id" AS id, ${a}."title" AS primary_label, ${a}."source" AS secondary_label, ${a}."fullmind_relevance" AS meta`;
    case "rfps":
      return `${a}."id"::text AS id, ${a}."title" AS primary_label, ${a}."agency_name" AS secondary_label, ${a}."status" AS meta`;
  }
}

function buildSampleOrderBy(source: SavedListSource): string {
  const a = PRIMARY_ALIAS;
  switch (source) {
    case "districts":
      return `${a}."name"`;
    case "contacts":
      return `${a}."name"`;
    case "opps":
      return `${a}."close_date" DESC NULLS LAST, ${a}."id"`;
    case "vacancies":
      return `${a}."date_posted" DESC NULLS LAST, ${a}."id"`;
    case "news":
      return `${a}."published_at" DESC, ${a}."id"`;
    case "rfps":
      return `${a}."captured_date" DESC, ${a}."id"`;
  }
}

/**
 * Build a SQL fragment that restricts the candidate set to the scope.
 *
 * Returns an empty string when scopeMode = 'none' or when scoping is not
 * applicable (e.g. news, which joins through a junction table — scope is
 * applied via a separate JOIN in v1.1+).
 */
function buildScopeClause(
  source: SavedListSource,
  scope: ScopeSpec,
  params: unknown[],
): { ok: true; sql: string } | { ok: false; error: string } {
  if (scope.mode === "none") return { ok: true, sql: "" };

  const tableInfo = SOURCE_TABLES[source];
  if (!tableInfo.districtJoinColumn) {
    // Source has no per-district join column; scope is N/A in v1. The caller
    // can still apply filterTree but scope is silently ignored. Surfaced via
    // 400 so the caller doesn't think scope was applied when it wasn't.
    return {
      ok: false,
      error: `Source "${source}" does not support scope filtering in v1.`,
    };
  }

  const districtCol = `${PRIMARY_ALIAS}."${tableInfo.districtJoinColumn}"`;

  if (scope.mode === "rules") {
    if (!scope.filterTree) {
      return { ok: false, error: "scope mode 'rules' requires scope.filterTree" };
    }
    // Compile with paramOffset = params.length so the scope's $N placeholders
    // continue numbering from where the primary filter left off.
    const compiled = compileFilterTree(
      "districts",
      scope.filterTree,
      SCOPE_DISTRICT_ALIAS,
      params.length,
    );
    if (!compiled.ok) return { ok: false, error: `Scope: ${compiled.error}` };
    // Append the compiled scope params to ours
    params.push(...compiled.params);
    return {
      ok: true,
      sql: `AND EXISTS (SELECT 1 FROM "districts" ${SCOPE_DISTRICT_ALIAS} WHERE ${SCOPE_DISTRICT_ALIAS}."leaid" = ${districtCol} AND ${compiled.whereSql})`,
    };
  }

  if (scope.mode === "reference") {
    if (!scope.refKind || !scope.refId) {
      return { ok: false, error: "scope mode 'reference' requires refKind and refId" };
    }
    if (scope.refKind === "plan") {
      params.push(scope.refId);
      const p = `$${params.length}`;
      return {
        ok: true,
        sql: `AND ${districtCol} IN (SELECT "district_leaid" FROM "territory_plan_districts" WHERE "plan_id" = ${p})`,
      };
    }
    if (scope.refKind === "list") {
      // List reference — v1 supports districts-source referenced lists only.
      // We resolve the list's district candidate set at preview time.
      // Implementation note: the referenced list's filterTree is fetched
      // by the route (route has Prisma access), then we compile + EXISTS-
      // join it here. To keep this helper pure, the route passes the
      // referenced list's filterTree via scope.filterTree.
      if (!scope.filterTree) {
        return {
          ok: false,
          error: "scope mode 'reference' with kind 'list' requires the referenced list's filterTree",
        };
      }
      const compiled = compileFilterTree(
        "districts",
        scope.filterTree,
        SCOPE_DISTRICT_ALIAS,
        params.length,
      );
      if (!compiled.ok) return { ok: false, error: `Scope: ${compiled.error}` };
      params.push(...compiled.params);
      return {
        ok: true,
        sql: `AND EXISTS (SELECT 1 FROM "districts" ${SCOPE_DISTRICT_ALIAS} WHERE ${SCOPE_DISTRICT_ALIAS}."leaid" = ${districtCol} AND ${compiled.whereSql})`,
      };
    }
    return { ok: false, error: `Unknown refKind: ${scope.refKind}` };
  }

  return { ok: false, error: `Unknown scope mode: ${(scope as { mode: string }).mode}` };
}

/**
 * Build the count + sample SQL for a preview request.
 *
 * The two SQL strings share the same params array — they pass it to the same
 * pg query call ordering.
 */
export function buildPreviewSql(
  source: SavedListSource,
  filterTree: FilterNode,
  scope: ScopeSpec,
  sampleLimit = 3,
): BuildPreviewResult {
  const tableInfo = SOURCE_TABLES[source];

  // Compile the primary filter first — its params come before any scope params.
  const compiled = compileFilterTree(source, filterTree, PRIMARY_ALIAS);
  if (!compiled.ok) return { ok: false, error: compiled.error };

  const params: unknown[] = [...compiled.params];

  const scopeResult = buildScopeClause(source, scope, params);
  if (!scopeResult.ok) return { ok: false, error: scopeResult.error };

  const limit = Math.max(1, Math.min(50, sampleLimit));
  const projection = buildSampleProjection(source);
  const orderBy = buildSampleOrderBy(source);
  const fromClause = `"${tableInfo.table}" ${PRIMARY_ALIAS}`;
  const whereClause = `WHERE ${compiled.whereSql} ${scopeResult.sql}`.trim();

  return {
    ok: true,
    sql: {
      countSql: `SELECT COUNT(*)::int AS count FROM ${fromClause} ${whereClause}`,
      sampleSql: `SELECT ${projection} FROM ${fromClause} ${whereClause} ORDER BY ${orderBy} LIMIT ${limit}`,
      params,
    },
  };
}
